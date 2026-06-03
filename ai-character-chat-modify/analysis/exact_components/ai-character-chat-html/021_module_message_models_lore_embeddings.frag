  function createMessageObj({threadId, message, characterId, hiddenFrom, variants, creationTime, expectsReply, memoryIdBatchesUsed, loreIdsUsed, summaryHashUsed, summariesUsed, summariesEndingHere, memoriesEndingHere, memoryQueriesUsed, messageIdsUsed, scene, avatar, name, customData, wrapperStyle, order, instruction}) {
    if(threadId === undefined || message === undefined || typeof characterId !== "number") throw new Error(`createMessageObj: threadId, message, and characterId are required: ${threadId}, ${message}, ${characterId}`);

    return {
      threadId,
      message,
      characterId,
      hiddenFrom: Array.isArray(hiddenFrom) ? hiddenFrom : [],
      expectsReply: expectsReply ?? undefined,
      creationTime: creationTime ?? Date.now(),
      variants: variants ?? [null], // null is the placeholder for the currently-selected variant (i.e. the one in the `message` property)
      memoryIdBatchesUsed: memoryIdBatchesUsed ?? [], // this is an array *of arrays* - each subarray is a contiguous sequence ("batch") of memories. it's just for "debugging" - i.e. to check character's brain is working properly via the brain button popup
      loreIdsUsed: loreIdsUsed ?? [],
      summaryHashUsed: summaryHashUsed ?? null,
      summariesUsed: summariesUsed ?? null,
      summariesEndingHere: summariesEndingHere ?? null,
      memoriesEndingHere: memoriesEndingHere ?? null, // an object like summariesEndingHere where keys are 'levels', and each value is an array of {text, embedding} objects, created during the summary/memory creation process
      memoryQueriesUsed: memoryQueriesUsed ?? [], // the memory/lore queries used to gather memories/lore as part of generating this message
      messageIdsUsed: messageIdsUsed ?? [],
      name: name ?? null,
      scene: scene ?? null,
      avatar: avatar ?? {},
      customData: customData ?? {},
      wrapperStyle: wrapperStyle ?? "",
      order: order ?? undefined,
      instruction: instruction ?? null,
      // RE `order` being undefined - this can happen if it's just being created (but not when e.g. being called from messagesFromCustomCodeFormat)
    };
  }

  async function addMessageToDb(messageObj, opts={}) {
    if(typeof messageObj.threadId !== "number") throw new Error(`invalid threadId=${messageObj.threadId} for message`);
    if(typeof messageObj.characterId !== "number") throw new Error(`invalid threadId=${messageObj.characterId} for message`);

    messageObj = structuredClone(messageObj);
    delete messageObj.character; // just in case I'm sloppy somewhere

    if(messageObj.order === undefined) {
      let messages = await db.messages.where({threadId:messageObj.threadId}).toArray();
      messages.sort((a,b) => a.order - b.order);
      messageObj.order = messages.length > 0 ? messages.at(-1).order + 1 : 0;
    }

    let id = await db.messages.add(messageObj);
    // update the thread's lastMessageTime.
    await db.threads.update(messageObj.threadId, { lastMessageTime: messageObj.creationTime });

    // if this thread isn't at the top of the thread list, re-render the thread list
    let threadId = messageObj.threadId;
    let thread = await db.threads.get(threadId);
    let threadElements = [...$.chatThreads.querySelectorAll(".thread")];
    if(threadElements.length > 0) { // TODO: this is stupid - addMessageToDb should not be referencing html stuff. this caused a bug where addMessageToDb was called before the HTML rendered which broke the page for a lot of users.
      if(!thread.isFav) threadElements = threadElements.filter(el => el.querySelector(".favStar").dataset.isFav==="false");
      if(threadElements[0].dataset.threadId !== threadId.toString()) {
        if(!opts.doNotReRenderThreadList) await renderThreadList();
      }
    }

    return id;
  }

  async function addThread(opts={}) {
    let {name, characterId} = opts;
    let threadCharacter = await db.characters.get(characterId);

    let modelName = threadCharacter.modelName;

    // get highest bookId value:
    let loreBookId = (await db.lore.orderBy("bookId").last() ?? ({bookId:-1})).bookId;

    // since a thread may have been assigned a lorebook id, but hasn't added any entries to it, we need to check if there's a higher loreBookId already assigned to a thread.
    // TODO: this may become an annoying cause of lag when creating a thread. Easy fix would just be to do some caching stuff.
    loreBookId = (await db.threads.toArray()).reduce((a,v) => v.loreBookId>a?v.loreBookId:a, loreBookId);

    loreBookId++;

    const defaultShortcutButtons = [
      {"name":"🗣️ {{char}}","message":"/ai <optional writing instruction>","insertionType":"replace","autoSend":false,"type":"message"},
      {"name":"🗣️ {{user}}","message":"/user <optional writing instruction>","insertionType":"replace","autoSend":false,"type":"message"},
      {"name":"🗣️ Narrator","message":"/nar <optional writing instruction>","insertionType":"replace","autoSend":false,"type":"message"},
      {"name":"🖼️ Image","message":"/image --num=3","insertionType":"replace","autoSend":true,"type":"message"},
    ];

    const threadObj = {
      name,
      characterId,
      creationTime: Date.now(),
      lastMessageTime: opts.lastMessageTime ?? Date.now(),
      lastViewTime: opts.lastViewTime ?? Date.now(),
      isFav: opts.isFav ?? false,
      // PERCHANCE EDIT: it doesn't make sense to "fix" the thread-specific user character *overrides* to the *global* defaults, so i'm commenting this out and fixing all the fallout
      // userCharacter: { // note: we don't use await getUserCharacterObj because that is for *existing* threads (requires threadId as input param)
      //   name: (await db.misc.get("userName"))?.value || defaultUserName,
      //   avatar: {
      //     url: (await db.misc.get("userAvatarUrl"))?.value || "",
      //     // we leave `shape` and `size` as thread default
      //   },
      // },
      userCharacter: opts.userCharacter ?? ({avatar:{}}), // thread-specific user character overrides
      // systemCharacter: {name:defaultSystemName, avatar:{}},
      systemCharacter: opts.systemCharacter ?? ({avatar:{}}), // PERCHANCE EDIT: see note above about userCharacter
      character: opts.character ?? ({avatar:{}}), // thread-specific ai character overrides
      modelName,
      customCodeWindow: {visible:false, width:null},
      customData: opts.customData ?? ({}),
      folderPath: opts.folderPath ?? "",
      loreBookId,
      textEmbeddingModelName: opts.textEmbeddingModelName ?? threadCharacter.textEmbeddingModelName,
      userMessagesSentHistory: opts.userMessagesSentHistory ?? [],
      unsentMessageText: opts.unsentMessageText ?? "",
      shortcutButtons: opts.shortcutButtons ?? (!threadCharacter.shortcutButtons || threadCharacter.shortcutButtons.length === 0 ? defaultShortcutButtons : threadCharacter.shortcutButtons),
      currentSummaryHashChain: [], // NOTE: This is no longer relevant in the new hierarchical summarization approach. But keeping this for backwards-compatibility.
    };

    await ensureLoreUrlsAreLoaded({loreBookUrls:threadCharacter.loreBookUrls, modelName:threadCharacter.textEmbeddingModelName}).catch(e => console.error(e));

    // PERCHANCE EDIT: See note above about userCharacter. Commenting these out.
    // when a thread is first created, we copy across the character's userCharacter as a starting point for the `thread.userCharacter` - after that, the `threadCharacter.userCharacter` is not relevant to the thread (i.e. thread's userCharacter can diverge from the character's 'template' userCharacter)
    // applyObjectOverrides({object:threadObj.userCharacter, overrides:threadCharacter.userCharacter});
    // same for systemCharacter
    // applyObjectOverrides({object:threadObj.systemCharacter, overrides:threadCharacter.systemCharacter});

    let id = await db.threads.add(threadObj);
    threadObj.id = id;
    return threadObj;
  }

  async function ensureLoreUrlsAreLoaded({loreBookUrls, modelName}) {
    let loadingModal = createLoadingModal("Downloading lore...");
    try {
      let urlI = 0;
      for(let url of loreBookUrls) {
        let downloadUrl;
        let origin = new URL(url).origin;
        if(origin.endsWith("jsdelivr.net")
          || (origin.endsWith("huggingface.co") && url.includes("/resolve/"))
          || origin === "https://raw.githubusercontent.com"
          || origin === "https://user-uploads.perchance.org"
          || origin === "https://user.uploads.dev"
        ) {
          // the server has correct CORS headers, so we don't need the proxy:
          downloadUrl = url;
        } else {
          downloadUrl = url; // since we're now using superFetch
        }
        let text;
        if(downloadUrl.endsWith(".gz")) {
          let blob = await root.superFetch(downloadUrl).then(r => r.blob());
          text = await root.decompressBlobWithGzip(blob).then(b => b.text());
        } else {
          text = await root.superFetch(downloadUrl).then(r => r.text());
        }

        let textFixed = text.replace(/\r/g, "").split("\n").map(line => line.trim() ? line : line.trim()).join("\n"); // fix some common problems - e.g. \r, and lines that appear blank but actually have some spaces/tabs

        let entryTextArr = textFixed.split(/\n{2,}/).map(entry => entry.trim()).filter(entry => entry);

        let textHashes = await Promise.all(entryTextArr.map(e => sha256Text(e)));
        let entries = entryTextArr.map((e, i) => ({
          text: e,
          textHash: textHashes[i],
          bookUrl: url,
          bookId: null,
          triggers: [],
        }));

        // Add embeddings to entries:
        let onProgressMessage = (data) => {
          window.lastKnownActivelyLoadingTime = Date.now();
          loadingModal.updateContent(`Adding lore entries (URL #${urlI})... ` + Math.round(data.progress * 100) + "%");
        };
        // Note that `embedTexts` will try to get embeddings from textEmbeddingCache first
        let embeddings = await embedTexts({textArr:entries.map(e => e.text), modelName, onProgressMessage, shouldCache:true});
        entries.forEach((e, i) => {
          e.embeddings = {[modelName]:embeddings[i]};
        });
        let textToEntry = new Map(entries.map(e => [e.text, e]));

        let entryTextsThatAreAlreadyInDb = new Set();
        await db.lore.where({bookUrl:url}).modify((entry, ref) => {
          if(!textToEntry.has(entry.text)) {
            delete ref.value; // delete this entry because it no longer exists as an entry in the text at this url
            return;
          }
          entryTextsThatAreAlreadyInDb.add(entry.text);
          if(!entry.embeddings[modelName]) { // <-- it's possible that the entry exists, but doesn't have an embedding for this model
            entry.embeddings[modelName] = textToEntry.get(entry.text).embeddings[modelName];
          }
        });

        let entriesToAdd = entries.filter(e => !entryTextsThatAreAlreadyInDb.has(e.text));
        for(let entry of entriesToAdd) {
          delete entry.textHash;
        }
        if(entriesToAdd.length > 0) {
          await db.lore.bulkAdd(entriesToAdd);
          console.log(`Added lore entries for ${url}:`, entriesToAdd);
        }
        urlI++;
      }
    } catch(e) {
      console.error("Error loading lore urls:", e);
      alert("Error loading lore urls: "+e);
    }
    loadingModal.delete();
  }

  let modelNameToTokenizerCache = {};
  let gpt3Tokenizer;
  async function getTokenizerByModelName(modelName) {
    if(modelNameToTokenizerCache[modelName]) return modelNameToTokenizerCache[modelName];

    if(!window.AutoTokenizer) {
      let { AutoTokenizer } = await import("https://cdn.jsdelivr.net/npm/@xenova/transformers@2.0.0-alpha.0/dist/transformers.js");
      window.AutoTokenizer = AutoTokenizer;
    }

    let tokenizer = await window.AutoTokenizer.from_pretrained(modelName); // returns data in this form: { data: [1, 15043, 3186], dims: [1, 3], size: 3, type: "int64" } where 'int64' ==> BigInt64
    function textToTokenIds(text) {
      return [...tokenizer(text).input_ids.data].map(n => Number(n)); // cast BigInt64 to Number
    }
    modelNameToTokenizerCache[modelName] = textToTokenIds;
    return textToTokenIds;
  }

  let messageHashToTokenCountCache = {};
  async function countTokensInMessages(messages, modelName) {
    let sum = 0;
    for(let messageText of messages.map(m => `\n\n[${m.name || m.role}]: ${m.content || m.message}`)) {
      let hash = await sha256Text(messageText);
      if(messageHashToTokenCountCache[hash] === undefined) {
        messageHashToTokenCountCache[hash] = countTokens(messageText);
      }
      sum += messageHashToTokenCountCache[hash];
    }
    return sum;
  }

  window.userHasInteractedWithPage = false;
  window.addEventListener("pointerdown", function() { // note: *cannot* use click event, because i use it programmatically during load
    window.userHasInteractedWithPage = true;
  });
  window.addEventListener("keydown", function() {
    window.userHasInteractedWithPage = true;
  });

  // workaround until env.backends.onnx.wasm.proxy NaN bug is fixed:
  (async function() {
    // this loads some heavy JS files, and it's low-priority (unlikely to be needed *immediately), so:

    // wait for page to finish loading fully:
    while(!window.finishedPageLoad && !window.haveTriedToEmbedText) await new Promise(r => setTimeout(r, 500));

    if(!window.haveTriedToEmbedText) {
      // wait a few more seconds to ensure it doesn't slow down initial page load
      let maxWaitMs = window.innerWidth<550 ? 3000 : 1500; // wait longer on mobile devices because they're slower
      let waitedMs = 0;
      while(1) {
        await new Promise(r => setTimeout(r, 300));
        waitedMs += 300;
        if(window.userHasInteractedWithPage) break;
        if(waitedMs > maxWaitMs) break;
      }
      await new Promise(r => setTimeout(r, 500));
    }

    let isLikelySafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    let isLikelyMobileOrTablet = window.innerWidth < 1100 && window.matchMedia("(pointer: coarse)").matches;
    if(!window.OffscreenCanvas && isLikelySafari && isLikelyMobileOrTablet) {
      console.warn("Old mobile Safari version detected. Not enabling lore/memory search due to the crash it causes.");
      return; // hackily detect old safari versions that crash when trying to load transformers.js - they'll have to go without lore/memory search.
    }

    let Comlink = await import("https://user.uploads.dev/file/429f4417069e11ed73a986e6efab065c.js").catch(console.error); // this is just an exact copy of https://unpkg.com/comlink@4.4.1/dist/esm/comlink.mjs
    if(!Comlink) Comlink = await import("https://unpkg.com/comlink@4.4.1/dist/esm/comlink.mjs").catch(console.error);

    // let worker = new Worker(URL.createObjectURL(new Blob([`importScripts("https://user.uploads.dev/file/fb599e745c0f1b1c78543c8aa228bf71.js");`], {type:"text/javascript"}))); // transformers.js v2.8.0
    // let worker = new Worker(URL.createObjectURL(new Blob([`importScripts("https://user.uploads.dev/file/7b296c17c954e25f2f5f72bd98e4a2b1.js");`], {type:"text/javascript"}))); // transformers.js v2.17.1
    let worker = new Worker(URL.createObjectURL(new Blob([`importScripts("https://unpkg.com/comlink@4.4.1/dist/umd/comlink.js");
      let extractors = {};
      async function loadModel(modelName) {
          if (!self.pipeline) {
            let { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1');
            env.allowLocalModels = false;
            self.pipeline = pipeline;
          }
          if (!extractors[modelName]) {
              extractors[modelName] = await pipeline('feature-extraction', modelName);
          }
      }
      async function extractFeatures(text, modelName) {
          await loadModel(modelName);
          const extractor = extractors[modelName];
          const result = await extractor(text, { pooling: 'mean', normalize: true });
          return result.data;
      }
      Comlink.expose({ extractFeatures });
    `], {type:"text/javascript"}))); // transformers.js v2.17.1
    let wrappedWorker = Comlink.wrap(worker);
    // load default model and 'warm it up':
    await wrappedWorker.extractFeatures("test 123", currentDefaultTextEmbeddingModelName);

    // You can test the function below by typing this in the browser console:
    // await window.textEmbedderFunction({textsToEmbed:[{text:"hello world"}], modelName:"Xenova/bge-base-en-v1.5"})

    window.textEmbedderFunction = async function({textsToEmbed, modelName}) {
      let data = [];
      for(let textObj of textsToEmbed) {
        let float32array = await wrappedWorker.extractFeatures(textObj.text, modelName);
        let embedding = [...float32array];
        embedding = embedding.map(n => Number((n).toFixed(4))); // remove some extraneous resolution to exports are 1/3 the size (embeddings take up most of the export space). Example of transformers.js embedding: [-0.004, 0.0281, 0.011, -0.0211, 0.0415, 0.0513, ...] vs same native embedding: [-0.028, 0.029, 0.012, -0.031, 0.031, 0.054, ...] - so as you can see by the huge differences, we definitely don't need to store 18 decimal places in the JSON exports
        data.push({embedding});
      }
      return {data};
    }
  })();

  window.embedTextWithLocalModel = async function embedTextWithLocalModel({textsToEmbed, modelName}) {
    window.haveTriedToEmbedText = true;
    if(!window.textEmbedderFunction) {
      let loadingModal = createLoadingModal("Loading memory/lore engine. Just a sec...");
      let secondsWaited = 0;
      while(!window.textEmbedderFunction) {
        await delay(1000);
        secondsWaited++;
        if(secondsWaited === 30) {
          alert("Hmm, this is taking a while. You might want to try refreshing the page, but it's possible that your web browser is buggy. If you wait another minute and it's still not working, please use the feedback to report which browser (e.g. Chrome, Firefox, etc) and device (e.g. iPhone or Android) you're using, and I'll try fix it. In the meantime, you can open the character editor, go to advanced settings, and disable character memories.");
          break;
        }
      }
      loadingModal.delete();
    }
    return window.textEmbedderFunction({textsToEmbed, modelName});
  }



  window.embedTexts = async function({textArr, modelName, onProgressMessage, shouldCache=false}={}) {
    // we need to return the embeddings in the same order despite our caching-retrieval process:
    let textsRemaining = textArr.slice(0).map((t, i) => ({text:t, order:i}));

    // try to get embeddings from cache.
    // first add text hashes:
    let textHashes = await Promise.all(textsRemaining.map(e => sha256Text(e.text)));
    textsRemaining.forEach((e, i) => e.textHash = textHashes[i]);
    // then get cached embeddings:
    let cachedEmbeddings = await db.textEmbeddingCache.where("textHash").anyOf(textHashes).toArray();
    cachedEmbeddings = cachedEmbeddings.filter(e => e.modelName === modelName);
    // then add cached embeddings to textsRemaining:
    let textHashToCachedEmbedding = {};
    cachedEmbeddings.forEach(e => textHashToCachedEmbedding[e.textHash] = e.embedding);
    textsRemaining.forEach(e => {
      if(textHashToCachedEmbedding[e.textHash]) {
        e.embedding = textHashToCachedEmbedding[e.textHash];
      }
    });

    let embeddings = textsRemaining.filter(e => e.embedding);
    textsRemaining = textsRemaining.filter(e => !e.embedding);

    // batch textArr into chunks (and increase chunk size until takes several hundred milliseconds per batch
    let chunkSize = 1;
    while(textsRemaining.length > 0) {
      let textsToEmbed = textsRemaining.splice(0, chunkSize);

      let startTime = performance.now();
      let result = await embedTextWithLocalModel({textsToEmbed, modelName});
      if(performance.now()-startTime < 200) {
        chunkSize *= 2;
        if(chunkSize > 100) chunkSize = 100; // sane maximum for memory considerations, etc.
      }
      if(!result.data) {
        alert("Error:\n" + JSON.stringify(result, null, 2));
        throw new Error("Error getting text embeddings");
      }
      let embeddingsForThisBatch = result.data.map((o, i) => {
        return {
          text: textsToEmbed[i].text,
          textHash: textsToEmbed[i].textHash,
          embedding: o.embedding,
          order: textsToEmbed[i].order,
          modelName,
          notFromCache: true,
        };
      });
      embeddings.push(...embeddingsForThisBatch);
      await new Promise(r => setTimeout(r, 2)); // just to be sure progress message renders
      if(onProgressMessage) onProgressMessage({progress:1-textsRemaining.length/textArr.length});
    }
    embeddings.sort((a,b) => a.order-b.order)
    let embeddingVectorsToReturn = embeddings.map(e => e.embedding);

    // add to cache:
    let alreadyGotTexts = new Set(); // just in case textArr contains duplicates
    let entriesToAddToCache = [];
    for(let entry of embeddings) {
      if(entry.notFromCache && !alreadyGotTexts.has(entry.text)) {
        delete entry.order;
        delete entry.notFromCache;
        entriesToAddToCache.push(entry);
        alreadyGotTexts.add(entry.text);
      }
    }
    if(shouldCache) {
      await db.textEmbeddingCache.bulkAdd(entriesToAddToCache);
    }

    if(onProgressMessage) onProgressMessage({progress:1});
    return embeddingVectorsToReturn;
  }


