  async function sendButtonClickHandler() {
    $.sendButton.disabled = true;

    try {
      let threadId = activeThreadId;
      let thread = await db.threads.get(threadId);
      let characterId = thread.characterId;
      let threadCharacter = await db.characters.get(characterId);

      // remove un-filled-in shortcut placeholders:
      try {
        let selectedText = window.getSelection().toString();
        if(!selectedText) selectedText = $.messageInput.value.substring($.messageInput.selectionStart, $.messageInput.selectionEnd); // for firefox
        if(selectedText.startsWith("<") && selectedText.endsWith(">")) {
          $.messageInput.value = $.messageInput.value.replace(selectedText, "");
        }
      } catch(e) {
        console.error(e);
      }

      let message = $.messageInput.value;

      if(window.clearInputAfterNextSendButtonClickIfMaintainedPrefix && $.messageInput.value.startsWith(window.clearInputAfterNextSendButtonClickIfMaintainedPrefix)) $.messageInput.value = "";
      window.clearInputAfterNextSendButtonClickIfMaintainedPrefix = null;

      // if they have a shortcut button for this exact message (which they just tapped), then we can definitely clear it
      if(window.mostRecentTappedReplacementShortcutButtonText && $.messageInput.value.trim() === window.mostRecentTappedReplacementShortcutButtonText.trim()) $.messageInput.value = "";
      window.mostRecentTappedReplacementShortcutButtonText = null;

      if(message.startsWith("/nar ")) {
        message = message.replace("/nar ", "/sys @Narrator ");
      }

      // This use used to detect if the browser is not allowing persistent storage, even if the user has been using the app for quite a while.
      // Can't just use e.g. message count because user could have just imported a bunch of messages.
      let datesApplicationWasUsedInThisBrowser = (await db.misc.get("datesApplicationWasUsedInThisBrowser"))?.value ?? [];
      datesApplicationWasUsedInThisBrowser.push(new Date().toISOString().slice(0,10));
      datesApplicationWasUsedInThisBrowser = [...new Set(datesApplicationWasUsedInThisBrowser)];
      await db.misc.put({key: "datesApplicationWasUsedInThisBrowser", value: datesApplicationWasUsedInThisBrowser});

      // if user sent message history contains message, move it to the end, otherwise add it to the end:
      let userMessageHistoryEntry = thread.userMessagesSentHistory.find(x => x.text === message);
      if(userMessageHistoryEntry) {
        thread.userMessagesSentHistory.splice(thread.userMessagesSentHistory.indexOf(userMessageHistoryEntry), 1);
      } else {
        userMessageHistoryEntry = {text:message, isPinned:false};
      }
      thread.userMessagesSentHistory.push(userMessageHistoryEntry);
      // ensure isPinned items are at the end of the array:
      thread.userMessagesSentHistory.sort((a,b) => a.isPinned === b.isPinned ? 0 : a.isPinned ? 1 : -1);
      // keep only the last 50 messages:
      thread.userMessagesSentHistory = thread.userMessagesSentHistory.slice(-30);
      await db.threads.update(threadId, {userMessagesSentHistory:thread.userMessagesSentHistory});

      try {

        if(message.trim() === "/ai" || message.startsWith("/ai ")) {
          // $.messageInput.value = "";

          if(message.trim() === "/ai") {
            await doBotReplyIfNeeded({forceReply:true, expectsReply:false});
          } else {
            let replyInstruction = message.replace(/^\/ai /, "").trimStart();
            // extract char name and ID from start of message if it's present
            let charNameAndId = replyInstruction.match(/^@([^#]+)#([0-9]+)/);
            let characterOverride = null;
            if(charNameAndId) {
              // let charName = charNameAndId[1];
              let characterId = parseInt(charNameAndId[2]);
              characterOverride = await db.characters.get(characterId);
              if(!characterOverride) {
                alert(`CharacterID not found: #${characterId}`);
              }
              replyInstruction = replyInstruction.replace(/^@([^#]+)#([0-9]+)/, "").trim() || null;
            }
            await doBotReplyIfNeeded({forceReply:true, replyInstruction, characterOverride, expectsReply:false});
          }
        } else if(message.trim() === "/user" || message.trim().startsWith("/user ")) {
          if(message.trim() === "/user") {
            // let characterToReplyWith = await getUserCharacterObj(threadId);
            // characterToReplyWith.modelName = thread.modelName; // use whatever model the thread character is using
            await doBotReplyInPlaceOfUser({expectsReply:false});
          } else {
            let replyInstruction = message.replace(/^\/user /, "").trimStart();
            // let characterToReplyWith = await getUserCharacterObj(threadId);
            await doBotReplyInPlaceOfUser({replyInstruction, expectsReply:false});
          }
        } else if(message.trim() === "/sys" || message.trim() === "/system" || message.trim().startsWith("/sys ") || message.trim().startsWith("/system ")) {
          let messageNormalized = message.trim();
          if(message.trim() === "/sys" || message.trim().startsWith("/sys ")) {
            messageNormalized = messageNormalized.replace(/^\/sys/, "/system");
          }
          if(message.trim() === "/system") {
            let characterToReplyWith = await getSystemCharacterObj();
            // characterToReplyWith.modelName = thread.modelName; // use whatever model the thread character is using
            // await doBotReplyInPlaceOfUser({characterToReplyWith, expectsReply:false});
            await doBotReplyIfNeeded({forceReply:true, characterOverride:characterToReplyWith, expectsReply:false});
          } else {
            let replyInstruction = messageNormalized.replace(/^\/system /, "").trimStart();
            let messageNameOverride = null;
            if(/^@[a-zA-Z0-9_\-]+ ?/.test(replyInstruction)) {
              messageNameOverride = replyInstruction.split(" ")[0].replace("@", "");
              replyInstruction = replyInstruction.split(" ").slice(1).join(" ");
            }
            let characterToReplyWith = await getSystemCharacterObj();
            // await doBotReplyInPlaceOfUser({characterToReplyWith, replyInstruction, expectsReply:false});
            await doBotReplyIfNeeded({forceReply:true, replyInstruction, messageNameOverride, characterOverride:characterToReplyWith, expectsReply:false});
          }
        } else if(message.trim() === "/sum") {
          // OLD SUMMARIES APPROACH:
          // // first ensure summary is up to date:
          // let loadingModal = createLoadingModal("Please wait...");
          // const onProgressMessage = (e) => loadingModal.updateContent("Please wait... "+e.message);
          // let {summary, instructionHash, remainingMessages} = await computeAndSaveThreadSummaryIfNeeded({threadId, onProgressMessage});
          // loadingModal.delete();
          // if(summary === undefined) {
          //   return alert("No summary available for this thread yet. Wait until the thread gets longer.");
          // }
          // // now let them edit it:
          // let result = await prompt2({summary: {label: "Summary:", type: "text", height:"fit-content", defaultValue: summary, focus:true}});
          // if(result) {
          //   await db.summaries.update(instructionHash, {summary:result.summary});
          //   addToDebugLog(`<b>edited summary:</b> ${result.summary}`);
          // }

          // NEW HIERARCHICAL SUMMARIES:
          const messages = await db.messages.where("threadId").equals(threadId).toArray();
          messages.sort((a,b) => a.order - b.order);
          let summaries = root.getMessageObjsWithoutSummarizedOnes(messages).map(m => {
            if(!m.summariesEndingHere || Object.keys(m.summariesEndingHere).length === 0) {
              return null;
            } else {
              // getMessageObjsWithoutSummarizedOnes just returns the relevant message object.
              // so we still need to grab the highest-level summary from each object that has
              // summaries:
              let level = Math.max(...Object.keys(m.summariesEndingHere).map(n => Number(n)));
              return {
                content: m.summariesEndingHere[level],
                messageId: m.id,
                level: level,
              };
            }
          }).filter(s => s); // <-- filter out non-summaries

          if(summaries.length === 0) {
            if(threadCharacter.fitMessagesInContextMethod !== "summarizeOld") {
              return alert(`This character doesn't have summaries enabled. You can enable summaries in the character editor.`);
            } else {
              return alert(`The chat isn't long enough for summaries to be required yet.`);
            }
          }

          let promptObj = {
            intro: {type:"none", html:`<p style="margin-top:0; font-size:80%; opacity:0.7;">You can edit these summaries to correct mistakes, but don't delete them. Summaries can be disabled in the character editor.</p>`},
          };
          let i = 0;
          for(let summary of summaries) {
            promptObj[summary.messageId+"|"+summary.level] = {label: `Summary (part ${i+1}):`, type: "text", height:"fit-content", defaultValue: summary.content, focus:i===0};
            i++;
          }
          let result = await prompt2(promptObj);
          if(result) {
            for(let summary of summaries) {
              let messageObj = await db.messages.get(summary.messageId);
              messageObj.summariesEndingHere[summary.level] = result[summary.messageId+"|"+summary.level];
              await db.messages.update(summary.messageId, {summariesEndingHere:messageObj.summariesEndingHere});
            }
            addToDebugLog(`<b>edited summary parts:</b>`, summaries, result);
          }
          $.messageInput.value = "";
        } else if(message.trim() === "/import") {
          let defaultValue = "";
          while(1) {
            let result = await prompt2({
              messagesText: {label: "Add messages in the same format as <a href='https://perchance.org/ai-character-chat-docs#initial-messages' target='blank'>initial messages</a> to add them to this thread:", type: "text", height:"fit-content", defaultValue: "", placeholder:"[USER]: Here's a user message.\n[SYSTEM]: Here's a system message.\n[AI]: Here's an AI message.\n[USER]: Messages can be multi-line\nlike this.", focus:true},
            });
            if(!result) break;
            let messages = parseMessagesFromTextFormat(result.messagesText);
            if(!messages) {
              defaultValue = result.messagesText;
              alert("Invalid message formating. Should start with either '[SYSTEM]:' or '[USER]:' or '[AI]:' (without the quotes).");
            } else {
              let nameToCharacterId = {};
              let noCharacterLinkNames = new Set();
              let names = [...new Set(messages.filter(m => m.name).map(m => m.name))];
              if(names.length > 0) {
                let promptObj = {
                  ___intro___: {type:"none", html:`<div style="font-size:80%;margin-bottom:1rem;padding: 0.5rem;border: 1px solid #6f6f6f;border-radius: 3px;">Some of your messages include character names. You can 'link' those names to actual characters, or just let them be assigned to the 'system' character, if e.g. they're just side characters.</div>`},
                };
                const characters = await db.characters.orderBy("lastMessageTime").reverse().toArray();
                for(let name of names) {
                  promptObj[name] = {label: `<i style="opacity:0.6;">(Optional)</i> Choose the character corresponding to the name "<b>${name}</b>".`, type: "select", options:[{content:`𝗡𝗼 𝗰𝗵𝗮𝗿𝗮𝗰𝘁𝗲𝗿 𝗹𝗶𝗻𝗸`, value:null}, {content:`𝗖𝗿𝗲𝗮𝘁𝗲 𝗻𝗲𝘄 𝗰𝗵𝗮𝗿𝗮𝗰𝘁𝗲𝗿`, value:"NEW"}, ...characters.map(c => ({content:`${c.name} #${c.id}`, value:c.id}))]};
                }
                let result = await prompt2(promptObj);
                if(!result) return;
                delete result.___intro___;
                // if they selected "Create new character" for any of them, we need to let them create those characters:
                for(let [name, id] of Object.entries(result)) {
                  if(id === "NEW") {
                    let result = await characterDetailsPrompt({name:name});
                    if(result) {
                      let character = await addCharacter(result);
                      id = character.id;
                    } else {
                      id = null;
                    }
                  }
                  if(id !== null) nameToCharacterId[name] = Number(id);
                  if(isNaN(nameToCharacterId[name])) delete nameToCharacterId[name]; // safety
                }
              }


              let loadingModal = createLoadingModal("Please wait...");
              let i = 0;
              for(let message of messages) {
                let messageCharacterId;
                if(message.author === "ai") messageCharacterId = characterId;
                else if(message.author === "user") messageCharacterId = -1;
                else if(message.author === "system") messageCharacterId = -2;
                else {
                  alert("There's a problem with parseMessagesFromTextFormat - it's producing an invalid 'author' value. Please report this problem using the feedback button.");
                  defaultValue = result.messagesText;
                  continue;
                }
                let messageArgs = {threadId, message:message.content, characterId:messageCharacterId, hiddenFrom:message.hiddenFrom || []};
                if(typeof nameToCharacterId[message.name] === "number") {
                  messageArgs.characterId = nameToCharacterId[message.name];
                } else if(message.name) {
                  messageArgs.name = message.name;
                  messageArgs.characterId = -2;
                }
                let messageObj = createMessageObj(messageArgs);
                messageObj.id = await addMessageToDb(messageObj);
                i++;
                if(i % 10 === 0) loadingModal.updateContent(`Please wait... (${i}/${messages.length})`);
              }
              await renderMessageFeed(threadId);
              loadingModal.delete();
              break;
            }
          }
          $.messageInput.value = "";
        } else if(message.trim() === "/mem") {
          window.userIsCurrentlyEditingMemories = true;
          let thread = await db.threads.get(threadId);
          let embeddingModelName = thread.textEmbeddingModelName;

          // let originalGeneratedMemories = await db.memories.where({threadId, status:"current"}).toArray();
          let messages = await db.messages.where("threadId").equals(threadId).toArray();
          let originalMemories = messages.map(message => {
            let messageMems = [];
            for(let level in message.memoriesEndingHere || {}) {
              let i = 0;
              for(let memory of message.memoriesEndingHere[level] || []) {
                memory.id = `${message.id}|${level}|${i}`; // we need to add an id for memoryIdBatchesUsed tracking
                messageMems.push(memory);
                i++;
              }
            }
            return messageMems;
          }).flat();

          if(!originalMemories[0]) {
            return alert("No memories yet. You'll need to wait for the chat/thread to become longer, and make sure you have memories enabled in the character editor. Use the '/lore' command if you have lots of non-chronological (i.e. unordered) facts/lore that you want the AI to remember. If you only have a small number of facts, you can put them in the character description.");
          }

          // emulate old memory format for now (otherwise would need to update lore format too, which would be a bit of a pain, so this is fine):
          originalMemories = originalMemories.map((mem, i) => ({
            text: mem.text,
            id: mem.id, // `${message.id}|${level}|${indexWithinLevel}`
            index: i, // this is the overall index of the memory within the whole thread
            embeddings: {[thread.textEmbeddingModelName]:mem.embedding},
            status: "current", // note that this 'status' field is completely unused at this point - from the old old system
            characterId: threadCharacter.id,
            threadId: thread.id,
          }));

          originalMemories.sort((a,b) => a.index - b.index);

          let textToOriginalMemory = new Map();
          for(let entry of originalMemories) {
            if(textToOriginalMemory.has(entry.text)) {
              // there's a duplicate, so for now we just hackily add a space to the end to avoid problems with mapping entries back to their object:
              while(textToOriginalMemory.has(entry.text)) {
                entry.text += " ";
              }
              // update the memory in the DB too:
              // await db.memories.update(entry.id, {text:entry.text});
              let [messageId, level, indexWithinLevel] = entry.id.split("|").map(n => Number(n))
              let message = await db.messages.get(messageId);
              message.memoriesEndingHere[level][indexWithinLevel] = {text:entry.text, embedding:entry.embeddings[thread.textEmbeddingModelName]};
              await db.messages.update(messageId, {memoriesEndingHere:message.memoriesEndingHere});
            }
            textToOriginalMemory.set(entry.text, entry);
          }

          let textToEmbeddingCache = new Map();
          for(let entry of originalMemories) {
            if(entry.embeddings[embeddingModelName] === undefined) { // <-- entry may not have an embedding if the embedding model was changed (or if there's a bug)
              console.warn("Memory entry has no embedding for the current embedding model:", entry);
            } else {
              textToEmbeddingCache.set(entry.text, entry.embeddings[embeddingModelName]);
            }
          }


          let originalMemoriesText = originalMemories.map(m => `${m.text}`).join("\n\n");

          let newMemoriesTextDefaultValue = originalMemoriesText;

          let loadingModal;

          let controls;

          // async function regenerateMemoriesHandler() {
          //   if(!confirm("This will DELETE all MEMORIES. Fresh memories will be regenerated during your character's next reply, which could take a *long* time if the chat thread is long. Are you sure you want to delete all memories?")) return;
          //   let { instructionHashChain } = await computeAndSaveThreadSummaryIfNeeded({threadId, exitOnFirstHashMissAndReturnHashChain:true});
          //   await db.transaction('rw', [db.summaries, db.memories], async tx => {
          //     await tx.table("summaries").where("hash").anyOf(instructionHashChain).delete();
          //     await tx.table("memories").where({threadId}).delete();
          //   });
          //   controls.cancel();
          // }

          while(1) {

            controls = {};

            let result = await prompt2({
              newMemoriesText: {label: `Edit character 'memories'. <span style="opacity:0.7; font-style:italic;">${originalMemories.length === 0 ? `If you have memories enabled in the character editor, then your character will automatically start generating memories once the chat becomes long enough to make it worthwhile. ` : ""}Ensure there is a <u>blank line between entries</u>. Each individual memory should be no longer than a sentence or two. Edits should not significantly change the overall ordering/chronology. Use the <b style="white-space:nowrap;">/lore</b> command to store non-chronological (i.e. unordered) facts/lore.</span>`, type: "text", height:"fit-content", minHeight:"8rem", defaultValue:newMemoriesTextDefaultValue, placeholder:"If this box is empty, your character hasn't stored any memories yet because the chat thread isn't long enough to warrant it."},
              // deleteAndRegenMemories: {hidden:true, type:"buttons", label:null, buttons:[{text:"delete &amp; regenerate all memories", onClick:regenerateMemoriesHandler}]},
            }, {submitButtonText:"save", controls});
            if(!result) break;

            // we set these so that if there's an error (e.g. while embedding, or with database) the while loop continues and they don't lose their edits
            newMemoriesTextDefaultValue = result.newMemoriesText;

            if(result.newMemoriesText.trim() === "") {
              // delete all original memories:
              for(let i = 0; i < originalMemories.length; i++) {
                let [messageId, level, indexWithinLevel] = originalMemories[i].id.split("|").map(n => Number(n))
                await db.messages.update(messageId, {memoriesEndingHere:null});
              }
              break;
            }

            // fix/clean text, and if a line only contains whitespace, then we want that to be considered a "blank line" for the purpose of separating memories
            let fixedText = result.newMemoriesText.replace(/\r/g, "").replace(/\n\s*\n/g, "\n\n");

            // note: bit hacky, but we only trim newlines from start and end - NOT spaces, since we are using spaces to distinguish between different memories with the same text
            let newMemoriesTextArr = fixedText.split(/\n{2,}/).map(m => m.replace(/^\n+|\n+$/g, "")).filter(m => m);

            // make sure they're all unique:
            let alreadySeenNewMemoryTexts = new Set();
            for(let i = 0; i < newMemoriesTextArr.length; i++) {
              let text = newMemoriesTextArr[i];
              while(alreadySeenNewMemoryTexts.has(text)) {
                 text += " ";
              }
              newMemoriesTextArr[i] = text;
              alreadySeenNewMemoryTexts.add(text);
            }

            loadingModal = createLoadingModal("Processing memories. Please wait...", $.middleColumn);

            let newTexts = [];
            for(let text of newMemoriesTextArr) {
              if(!textToEmbeddingCache.has(text)) {
                newTexts.push(text);
              }
            }

            try {

              let newEmbeddings = await embedTexts({textArr:newTexts, modelName:embeddingModelName});
              for(let i = 0; i < newTexts.length; i++) {
                textToEmbeddingCache.set(newTexts[i], newEmbeddings[i]);
              }

              if(originalMemoriesText !== result.newMemoriesText || newEmbeddings.length > 0) { // we (edit: may) need the `newEmbeddings.length > 0` bit because of stuff related to duplicate memories (possibly only due to since-fixed database upgrade bug)
                // debugger;
                // dumb but good-enough approach, for now:
                // assume all level 1 memories, and we just loop over the new memories and assign them to the "nearest" original message id:
                let messageIdsArr = originalMemories.map(m => m.id.split("|").map(n => Number(n))[0]);
                let newMemoryIndexToMessageId = {};
                for(let i = 0; i < newMemoriesTextArr.length; i++) {
                  let closestMessageIdsArrIndex = Math.floor((i/newMemoriesTextArr.length) * messageIdsArr.length);
                  newMemoryIndexToMessageId[i] = messageIdsArr[closestMessageIdsArrIndex];
                }
                for(let messageId of [...new Set(messageIdsArr)]) {
                  let newMemoryIndicesForThisMessage = Object.entries(newMemoryIndexToMessageId).filter(e => e[1] === messageId).map(e => Number(e[0]));
                  let newMemoryTextsForThisMessage = newMemoryIndicesForThisMessage.map(index => newMemoriesTextArr[index]);
                  let memoriesEndingHere = {"1":[]};
                  for(let text of newMemoryTextsForThisMessage) {
                    let embedding = textToEmbeddingCache.get(text);
                    if(!embedding) throw new Error("Text embedding should have been precomputed and cached. Code:1");
                    memoriesEndingHere[1].push({text, embedding});
                  }
                  let message = await db.messages.get(messageId);
                  if(message.memoriesEndingHere?.[0] || message.memoriesEndingHere?.[2]) throw new Error("Unexpected level in message.memoriesEndingHere");
                  await db.messages.update(messageId, {memoriesEndingHere:memoriesEndingHere});
                }

                // // first we remove edited/deleted memories from their parent message object:
                // let memoriesIdsMovedOrDeleted = [];
                // for(let i = 0; i < originalMemories.length; i++) {
                //   let memoryObj = originalMemories[i];
                //   if(!newMemoriesTextArr.includes(memoryObj.text)) {
                //     memoriesIdsMovedOrDeleted.push(memoryObj.id);
                //     let [messageId, level, indexWithinLevel] = memoryObj
                //     let message = await db.messages.get(messageId);
                //     message.memoriesEndingHere[level][indexWithinLevel] = null;
                //     await db.messages.update(messageId, {memoriesEndingHere:message.memoriesEndingHere});
                //   }
                // }
                // debugger;
                // // we make the assumption that the first entry goes in the same position as the original first one, so if it's different, we need to update it:
                // if(newMemoriesTextArr[0] !== originalMemories[0].text) {
                //   let [messageId, level, indexWithinLevel] = originalMemories[0].id.split("|").map(n => Number(n));
                //   let embedding = textToEmbeddingCache.get(newMemoriesTextArr[0]);
                //   if(!embedding) throw new Error("Text embedding should have been precomputed and cached. Code:1");
                //   let message = await db.messages.get(messageId);
                //   message.memoriesEndingHere[level][indexWithinLevel] = {text:newMemoriesTextArr[0], embedding};
                //   await db.messages.update(messageId, {memoriesEndingHere:message.memoriesEndingHere});
                // }
                // // newly added/edited memories get added into the same message/level as the last seen existing memory object.
                // // we use the first 'null' spot (else put at end) because the deleted ones above will create null spots for new versions of that same entry.
                // let [lastSeenMessageId, lastSeenLevel, lastSeenIndexWithinLevel] = originalMemories[0].id.split("|").map(n => Number(n));
                // let messageIdLevelsChanged = new Set();
                // for(let i = 1; i < newMemoriesTextArr.length; i++) {
                //   let text = newMemoriesTextArr[i];
                //   let embedding = textToEmbeddingCache.get(text);
                //   if(!embedding) throw new Error("Text embedding should have been precomputed and cached. Code:2");
                //   let originalMemory = textToOriginalMemory.get(text);
                //   let needsToBeAdded = false;
                //   if(originalMemory) {
                //     let [originalMessageId, originalLevel, originalIndexWithinLevel] = originalMemory.id.split("|").map(n => Number(n));

                //     let isAfterPrevious = false;
                //     if(!isAfterPrevious) isAfterPrevious = lastSeenMessageId === originalMessageId && lastSeenLevel === originalLevel && lastSeenIndexWithinLevel === originalIndexWithinLevel+1;
                //     if(!isAfterPrevious) isAfterPrevious = lastSeenLevel === originalLevel && lastSeenIndexWithinLevel === originalIndexWithinLevel+1;

                //     if(messageIdLevelsChanged.has(originalMessageId+"|"+originalLevel) || !isAfterPrevious) {
                //       needsToBeAdded = true; // it's not currently *exactly* after the last seen id/level/index, so we need to move it to that position
                //       // set old position to null:
                //       memoriesIdsMovedOrDeleted.push(originalMemory.id);
                //       let message = await db.messages.get(originalMessageId);
                //       message.memoriesEndingHere[originalLevel][originalIndexWithinLevel] = null;
                //       await db.messages.update(originalMessageId, {memoriesEndingHere:message.memoriesEndingHere});
                //     }
                //   } else {
                //     needsToBeAdded = true; // doesn't exist, so we need to add it right after the last seen id/level/index position
                //   }
                //   if(needsToBeAdded) {
                //     let message = await db.messages.get(lastSeenMessageId);
                //     message.memoriesEndingHere[lastSeenLevel].splice(lastSeenIndexWithinLevel+1, 0, {text, embedding})
                //     lastSeenIndexWithinLevel = lastSeenIndexWithinLevel+1;
                //     messageIdLevelsChanged.add(lastSeenMessageId+"|"+lastSeenLevel); // so we know that positions have been 'messed up' in this array - i.e. originalIndexWithinLevel are no longer accurate in this id/level
                //     await db.messages.update(lastSeenMessageId, {memoriesEndingHere:message.memoriesEndingHere});
                //   } else {
                //     ([lastSeenMessageId, lastSeenLevel, lastSeenIndexWithinLevel] = originalMemory.id.split("|").map(n => Number(n)));
                //   }
                // }
                // debugger;
                // // remove gaps due to deleted memories that weren't due to edits
                // // (this code is not efficient, but that's fine for now - not hot path)
                // let alreadyRemovedGapsForMessageIds = new Set();
                // for(let id of memoriesIdsMovedOrDeleted) {
                //   let [messageId, level, _] = id.split("|").map(n => Number(n));
                //   if(alreadyRemovedGapsForMessageIds.has(messageId+"|"+level)) continue;
                //   alreadyRemovedGapsForMessageIds.add(messageId+"|"+level);
                //   let message = await db.messages.get(messageId);
                //   message.memoriesEndingHere[level] = message.memoriesEndingHere[level].filter(o => o);
                //   await db.messages.update(messageId, {memoriesEndingHere:message.memoriesEndingHere});
                // }

                window.userIsCurrentlyEditingMemories = false;
              }

            } catch(e) {
              console.error("There was an error while saving the memories:", e);
              alert("There was an error while saving the memories:\n"+e.stack);
              loadingModal.delete();
              continue;
            }

            loadingModal.delete();
            break;
          }
          window.userIsCurrentlyEditingMemories = false;
          $.messageInput.value = "";
        } else if(message.trim().startsWith("/lore ")) {
          // text following /lore is a lore entry to add to db.lore
          let loadingModal = createLoadingModal("Computing lore embedding. Please wait...", $.middleColumn);
          let text = message.trim().slice("/lore ".length);
          let thread = await db.threads.get(threadId);
          let bookId = thread.loreBookId;
          let modelName = thread.textEmbeddingModelName;
          let embedding = await embedTexts({textArr:[text], modelName});
          let obj = {bookId, bookUrl:null, text, embeddings:{[modelName]:embedding[0]}, triggers:[]};
          await db.lore.add(obj);
          loadingModal.delete();
          $.messageInput.value = "";
        } else if(message.trim() === "/lore") {
          let thread = await db.threads.get(threadId);
          let character = await db.characters.get(thread.characterId);
          let loreBookId = thread.loreBookId;
          if(loreBookId === undefined) debugger;
          let originalLoreEntries = await db.lore.where({bookId:loreBookId}).toArray();

          let textToEmbeddingCache = new Map();
          for(let entry of originalLoreEntries) {
            textToEmbeddingCache.set(entry.text, entry.embedding);
          }

          let textToLoreObj = new Map();
          for(let entry of originalLoreEntries) {
            textToLoreObj.set(entry.text, entry);
          }

          let originalLoreEntriesText = originalLoreEntries.map(m => `${m.text}`).join("\n\n");

          let loreDefaultValue = originalLoreEntriesText;

          let loreBookUrlEntries = await db.lore.where("bookUrl").anyOf(character.loreBookUrls).toArray();

          while(1) {
            let controls = {}; // this will get populated with `data` object that is proxied such that we can update the values of the inputs in reloadButtonClickHandler.

            async function reloadButtonClickHandler() {
              await ensureLoreUrlsAreLoaded({loreBookUrls:character.loreBookUrls, modelName:thread.textEmbeddingModelName}).catch(e => console.error(e));
              loreBookUrlEntries = await db.lore.where("bookUrl").anyOf(character.loreBookUrls).toArray();
              controls.data.loreBookUrlEntriesText = loreBookUrlEntries.map(m => `${m.text}`).join("\n\n");
            }

            let result = await prompt2({
              loreEntriesText: {label: "Add/edit lore entries specifically for <u>this</u> thread. Entries should be short facts about the world/characters/etc, separated by blank lines. If you want to add lore entries for <i>every</i> thread that involves this character, you can do that in the character editor.", type: "text", height:"fit-content", defaultValue:loreDefaultValue, placeholder:"Here's an example lore entry.\n\nAnd here's another.\n\nAnd here's yet another. As you can see, lore entries should be separated with a blank line.", focus:true, infoTooltip:"Lorebook entries can be used to describe facts about your world, characters, towns, demographics, relationships, etc. The AI 'searches' the lorebook for relevant entries when it's trying to work out the most appropriate thing to say/write next. Use relevant words, phrases, character names, etc. in each entry to help it trigger it at the appropriate moments. Don't make lore entries too big - maximum of a few sentences per entry, and try to make them self-contained \"facts\". You can add thousands of entries - it will NOT slow down replies. You should think of lore entries like \"dynamic reminder messages\" which get read by the AI only when they're deemed relevant to the current situation in your story/chat."},
              loreBookUrlEntriesText: {hidden:true, label: "Here are the entries loaded from this character's lorebook URLs. You can't edit these directly - open the character editor instead. Click the reload button below to pull in any changes that have been made to the character's lorebook URLs or the content at those URLs.", type: "text", placeholder:"You haven't added any lorebooks to your character. Open the character editor if you wish to do so.", disabled:true, height:"fit-content", defaultValue:loreBookUrlEntries.map(e => e.text).join("\n\n")},
              reloadLoreUrlsButton: {hidden:true, type:"buttons", label:null, buttons:[{text:"Reload Lore URLs", onClick:reloadButtonClickHandler}]},
            }, {submitButtonText:"save", showHiddenInputsText: "show character-specific lore", controls});
            if(!result) break;

            // we set these so that if there's an error (e.g. while embedding, or with database) the while loop continues and they don't lose their edits
            loreDefaultValue = result.loreEntriesText;

            let newLoreEntries = result.loreEntriesText.replace(/\r/g, "").split(/\n{2,}/).map(e => e.trim()).filter(e => e);

            // remove duplicates from newLoreEntries to prevent problems with our textToLoreObj mappings.
            // doesn't make sense to have duplicate memories anyway.
            newLoreEntries = [...new Set(newLoreEntries)];

            let loadingModal = createLoadingModal("Computing lore embeddings. Please wait...", $.middleColumn);

            let embeddingModelName = thread.textEmbeddingModelName;
            let newTexts = [];
            for(let text of newLoreEntries) {
              if(!textToEmbeddingCache.has(text)) {
                newTexts.push(text);
              }
            }

            try {

              let newEmbeddings = await embedTexts({textArr:newTexts, modelName:embeddingModelName});
              for(let i = 0; i < newTexts.length; i++) {
                textToEmbeddingCache.set(newTexts[i], newEmbeddings[i]);
              }

              if(originalLoreEntriesText !== result.loreEntriesText) {
                let newLoreEntryObjs = [];
                for(let text of newLoreEntries) {
                  let obj;
                  if(textToLoreObj.has(text)) {
                    obj = textToLoreObj.get(text);
                  } else {
                    let embedding = textToEmbeddingCache.get(text);
                    obj = {bookId:loreBookId, bookUrl:null, text, embeddings:{[embeddingModelName]:embedding}, triggers:[]};
                  }
                  newLoreEntryObjs.push(obj);
                }

                await db.transaction('rw', db.lore, async tx => {
                  // note: entries lose their original id if they are edited, which means references from message.loreIdsUsed are lost - that's okay, since it's just used for 'debugging' anyway - we just indicate to the user (in the 'brain icon modal') that the lore entry no longer exists.
                  await tx.table("lore").where({bookId:loreBookId}).delete();
                  await tx.table("lore").bulkAdd(newLoreEntryObjs);
                });
              }

            } catch(e) {
              console.error("There was an error while saving the lore entries:", e);
              alert("There was an error while saving the lore entries:\n"+e.stack);
              continue;
            }

            loadingModal.delete();
            break;
          }
          $.messageInput.value = "";
        } else if(message.startsWith("/name ") || message.startsWith("/avatar ")) {
          let arg = message.replace(/^\/(name|avatar) /, "");
          let thread = await db.threads.get(threadId);
          if(message.startsWith("/name ")) {
            // let regex = new RegExp(characterNameValidationPattern);
            // if(regex.test(arg)) {
            thread.userCharacter.name = arg;
            alert(`Your name has been changed to "${arg}" for this particular chat thread.`);
            // } else {
            //   alert(`Unfortunately, names must only contain letters, numbers, spaces, hyphens and underscores, and must be 64 characters or less.`);
            // }

            // warn about changing name after summarization has started:
            // let summaryCount = await db.summaries.where("threadId").equals(threadId).count();
            let messageCount = await db.messages.where("threadId").equals(threadId).count();
            if(messageCount > 40 && threadCharacter.fitMessagesInContextMethod === "summarizeOld") {
              let warningMessage = `Warning: This character has summaries enabled which means that the earlier summaries may contain references to your old name. You can see and edit the summaries by typing /sum in the chat.`;
              if(threadCharacter.associativeMemoryMethod !== "none") warningMessage += ` This is also the case for character memories. You can see and edit memories by typing /mem in the chat.`;
              warningMessage += `\n\nIt's best to do any name changes at the start of the thread, before summaries${threadCharacter.associativeMemoryMethod !== "none" ? " and memories" : ""} start to be computed/stored.`;
              alert(warningMessage);
            }
          } else if(message.startsWith("/avatar ")) {
            thread.userCharacter.avatar.url = arg;
          }
          await db.threads.update(threadId, {userCharacter: thread.userCharacter});
          await renderMessageFeed(threadId, {forceFullRender:true});
          await renderShortcutButtons(); // since shortcut names can contain {{user}} and {{char}}
          $.messageInput.value = "";
        } else if(message.trim() === "/image" || /^\/image[ ]+--num=[0-9]+$/.test(message.trim())) { // plain `/image` command or with number of images after it - so we need to generate the caption based on the context
          let characterToReplyWith = await getSystemCharacterObj();
          let replyInstruction = `In one paragraph, describe all visual details of the above, current situation in the above chat/story/rp. Don't progress the story. Just describe the current scene/situation. Use visually descriptive language. Ensure you describe everything, including what the characters (if any) look like. This description will be used as the prompt for an AI image generator, so you can't assume the AI image generation model knows what the characters look like.`;
          let extraStopSequences = ["\n\n"];
          let startMessageWith = "The"; // so '\n\n' stop sequence doesn't cause it to stop right away if it adds some initial newlines
          let messageNameOverride = `Narrator`;
          let wrapInImageTags = 1;
          if(/^\/image[ ]+--num=[0-9]+$/.test(message.trim())) {
            wrapInImageTags = Number(message.trim().match(/^\/image[ ]+--num=([0-9]+)$/)[1]);
            if(wrapInImageTags > 100) wrapInImageTags = 100;
          }
          await doBotReplyIfNeeded({forceReply:true, characterOverride:characterToReplyWith, replyInstruction, messageNameOverride, extraStopSequences, startMessageWith, wrapInImageTags, expectsReply:false});
        } else {

          // image command with caption after it:
          message = message.replace(/(^|\n)\/image\s+(.+)(\n|$)/g, function(m, p1, prompt, p2) {
            let numImages = 1;
            if(/^--num=[0-9]+\s/.test(prompt.trim())) {
              numImages = Number(prompt.trim().match(/^--num=([0-9]+)(\s|$)/)[1]);
              prompt = prompt.trim().replace(/^--num=([0-9]+)/, "").trim();
            }
            return p1 + `<image>${prompt}</image> `.repeat(numImages) + p2;
          });

          let senderCharacterId = thread.currentReplyAsCharacterId ?? -1;

          // EDIT: system command is now instruction-based, like with /ai and /user
          // if(message.startsWith("/sys ")) {
          //   message = message.replace(/^\/sys /, "");
          //   senderCharacterId = -2;
          // }
          // if(message.startsWith("/system ")) {
          //   message = message.replace(/^\/system /, "");
          //   senderCharacterId = -2;
          // }

          let lastLineCommand = null;
          if(senderCharacterId === -1) {
            // user can end message with /ai <instruction> to give instruction to the AI for their reply:
            let messageLines = message.trim().split("\n");
            let lastLine = messageLines.pop();
            if(lastLine?.startsWith("/ai ") || lastLine?.startsWith("/user ")) {
              message = messageLines.join("\n");
              lastLineCommand = lastLine;
            }
          }

          // for now, if user is replying as system, the default name is "Narrator". can add currentReplyAsCharacterNameOverride in the future if needed
          let name = null;
          if(senderCharacterId === -2) {
            name = "Narrator";
          }

          let messageObj = createMessageObj({threadId, name, message, characterId:senderCharacterId});

          let id = await addMessageToDb(messageObj);
          messageObj.id = id;

          let character;
          if(messageObj.characterId === -1) character = await getUserCharacterObj();
          else if(messageObj.characterId === -2) character = await getSystemCharacterObj();
          else character = await db.characters.get(messageObj.characterId);

          if(character.id >= 0) await db.characters.update(character.id, { lastMessageTime: Date.now() });

          await addMessageToFeed(messageObj, {character});

          $.messageInput.value = "";
          $.messageInput.style.height = "";
          await triggerMessageActionCustomCodeEvent({threadId, eventData:{}, eventName:"MessageAdded", triggerBotReply:false});

          if(lastLineCommand) {
            $.messageInput.value = lastLineCommand;
            await sendButtonClickHandler();
          } else {
            if(thread.autoReplyDisabled) {
              // no auto-reply
            } else {
              await doBotReplyIfNeeded(); // note that we can't just pass the replyInstruction here because doBotReplyIfNeeded can get called in the process of executing triggerMessageActionCustomCodeEvent, so we use the global instructionForNextBotReply instead
            }
          }
        }
      } catch(e) {
        console.error("sendButtonClickHandler error: ", e);
        alert("sendButtonClickHandler error: "+e.stack);
        $.messageInput.value = message;
        // window.userIsCurrentlyEditingMemories = false;
      }
      // window.userIsCurrentlyEditingMemories = false;

      await db.threads.update(threadId, {unsentMessageText:$.messageInput.value});

      // EDIT: new hierarchical summary approach doesn't "hold up" chat message generation, so no need to trigger summarization here.
      // if(threadCharacter.fitMessagesInContextMethod === "summarizeOld") {
      //   // we don't `await` this because we want it to happen in the background
      //   computeAndSaveThreadSummaryIfNeeded({threadId});
      // }

      let messageCount = await db.messages.count();
      if(messageCount >= 4) { // PERCHANCE EDIT (to declutter the page on their first interaction)
        document.querySelector(':root').style.setProperty('--inline-reminder-message-default-visibility', 'visible');
        // document.querySelector(':root').style.setProperty('--shortcut-buttons-display', 'initial');
      }
      let threadCount = await db.threads.count();
      if(threadCount < 4 && messageCount > 14 && !localStorage.hasSeenInitialTipsModal) {
        localStorage.hasSeenInitialTipsModal = "1";
        await prompt2({message:{type:"none", html:dedent(`
          <div style="white-space: pre-wrap;"><b>Looks like you're new to this Perchance character chat, so here are some quick tips:</b>

          <b>1.</b> If the character is undesirably speaking/acting on your behalf, try limiting its response length to 1 paragraph using the character editor.

          <b>2.</b> It's very important that you edit the AI's responses (just double-tap on the message) if it says something you don't like, or speaks in a style you don't like - especially for the first few messages of a conversation. This is the most powerful way to control the AI's behavior - the AI will mostly tend to write in a way that is similar to previous messages in the chat.

          <b>3.</b> To fix common errors that your character makes, or change its writing style, experiment with the character's "reminder message" (in the character editor), but try to keep it short.

          <b>4.</b> Look at the instructions and reminders of 'example characters' for ideas, and open the comments to discuss things with others. Also, be sure to read the <a href="https://perchance.org/ai-character-chat-docs#tips" target="_blank">tips</a> page to learn about some handy slash command and features (e.g. group chats, image generation, etc).</div>`)}
        }, {cancelButtonText:null, submitButtonText:"✅ Okay, got it"});
      }

      if(threadCount >= 3 || messageCount >= 30) {
        try { tryPersistBrowserStorageData(); } catch(e) { console.error(e); }
      }

      try {
        if(window.location.href.includes("?data=") || window.location.href.includes("?char=") || window.location.href.includes("&data=") || window.location.href.includes("&char=")) {
          history.replaceState({}, "", `/${generatorName}`);
        }
      } catch(e) { console.error(e); }

    } finally {
      $.sendButton.disabled = false;
    }

  }

  async function queueUpAutoReplies(replies) {
    for(let reply of replies) {
      $.messageInput.value = reply;
      await sendButtonClickHandler();
    }
  }

  function getDateTimeString(utcMs) {
    let now = new Date();
    if(now-utcMs > 1000*60*60*24) return new Date(utcMs).toISOString().split('T')[0].replace(/-/g, "/")+" "+new Date(utcMs).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}).replace(/^0([0-9]):/, "$1:");
    else return new Date(utcMs).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}).replace(/^0([0-9]):/, "$1:");
  }

  // db naming --> public custom code API naming
