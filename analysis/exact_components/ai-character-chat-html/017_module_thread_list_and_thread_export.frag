  async function renderThreadList(opts={}) {
    console.log("renderThreadList called");
    if(!opts.maxShownThreads) opts.maxShownThreads = 50;

    let maxThreadsToGet = opts.maxShownThreads ?? 999999;
    if(opts.filterWithQuery) maxThreadsToGet = 999999;

    maxThreadsToGet += 50; // get (arbitrarily) more than needed to trigger the showAllThreadsButton in the case that there are more available

    console.log("renderThreadList: 1");

    let currentFolderPath = $.chatThreads.dataset.currentFolderPath;

    let threads = [];
    if(currentFolderPath === "") {
      threads = await db.threads.orderBy("lastMessageTime").reverse().limit(maxThreadsToGet).toArray();
    } else {
      maxThreadsToGet = 9999999; // hacky but should be fine
      try {
        threads = await db.threads.where('folderPath').startsWith(currentFolderPath).reverse().limit(maxThreadsToGet).toArray();
        threads.sort((a,b) => b.lastMessageTime-a.lastMessageTime);
      } catch(e) {
        console.error(e);
        threads = await db.threads.orderBy("lastMessageTime").reverse().limit(maxThreadsToGet).toArray();
      }
    }
    threads = threads.filter(t => t); // a user reported an error that indicated that an element of this array was `null` - no idea why, but filtering here as a hack for until i get to the root cause.
    // debugger;
    console.log("renderThreadList: 2");

    if(threads.length >= 3) {
      showEl($.threadSearchCtn);
    } else {
      hideEl($.threadSearchCtn);
    }

    console.log("renderThreadList: 3");

    let allFolderPaths = [...new Set(threads.map(t => t.folderPath))];
    let currentSubfolderNames = [...new Set(allFolderPaths.filter(p => p.startsWith(currentFolderPath) && p !== currentFolderPath).map(p => p.split("/").slice(currentFolderPath.split("/").length-(currentFolderPath === "" ? 1 : 0)).filter(s => s)[0]))];
    console.log("renderThreadList: 4");

    if(!opts.filterWithQuery) { // don't do folder stuff if they're searching
      threads = threads.filter(t => t.folderPath === currentFolderPath);
    }

    console.log("renderThreadList: 5");

    let characters = opts.characters ?? await db.characters.toArray();

    console.log("renderThreadList: 6");

    // to fix a bug where characters were added without required props:
    let charactersToDelete = [];
    for(let character of characters) {
      if(character.name === undefined) charactersToDelete.push(character);
    }

    console.log("renderThreadList: 7");

    if(charactersToDelete.length > 0) {
      console.warn("charactersToDelete:", charactersToDelete);
      let r = prompt(`You have one or more characters (with ids=${charactersToDelete.map(t => t.id).join(",")}) that are corrupted. This is a bug. Please report it using the feedback button and 𝗽𝗹𝗲𝗮𝘀𝗲 𝗺𝗲𝗻𝘁𝗶𝗼𝗻 𝘄𝗵𝗮𝘁 𝘆𝗼𝘂 𝗱𝗶𝗱 𝗿𝗲𝗰𝗲𝗻𝘁𝗹𝘆 (e.g. imported a character/thread/backup, deleted a character, etc). You can type "yes" below to delete these characters but you may want to click the export button to save a backup first.`);
      if(r?.toLowerCase().trim() === "yes") {
        for(let character of charactersToDelete) await safelyDeleteCharacterById(character.id);
      }
    }

    console.log("renderThreadList: 8");

    for(let thread of threads) {
      thread.character = characters.find(c => c.id === thread.characterId) || null;
    }

    console.log("renderThreadList: 9");

    let threadsWithoutCharacter = threads.filter(t => !t.character);
    if(threadsWithoutCharacter.length > 0) {
      let r = prompt(`You have one or more threads (with ids=${threadsWithoutCharacter.map(t => t.id).join(",")}) that are referencing character(s) that don't exist. This is a bug. Please report it using the feedback button and 𝗽𝗹𝗲𝗮𝘀𝗲 𝗺𝗲𝗻𝘁𝗶𝗼𝗻 𝘄𝗵𝗮𝘁 𝘆𝗼𝘂 𝗱𝗶𝗱 𝗿𝗲𝗰𝗲𝗻𝘁𝗹𝘆 (e.g. imported a character/thread/backup, deleted a character, etc). You can type "yes" below to delete these threads but you may want to click the export button to save a backup first.`);
      if(r?.toLowerCase().trim() === "yes") {
        for(let thread of threadsWithoutCharacter) {
          await safelyDeleteThreadById(thread.id);
        }
      }
    }

    console.log("renderThreadList: 10");

    threads = threads.filter(t => t.character && t.character.name !== undefined);

    console.log("renderThreadList: 11");

    if(opts.filterWithQuery) {
      try {
        let q = opts.filterWithQuery.toLowerCase();
        let regex = false;
        if(q.startsWith("/") && q.endsWith("/") && q.length > 2) {
          let match = q.trim().match(new RegExp('^/(.*?)/([dgimsuvy]*)$'));
          regex = new RegExp(match[1], match[2]);
        }
        // iterate over all threads, and all messages in each thread, and tally query "hits" for the threads
        for(let thread of threads) {
          thread.queryHits = 0;
          const messages = await db.messages.where("threadId").equals(thread.id).toArray();
          for(let message of messages) {
            if(regex ? regex.test(message.message) : message.message.toLowerCase().includes(q)) {
              thread.queryHits++;
            }
          }
        }
        // sort and filter
        threads.sort((a,b) => b.queryHits - a.queryHits);
        threads = threads.filter(t => t.queryHits > 0);
        for(let thread of threads) {
          delete thread.queryHits;
        }
      } catch(e) {
        console.error("opts.filterWithQuery:", e);
        alert(e.message);
      }
    }

    console.log("renderThreadList: 12");

    // move isFav threads to top without affecting order of the others:
    threads.sort((a,b) => {
      if(a.isFav && !b.isFav) return -1;
      if(!a.isFav && b.isFav) return 1;
      return 0;
    });

    console.log("renderThreadList: 13");

    let threadFolderData = (await db.misc.get("threadFolderData"))?.value || {};

    console.log("renderThreadList: 14");

    let foldersHtml = "";
    if(!opts.filterWithQuery) { // don't do folder stuff if they're searching
      if(currentFolderPath !== "") {
        foldersHtml += `<div class="threadFolder" data-folder-path="${sanitizeHtml(currentFolderPath.split("/").slice(0, -1).join("/"))}">🔙 up one level</div>`;
      }
      foldersHtml += currentSubfolderNames.map(name => {
        let folderPath = currentFolderPath ? currentFolderPath+"/"+name : name;
        let icon = threadFolderData[folderPath]?.emoji;
        if(icon && icon.startsWith("http")) {
          icon = `<img src="${sanitizeHtml(icon)}" style="height:1.2rem; width:1.2rem; object-fit:cover; border-radius:2px;"/>`;
        }
        return `<div class="threadFolder" data-folder-path="${sanitizeHtml(folderPath)}">${icon ?? "📁"}<span style="flex-grow:1; margin-left:0.5rem;">${sanitizeHtml(name)}</span><span class="editFolderName emojiButton" style="font-size:0.7rem; display:flex; align-items:center;">✏️</span></div>`;
      }).join("");
    }
    // $.chatThreadFolders.innerHTML = foldersHtml;

    console.log("renderThreadList: 15");

    let dataUrlToCachedBlobUrlMap = {};
    for(let thread of threads) {
      let avatarUrl = thread.character.avatar?.url;
      if(avatarUrl && avatarUrl.startsWith("data:")) {
        dataUrlToCachedBlobUrlMap[avatarUrl] = await dataUrlToCachedBlobUrl(avatarUrl).catch(e => (console.error(e), ""));
      }
    }

    console.log("renderThreadList: 16");

    let dataLossWarningHtml = "";
    if(threads.length > 0 && threads.length < 6) {
      dataLossWarningHtml = `<div style="font-size: 75%;opacity: 0.6;padding: 0.5rem;"><b>Note</b>: Your chat data is stored <u>privately</u> in your browser (<b style="color: #ff8e29;">not</b> on a server), so if your site data/cache is cleared, your chats and characters <b>will be lost</b>. Web browsers sometimes clear data automatically 😨 (e.g. if available storage space is low). Use the <u style="font-weight:bold;">export</u> button to backup your data regularly.</div>`;
    }

    let showAllButtonHtml = "";
    if(threads.length > opts.maxShownThreads) {
      showAllButtonHtml = `<div style="text-align:center; margin-top:0.5rem;"><button class="showAllThreadsButton">show all threads</button></div>`;
      threads = threads.slice(0, opts.maxShownThreads);
    }

    let threadsHtml = threads.map(thread => {
      let avatarUrl = thread.character.avatar?.url;
      if(avatarUrl && avatarUrl.startsWith("data:")) {
        avatarUrl = dataUrlToCachedBlobUrlMap[avatarUrl];
      }
      return `
        <div class="thread" data-thread-id="${sanitizeHtml(thread.id)}">
          <span class="favStar" data-is-fav="${thread.isFav}" title="Favorite/pin this thread">⭐</span>
          <span class="changeFolderPath" title="Add this thread to a folder">📁</span>
          <div class="avatar" style="${avatarUrl ? `background-image:url(${sanitizeHtml(avatarUrl)})` : ""}; border:1px solid var(--border-color);"></div>
          <div class="info" style="flex-grow:1; padding-left:0.5rem; display:flex; flex-direction:column;">
            <div class="nameWrapper" style="font-weight:bold; font-size:0.8rem;"><span class="name" title="${sanitizeHtml(thread.name)}">${sanitizeHtml(thread.name)}</span></div>
            <div class="characterName" style="font-size:0.8rem;">${thread.character.name.length > 15 ? sanitizeHtml(thread.character.name.slice(0, 15)+"…") : sanitizeHtml(thread.character.name)} <span style="opacity:0.5; font-weight:normal; font-size:80%;" title="Character ID">#${sanitizeHtml(thread.character.id)}</span> <span class="characterEditButton" title="Edit this character">${root.combineEmojis("✏️", "👤")}</span></div>
            <div style="font-size:0.8rem; opacity:0.5; padding-right:0.5rem; display:flex; justify-content:space-between; margin-top:auto;"><button class="duplicateThreadBtn" style="font-size:0.45rem; font-weight:bold; min-width:1rem;" title="Create a duplicate/copy of this chat">⿻</button><span style="font-size:0.65rem; display:flex; align-items:center; filter:grayscale(1);" title="Thread ID">🧵#${sanitizeHtml(thread.id)}</span></div>
          </div>
          <div style="display:flex; flex-direction:column; justify-content:space-between; font-size:0.65rem;">
            <span class="button nameEditButton" title="Change thread name">🏷️</span>
            <span class="button exportButton" title="Export/save/backup this thread">💾</span>
            <span class="button deleteButton" title="Delete this thread">🗑️</span>
          </div>
        </div>`;
    }).join("");

    console.log("renderThreadList: 17");

    $.chatThreads.innerHTML = foldersHtml + threadsHtml + dataLossWarningHtml + showAllButtonHtml;

    console.log("renderThreadList: 18");

    $.chatThreads.querySelector(".showAllThreadsButton")?.addEventListener("click", function() {
      this.disabled = true;
      opts.maxShownThreads = 99999999;
      renderThreadList(opts);
    });

    // if message feed is visible, set selected thread to the currently-visible chat thread
    if($.messageFeed.offsetWidth > 0 && activeThreadId !== null) {
      let threadCardForActiveThread = $.chatThreads.querySelector(`.thread[data-thread-id="${activeThreadId}"]`);
      if(threadCardForActiveThread) threadCardForActiveThread.classList.add("selected");
    }

    $.chatThreads.querySelectorAll(".editFolderName").forEach(btn => {
      btn.addEventListener("click", async function(e) {
        e.stopPropagation();
        const folderPath = btn.closest(".threadFolder").dataset.folderPath;

        let label;
        if(folderPath.split("/").length === 1) {
          label = `Edit the name of this folder:`;
        } else {
          label = `Edit the name of this folder by changing '${folderPath.split("/").at(-1)}' to something else, or move all items inside the '${folderPath.split("/").at(-1)}' folder to a new location by editing the whole folder path:`;
        }
        let threadFolderData = (await db.misc.get("threadFolderData"))?.value || {};

        let result = await prompt2({
          newFolderPath: {type:"textLine", label, defaultValue:folderPath},
          emoji: {type:"textLine", label:"Folder emoji or image URL:", defaultValue:threadFolderData[folderPath]?.emoji || ""},
        });
        if(!result) return;

        if(result.emoji) {
          if(!threadFolderData[folderPath]) threadFolderData[folderPath] = {};
          threadFolderData[folderPath].emoji = result.emoji;
        }

        await db.misc.put({key:"threadFolderData", value:threadFolderData});

        let newFolderPath = result.newFolderPath.trim().replace(/^\//, "").replace(/\/$/, "").trim();
        // each thread has a folderPath property, which is a string like "folder1/folder2/folder3" or just "" (empty string) if it's in the root folder
        await db.threads.toCollection().modify(function(thread) {
          // we need to move all threads that start with folderPath to newFolderPath
          if(thread.folderPath === folderPath) {
            thread.folderPath = newFolderPath;
          } else if(thread.folderPath.startsWith(folderPath+"/")) {
            thread.folderPath = newFolderPath + thread.folderPath.slice(folderPath.length);
          }
        });
        await renderThreadList();
      });
    });

    $.chatThreads.querySelectorAll(".thread").forEach(thread => {
      thread.addEventListener("click", async function() {
        const threadId = parseInt(thread.dataset.threadId);
        // let loadingModal = createLoadingModal("Loading...");
        try {
          await showThread(threadId);
        } catch(e) {
          console.error(`Chat thread click --> showThread: thread.dataset.threadId=${thread.dataset.threadId}\n\n${e.message}\n\n${e.stack}`);
          alert(`Error while loading thread #${threadId} - please report this using the feedback button:\n`+e);
          $.newThreadButton.click();
        }
        // loadingModal.delete();
      });
    });
    $.chatThreads.querySelectorAll(".thread .favStar").forEach(favStarEl => {
      favStarEl.addEventListener("click", async function(e) {
        e.stopPropagation();
        const threadId = parseInt(favStarEl.closest(".thread").dataset.threadId);
        let thread = await db.threads.get(threadId);
        let isFav = !thread.isFav;
        await db.threads.update(threadId, { isFav });
        favStarEl.dataset.isFav = isFav;
        await renderThreadList();
      });
    });
    $.chatThreads.querySelectorAll(".thread .changeFolderPath").forEach(changeFolderPathEl => {
      changeFolderPathEl.addEventListener("click", async function(e) {
        e.stopPropagation();
        const threadId = parseInt(changeFolderPathEl.closest(".thread").dataset.threadId);
        let thread = await db.threads.get(threadId);
        let newFolderPath = prompt(`Enter new folder path for this thread. You can add subfolders with forward-slashes like:\nlevi/silly/...`, thread.folderPath);
        if(newFolderPath !== null) {
          newFolderPath = newFolderPath.trim().replace(/^\//, "").replace(/\/$/, "").trim();
          await db.threads.update(threadId, { folderPath: newFolderPath });
          await renderThreadList();
        }
      });
    });
    $.chatThreads.querySelectorAll(".thread .duplicateThreadBtn").forEach(duplicateThreadBtn => {
      duplicateThreadBtn.addEventListener("click", async function(e) {
        e.stopPropagation();
        const threadId = parseInt(duplicateThreadBtn.closest(".thread").dataset.threadId);
        let threadToDuplicate = await db.threads.get(threadId);
        if(confirm(`This will create a copy of this thread. Continue?`)) {
          let newThread = await addThread(threadToDuplicate);

          // copy across messages:
          let messages = await db.messages.where("threadId").equals(threadToDuplicate.id).toArray();
          for(let message of messages) {
            delete message.id;
            message.threadId = newThread.id;
            await db.messages.add(message);
          }

          // copy across thread-specific lore items:
          let loreItems = await db.lore.where("bookId").equals(threadToDuplicate.loreBookId).toArray();
          for(let item of loreItems) {
            delete item.id;
            item.bookId = newThread.loreBookId;
            await db.lore.add(item);
          }

          await renderThreadList();
          await showThread(newThread.id);
        }
      });
    });
    $.chatThreads.querySelectorAll(".threadFolder").forEach(threadFolderEl => {
      threadFolderEl.addEventListener("click", async function(e) {
        e.stopPropagation();
        $.chatThreads.dataset.currentFolderPath = threadFolderEl.dataset.folderPath;
        await renderThreadList();
      });
    });
    $.chatThreads.querySelectorAll(".nameEditButton").forEach(btn => {
      btn.addEventListener("click", async function(e) {
        e.stopPropagation();
        // edit the thread name and re-render thread list.
        const threadId = parseInt(btn.closest(".thread").dataset.threadId);
        let thread = await db.threads.get(threadId);
        let newName = prompt("Enter new name for this thread.", thread.name || "");
        if(newName) {
          await db.threads.update(threadId, { name: newName });
          await renderThreadList();
        }
      });
    });
    $.chatThreads.querySelectorAll(".usageStatsSpend").forEach(btn => {
      btn.addEventListener("click", async function(e) {
        // e.stopPropagation();
      });
    });
    $.chatThreads.querySelectorAll(".exportButton").forEach(btn => {
      btn.addEventListener("click", async function(e) {
        e.stopPropagation();

        const result = await prompt2({
          exportType: {label: "export type:", type: "select", options:[{value:"json", content:"whole thread, including character(s) (recommended)"}, {value:"text", content:"message text only (in [AI]/[USER] format - use '/import' command to import)"}]},
          // includeUserMessagesSentHistory: {hidden:true, label: "include user messages sent history:", type: "select", options:[{value:"no"}, {value:"yes"}]},
        }, {submitButtonText:"export"});
        if(!result) return;

        let loadingModal = createLoadingModal("Exporting thread...");

        let opts = {};
        opts.excludeUserMessagesSentHistory = true;

        const threadId = parseInt(btn.closest(".thread").dataset.threadId);
        let json = await getThreadJSONById(threadId, opts);

        let thread = await db.threads.get(threadId);
        let character = await db.characters.get(thread.characterId);
        let characterIdToName = {};

        if(result.exportType === "text") {
          let filename = encodeURIComponent(`${thread.name} - ${character.name}`.replaceAll(" ", "_")) + ".txt";
          let messages = json.data.data.find(t => t.tableName === "messages").rows.sort((a,b) => a.order-b.order);
          let textBasedMessagesArr = [];
          for(let m of messages) {
            let authorType = m.characterId === -1 ? "USER" : (m.characterId===-2||m.characterId!==thread.characterId) ? "SYSTEM" : "AI";
            let params = [];

            if(m.hiddenFrom.includes("ai")) params.push("hiddenFrom=ai");
            else if(m.hiddenFrom.includes("user")) params.push("hiddenFrom=user");

            if(m.characterId === -2) {
              if(m.name) params.push(`name=${m.name}`);
            } else if(m.characterId >= 0) {
              if(m.characterId !== thread.characterId) {
                if(m.name) {
                  params.push(`name=${m.name}`);
                } else {
                  if(!characterIdToName[m.characterId]) characterIdToName[m.characterId] = (await db.characters.get(m.characterId)).name;
                  params.push(`name=${characterIdToName[m.characterId]}`);
                }
              }
            }
            textBasedMessagesArr.push(`[${authorType}${params.length > 0 ? `; `+params.join(", ") : ""}]: ${m.message}`);
          }
          let text =textBasedMessagesArr.join("\n\n");
          downloadTextOrBlob(text, filename);
        } else {
          let filename = encodeURIComponent(`${thread.name} - ${character.name}`.replaceAll(" ", "_")) + ".json";
          downloadTextOrBlob(JSON.stringify(json), filename);
        }

        loadingModal.delete();
      });
    });


    $.chatThreads.querySelectorAll(".characterEditButton").forEach(btn => {
      btn.addEventListener("click", async function(e) {
        e.preventDefault();
        e.stopPropagation();
        const threadId = parseInt(btn.closest(".thread").dataset.threadId);
        const thread = await db.threads.get(threadId);
        await editCharacterById(thread.characterId);
      });
    });

    $.chatThreads.querySelectorAll(".deleteButton").forEach(btn => {
      btn.addEventListener("click", async function(e) {
        e.stopPropagation();
        if(confirm("Are you sure you want to delete this thread?")) {
          const threadId = parseInt(btn.closest(".thread").dataset.threadId);
          await safelyDeleteThreadById(threadId);
          await renderThreadList();
          // switch to character selection area
          await renderCharacterList();
          document.querySelectorAll("#middleColumn > .middleColumnScreen").forEach(el => hideEl(el));
          showEl($.characterSelection);
        }
      });
    });

    console.log("renderThreadList: 19");

  }


  async function getThreadJSONById(threadId, opts={}) {
    const thread = await db.threads.get(threadId);
    let threadCharacterIds = (await db.messages.where("threadId").equals(threadId).toArray()).map(m => m.characterId);
    threadCharacterIds.push(thread.characterId);
    for(let button of (thread.shortcutButtons || [])) {
      let m = button.message.trimStart().match(/^\/[a-zA-Z]+ @[^ ]+#([0-9]+)/);
      if(m) {
        let id = Number(m[1]);
        if(!isNaN(id)) threadCharacterIds.push(id);
      }
    }
    threadCharacterIds = [...new Set(threadCharacterIds)];
    let threadCharacters = await db.characters.where("id").anyOf(threadCharacterIds).toArray();
    let threadCharacterLoreBookUrls = [...new Set(threadCharacters.map(c => c.loreBookUrls).flat())];

    // const blob = await db.export({prettyJson: true, numRowsPerChunk:100});
    console.log("Exporting full DB first a blob (to then extract parts relevant to this thread)...");
    const blob = await db.export({});
    console.log("Full db exported as blob.");

    let json;
    // try JSON.parse approach first, but may hit string length limit of browser, so fall back to Response method which bypasses that, but has issues in Safari as of writing
    try { json = JSON.parse(await blob.text()); } catch(e) { console.error(e); }
    if(!json) json = await new Response(blob).json(); // use Response hack instead of JSON.parse(await blob.text()) to avoid maximum string length errors

    // in case I add a new table and forget to update this function, tables must be explicitely allowed here:
    let tableNamesAllowList = ["characters", "threads", "messages", "summaries", "memories", "usageStats", "lore"];
    for(let table of json.data.data) {
      if(!tableNamesAllowList.includes(table.tableName)) {
        table.rows = [];
      }
    }

    // only keep the data for the current thread:
    let characters = json.data.data.find(d => d.tableName === "characters");
    characters.rows = characters.rows.filter(c => threadCharacterIds.includes(c.id));

    let threads = json.data.data.find(d => d.tableName === "threads");
    threads.rows = threads.rows.filter(t => t.id === threadId);
    if(threads.rows.length > 1) alert("Something went wrong. There should only be one thread in the export, but several were exported.");

    // privacy stuff:
    if(opts.excludeUserMessagesSentHistory) {
      threads.rows[0].userMessagesSentHistory = [];
    }
    threads.rows[0].unsentMessageText = "";

    let messages = json.data.data.find(d => d.tableName === "messages");
    messages.rows = messages.rows.filter(m => m.threadId === threadId);

    // NOTE: summaries are stored on message objects (i.e. `message.summariesEndingHere[level]`) in the new hierarchical summarization approach. But keeping this for backwards-compatibility.
    let summaries = json.data.data.find(d => d.tableName === "summaries");
    if(summaries) {
      let hashes = new Set(thread.currentSummaryHashChain || []);
      // note: summaries shouldn't really have a threadId because they have hash as a unique key, which means if someone duplicates a thread, there is a single summary, but it's used for multiple threads.
      // that's why we use hashes instead of threadId here. I've yet to adjust the db to remove threadId from summaries.
      summaries.rows = summaries.rows.filter(s => hashes.has(s.hash));
    }

    let memories = json.data.data.find(d => d.tableName === "memories");
    if(memories) {
      memories.rows = memories.rows.filter(s => s.threadId === threadId);
    }

    let lore = json.data.data.find(d => d.tableName === "lore");
    if(lore) {
      lore.rows = lore.rows.filter(l => l.bookId === thread.bookId || (l.bookUrl && threadCharacterLoreBookUrls.includes(l.bookUrl)));
    }

    let usageStats = json.data.data.find(d => d.tableName === "usageStats");
    if(usageStats) {
      usageStats.rows = usageStats.rows.filter(m => m.threadId === threadId);
    }

    sanitizeExportJson(json);

    return json;
  }

  // Given a threadId, this renders the message feed for that thread in the middle column.
