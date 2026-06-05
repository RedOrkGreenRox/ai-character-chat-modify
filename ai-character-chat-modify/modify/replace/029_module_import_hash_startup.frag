  async function getCharacterHash(characterObj) {
    let char = structuredClone(characterObj);
    // debugger;
    delete char.id;
    delete char.creationTime;
    delete char.lastMessageTime;
    delete char.uuid;
    delete char.folderPath;

    // delete fields that have default values, and which are currently set to the default value / where falsy is default.
    if(!char.maxParagraphCountPerMessage) delete char.maxParagraphCountPerMessage;
    if(!char.imagePromptPrefix) delete char.imagePromptPrefix;
    if(!char.imagePromptSuffix) delete char.imagePromptSuffix;
    if(!char.imagePromptTriggers) delete char.imagePromptTriggers;
    if(!char.shortcutButtons) delete char.shortcutButtons;
    if(!char.metaDescription) delete char.metaDescription;
    if(!char.metaImage) delete char.metaImage;
    if(!char.metaTitle) delete char.metaTitle;
    if(!char.messageWrapperStyle) delete char.messageWrapperStyle;
    if(!char.customCode) delete char.customCode;
    // others:
    if(char.maxTokensPerMessage === 500) delete char.maxTokensPerMessage;
    if(char.temperature === 0.8) delete char.temperature;

    for(let key in char) {
      if(key.startsWith("$")) { // special `dexie-export-import` properties start with `$` (only exists in exported json data)
        delete char[key];
      }
    }
    let entries = Object.entries(char);
    entries.sort((a,b) => a[0].localeCompare(b[0]));
    let hash = await sha256Text(JSON.stringify(entries));
    return hash;
  }

  // import data if they click import button
  $.importDataFileInput.addEventListener("change", async function() {
    let file = $.importDataFileInput.files[0];

    let options = {keepExistingData:"yes"};

    if(!(file.type || "").startsWith("image/")) {
      options = await prompt2({
        keepExistingData: {label: "Keep existing data?", type: "select", options:[{value:"yes", content:"Yes, keep."}, {value:"no", content:"No, DELETE existing data."}], defaultValue: "yes"},
      }, {submitButtonText:"import data"});
    }

    if(!options) {
      $.importDataFileInput.value = "";
      return;
    }

    // warn about overwrite:
    if(options.keepExistingData === "no" && !confirm("Are you sure you want to DELETE all of your existing data? You should create an export of your data first! This cannot be undone.")) {
      $.importDataFileInput.value = "";
      return;
    }

    $.importDataFileInput.value = "";

    let loadingModal = createLoadingModal(`⏳ Importing data... <span class="importLoadingProgressIndicator"></span><br><span style="font-size:80%; opacity:0.6;">This could take a while if the file is large.</span>`);
    await delay(50); // give the loading modal a chance to render

    options.loadingModal = loadingModal;
    options.onProgress = ({message}) => {
      document.querySelector(".importLoadingProgressIndicator").textContent = message;
    };

    let success = false;
    try {
      if((file.name || "").endsWith(".cbor.gz") && await tryImportingRawDbExport(file, options).catch(e => "fail") === "finished") {
        success = true;
      } else if(await tryImportingDexieFile(file, options).catch(e => "fail") === "finished") {
        success = true;
      } else if(await tryImportingTavernAIThreadFile(file, options).catch(e => "fail") === "finished") {
        success = true;
      } else if(await tryImportingExternalCharacterFileFormat(file, options).catch(e => "fail") === "finished") {
        success = true;
      }
    } catch(e) {}

    try { loadingModal.delete(); } catch(e) { console.error(e); }

    if(!success) {
      console.error(`Invalid import format - tried all possibilities. file.type=${file.type}, file.name=${file.name}, file.size=${file.size}`);
      alert("Import failed. The file that you're importing doesn't seem to be a valid format, or something went wrong during import. If you think your file is valid, please report this as a bug using the feedback button.");
    }

  });

  async function* readTextBlobLineByLine(file) {
    const reader = file.stream().getReader();
    const decoder = new TextDecoder("utf-8");
    let { value: chunk, done: readerDone } = await reader.read();
    let buffer = '';

    while (!readerDone) {
      buffer += decoder.decode(chunk, { stream: true });
      let lines = buffer.split('\n');
      buffer = lines.pop();
      for (let line of lines) {
        yield line;
      }
      ({ value: chunk, done: readerDone } = await reader.read());
    }
    buffer += decoder.decode();
    if(buffer) {
      yield buffer;
    }
  }


  async function tryImportingRawDbExport(file, opts={}) {
    try {
      let cborBlob = await root.decompressBlobWithGzip(file);
      let cborBytes = new Uint8Array(await cborBlob.arrayBuffer());

      let CBOR = await import("https://user.uploads.dev/file/4cc84b2c503aad595e5c6e9fffe24602.js").then(r => r.default).catch(console.error);
      if(!CBOR) CBOR = await import(`https://user.uploads.dev/file/4cc84b2c503aad595e5c6e9fffe24602.js?v=${Math.random()}`).then(r => r.default).catch(console.error);
      if(!CBOR) CBOR = await import(URL.createObjectURL(await root.superFetch(`https://user.uploads.dev/file/4cc84b2c503aad595e5c6e9fffe24602.js`).then(r => r.blob()))).then(r => r.default).catch(console.error);
      if(!CBOR) { // no idea why the above aren't working for some people, final fallback:
        await import(`https://unpkg.com/cbor-x@1.6.0/dist/index.js`).catch(console.error); // adds it as a global
        CBOR = self.CBOR;
      }
      const data = CBOR.decode(cborBytes);

      if(data.meta?.type !== `ai-character-chat-db-raw-export-v1`) return "fail";
      if(data.meta?.dbName !== `chatbot-ui-v1`) return "fail";

      if((prompt("You're importing a 'raw' database export. ALL EXISTING DATA WILL BE DELETED if you import this file. Type 'yes' in the input box below to continue.\n\nIMPORTANT: You should backup your existing data first. And you should try importing this file into an incognito/private/guest browsing session first, to ensure it works fine.") || "").trim().toLowerCase() !== "yes") {
        alert("Aborting import, since you didn't type 'yes'.");
        return "finished";
      }



      try {

        // Add all items serially to prevent browser crash:
        let i = 0;
        let totalItems = Object.values(data.stores).filter(s => s).reduce((a,v) => a+v.length, 0);
        for (let [storeName, rows] of Object.entries(data.stores)) {
          if(!db[storeName]) continue; // maybe due to e.g. usageStats not existing anymore

          await db[storeName].clear();
          for(let item of (rows || [])) {
            await db[storeName].add(item);
            i++;
            if(i%100 === 0 && opts.onProgress) opts.onProgress({message:`${i}/${totalItems}`});
          }
        }

        await new Promise(r => setTimeout(r, 1000)); // just to be safe idk
        alert("Successfully imported raw database file. The page will now reload.");
        window.location.reload();
        return "finished"; // possibly needed since i don't think location.reload is instant (but idk, can't hurt anyway)

      } catch(e) {
        console.error(e);
        alert(`Importing raw db file failed: ${e.message}\n\Please use the feedback button to say what happened, and then ask for help on the forum.`);
        return "finished";
      }

    } catch(e) {
      console.error(e);
      return "fail";
    }
  }

  async function tryImportingDexieFile(file, options) {
    // backup existing data just in case this wrecks the db for some reason (used in catch block below):
    let originalDbJsonBlob;

    let singleThreadImportId = null;

    try {

      let json;
      let successReadingJsonAsDexie = false;
      // ACCM PATCH START: sniff gzip magic bytes because Perchance exports may be compressed while named *.json.
      let fileLooksGzipped = false;
      try {
        let headerBytes = new Uint8Array(await file.slice(0, 2).arrayBuffer());
        fileLooksGzipped = headerBytes.length >= 2 && headerBytes[0] === 0x1f && headerBytes[1] === 0x8b;
      } catch(e) {
        console.warn('Could not sniff imported file header:', e);
      }

      // NOTE: `file.type` may be misleading. Perchance exports can be gzip-compressed while still named *.json,
      // causing some browsers to report application/json. Sniff gzip magic bytes instead of trusting MIME alone.
      // ACCM PATCH END
      if(!successReadingJsonAsDexie && (file.type !== "application/json" || fileLooksGzipped)) {
        try {
          console.log("Decompressing blob...");
          let textBlob = await root.decompressBlobWithGzip(file);

          console.log("Reading decompressed blob as json...");
          try {
            json = JSON.parse(await textBlob.text());
          } catch(e) {
            console.error("Probably maximum string length error:", e);
          }
          // in case of maximum string length error, use this, which works around it (but seems to cause issues in safari, hence trying above approach first):
          if(!json) json = await new Response(textBlob).json();

          console.log("Got json from blob.");

          if(json.formatName !== "dexie") throw new Error("was gzip file, but not a dexie file");
          successReadingJsonAsDexie = true;
        } catch(e) {
          console.log("Imported blob was not a gziped dexie file.", e);
          // NOTE: we don't return here because there are subsequent attempts below
        }
      }

      if(!successReadingJsonAsDexie) {
        try {
          console.log("Reading imported blob as plain json.");
          json = await new Response(file).json(); // a hack to go straight from blob to json to avoid maximum string length errors
          if(!json.formatName && json.type === "application/json" && typeof json.uri === "string" && json.uri.startsWith("file:///")) {
            alert("The file you provided is invalid. It's likely you tried to upload it to Discord, or something like that, and instead of actually uploading the file itself, Discord uploaded a *reference* to the file. I'm not sure why Discord does this, but you might want to try a different method of transferring the file. To check if your file is valid, you can open it up with a text editor and check that it starts with: {\"formatName\":\"dexie\", ...");
            return "finished";
          }
          if(json.formatName !== "dexie") throw new Error("was uncompressed json file, but not a dexie file");
          successReadingJsonAsDexie = true;
        } catch(e) {
          console.log("Imported blob was not a plain json dexie file.");
          // NOTE: we don't return here because there are subsequent attempts below
        }
      }



      if(!successReadingJsonAsDexie) {
        if(json && typeof json.format === "string" && json.format.startsWith("perchance-ai-chat-v")) {
          alert(`Perchance has multiple AI chat interfaces (since anyone can build their own). You may be trying to load a save file in the wrong interface. You're currently using perchance.org/𝗮𝗶-𝗰𝗵𝗮𝗿𝗮𝗰𝘁𝗲𝗿-𝗰𝗵𝗮𝘁\n\n👉 perchance.org/ai-chat is another popular interface.`);
        }
        return "fail"; // it's not a dexie file
      }

      // if(!json) {
      //   console.error("This shouldn't happen.");
      //   json = await new Response(new Blob([file])).json();
      // }
      // let json = JSON.parse(await new Blob([file]).text());

      if(!json.data || !json.data.data) return "fail"; // it's not a dexie file

      // Pre-validation of crucial tables before doing any destructive operations (such as db.delete())
      let importedCharactersVal = json.data.data.find(d => d.tableName === "characters")?.rows;
      let importedThreadsVal = json.data.data.find(d => d.tableName === "threads")?.rows;
      let importedMessagesVal = json.data.data.find(d => d.tableName === "messages")?.rows;
      if (!importedCharactersVal || !importedThreadsVal || !importedMessagesVal) {
        alert("Import aborted: Crucial tables (characters, threads, or messages) are missing or corrupted in the import file.");
        return "fail";
      }

      if(options.keepExistingData === "no") {
        await db.delete();
        await db.open();
        // db = await Dexie.import(file); // this wasn't doing a version upgrade, and I'm not sure how to trigger it, so I'm just using the code below which was written for partial imports (but also works for full imports), and does the version upgrade manually
      } else {
        try {
          // originalDbJsonBlob = await db.export({prettyJson:true, numRowsPerChunk:100});
          console.log("Doing safety export before importing...");
          originalDbJsonBlob = await db.export({});
          console.log("Finished safety export.");
        } catch(e) {
          console.error("Pre-import backup error:", e);
          alert(`There was an error while trying to do a pre-import backup of your existing data: ${e.message}\n\nYour existing data may be corrupt for some reason. Please also report this bug using the feedback button. In the meantime, one thing you could try is to export your prized chat threads and characters one-by-one, and then delete all your current data and then retry this import.`);
          return;
        }
      }

      // TODO: I should probably convert IDs to UUIDs so I don't need to do this sort of thing, but this is fine for now. Note: If you do this, you need to update the export modal because it currently uses comma-separated IDs

      // we need to re-number all ids in the imported data to be higher than the current max ids.

      // get current maximum id for each table
      let maxThreadId = (await db.threads.orderBy("id").last())?.id ?? -1;
      let maxMessageId = (await db.messages.orderBy("id").last())?.id ?? -1;
      let maxCharacterId = (await db.characters.orderBy("id").last())?.id ?? -1;
      let maxMemoryId = (await db.memories.orderBy("id").last())?.id ?? -1;
      let maxLoreId = (await db.lore.orderBy("id").last())?.id ?? -1;
      let maxLoreBookId = (await db.lore.orderBy("bookId").last())?.bookId ?? -1;
      // note: summaries don't have an id (we index by hash), so we don't need to re-number their ids (but note that we do need to renumber their thread ids to match the new thread ids)

      let importedCharacters = json.data.data.find(d => d.tableName === "characters").rows;
      let importedThreads = json.data.data.find(d => d.tableName === "threads").rows;
      let importedMessages = json.data.data.find(d => d.tableName === "messages").rows;
      let importedUsageStats = json.data.data.find(d => d.tableName === "usageStats")?.rows;
      let importedMemories = json.data.data.find(d => d.tableName === "memories")?.rows;
      let importedLore = json.data.data.find(d => d.tableName === "lore")?.rows;
      let importedTextCompressionCacheEntries = json.data.data.find(d => d.tableName === "textCompressionCache")?.rows;

      // we use a hierarchical summary system now which stores summaries within message.summariesEndingHere, so we don't need these:
      let oldSummaries = json.data.data.find(d => d.tableName === "summaries")?.rows;
      if(oldSummaries) {
        json.data.data.find(d => d.tableName === "summaries").rows = [];
      }

      const existingCharacters = await db.characters.toArray();

      // hash existing characters, and new characters, so we can map ids of new characters to ones that may already exist
      let existingCharacterHashToId = {};
      let newCharacterIdToHash = {};
      for(let character of existingCharacters) {
        let hash = await getCharacterHash(character);
        existingCharacterHashToId[hash] = character.id;
      }
      for(let character of importedCharacters) {
        let hash = await getCharacterHash(character);
        newCharacterIdToHash[character.id] = hash;
      }

      // old id -> new id maps
      let characterIdMap = {};
      let threadIdMap = {};
      let messageIdMap = {};
      let summaryIdMap = {};
      let memoryIdMap = {};
      let loreIdMap = {};
      let loreBookIdMap = {};

      let charactersThatWeAlreadyHave = [];

      // re-number character ids
      for(let character of importedCharacters) {
        let existingCharacterId = existingCharacterHashToId[newCharacterIdToHash[character.id]];
        if(existingCharacterId !== undefined) {
          characterIdMap[character.id] = existingCharacterId;
          charactersThatWeAlreadyHave.push(character);
          continue;
        }
        // no existing character with this hash, so we need to create a new entry:
        maxCharacterId++;
        characterIdMap[character.id] = maxCharacterId;
        character.id = maxCharacterId;
      }

      // remove all the `charactersThatWeAlreadyHave` characters from the `importedCharacters`, since we don't need to import them:
      importedCharacters = importedCharacters.filter(c => !charactersThatWeAlreadyHave.includes(c));

      // re-number thread stuff
      for(let thread of importedThreads) {
        maxThreadId++;
        threadIdMap[thread.id] = maxThreadId;
        thread.id = maxThreadId;
        // re-number character id of each thread
        thread.characterId = characterIdMap[thread.characterId];
        // re-number currentReplyAsCharacterId
        if(thread.currentReplyAsCharacterId !== undefined && thread.currentReplyAsCharacterId >= 0) {
          thread.currentReplyAsCharacterId = characterIdMap[thread.currentReplyAsCharacterId] ?? -1;
        }
        // re-number shortcutButtons
        for(let button of (thread.shortcutButtons || [])) {
          button.message = button.message.trimStart().replace(/^(\/[a-zA-Z]+ @[^ ]+#)([0-9]+)/, (m, p1, p2) => {
            let id = Number(p2);
            return p1 + (characterIdMap[id] ?? -2);
          });
        }
      }

      if(importedLore) {
        // re-number lore ids
        for(let entry of importedLore) {
          maxLoreId++;
          loreIdMap[entry.id] = maxLoreId;
          entry.id = maxLoreId;
        }
        for(let message of importedMessages) {
          message.loreIdsUsed = message.loreIdsUsed.map(id => loreIdMap[id]);
        }

        // re-number lore bookIds
        for(let thread of importedThreads) {
          if(loreBookIdMap[thread.loreBookId] === undefined) {
            maxLoreBookId++;
            loreBookIdMap[thread.loreBookId] = maxLoreBookId;
          }
          thread.loreBookId = loreBookIdMap[thread.loreBookId];
        }
        for(let entry of importedLore) {
          if(typeof entry.bookId == "number") { // <-- bookId is null for bookUrl-based entries
            entry.bookId = loreBookIdMap[entry.bookId];
          }
        }
      }

      let importedThreadIdToCharacterId = {};
      for(let thread of importedThreads) {
        importedThreadIdToCharacterId[thread.id] = thread.characterId;
      }

      // re-number message ids
      for(let message of importedMessages) {
        maxMessageId++;
        messageIdMap[message.id] = maxMessageId;
        message.id = maxMessageId;
        // re-number thread id of each message
        message.threadId = threadIdMap[message.threadId];
        // re-number author/character id of each message
        if(message.characterId >= 0) { // remember, user messages have characterId = -1, and system messages have characterId = -2
          message.characterId = characterIdMap[message.characterId];
          if(message.characterId === undefined) { // this is possible due to an old bug in safelyDeleteCharacterById where I wasn't updating the characterId of messages in threads where the deleted character was included in a thread via `/ai @CharName#123` rather than actually being the main character of the thread.
            message.characterId = importedThreadIdToCharacterId[message.threadId]; // just set the ID to the characterId of the thread's main character
          }
        }
      }

      // re-number memory ids
      if(importedMemories) {
        for(let memory of importedMemories) {
          maxMemoryId++;
          memoryIdMap[memory.id] = maxMemoryId;
          memory.id = maxMemoryId;
        }
      }

      // re-number message.memoryIdBatchesUsed
      for(let message of importedMessages) {
        // WARNING: for whatever reason, dexie complains if we try to change/remove message.memoryIdBatchesUsed so we don't touch any old format stuff
        if(Array.isArray(message.memoryIdBatchesUsed) && message.memoryIdBatchesUsed.length > 0) { // <-- old exports won't have this
          if(message.memoryIdBatchesUsed.flat().some(a => typeof a === "number")) {
            // old memory id (integer) data format
            message.memoryIdBatchesUsed = message.memoryIdBatchesUsed.map(b => b.map(id => id === null ? null : memoryIdMap[id]));
          } else if(message.memoryIdBatchesUsed.flat().some(a => typeof a === "string")) {
            // new `${messageId}|${level}|${indexWithinLevel}` string format
            message.memoryIdBatchesUsed = message.memoryIdBatchesUsed.map(b => b.map(idStr => {
              if(idStr === null) return null; // probably not needed, but just in case there are places in the code where we do the old thing of setting to null if a memory has been deleted
              let messageId = Number(idStr.split("|")[0]);
              // note that we use the *messageIdMap*, NOT the memoryIdMap:
              return messageIdMap[messageId] + "|" + idStr.split("|").slice(1).join("|");
            }));
          } else {
            message.memoryIdBatchesUsed = message.memoryIdBatchesUsed;
          }
        }
      }
      // (note: we don't need to do the same as above for summaryHashUsed since it obviously uses a hash instead of an id)

      // re-number message.messageIdsUsed
      for(let message of importedMessages) {
        if(message.messageIdsUsed) { // <-- old exports won't have this
          message.messageIdsUsed = message.messageIdsUsed.map(id => id === -1 ? -1 : messageIdMap[id]);
        }
      }

      if(importedUsageStats) {
        // convert old usageStats thread and character ids to new ones
        for(let entry of importedUsageStats) {
          entry.threadId = threadIdMap[entry.threadId];
          entry.characterId = characterIdMap[entry.characterId];
        }
      }

      if(importedMemories) {
        for(let memory of importedMemories) {
          memory.threadId = threadIdMap[memory.threadId];
          memory.characterId = characterIdMap[memory.characterId];
        }
      }

      if(importedTextCompressionCacheEntries) {

        let existingEntries = await db.textCompressionCache.toArray();
        let alreadyGotEntryKeys = new Set(existingEntries.map(entry => entry.uncompressedTextHash + "-<<-|->>-" + entry.modelName + "-<<-|->>-" + entry.tokenLimit));

        for(let entry of importedTextCompressionCacheEntries) {
          entry.threadId = threadIdMap[entry.threadId];
          let uniqueKey = entry.uncompressedTextHash + "-<<-|->>-" + entry.modelName + "-<<-|->>-" + entry.tokenLimit;
          if(alreadyGotEntryKeys.has(uniqueKey)) {
            entry.__shouldRemove = true;
          } else {
            alreadyGotEntryKeys.add(uniqueKey);
          }
        }
        importedTextCompressionCacheEntries = importedTextCompressionCacheEntries.filter(entry => !entry.__shouldRemove);
      }

      // if there's just one thread, then we assume it was from a single-thread export
      // and in that case we probably don't want isFav to persist, and we also probably
      // want that thread to be at the top - i.e. lastMessageTime = now
      if(importedThreads.length === 1) {
        importedThreads[0].isFav = false;
        importedThreads[0].lastViewTime = Date.now();
        importedThreads[0].lastMessageTime = Date.now();
        singleThreadImportId = importedThreads[0].id;
      }


      // UPGRADES:
      // TODO: shouldn't dexie's .upgrade function handle this? doesn't seem to be doing it. check again - I could be wrong.
      for(let character of importedCharacters) {
        upgradeCharacterFromOldVersion(character);
      }
      let allCharacters = [...existingCharacters, ...importedCharacters];
      for(let thread of importedThreads) {
        await upgradeThreadFromOldVersion(thread, {characters:allCharacters});
      }
      for(let message of importedMessages) {
        upgradeMessageFromOldVersion(message);
      }
      if(importedUsageStats) {
        importedUsageStats = importedUsageStats.filter(entry => entry.threadId !== undefined);
      }
      // if(importedSummaries) {
      //   importedSummaries = importedSummaries.filter(entry => entry.messageIds !== undefined);
      // }
      let loreEntriesToAddAfterImport = [];
      if(importedMemories) {
        let userWrittenMemories = importedMemories.filter(m => m.type === "user-written");
        if(userWrittenMemories.length > 0) {
          for(let m of userWrittenMemories) {
            if(importedLore) {
              maxLoreId++;
              importedLore.push({ id:maxLoreId, bookId:m.threadId, text:m.text, embedding:m.embedding, triggers:[] });
            } else {
              loreEntriesToAddAfterImport.push({ bookId:m.threadId, text:m.text, embedding:m.embedding, triggers:[] });
            }
          }
          importedMemories = importedMemories.filter(m => m.type !== "user-written");
        }

        let memoryIdToIndexMap = createMemoryIdToIndexMapForIncorrectlyIndexedOrUnindexedMemories(importedMemories);
        for(let memory of importedMemories) {
          let opts = {};
          if(memoryIdToIndexMap[memory.id] !== undefined) opts.index = memoryIdToIndexMap[memory.id];
          upgradeMemoryFromOldVersion(memory, opts);
        }
      }
      if(importedLore) {
        for(let entry of importedLore) {
          upgradeLoreFromOldVersion(entry);
        }
      }
      for(let entry of loreEntriesToAddAfterImport) {
        upgradeLoreFromOldVersion(entry);
      }

      if(json.data.data.find(d => d.tableName === "textEmbeddingCache")) {
        let existingEntries = await db.textEmbeddingCache.toArray();
        let entries = json.data.data.find(d => d.tableName === "textEmbeddingCache").rows;
        for(let e of entries) {
          delete e.id;
        }
        // remove duplicate embeddings (duplicates were possible in older versions of the app, but are now disallowed)
        let seen = new Set(existingEntries.map(entry => entry.textHash + "-<<-|->>-" + entry.modelName));
        entries = entries.filter(entry => {
          let key = entry.textHash + "-<<-|->>-" + entry.modelName;
          if(seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        json.data.data.find(d => d.tableName === "textEmbeddingCache").rows = entries;
      }


      json.data.data.find(d => d.tableName === "characters").rows = importedCharacters;
      json.data.data.find(d => d.tableName === "threads").rows = importedThreads;
      json.data.data.find(d => d.tableName === "messages").rows = importedMessages;
      // if(importedSummaries) {
      //   json.data.data.find(d => d.tableName === "summaries").rows = importedSummaries;
      // }
      if(importedUsageStats) {
        json.data.data.find(d => d.tableName === "usageStats").rows = importedUsageStats;
      }
      if(importedMemories) {
        json.data.data.find(d => d.tableName === "memories").rows = importedMemories;
      }
      if(importedLore) {
        json.data.data.find(d => d.tableName === "lore").rows = importedLore;
      }
      if(importedTextCompressionCacheEntries) {
        json.data.data.find(d => d.tableName === "textCompressionCache").rows = importedTextCompressionCacheEntries;
      }

      // delete old apiUsage table/data
      json.data.data = json.data.data.filter(d => d.tableName !== "apiUsage");
      json.data.tables = json.data.tables.filter(d => d.name !== "apiUsage");

      // check which misc keys user already has, and remove them from the misc table that we're importing:
      let existingMiscKeys = (await db.misc.toArray()).map(m => m.key);
      let miscData = json.data.data.find(d => d.tableName === "misc");
      miscData.rows = miscData.rows.filter(m => !existingMiscKeys.includes(m.key));

      // convert json back to blob and import
      // let blob = new Blob([JSON.stringify(json)], {type: "application/json"});
      let jsonToBlobStartTime = performance.now();
      let blob = jsonToBlob(json);
      console.log(`jsonToBlob took ${performance.now()-jsonToBlobStartTime}ms`);

      let dbImportStartTime = performance.now();
      console.log("Starting db.import(blob)...");
      await db.import(blob, {acceptVersionDiff:true, acceptMissingTables:true});
      console.log(`Finished db.import(blob) - took ${performance.now()-dbImportStartTime}ms`);
      if(loreEntriesToAddAfterImport.length > 0) {
        await db.lore.bulkAdd(loreEntriesToAddAfterImport); // we add these after import because there was no 'lore' table in the original JSON
      }

      // instead of importing the whole textEmbeddingCache, we just import the ones that are currently attached to memories/lore, which helpfully cleans out any unused entries in the cache
      {
        let importedMemoriesAndLore = [...(importedLore || []), ...(importedMemories || [])];
        let importedMemoryAndLoreTextHashes = await Promise.all(importedMemoriesAndLore.map(entry => sha256Text(entry.text)));
        let textEmbeddingsToAddToCache = [];
        for(let i = 0; i < importedMemoriesAndLore.length; i++) {
          for(let modelName of Object.keys(importedMemoriesAndLore[i].embeddings)) {
            textEmbeddingsToAddToCache.push({
              text: importedMemoriesAndLore[i].text,
              textHash: importedMemoryAndLoreTextHashes[i],
              modelName: modelName,
              embedding: importedMemoriesAndLore[i].embeddings[modelName],
            });
          }
        }
        let alreadyGotEmbeddings = await db.textEmbeddingCache.toArray();
        let alreadyGotTextHashModelNamePairs = new Set(alreadyGotEmbeddings.map(e => `${e.textHash}-<<-|->>-${e.modelName}`));

        textEmbeddingsToAddToCache = textEmbeddingsToAddToCache.filter(e => {
          let keep = !alreadyGotTextHashModelNamePairs.has(`${e.textHash}-<<-|->>-${e.modelName}`);
          alreadyGotTextHashModelNamePairs.add(`${e.textHash}-<<-|->>-${e.modelName}`);
          return keep;
        });
        await db.textEmbeddingCache.bulkAdd(textEmbeddingsToAddToCache).catch(e => {
          console.error("Something went wrong while adding text embeddings to cache. Not a critical error, but does indicate a bug in above code:", e);
        });
      }

      // TODO: should probably update the lastMessageTime of each charactersThatWeAlreadyHave to be the time of their last message, since this could be wrong now

    } catch(e) {
      console.error("tryImportingDexieFile import error:", e);
      if(e.message.toLowerCase().includes("i/o read operation")) {
        alert(`There was an error while trying to import the file. Your original data will be downloaded as a backup in case of data corruption. If you're using Safari, this is likely due to a bug in the browser. Please try switching to the Chrome browser, which generally has fewer bugs, and better performance.`);
      } else {
        alert(`There was an error importing your data. Your original data will be downloaded as a backup in case of data corruption. Please share this error message using the feedback button:\n\n${e.message}\n\n${e.stack}`);
      }
      await delay(1000);
      let yyyymmdd = new Date().toISOString().split("T")[0];
      if(originalDbJsonBlob) {
        try { downloadTextOrBlob(originalDbJsonBlob, `perchance-export-${yyyymmdd}.json`); } catch(e) { console.error(e); }
      }
      return "fail";
    }

    try { options.loadingModal.delete(); } catch(e) { console.error(e); }

    await renderCharacterList(); // <-- in case they're currently on the character screen
    await renderThreadList();
    console.log("Finished renderThreadList after import");
    if(singleThreadImportId !== null) {
      await showThread(singleThreadImportId);
    }
    return "finished";
  }

  function base64DecodeUnicode(str) {
    // Convert Base64 to binary string
    const binaryString = atob(str);
    // Convert binary string to UTF-8 encoded string
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }


  async function tryImportingExternalCharacterFileFormat(file, options={}) {
    try { if(file instanceof Blob) file = new File([file], `fake_name.${file.type.split("/")[1]}`); } catch(e) { console.error(e); }

    let text;
    let json;
    try {
      text = await new Blob([file]).text();
      json = JSON.parse(text);
    } catch(e) {}

    if(!json && file.name?.endsWith(".json")) return "fail";

    // wasn't a json file - try parsing as webp/png
    if(!json) {
      try {
        let loadingModal = createLoadingModal("Loading parser...");
        let ExifReader = await import('https://cdn.jsdelivr.net/npm/exifreader@4.12.0/+esm');
        loadingModal.delete();
        let tags = await ExifReader.load(file);
        if(tags.chara || tags.UserComment) {
          if(!window.JSON5) await delay(7000);
          if(!window.JSON5) alert("For some reason your browser didn't load 'JSON5' properly, which is required for importing. Please report this issue via the feedback button, including the web browser and device you're using. You can try refreshing the page to see if that helps.");
        }
        if(tags.chara) {
          json = window.JSON5.parse(base64DecodeUnicode(tags.chara.value));
        } else if(tags.UserComment) {
          json = window.JSON5.parse(tags.UserComment.value[0]);
        }
        // convert `file` to a data URL:
        // let reader = new FileReader();
        // let dataUrl = await new Promise((resolve, reject) => {
        //   reader.onload = () => resolve(reader.result);
        //   reader.onerror = reject;
        //   reader.readAsDataURL(file);
        // });

        // convert image to jpeg data URL for avatar:
        let dataUrl;
        try {
          // let bitmap = await createImageBitmap(file);
          // let canvas = document.createElement('canvas');
          // canvas.width = bitmap.width;
          // canvas.height = bitmap.height;
          // let ctx = canvas.getContext('2d');
          // ctx.drawImage(bitmap, 0, 0);
          // dataUrl = canvas.toDataURL('image/jpeg');
          let bitmap = await createImageBitmap(file);
          let canvas = document.createElement('canvas');
          const maxSize = 768;
          let width = bitmap.width;
          let height = bitmap.height;
          if(width > maxSize || height > maxSize) {
            if (width > height) {
              height *= maxSize / width;
              width = maxSize;
            } else {
              width *= maxSize / height;
              height = maxSize;
            }
          }
          canvas.width = width;
          canvas.height = height;
          let ctx = canvas.getContext('2d');
          ctx.drawImage(bitmap, 0, 0, width, height);
          dataUrl = canvas.toDataURL('image/jpeg');
        } catch(e) { console.error(e); }

        if(dataUrl) {
          if(json.data) {
            if(!json.data.avatar || json.data.avatar === "none") {
              json.data.avatar = dataUrl;
            }
          } else {
            if(!json.avatar || json.avatar === "none") {
              json.avatar = dataUrl;
            }
          }
        }
      } catch(e) {
        console.error(e);
        return "fail";
      }
    }

    if(!json) return "fail";

    if(options.keepExistingData === "no") {
      if(!confirm("You're importing an external character format, but you've requested that all existing data be deleted. This is not currently supported when importing external formats. Existing data will NOT be deleted.")) {
        return "finished";
      }
    }

    try { if(options.loadingModal) { options.loadingModal.delete(); } } catch(e) { console.error(e); }

    let character = {avatar:{}};

    // tavern/pyg/text-gen:
    if(json.name || json.char_name || json.data?.name) {
      let name = json.name ?? json.char_name ?? json.data?.name;
      if(!name || typeof name !== "string") name = "Unnamed";

      if(json.char_persona === "undefined undefined") json.char_persona = "";

      let personality = json.personality ?? json.char_persona ?? json.data?.personality ?? null;
      let description = json.description ?? json.data?.description ?? null;
      let firstAIMessage = json.char_greeting ?? json.first_mes ?? json.data?.first_mes ?? json.data?.alternate_greetings?.[0] ?? null;
      let exampleDialogue = json.example_dialogue ?? json.mes_example ?? json.data?.mes_example ?? ""
      let scenario = json.scenario ?? json.world_scenario ?? json.data?.scenario ?? "";
      let avatarUrl;
      if(json.data) {
        avatarUrl = json.data.avatar === undefined || json.data.avatar === "none" || json.data.avatar === "" ? "" : json.data.avatar;
      } else {
        avatarUrl = json.avatar === undefined || json.avatar === "none" || json.avatar === "" ? "" : json.avatar;
      }


      let exampleDialogueChunks = [];
      if(exampleDialogue) {
        if(exampleDialogue.includes("<START>")) {
          exampleDialogueChunks = exampleDialogue.split("<START>").map(c => c.trim()).filter(c => c);
        } else {
          exampleDialogueChunks = [exampleDialogue];
        }
      }

      let roleInstructionChunks = [];
      if(description) description = description.trim().replace(/^<p><span style="[^"]+">(.+)<\/span><\/p>$/, "$1");
      if(description) roleInstructionChunks.push(`# Description of {{char}}:\n${description}`);
      if(personality) roleInstructionChunks.push(`# {{char}}'s Personality:\n${personality}`);

      character.name = name;
      character.avatar.url = avatarUrl;
      character.roleInstruction = roleInstructionChunks.join("\n\n");
      character.initialMessages = [];
      if(exampleDialogueChunks.length > 0) character.initialMessages.push({author:"system", content:`# Example Dialogue:\n${exampleDialogueChunks.map(c => `---start example---\n${c}\n---end example---`).join("\n\n")}`, hiddenFrom:["user"]});
      if(scenario) character.initialMessages.push({author:"system", content:"Scenario: "+scenario});
      if(firstAIMessage) character.initialMessages.push({author:"ai", content:firstAIMessage});
    } else if(json.character?.name) {
      character.name = json.character.name;
      let roleInstructionChunks = [];
      if(json.character.title) roleInstructionChunks.push(`# Title:\n${json.character.title}`);
      if(json.character.description) roleInstructionChunks.push(`# Description of ${character.name}:\n${json.character.description}`);
      if(json.character.definition) roleInstructionChunks.push(`# Character Definition:\n${json.character.definition}`);
      character.roleInstruction = roleInstructionChunks.join("\n\n");
      character.initialMessages = [{author:"ai", content:json.character.greeting}];
      character.avatar.url = "https://characterai.io/i/400/static/avatars/"+json.character.avatar_file_name;
    } else {
      return "fail";
    }

    if(json.data?.character_book?.entries?.length > 0) {
      let loadingModal = createLoadingModal("Loading character's lorebook...");
      try {
        let loreText = json.data.character_book.entries.map(e => e.content.replace(/^-+/, "").trim().replace(/\n+/g, "\n").slice(0, 5000)).join("\n\n");
        let blob = await fetch("data:text/plain;charset=utf-8,"+loreText.replace(/#/g, "%23")).then(res => res.blob());
        let compressedBlob = await root.compressBlobWithGzip(blob);
        let { url, size, error } = await root.uploadPlugin(compressedBlob);
        if(error) {
          throw new Error(error);
        } else {
          if(!character.loreBookUrls) character.loreBookUrls = [];
          character.loreBookUrls.push(url);
        }
      } catch(e) {
        console.error(e);
        alert("Your character has been created, but there was an issue loading the character's lorebook: "+e.message);
      }
      loadingModal.delete();
    }

    let result = await characterDetailsPrompt(character);
    if(result) {
      const character = await addCharacter(result);
      await createNewThreadWithCharacterId(character.id);
    }

    return "finished";
  }

  async function tryImportingTavernAIThreadFile(file, options) {
    let text = await new Blob([file]).text();
    // parse text as jsonl format (lines are json objects):
    let jsonl = text.trim().split("\n").map(line => JSON.parse(line));
    // check if it's jsonl format:
    if(!jsonl.every(obj => typeof obj === "object" && obj !== null)) {
      return "fail";
    }
    // check if it's TavernAI thread format (first line is header/meta):
    let seemsValid = jsonl[0].user_name!==undefined && jsonl[0].character_name!==undefined && jsonl[0].create_date!==undefined && jsonl.slice(1).every(m => m.name!==undefined && m.is_user!==undefined && m.mes!==undefined && m.send_date!==undefined);
    if(!seemsValid) {
      return "fail";
    }

    if(options.keepExistingData === "no") {
      if(!confirm("You're importing a TavernAI thread, but you've requested that all existing data be deleted. This is not supported when importing TavernAI threads. Existing data will NOT be deleted.")) {
        return "finished";
      }
    }

    try { options.loadingModal.delete(); } catch(e) { console.error(e); }

    // if so, ask user which character it corresponds to, and then add it as a thread
    const characters = await db.characters.orderBy("lastMessageTime").reverse().toArray();
    let tavernOptions = await prompt2({
      characterId: {label: "You're importing a TavernAI thread. Choose the character for this thread. If you haven't created/imported it yet, you should click cancel and do that first.", type: "select", options:characters.map(c => ({content:`${c.name} #${c.id}`, value:c.id}))},
    }, {submitButtonText:"submit"});
    if(!tavernOptions) {
      return "finished";
    }
    tavernOptions.characterId = parseInt(tavernOptions.characterId);
    let character = await db.characters.get(tavernOptions.characterId);
    let thread = await addThread({name:defaultThreadName, characterId:character.id});
    for(let m of jsonl.slice(1)) {
      let characterId;
      if(m.is_user) characterId = -1;
      else characterId = character.id;
      let data = {threadId:thread.id, message:m.mes, characterId, creationTime:m.send_date};
      let messageObj = createMessageObj(data);
      await addMessageToDb(messageObj)
    }
    await renderThreadList();
    await showThread(thread.id);
    return "finished";
  }

  // parse url hash as json
  let ignoreHashChange = false;
  function handleInvalidCharacterShareLink(error) {
    console.error("Invalid character share link:", error);
    ignoreHashChange = true;
    window.location.hash = "#";
    setTimeout(() => ignoreHashChange = false, 0);
    alert("This character share link is invalid or corrupted, so it couldn't be loaded.");
    return null;
  }
  async function checkForHashCommand() {
    const urlHash = window.location.hash.slice(1);
    let searchParams = new URL(window.location.href).searchParams;
    // PERCHANCE EDIT:
    let urlHashJson = {};
    if(urlHash || window.location.search) {
      try {
        if(urlHash.startsWith("%7B%22")) {
          urlHashJson = JSON.parse(decodeURIComponent(urlHash));
        } else if(searchParams.get("char")) {
          if(!searchParams.get("char").endsWith(".gz") && !(root.urlNamedCharacters[searchParams.get("char")] || "").endsWith(".gz")) {
            urlHashJson = starterCharacters.filter(o => o._charUrlId === searchParams.get("char"))[0];
            if(urlHashJson) urlHashJson = {addCharacter:urlHashJson, quickAdd:true};
            else urlHashJson = {};
          } else {
            urlHashJson = await root.loadDataFromUrlThatReferencesCloudStorageFile() ?? {};
          }
        } else if(window.location.search.includes("?data=") || window.location.search.includes("&data=")) {
          urlHashJson = await root.loadDataFromUrlThatReferencesCloudStorageFile() ?? {};
        }
      } catch(error) {
        if(urlHash.startsWith("%7B%22")) {
          return handleInvalidCharacterShareLink(error);
        } else {
          throw error;
        }
      }
    }
    if(urlHashJson.addCharacter) {
      initialPageLoadingModal.style.display = "none";
      $.main.style.visibility = "visible";

      $.newThreadButton.click();
      let character = urlHashJson.addCharacter;

      // UPGRADES (should be the same as the dexie db.upgrade code):
      upgradeCharacterFromOldVersion(character);

      let uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
      if(character.uuid && !uuidRegex.test(character.uuid)) {
        alert("The character you're trying to load has an invalid UUID. It will be imported without a UUID. Please see correct UUID format here:\n\nhttps://en.wikipedia.org/wiki/Universally_unique_identifier");
        delete character.uuid;
      }

      let existingCharacters = await db.characters.toArray();

      let thereIsAnExistingCharacterWithTheSameName = false;
      if(existingCharacters.find(c => c.name === character.name)) {
        thereIsAnExistingCharacterWithTheSameName = true;
      }

      let existingVerySimilarCharacter = existingCharacters.find(c => (c.name??"")===(character.name??"") && (c.roleInstruction??"")===(character.roleInstruction??"") && (c.reminderMessage??"")===(character.reminderMessage??"") && (c.customCode??"")===(character.customCode??"") && (c.messageWrapperStyle??"")===(character.messageWrapperStyle??"") && (c.avatar?.url??"")===(character.avatar?.url??""));

      if(existingVerySimilarCharacter) {
        // if name and description match, just use the existing character (show latest chat, or create a new chat if none exist)
        let mostRecentThreadWithThisChar = (await db.threads.where("characterId").equals(existingVerySimilarCharacter.id).toArray()).sort((a,b) => b.creationTime-a.creationTime)[0];
        if(mostRecentThreadWithThisChar) {
          await showThread(mostRecentThreadWithThisChar.id);
        } else {
          await createNewThreadWithCharacterId(existingVerySimilarCharacter.id);
        }
        return "showCharacter";
      }

      let editingExistingCharacter = false;
      if(character.uuid && await db.characters.get({uuid:character.uuid})) {
        editingExistingCharacter = true;
      }

      let submitButtonText = "add character";
      if(editingExistingCharacter) {
        submitButtonText = "save edits";
      }

      delete character.folderPath;

      let newUserCancelledAddCharacter = false;
      if(existingCharacters.length < 3 && !localStorage.hasStartedThreadViaCharacterTap && !localStorage.hasSeenInitialTipsModal) {
        // TODO: make this way more robust
        let characterText = JSON.stringify(character).replace(/\\n/g, " ");
        // Courtesy mostly of chatgpt:
        if(/\b(?:18\+|nsfw|porn(?:o|hub|tube|star|ography|ographic)?|xxx|x[-]?rated|xvideos|xhamster|redtube|youporn|spankbang|porntube|tube8|cock|dick(?:head)?|penis|phallus|prick|pussy|cunt|twat|snatch|vulva|vagina|clit(?:oris)?|labia(?:[- ]?minora)?|g[- ]?spot|testicles?|balls|nuts|scrotum|nutsack|taint|gooch|foreskin|bellend|boobs?|boobies|tits?|titties|jugs|nipples?|asshole|butthole|anus|anal(?:sex)?|analgape|assfuck|buttsex|bareback|blow[- ]?job|bj|hand[- ]?job|rim[- ]?job|rimming|doggy[- ]?style|reversecowgirl|cunnilingus|fellatio|deepthroat|fingering|fisting|pegging|dp|double[- ]?penetration|gang[- ]?bang|gangbang|threesome|foursome|orgy|orgies|fuck(?:ing|ed)?|sodomy|spitroast|facesitting|footjob|foot[- ]?fetish|edging|snowballing|felch(?:ing)?|scissoring|tribb(?:ing|adism)|nympho(?:maniac)?|arousal|fornicat(?:e|ed|ing|ion)|masturbat(?:e|ed|ing|ion)|nudism|hotwife|cuckold(?:ry)?|cuck|milf|gilf|ladyboy|tranny|domme|dominatrix|bdsm|bondage|shibari|sadism|masochism|fetish(?:es)?|kinky|watersports|golden[- ]?shower|scat|coprophilia|urophilia|gokkun|bukkake|bukake|cum(?:ming|shot|shots|load|loads|slut|guzzler|rag)?|cum[- ]?dumpster|cumdump|ejaculat(?:e|ed|ing|ion|es)|semen|jizz|spunk|splooge|precum|pre[- ]?cum|moneyshot|pearl[- ]?necklace|squirt(?:ing)?|orgasm(?:ic|s)?|queef|milking|cream[- ]?pie|creampies?|glory[- ]?hole|bigblackcock|fleshlight|fuck[- ]?machine|sybian|hitachi|dildo(?:s)?|vibrator(?:s)?|butt[- ]?plug(?:s)?|strap[- ]?on(?:s)?|sex[- ]?toy(?:s)?|cock[- ]?ring(?:s)?|onlyfans|camgirl(?:s)?|camwhore(?:s)?|pornstar|stripper|brothel|bordello|whorehouse|escort|prostitut(?:e|ion)|whore|slutty?|hooker|sensual|intimate|kiss|breasts|sexual|seductive|bikini|erotic|arousal|intimacy|flirty|flirt|clit|sexuality|consent|voluptuous|-cup|fucking|labia|insatiable|perverse|perverted|pervert|pedo|pedophile|dildo|penetration|penetrated|penetrates|stroking|strokes|perky)\b/i.test(characterText)) {
          window.lastKnownActivelyLoadingTime = Infinity; // prevent load failure/bug warning
          let confirmed = await root.confirmAsync("You've visited a character sharing link, which will add a new character to your character list. This character may talk about sensitive themes that are not appropriate for all audiences - please click 𝗰𝗮𝗻𝗰𝗲𝗹 if you are under 18.");
          window.lastKnownActivelyLoadingTime = Date.now();
          if(!confirmed) {
            newUserCancelledAddCharacter = true;
          }
        }
      }

      let result;

      if(!newUserCancelledAddCharacter) {
        result = await characterDetailsPrompt(character, {
          editingExistingCharacter,
          submitButtonText,
          submitButtonCssText: "background-color:#008c00",
          existingCharacterSameNameWarningOnShareLinkPageLoad: thereIsAnExistingCharacterWithTheSameName,
          // we don't quickAdd if thereIsAnExistingCharacterWithTheSameName because it might just be because they e.g. refreshed the page without removing the character share URL.
          // TODO***: I should automatically remove the share URL part once the character has been added.
          autoSubmit: urlHashJson.quickAdd && !editingExistingCharacter && !thereIsAnExistingCharacterWithTheSameName,
        });
      }

      if(result) {
        if(editingExistingCharacter) {
          await db.characters.where({uuid:character.uuid}).modify(result);
          const editedCharacter = await db.characters.get({uuid:character.uuid});
          await createNewThreadWithCharacterId(editedCharacter.id);
        } else {
          const newCharacter = await addCharacter(result);
          await createNewThreadWithCharacterId(newCharacter.id);
        }
      }
      if(window.location.hash) {
        ignoreHashChange = true;
        window.location.hash = "";
        await new Promise(r => setTimeout(r, 20)); // allow hashchange event to fire and be ignored
        ignoreHashChange = false;
      }
      if(result) {
        return "addCharacter";
      } else {
        return null;
      }
    } else {
      return null;
    }
  }
  window.addEventListener('hashchange', (event) => {
    if(!ignoreHashChange) {
      checkForHashCommand();
    }
  });

  console.log("load log: before render thread list", Date.now()-window.pageLoadStartTime);

  let mostRecentlyInteractedThread = (await db.threads.orderBy("lastViewTime").reverse().toArray())[0];
  if(mostRecentlyInteractedThread) $.chatThreads.dataset.currentFolderPath = mostRecentlyInteractedThread.folderPath;

  await renderThreadList(); //.catch(e => console.error(e));

  console.log("load log: after render thread list", Date.now()-window.pageLoadStartTime);

  let customPostPageLoadMainThreadCode = (await db.misc.get("customPostPageLoadMainThreadCode"))?.value || "";
  if(customPostPageLoadMainThreadCode.trim()) {
    console.warn("[ACCM Security] Custom post page load code execution blocked for security reasons.");
  }

  console.log("load log: after custom post page load main thread code", Date.now()-window.pageLoadStartTime);

  if(await checkForHashCommand() === null) {
    // if there are no threads, show the character selection screen
    if(!$("#chatThreads .thread")) {
      // $.newThreadButton.click();
      // if there are no threads, open a new thread with the first starter character
      let character = starterCharacters[0];
      if(typeof character === "string") {
        character = JSON.parse(decodeURIComponent(character.split("#").slice(1).join("#"))).addCharacter;
      }
      let result = await characterDetailsPrompt(character, {autoSubmit:true});
      const characterObj = await addCharacter(result);
      await createNewThreadWithCharacterId(characterObj.id);
    } else {
      // otherwise click the most recently-interacted-with thread
      if($.chatThreads.dataset.currentFolderPath !== mostRecentlyInteractedThread.folderPath) {
        $.chatThreads.dataset.currentFolderPath = mostRecentlyInteractedThread.folderPath;
        await renderThreadList();
      }
      let el = $.chatThreads.querySelector(`.thread[data-thread-id="${mostRecentlyInteractedThread.id}"]`);
      if(!el) el = $.chatThreads.querySelector(`.thread`); // in case the 'last viewed' thread is in a different folder to the 'last messaged' thread (renderThreadList shows last messaged thread)
      el.click();
    }
  }

  initialPageLoadingModal.style.display = "none";
  $.main.style.visibility = "visible";

  console.log("load log: after auto thread click", Date.now()-window.pageLoadStartTime);

  tryPersistBrowserStorageData();

  (async function() {
    let messageCount = await db.messages.count();
    if(messageCount >= 4) { // PERCHANCE EDIT (to declutter the page on their first interaction)
      document.querySelector(':root').style.setProperty('--inline-reminder-message-default-visibility', 'visible');
      // document.querySelector(':root').style.setProperty('--shortcut-buttons-display', 'initial');
    }
  })();

  clearInterval(window.emergencyExportButtonDisplayTimeout);
  emergencyExportCtn.hidden = true;

  console.log("Finished initialization.");
  console.log("load log: finished", Date.now()-window.pageLoadStartTime);

  window.finishedPageLoad = true;

  if(window.innerWidth < 500) setTimeout(() => root.aiTextPlugin({preload:true}), 5000);
  else root.aiTextPlugin({preload:true});

</script>

<script>
  try {
    let isTouchScreen = window.matchMedia("(pointer: coarse)").matches;
    let isSafari = navigator.vendor && navigator.vendor.indexOf('Apple') > -1 && navigator.userAgent && navigator.userAgent.indexOf('CriOS') == -1 && navigator.userAgent.indexOf('FxiOS') == -1;
    if(isSafari && window.innerWidth < 800 && isTouchScreen) {
      let viewportMetaEl = document.querySelector("[name=viewport]");
      if(!viewportMetaEl.getAttribute("content").includes("maximum-scale")) {
        viewportMetaEl.setAttribute("content", viewportMetaEl.getAttribute("content") + ", maximum-scale=1");
      }
      console.log("Safari iOS detected. Added maximum-scale attribute to prevent zooming:", viewportMetaEl.getAttribute("content"));
    }
  } catch(e) {
    console.error(e);
  }
</script>
