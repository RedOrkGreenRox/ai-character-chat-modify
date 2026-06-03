  $.exportDataButton.addEventListener("click", async function() {
    // choose export options
    let result = await prompt2({
      exportUserData: {label: "Export user settings/data? (e.g. your own avatar, name, text input history)", type: "select", options:[{value: "yes", content: "Yes"}, {value: "no", content: "No"}]},
      exportType: {label: "Export type", type: "select", options:[{content: "All characters and chats", value:"allCharactersAndThreads"}, {content: "All characters, no chats", value:"allCharactersNoThreads"}, {content: "Specific characters", value:"specificCharacters"}, {content: "Specific chats", value:"specificThreads"}]},
      exportFormat: {hidden:true, label: "Export format", type: "select", options:[{content: "Compressed", value:"compressed"}, {content: "Text (about 3x larger file size)", value:"text"}]},
      exportThreadIds: {show:(data) => data.exportType==="specificThreads", label: "Chat IDs to export (comma-separated numbers). Chat IDs are shown in bottom-right of each chat card in the side bar. The characters associated with these chats will be exported too.", type: "textLine", defaultValue: "", placeholder:"23,45,67"},
      exportCharacterIds: {show:(data) => data.exportType==="specificCharacters", label: "Character IDs to export (comma-separated numbers). Character IDs are shown next to the character name.", type: "textLine", defaultValue: "", placeholder:"3,12,7,14"},
      includeThreadsOfCharacters: {show:(data) => data.exportType==="specificCharacters", label: "Include all chats with these characters?", type: "select", options:[{value: "yes", content: "Yes"}, {value: "no", content: "No"}], defaultValue: "no"},
    });
    if(!result) return;

    let loadingModal = createLoadingModal(`Please wait...<br><span style="font-size:80%; opacity:0.6;">This could take a while if you have a lot of data.</span>`);

    // const blob = await db.export({prettyJson:true, numRowsPerChunk:100});
    console.log("Exporting DB to blob...");
    const blob = await db.export({});
    window.exportedBlob1 = blob;
    console.log("Converting blob to json...");

    // try a couple of different approaches in case of huge file:
    let json;
    try { json = await new Response(blob).json(); } catch(e) { console.error(e); }
    if(!json) { try { json = JSON.parse(await blob.text()); } catch(e) { console.error("Probably maximum string length error:", e); } }

    let keepThreadCheck;
    let keepCharacterCheck;
    let keepLoreBookCheck;
    let keepLoreBookUrlCheck;
    if(result.exportType === "allCharactersAndThreads") {
      keepThreadCheck = (id) => true;
      keepLoreBookCheck = (id) => true;
      keepLoreBookUrlCheck = (url) => true;
      keepCharacterCheck = (id) => true;
    } else if (result.exportType === "allCharactersNoThreads") {
      keepThreadCheck = (id) => false;
      keepLoreBookCheck = (id) => false;
      keepLoreBookUrlCheck = (url) => false;
      keepCharacterCheck = (id) => true;
    } else if (result.exportType === "specificCharacters") {
      if(!result.exportCharacterIds.trim()) return alert("You must specify at least one character ID to export.")

      const keepCharacterIds = result.exportCharacterIds.split(",").map(s => parseInt(s)).filter(id => !isNaN(id));
      keepCharacterCheck = (id) => keepCharacterIds.includes(id);

      if(result.includeThreadsOfCharacters === "yes") {
        const keepCharacters = await db.characters.where("id").anyOf(keepCharacterIds).toArray();
        const keepThreads = await db.threads.where("characterId").anyOf(keepCharacterIds).toArray();
        const keepThreadIds = keepThreads.map(t => t.id);
        const keepLoreBookIds = keepThreads.map(t => t.loreBookId);
        const keepLoreBookUrls = keepCharacters.map(c => c.loreBookUrls).flat();
        keepThreadCheck = (id) => keepThreadIds.includes(id);
        keepLoreBookCheck = (id) => keepLoreBookIds.includes(id);
        keepLoreBookUrlCheck = (url) => keepLoreBookUrls.includes(url);
      } else {
        keepThreadCheck = (id) => false;
        keepLoreBookCheck = (id) => false;
        keepLoreBookUrlCheck = (url) => false;
      }
    } else if (result.exportType === "specificThreads") {
      if(!result.exportThreadIds.trim()) return alert("You must specify at least one thread ID to export.")
      const keepThreadIds = result.exportThreadIds.split(",").map(s => parseInt(s)).filter(id => !isNaN(id));
      const keepThreads = await db.threads.where("id").anyOf(keepThreadIds).toArray();
      const keepCharacterIds = [...new Set(keepThreads.map(t => t.characterId))];
      const keepCharacters = await db.characters.where("id").anyOf(keepCharacterIds).toArray();
      const keepLoreBookUrls = keepCharacters.map(c => c.loreBookUrls).flat();
      const keepLoreBookIds = keepThreads.map(t => t.loreBookId);
      keepThreadCheck = (id) => keepThreadIds.includes(id);
      keepLoreBookCheck = (id) => keepLoreBookIds.includes(id);
      keepLoreBookUrlCheck = (url) => keepLoreBookUrls.includes(url);
      keepCharacterCheck = (id) => keepCharacterIds.includes(id);
    }


    if(result.exportUserData === "no") {
      json.data.data.find(d => d.tableName === "misc").rows = [];
    }
    // remove datesApplicationWasUsedInThisBrowser because it's browser-specific
    json.data.data.find(d => d.tableName === "misc").rows = json.data.data.find(d => d.tableName === "misc").rows.filter(r => r.key !== "datesApplicationWasUsedInThisBrowser");

    let threads = json.data.data.find(d => d.tableName === "threads");
    threads.rows = threads.rows.filter(t => keepThreadCheck(t.id));

    let messages = json.data.data.find(d => d.tableName === "messages");
    messages.rows = messages.rows.filter(m => keepThreadCheck(m.threadId));

    const threadCharacters = new Set(messages.rows.filter(m => keepThreadCheck(m.threadId)).map(a => a.characterId));
    let characters = json.data.data.find(d => d.tableName === "characters");
    characters.rows = characters.rows.filter(c => keepCharacterCheck(c.id) || threadCharacters.has(c.id));

    // NOTE: summaries are stored on message objects (i.e. `message.summariesEndingHere[level]`) in the new hierarchical summarization approach. But keeping this for backwards-compatibility.
    let summaries = json.data.data.find(d => d.tableName === "summaries");
    if(summaries) {
      let summaryHashesToKeep = new Set(threads.rows.map(t => t.currentSummaryHashChain ?? []).flat());
      // Note: s.threadId only exists for 'legacy' reasons (we don't rely on it because a summary can be used by multiple threads), but it's useful here because currentSummaryHashChain is a new property and may not exist for old threads, so we can use the threadId as a backup check
      summaries.rows = summaries.rows.filter(s => summaryHashesToKeep.has(s.hash) || keepThreadCheck(s.threadId));
    }

    let memories = json.data.data.find(d => d.tableName === "memories");
    if(memories) {
      memories.rows = memories.rows.filter(m => keepThreadCheck(m.threadId));
    }

    let lore = json.data.data.find(d => d.tableName === "lore");
    if(lore) {
      lore.rows = lore.rows.filter(l => keepLoreBookCheck(l.bookId) || keepLoreBookUrlCheck(l.bookUrl));
    }

    let textEmbeddingCache = json.data.data.find(d => d.tableName === "textEmbeddingCache");
    if(textEmbeddingCache) {
      let memoryAndLoreTextHashes = new Set(await Promise.all([...lore.rows, ...memories.rows].map(entry => sha256Text(entry.text))));
      textEmbeddingCache.rows = textEmbeddingCache.rows.filter(c => memoryAndLoreTextHashes.has(c.textHash));
    }

    if(result.exportUserData === "no") {
      let usageStats = json.data.data.find(d => d.tableName === "usageStats");
      if(usageStats) usageStats.rows = [];
    } else {
      let usageStats = json.data.data.find(d => d.tableName === "usageStats");
      if(usageStats) {
        usageStats.rows = usageStats.rows.filter(entry => keepThreadCheck(entry.threadId) && keepCharacterCheck(entry.characterId));
      }
    }

    sanitizeExportJson(json);

    let yyyymmdd = new Date().toISOString().split("T")[0];

    if(window.CompressionStream) {
      let textBlob = new Blob([JSON.stringify(json)], {type:"application/json"});
      if(result.exportFormat === "compressed") {
        let gzipBlob = await root.compressBlobWithGzip(textBlob);
        downloadTextOrBlob(gzipBlob, `perchance-characters-export-${yyyymmdd}.json.gz`);
      } else if(result.exportFormat === "text") {
        downloadTextOrBlob(textBlob, `perchance-characters-export-${yyyymmdd}.json`);
      }
    } else {
      downloadTextOrBlob(JSON.stringify(json), `perchance-characters-export-${yyyymmdd}.json`);
    }

    loadingModal.delete();
  });

  // This renders the list of threads in the left column.
