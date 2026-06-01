  const dbName = "chatbot-ui-v1";
  const dbVersion = 90;

  window.db = await new Dexie(dbName).open().catch(e => {
    console.warn(e);
    return false;
  }); // throws if db doesn't exist
  let dbLoadingModal;
  if(db) {
    console.log("Existing data found, checking IndexedDB version...");
    let usersOriginalDbVersion = db.verno;
    if(usersOriginalDbVersion < dbVersion) {
      let result = await prompt2({
        message: {type:"none", "html":`<p style="margin:0;">A database upgrade will be done when you click continue. A full export/backup will be downloaded first in case anything goes wrong.</p>`},
      }, {cancelButtonText:null, submitButtonText:"Continue"});

      dbLoadingModal = createLoadingModal(`Please wait...<br><span style="font-size:80%; opacity:0.6;">This could take a while if you have a lot of data.</span>`);

      const originalDbJsonBlob = await db.export({prettyJson: true});
      let yyyymmdd = new Date().toISOString().split("T")[0];
      downloadTextOrBlob(originalDbJsonBlob, `perchance-characters-export-${yyyymmdd}.json`);
    }
    await db.close(); // we need to close before db.version() call below and re-open afterwards
  } else {
    // brand new user, so create the db:
    console.log("New user, creating database...");
    window.db = new Dexie(dbName);
  }

  console.log("load log: after db init", Date.now()-window.pageLoadStartTime);

  db.version(dbVersion).stores({
    // REMEMBER: If you update the database schema, you may also need to update the export/import code
    // in particular: the character hash code shouldn't include fields like `id` and `creationTime` and `lastMessageTime`.

    // Things to check:
    // - character hash computation
    // - $.exportDataButton.addEventListener
    // - import code

    // NOTE: The properties listed here are just the INDEXES, not *all* the columns/properties.
    characters: "++id,modelName,fitMessagesInContextMethod,uuid,creationTime,lastMessageTime,folderPath",
    threads: "++id,name,characterId,creationTime,lastMessageTime,lastViewTime,folderPath",
    messages: "++id,threadId,characterId,creationTime,order", // characterId is -1 for user, and for system it is -2.
    misc: "key", // key=>value
    summaries: "hash,threadId", // EDIT: This does not make sense, because the `hash` is used as the primary key, so in the case where two threads end up with the same summary hash (which is actually common because you can import a thread which you already have), then you can only have one entry for both threads. So for summary deletion you actually need to (OLD: we track threadId so when we delete threads, we can delete the associated summaries. we also need it for grabbing summaries for the edit interface.)
    memories: "++id,[summaryHash+threadId],[characterId+status],[threadId+status],[threadId+index],threadId", // memories are associated with a summary hash because they are computed alongside the summary. We need to track the hash so that if earlier messages are edited (and therefore the summaries need to be recomputed), we know to only consider "valid"/"current" the memories that are associated with currently-"used". The "type" property is used to track the "currentness", and also to track whether a memory was manually added by the user (in which case it is *always* considered valid)
    lore: "++id,bookId,bookUrl",
    textEmbeddingCache: "++id,textHash,&[textHash+modelName]",
    textCompressionCache: "++id,uncompressedTextHash,&[uncompressedTextHash+modelName+tokenLimit]",
    // usageStats: "[dateHour+threadId+modelName],threadId,characterId,dateHour",
  }).upgrade(async tx => {

    await tx.table("characters").toCollection().modify(character => {
      upgradeCharacterFromOldVersion(character);
    });

    await tx.table("messages").toCollection().modify(message => {
      upgradeMessageFromOldVersion(message);
    });

    let characters = await tx.table("characters").toArray();
    await tx.table("threads").toCollection().modify(async thread => {
      await upgradeThreadFromOldVersion(thread, {characters});
    });

    if(db.apiUsage) await db.apiUsage.delete();

    try {
      await tx.table("usageStats").toCollection().modify((entry, ref) => {
        if(entry.threadId === undefined) delete ref.value; // delete rows/entries that don't have a threadId - this was caused by some sort of bug in early implementation
      });
    } catch(e) {
      console.error(e);
    }

    await tx.table("summaries").toCollection().modify((entry, ref) => {
      if(entry.messageIds === undefined) delete ref.value; // old summaries didn't have messageIds or prevSummaryHash
    });


    let memories = await tx.table("memories").toArray();
    let userWrittenMemories = memories.filter(m => m.type === "user-written");
    if(userWrittenMemories.length > 0) {
      let loreEntries = [];
      for(let m of userWrittenMemories) {
        loreEntries.push({ bookId:m.threadId, text:m.text, embedding:m.embedding, triggers:[] });
      }
      await tx.table("lore").bulkAdd(loreEntries);
      await tx.table("memories").toCollection().modify((entry, ref) => {
        if(entry.type === "user-written") delete ref.value;
      });
      memories = memories.filter(m => m.type !== "user-written");
    }
    let memoryIdToIndexMap = createMemoryIdToIndexMapForIncorrectlyIndexedOrUnindexedMemories(memories);
    await tx.table("memories").toCollection().modify(memory => {
      let opts = {};
      if(memoryIdToIndexMap[memory.id] !== undefined) opts.index = memoryIdToIndexMap[memory.id];
      upgradeMemoryFromOldVersion(memory, opts);
    });

    await tx.table("lore").toCollection().modify(entry => {
      upgradeLoreFromOldVersion(entry);
    });
  });

  try {
    await db.open();
  } catch(e) {
    console.error(e);
    await db.open();
  }

  if(dbLoadingModal) dbLoadingModal.delete();

  // Someone mentioned that their power went out while they were using it, and the error message they gave seems to indicate that an item in `await db.characters.toArray()` was null.
  // So this is a hack to ensure that sort of failure isn't a problem (hopefully it doesn't affect queries...)
  {
    let origDbCharactersToArray = db.characters.toArray.bind(db.characters);
    db.characters.toArray = async function() {
      let arr = await origDbCharactersToArray();
      return arr.filter(o => o); // they should all be truthy because they should all be objects
    };

    let origDbThreadsToArray = db.threads.toArray.bind(db.threads);
    db.threads.toArray = async function() {
      let arr = await origDbThreadsToArray();
      return arr.filter(o => o); // they should all be truthy because they should all be objects
    };

    let origDbMessagesToArray = db.messages.toArray.bind(db.messages);
    db.messages.toArray = async function() {
      let arr = await origDbMessagesToArray();
      return arr.filter(o => o); // they should all be truthy because they should all be objects
    };
  }

  console.log("Database ready.");

  console.log("load log: after db ready", Date.now()-window.pageLoadStartTime);

  function upgradeCharacterInitialMessagesArrayIfNeeded(character) {
    // upgrade from the ["foo", "bar"] format to [{author:"user", content:"foo"}, {author:"ai", content:"bar"}]
    if(character.initialMessages && character.initialMessages.length === 1 && character.initialMessages[0] === "") {
      // bugfix:
      character.initialMessages = [];
    } else if(character.initialMessages && character.initialMessages.length > 0 && character.initialMessages[0] === "" && typeof character.initialMessages[1] === "object") {
      // bugfix:
      character.initialMessages = character.initialMessages.slice(1);
    } else if(character.initialMessages && character.initialMessages.length > 0 && typeof character.initialMessages[0] === "string") {
      // actual upgrade:
      let author = "user";
      for(let i = 0; i < character.initialMessages.length; i++) {
        let content = character.initialMessages[i];
        if(content === "") { // if first message is empty, this indicates that character maker wanted AI to speak first
          author = (author === "user" ? "ai" : "user");
          continue;
        }
        character.initialMessages[i] = {
          author,
          content,
        };
        author = (author === "user" ? "ai" : "user");
      }
      if(character.initialMessages[0] === "") character.initialMessages = character.initialMessages.slice(1);
    }
  }

  function upgradeCharacterFromOldVersion(character) {
    upgradeCharacterInitialMessagesArrayIfNeeded(character);
    if(character.customCode === undefined) character.customCode = "";
    if(character.modelVersion) {
      character.modelName = character.modelVersion;
      delete character.modelVersion;
    }
    if(character.textEmbeddingModelName === undefined) {
      character.textEmbeddingModelName = character.associativeMemoryEmbeddingModelName ?? currentDefaultTextEmbeddingModelName;
      delete character.associativeMemoryEmbeddingModelName;
    }
    if(character.userCharacter === undefined) character.userCharacter = {};
    if(character.avatar === undefined) character.avatar = {url:character.avatarUrl, size:1, shape:"square"};
    if(character.hasOwnProperty("avatarUrl")) delete character.avatarUrl;
    if(character.scene === undefined) character.scene = {background:{}, music:{}};
    if(character.streamingResponse === undefined) character.streamingResponse = true;
    if(character.roleInstruction === undefined) {
      character.roleInstruction = character.systemMessage;
      delete character.systemMessage;
    }
    if(character.folderPath === undefined) character.folderPath = "";
    if(character.uuid === undefined) character.uuid = null;
    if(character.customData === undefined) character.customData = {};
    if(character.systemCharacter === undefined) character.systemCharacter = {avatar:{}};
    if(character.loreBookUrls === undefined) character.loreBookUrls = [];
    if(character.associativeMemoryMethod !== undefined) {
      character.autoGenerateMemories = character.associativeMemoryMethod;
      delete character.associativeMemoryMethod;
    }
    if(character.autoGenerateMemories === undefined) {
      character.autoGenerateMemories = "none";
    }
    if(character.maxTokensPerMessage === undefined) character.maxTokensPerMessage = null;

    // WARNING: If you add something here, you'll likely have to edit:
    //  - characterDetailsPrompt (characterDetailsPrompt should return a valid character object - addCharacter only adds creationTime and lastMessageTime, so characterDetailsPrompt should fill in everything else, even if it's not visible in the editor)
    //  - getUserCharacterObj
    //  - getSystemCharacterObj
    //  - characterPropertiesVisibleToCustomCode
    //  - addThread - (EDIT: the following comment is no longer true - we don't copy scene/userCharacter/etc. over at start of thread) for things like `character.scene` where it's copied over to the thread at the start, and custom code can only edit it from there
    //  - the "share link" creation code (if you add any other private/user-specific data like id, lastMessageTime, etc.)
    return character;
  }

  function upgradeMessageFromOldVersion(message) {
    if(!message.variants) message.variants = [null]; // null is the placeholder for the currently-chosen variant (stored in `message.message`)
    if(!message.hasOwnProperty("expectsReply")) message.expectsReply = undefined;
    if(!message.hasOwnProperty("summaryHashUsed")) message.summaryHashUsed = undefined; // undefined means that we don't know whether a summary was used because the message was created before this 'summaryUsed' feature was added
    if(message.memoryIdBatchesUsed === undefined) message.memoryIdBatchesUsed = [];
    if(message.loreIdsUsed === undefined) message.loreIdsUsed = [];
    if(message.scene === undefined) message.scene = null;
    if(message.avatar === undefined) message.avatar = {};
    if(message.customData === undefined) message.customData = {};
    if(message.wrapperStyle === undefined) message.wrapperStyle = "";
    if(message.memoryQueriesUsed === undefined) message.memoryQueriesUsed = [];
    if(message.messageIdsUsed === undefined) message.messageIdsUsed = [];
    if(message.order === undefined) message.order = message.id; // <-- this is a little hacky, but it works because id is auto-incremented, and `order` values don't need to be contiguous
    if(message.instruction === undefined) message.instruction = null;
    // WARNING: If you add something here, you may need to edit
    // - createMessageObj
    // - messagesToCustomCodeFormat and messagesFromCustomCodeFormat (if the data should be readable/writable from custom code)
    return message;
  }

  async function upgradeThreadFromOldVersion(thread, opts={}) {
    if(thread.isFav === undefined) thread.isFav = false;
    if(thread.userCharacter === undefined) thread.userCharacter = {avatar:{}}; // this overrides the default user character object (for this specific thread)
    if(thread.lastViewTime === undefined) thread.lastViewTime = thread.lastMessageTime;
    if(thread.customCodeWindow === undefined) thread.customCodeWindow = {visible:false, width:null};
    if(thread.customData === undefined) thread.customData = {};
    if(thread.modelName === undefined) {
      let character;
      if(opts.characters) {// need this specifically for the db upgrade() function (i.e. not needed in import code) since modify can't be `async`, so we get all characters beforehand and pass them to this function
        // oh and I now use this in the import code too because we need to pass in the *new* characters as well, since new threads can obviously reference them.
        character = opts.characters.find(c => c.id === thread.characterId);
      } else {
        character = await db.characters.get(thread.characterId);
      }
      thread.modelName = character.modelName; // don't need to do good/great conversion here because that was not a feature previous to this change
    }
    if(thread.textEmbeddingModelName === undefined) {
      let character;
      if(opts.characters) character = opts.characters.find(c => c.id === thread.characterId);
      else character = await db.characters.get(thread.characterId);
      thread.textEmbeddingModelName = character.textEmbeddingModelName;
    }
    if(thread.folderPath === undefined) thread.folderPath = "";
    if(thread.character === undefined) thread.character = {avatar:{}};
    if(thread.systemCharacter === undefined) thread.systemCharacter = {avatar:{}}; // this overrides the default user character object (for this specific thread)
    if(thread.loreBookId === undefined) thread.loreBookId = thread.id; // user-written memories for each thread are now lore entries, and for simplicity I've made the lorebook id equal to the thread id the the existing lore entries (thread and lorebook ids are not actually coupled though)
    if(thread.messageWrapperStyle === undefined) thread.messageWrapperStyle = "";
    if(thread.userMessagesSentHistory === undefined) thread.userMessagesSentHistory = [];
    if(thread.unsentMessageText === undefined) thread.unsentMessageText = "";
    if(thread.shortcutButtons === undefined) thread.shortcutButtons = [];
    for(let shortcut of thread.shortcutButtons) {
      if(shortcut.insertionType === undefined) shortcut.insertionType = "replace";
    }

    // EDIT: currentSummaryHashChain is no longer used in the new hierarchical summary approach
    if(thread.currentSummaryHashChain === undefined) thread.currentSummaryHashChain = null; // NOTE: currentSummaryHashChain isn't added here since we need the thread to be fully loaded before we can calculate it (including the custom code iframe), so we have a function to access this thread property which will calculate it if it's not already calculated

    // WARNING: If you add something here, you may need to edit:
    // - addThread
    // - getThreadJSONById
    // and if exposing to custom code:
    // - window.oc.thread.<...>  (during declaration of window.oc object, with Object.seal if property is an object)
    // - getDataForCustomCode  (sending data to custom code)
    // - updateDbWithNewDataFromCustomCode (receiving data from custom code)
    return thread;
  }

  function sanitizeExportJson(json) {
    const charactersTable = json.data.data.find(d => d.tableName === "characters");
    const threadsTable = json.data.data.find(d => d.tableName === "threads");
    const messagesTable = json.data.data.find(d => d.tableName === "messages");

    if(!charactersTable || !threadsTable || !messagesTable) return json;

    const characters = charactersTable.rows || [];
    const threads = threadsTable.rows || [];
    const messages = messagesTable.rows || [];
    const memories = json.data.data.find(d => d.tableName === "memories")?.rows || [];
    const usageStats = json.data.data.find(d => d.tableName === "usageStats")?.rows || [];

    const charactersById = new Map();
    let maxCharacterId = -1;
    for(let character of characters) {
      if(character && typeof character.id === "number") {
        charactersById.set(character.id, character);
        if(character.id > maxCharacterId) maxCharacterId = character.id;
      }
    }

    const defaultModelName = characters.find(c => typeof c?.modelName === "string" && c.modelName.trim())?.modelName || "perchance-ai";

    const requiredIds = new Set();

    for(let thread of threads) {
      if(!thread) continue;
      if(typeof thread.characterId !== "number" || Number.isNaN(thread.characterId) || thread.characterId < 0) {
        maxCharacterId++;
        thread.characterId = maxCharacterId;
      }
      if(thread.characterId >= 0) requiredIds.add(thread.characterId);
      if(thread.currentReplyAsCharacterId !== undefined && thread.currentReplyAsCharacterId >= 0) {
        requiredIds.add(thread.currentReplyAsCharacterId);
      }
      if(Array.isArray(thread.replyAsCharacterIds)) {
        for(let id of thread.replyAsCharacterIds) {
          if(id >= 0) requiredIds.add(id);
        }
      }
    }

    for(let message of messages) {
      if(message?.characterId >= 0) requiredIds.add(message.characterId);
    }

    for(let memory of memories) {
      if(memory?.characterId >= 0) requiredIds.add(memory.characterId);
    }

    for(let entry of usageStats) {
      if(entry?.characterId >= 0) requiredIds.add(entry.characterId);
    }

    for(let id of requiredIds) {
      if(charactersById.has(id)) continue;
      let stub = {
        id,
        name: `Recovered Character #${id}`,
        modelName: defaultModelName,
        roleInstruction: "",
        initialMessages: [],
      };
      upgradeCharacterFromOldVersion(stub);
      characters.push(stub);
      charactersById.set(id, stub);
    }

    return json;
  }

  function upgradeMemoryFromOldVersion(memory, opts={}) {
    if(memory.type === "user-written") return; // these will be moved to the lore table and deleted from the memories table

    if(opts.index !== undefined) {
      delete memory.nextMemoryId;
      delete memory.previousMemoryId;
      memory.index = opts.index;
    }
    delete memory.type; // no longer need type="generated" because it's the only type (and also a better name would be "chronological" because user's can edit them and add their own)

    if(Array.isArray(memory.embedding)) {
      memory.embeddings = {"text-embedding-ada-002":memory.embedding};
      delete memory.embedding;
      if(memory.$types) {
        // needed for manual upgrading of dexie json import (still don't know why we need to manually upgrade stuff though - should be able to import old json and it upgrades automatically)
        memory.$types["embeddings.text-embedding-ada-002"] = memory.$types.embedding;
        delete memory.$types.embedding;
      }
    }
  }

  function upgradeLoreFromOldVersion(entry) {
    if(entry.bookUrl === undefined) entry.bookUrl = null;
    if(Array.isArray(entry.embedding)) {
      entry.embeddings = {"text-embedding-ada-002":entry.embedding};
      delete entry.embedding;
      if(entry.$types) {
        // needed for manual upgrading of dexie json import (still don't know why we need to manually upgrade stuff though - should be able to import old json and it upgrades automatically)
        entry.$types["embeddings.text-embedding-ada-002"] = entry.$types.embedding;
        delete entry.$types.embedding;
      }
    }
  }


  // function createMemoryIdToIndexMapFromAllMemories(memories) {
  //   // each memory has `nextMemoryId` and `previousMemoryId`, but we need to convert to `index` format.
  //   // we need to create a map of memory.id -> index
  //   // but first we need to group all memories by their threadId
  //   let memoriesByThreadId = {};
  //   for(let memory of memories) {
  //     if(memory.type === "user-written") continue; // <-- these don't have an order/index, and are being moved to the lore table
  //     if(!memoriesByThreadId[memory.threadId]) memoriesByThreadId[memory.threadId] = [];
  //     memoriesByThreadId[memory.threadId].push(memory);
  //   }
  //   // now for each thread's memories we follow the `previousMemoryId`/`nextMemoryId` chain to sort them
  //   // the first memory in the chain will have previousMemoryId==-1, so we get that first, and then crawl through:
  //   let memoryIdToIndexMap = {};
  //   for(let threadId of Object.keys(memoriesByThreadId)) {
  //     let threadMemories = memoriesByThreadId[threadId];
  //     threadMemories.sort((a,b) => a.id - b.id);
  //     for(let i = 0; i < threadMemories.length; i++) {
  //       memoryIdToIndexMap[threadMemories[i].id] = i;
  //     }

  //     // this was buggy for some reason:
  //     // let index = 0;
  //     // while(memory) {
  //     //   memoryIdToIndexMap[memory.id] = index;
  //     //   index++;
  //     //   memory = threadMemories.find(m => m.previousMemoryId === memory.id);
  //     // }
  //   }
  //   return memoryIdToIndexMap;
  // }

  function createMemoryIdToIndexMapForIncorrectlyIndexedOrUnindexedMemories(memories) {
    let memoriesByThreadId = {};
    for(let m of memories) {
      if(!memoriesByThreadId[m.threadId]) memoriesByThreadId[m.threadId] = [];
      memoriesByThreadId[m.threadId].push(m);
    }
    // for each thread, check that memory indices (m.index) exist for each memory and are unique:
    let threadIdsThatNeedToBeIndexed = [];
    for(let threadId of Object.keys(memoriesByThreadId)) {
      let memories = memoriesByThreadId[threadId];
      let indices = memories.map(m => m.index);
      if(indices.includes(undefined) || indices.length !== new Set(indices).size) {
        threadIdsThatNeedToBeIndexed.push(threadId);
      }
    }
    let memoryIdToIndexMap = {};
    if(threadIdsThatNeedToBeIndexed.length > 0) {
      for(let threadId of threadIdsThatNeedToBeIndexed) {
        let memories = memoriesByThreadId[threadId];
        memories.sort((a,b) => a.id - b.id);
        for(let i = 0; i < memories.length; i++) {
          let m = memories[i];
          m.index = i;
          memoryIdToIndexMap[m.id] = i;
        }
      }
    }
    return memoryIdToIndexMap;
  }



  // export data if they click export button
