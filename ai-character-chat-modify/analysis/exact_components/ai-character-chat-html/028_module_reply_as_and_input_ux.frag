  $.sendButton.addEventListener("click", sendButtonClickHandler);

  async function doBotReplyInPlaceOfUser({replyInstruction=null, startMessageWith=null, signals=null, expectsReply=undefined, result={}}={}) {
    let threadId = activeThreadId;
    let userCharacter = await getUserCharacterObj(threadId);
    let thread = await db.threads.get(threadId);
    let threadCharacter = await db.characters.get(thread.characterId);

    try {
      for(let key in threadCharacter.userCharacter) {
        userCharacter[key] = threadCharacter.userCharacter[key];
      }
    } catch(e) { console.error(e) } // try/catch because new code

    let messageObj = createMessageObj({threadId, message:"...", characterId:-1, instruction:replyInstruction});

    // EDIT: Commented these out because doBotReplyInPlaceOfUser is now only for the actual user character - others use doBotReplyIfNeeded with the `characterOverride` parameter.
    // And this was wrong anyway because you can't e.g. put a thread-external character's avatar in a message - it could have a data URL, which would make each message huge, and bloat the database.
    // messageObj.name = messageObjToCharacterName(messageObj, {thread, character:characterToReplyWith, threadCharacter}); // was previously: `characterToReplyWith.name` which I'm quite sure is wrong
    // messageObj.avatar = messageObjToCharacterAvatar(messageObj, {thread, character:characterToReplyWith, threadCharacter}); // was previously: `structuredClone(characterToReplyWith.avatar)`

    let messageEl = await addMessageToFeed(messageObj, {character:userCharacter, skipReaderRendering:true});
    messageEl.messageObj = messageObj; // this is so we can surgically re-render this message if custom code updates e.g. oc.thread.character.avatar.url during streaming of this message - see "dataChanged" event recieved from customCode iframe.
    messageEl.dataset.currentlyStreaming = "1";
    messageEl.querySelector(".messageText").innerHTML = createPaddedTypingIndicatorHtml();

    if(!signals) signals = {stop:false, wasDeleted:false};
    messageEl.querySelector(".info .deleteButton").addEventListener("click", async e => {
      e.preventDefault(); e.stopPropagation();
      signals.stop = true;
      signals.wasDeleted = true;
      messageEl.remove();
    });

    let messages = await db.messages.where("threadId").equals(threadId).toArray();
    messages.sort((a,b) => a.order - b.order);

    let streamingChunkCount = 0;

    $.statusNotifier.innerHTML = `<button style='font-size: 0.9rem; margin-top:1.5rem; box-shadow:0px 1px 8px 5px var(--background); max-height:1.5rem; display:inline-flex; align-items:center; justify-content:center;'>🛑&nbsp;stop response&nbsp;${animatedLoadingSvg}</button>`;
    $.statusNotifier.querySelector("button").addEventListener("click", async (e) => {
      e.preventDefault(); e.stopPropagation();
      signals.stop = true;
      if(!userCharacter.streamingResponse || (userCharacter.streamingResponse && streamingChunkCount === 0)) {
        messageEl.remove();
        signals.wasDeleted = true;
      }
      $.statusNotifier.innerHTML = "";
      hideEl($.statusNotifier);
    });
    showEl($.statusNotifier);

    function onStreamingReplyChunk(c) {
      handleStreamingReplyChunk(c, messageEl);
      streamingChunkCount++;
    }

    const onProgressMessage = (e) => messageEl.querySelector(".statusMessage").innerHTML=e.message;
    let {message, memoryIdBatchesUsed, loreIdsUsed, summaryHashUsed, summariesUsed, memoryQueriesUsed, messageIdsUsed} = await getBotReply({messages, replyingCharacter:userCharacter, replyInstruction, startMessageWith, threadId, onProgressMessage, onStreamingReplyChunk, signals}).catch(e => {
      if(e.name !== "AbortError") {
        console.error("There was an error during doBotReplyInPlaceOfUser:", e);
        alert("There was an error during doBotReplyInPlaceOfUser:\n\n"+e.stack);
      }
      messageEl.remove();
      return {};
    });
    messageEl.querySelector(".statusMessage").innerHTML = "";

    hideEl($.statusNotifier);
    $.statusNotifier.innerHTML = "";

    if(signals.wasDeleted || message === undefined) {
      return;
    }

    messageObj.memoryIdBatchesUsed = memoryIdBatchesUsed;
    messageObj.loreIdsUsed = loreIdsUsed;
    messageObj.summaryHashUsed = summaryHashUsed;
    messageObj.memoryQueriesUsed = memoryQueriesUsed;
    messageObj.summariesUsed = summariesUsed;
    messageObj.messageIdsUsed = messageIdsUsed;

    messageObj.expectsReply = expectsReply;

    // if `message` is falsy, it means the bot failed to reply, so delete the message
    if(typeof message !== "string") {
      messageEl.remove();
      return false;
    } else {

      if(message.endsWith("\n\n---")) message = message.replace(/\n\n---$/, "");

      messageObj.message = message;
      result.message = message;

      messageObj.id = await addMessageToDb(messageObj);
      delete messageEl.dataset.currentlyStreaming;

      let shouldScrollDown = messageFeedIsNearBottom();

      let inPlaceOf = $.messageFeed.contains(messageEl) ? messageEl : undefined; // it's possible the thread has been re-rendered  in the meantime (e.g. due to username change or whatever) - in that case we set inPlaceOf to undefined (i.e. just add it to the end of the thread)

      await addMessageToFeed(messageObj, {character:userCharacter, inPlaceOf});
      if(shouldScrollDown) $.messageFeed.scrollTop = $.messageFeed.scrollHeight;

      await triggerMessageActionCustomCodeEvent({threadId, eventData:{}, eventName:"MessageAdded"});
    }
    return true;
  }

  $.threadOptionsButton.addEventListener("click", async function() {
    if($.threadOptionsPopup.offsetHeight === 0) {
      showEl($.threadOptionsPopup);
      hideEl($.threadReplyAsCharacterListPopup);
    } else {
      hideEl($.threadOptionsPopup);
    }
  });

  // if user clicks anywhere other than $.threadOptionsPopup, hide it:
  window.addEventListener("click", function(e) {
    if($.threadOptionsPopup.offsetHeight > 0 && document.body.contains(e.target) && !$.threadOptionsPopup.contains(e.target) && !$.threadOptionsButton.contains(e.target)) {
      hideEl($.threadOptionsPopup);
    }
    if($.threadReplyAsCharacterListPopup.offsetHeight > 0 && document.body.contains(e.target) && !$.threadReplyAsCharacterListPopup.contains(e.target) && !$.replyAsOptionsButton.contains(e.target)) {
      hideEl($.threadReplyAsCharacterListPopup);
    }
  });

  window.showAddShortcutButtonModal = async function() {
    let shortcut = await prompt2({
      intro: {html: `<div style="font-size: 0.85rem;margin-bottom: 0.5rem;">Shortcuts are buttons that appear above the text box which can be used to easily/quickly send a commonly-used message. See the <a href="https://perchance.org/ai-character-chat-docs#tips" target="_blank">tips</a> page for some handy commands that you might want to make shortcuts for.</div>`, type:"none"},
      name: {label: "Shortcut button label (you can use emojis):", type: "textLine", placeholder:"e.g. silly reply"},
      message: {label: "Message text to add/send when button is clicked:", type: "text", height:"fit-content", minHeight:"2rem", placeholder:"e.g. /ai write a really silly reply"},
      insertionType: {label: "Insertion type (what happens when you click the shortcut):", type: "select", options:[{content:"Replace existing reply box text (if any)", value:"replace"}, {content: "Add to 𝗲𝗻𝗱 of existing reply box text", value:"append"}, {content: "Add to 𝘀𝘁𝗮𝗿𝘁 of existing reply box text", value:"prepend"}]},
      autoSend: {label: "Auto-send?", type: "select", options:[{content:"Yes, send on click", value:"yes"}, {content: "No, just put it in the reply box", value:"no"}]},
      clearAfterSend: {label: "Clear reply box after sending?", type: "select", options:[{content:"Yes, clear it", value:"yes"}, {content: "No, keep it in the reply box", value:"no"}]},
    }, {submitButtonText:"create"});
    if(!shortcut || (!shortcut.name.trim() && !shortcut.message.trim())) return;
    if(!shortcut.name.trim()) shortcut.name = shortcut.message;
    shortcut.autoSend = (shortcut.autoSend === "yes");
    shortcut.clearAfterSend = (shortcut.clearAfterSend === "yes");
    shortcut.type = "message";
    let thread = await db.threads.get(activeThreadId);
    thread.shortcutButtons.push(shortcut);
    await db.threads.update(thread.id, {shortcutButtons: thread.shortcutButtons});
    updateCustomCodePropIfNeeded({threadId:thread.id, prop:"thread.shortcutButtons", value:thread.shortcutButtons});
    await renderShortcutButtons(thread);
  }
  // $.addShortcutButton.addEventListener("click", window.showAddShortcutButtonModal);

  async function updateCustomCodePropIfNeeded({threadId, prop, value}) {
    if(customCodeIframes[threadId]) {
      try { // try catch because it's new code
        let code = `window.___setDataWithoutTriggeringChange(${JSON.stringify(prop.split("."))}, ${JSON.stringify(value)})`;
        window.runCodeInCustomCodeIframe(code, {threadId});
      } catch(e) {
        console.error(e);
      }
    }
  }

  window.changeThreadUserNameHandler = async function() {
    let thread = await db.threads.get(activeThreadId);
    const result = await prompt2({
      name: {label:`Type your desired name for this particular chat. <i style="opacity:0.7; font-size:85%">Note: You can change your default name (and <b>description</b>) for <b>all</b> chats with this character using the <b>edit character</b> button. Change your default/fallback name for chats with <b>any</b> character using the settings button in the left side-menu.</i>`, placeholder:"Type a name/nickname...", type: "textLine", defaultValue:thread.userCharacter.name || ""},
      avatarUrl: {label:`Paste an image URL or click the folder button to select your desired avatar/profile pic. <i style="opacity:0.7; font-size:85%">Note that you can change your default avatar in chats with this character using the character editor, and you can change your default/fallback avatar for *all* chats using the settings button in the right side-panel.</i>`, placeholder:"https://example.com/pic.jpg", type: "textLine", disableSpellCheck:true /* <-- else lag for data URLs */, dataUrlUploadButton:"image/*", cssText:"white-space:pre; font-family:monospace;", defaultValue:thread.userCharacter.avatarUrl || ""},
    });
    let changed = false;
    if(result && result.name && result.name.trim()) {
      let name = result.name.trim();
      thread.userCharacter.name = name;
      changed = true;
    }

    if(result && result.avatarUrl && result.avatarUrl.trim()) {
      let avatarUrl = result.avatarUrl.trim();
      thread.userCharacter.avatar.url = avatarUrl.trim();
      changed = true;
    }

    if(changed) {
      await db.threads.update(thread.id, {userCharacter: thread.userCharacter});
      await renderShortcutButtons(); // since shortcut names can contain {{user}} and {{char}}
      await renderMessageFeed(thread.id, {forceFullRender:true});
    }

    hideEl($.threadOptionsPopup);
  }
  $.changeThreadUserNameButton.addEventListener("click", window.changeThreadUserNameHandler);
  $.changeThreadUserAvatarUrlButton.addEventListener("click", async function() {
    let thread = await db.threads.get(activeThreadId);
    const result = await prompt2({
      avatarUrl: {label:`Paste an image URL or click the folder button to select your desired avatar/profile pic. <i style="opacity:0.7;">Note that you can change your default avatar in chats with this character using the character editor, and you can change your default/fallback avatar for *all* chats using the settings button in the right side-panel.</i>`, placeholder:"https://example.com/pic.jpg", type: "textLine", disableSpellCheck:true /* <-- else lag for data URLs */, dataUrlUploadButton:"image/*", cssText:"white-space:pre; font-family:monospace;", defaultValue:thread.userCharacter.avatarUrl || ""},
    });
    if(!result || !result.avatarUrl || !result.avatarUrl.trim()) return;
    let avatarUrl = result.avatarUrl.trim();
    thread.userCharacter.avatar.url = avatarUrl.trim();
    await db.threads.update(thread.id, {userCharacter: thread.userCharacter});
    await renderShortcutButtons(thread);
    hideEl($.threadOptionsPopup);
  });
  $.threadLevelResponseLengthButton.addEventListener("click", async function() {
    hideEl($.threadOptionsPopup);
    let thread = await db.threads.get(activeThreadId);
    const result = await prompt2({
      maxParagraphCountPerMessage: { label: `📏 Strict message length limit for this chat thread. <i style="opacity:0.7;">This applies to all characters in this thread unless they already have their own response limit set in their character settings.</i>`, type:"select", options:[{value:"", content:"No reply length limit"}, {value:"1", content:"𝗢𝗻𝗲 paragraph, max"}, {value:"2", content:"𝗧𝘄𝗼 paragraphs, max"}, {value:"3", content:"𝗧𝗵𝗿𝗲𝗲 paragraphs, max"}, {value:"4", content:"𝗙𝗼𝘂𝗿 paragraphs, max"}, {value:"5", content:"𝗙𝗶𝘃𝗲 paragraphs, max"}], defaultValue:thread.maxParagraphCountPerMessage ? thread.maxParagraphCountPerMessage.toString() : "" },
    });
    if(!result) return;
    let maxParagraphCountPerMessage = result.maxParagraphCountPerMessage ? Number(result.maxParagraphCountPerMessage) : undefined;
    await db.threads.update(thread.id, {maxParagraphCountPerMessage});
  });
  $.toggleAutoReplyToUserButton.addEventListener("click", async function() {
    let thread = await db.threads.get(activeThreadId);
    if(thread.autoReplyDisabled === undefined || thread.autoReplyDisabled === false) {
      thread.autoReplyDisabled = true;
    } else {
      thread.autoReplyDisabled = false;
    }
    await db.threads.update(thread.id, {autoReplyDisabled: thread.autoReplyDisabled});
    alert(`Auto-reply has been ${thread.autoReplyDisabled === true ? "𝗱𝗶𝘀𝗮𝗯𝗹𝗲𝗱" : "𝗲𝗻𝗮𝗯𝗹𝗲𝗱"} for this chat thread.`);
    hideEl($.threadOptionsPopup);
  });
  $.addCharacterOptionsButton.addEventListener("click", async function() {
    hideEl($.threadOptionsPopup);
    await showAddCharacterShortcutToThreadPopup();
  });
  $.editCharacterOptionsButton.addEventListener("click", async function() {
    const thread = await db.threads.get(activeThreadId);
    await editCharacterById(thread.characterId);
    hideEl($.threadOptionsPopup);
  });
  $.replyAsOptionsButton.addEventListener("click", async function() {
    hideEl($.threadOptionsPopup);
    renderThreadReplyAsCharacterListPopup();
    showEl($.threadReplyAsCharacterListPopup);
  });
  async function renderThreadReplyAsCharacterListPopup() {
    let thread = await db.threads.get(activeThreadId);
    let replyAsCharacterIds = thread.replyAsCharacterIds || [];
    replyAsCharacterIds.push(activeCharacterId);
    let replyAsCharacters = await db.characters.where("id").anyOf(replyAsCharacterIds).toArray();
    let threadCharacter = replyAsCharacters.find(char => char.id === activeCharacterId);

    let userCharacter = await getUserCharacterObj();
    userCharacter.name = thread.userCharacter.name ?? threadCharacter.userCharacter.name ?? userCharacter.name;
    userCharacter.avatar.url = thread.userCharacter.avatar.url ?? threadCharacter.userCharacter.avatar.url ?? userCharacter.avatar.url;
    replyAsCharacters.push(userCharacter);

    let systemCharacter = await getSystemCharacterObj();
    systemCharacter.name = thread.systemCharacter.name ?? threadCharacter.systemCharacter.name ?? "Narrator"; // CAUTION: this actually only affects the HTML label - if you want to also change the default "reply as..." system name, then ctrl+f for currentReplyAsCharacterId in sendButtonClickHandler. can add currentReplyAsCharacterNameOverride in the future if needed.
    systemCharacter.avatar.url = thread.systemCharacter.avatar.url ?? threadCharacter.systemCharacter.avatar.url ?? systemCharacter.avatar.url;
    replyAsCharacters.push(systemCharacter);

    let html = `<button id="addCharacterToReplyAsListButton" style="text-align:left; padding:0.25rem;">➕ <b>add character</b></button>`;
    if(replyAsCharacters.length > 4) html += `<button id="removeCharacterFromReplyAsListButton" style="text-align:left; padding:0.25rem;">➖ <b>hide character</b></button>`;
    html += replyAsCharacters.map(char => `<button class="replyAsCharacterListCharacterButton" data-character-id="${char.id}" data-character-name="${char.name}" data-thread-id="${activeThreadId}" onclick="setThreadCurrentReplyAsCharacterId({threadId:Number(this.dataset.threadId), characterName:this.dataset.characterName, characterId:Number(this.dataset.characterId)})" style="text-align:left; display:flex; align-items:center; padding:0.25rem;"><div class="replyAsCharacterListCharacterButtonAvatar" style="background-image:url(${char.avatar?.url}); background-size:cover; background-position:center; display:inline-block; width:1rem; height:1rem; margin-right:0.25rem;"></div>${char.name}</button>`).join("");
    $.threadReplyAsCharacterListPopup.innerHTML = html;


    $.threadReplyAsCharacterListPopup.querySelector("#addCharacterToReplyAsListButton").onclick = async function() {
      const characters = await db.characters.orderBy("lastMessageTime").reverse().toArray();
      const result = await prompt2({
        characterId: {label: "Choose a character to add the the 'reply as' list for this chat. If you want to <b>create a new character</b>, then you can do that on the 'new chat' screen, and then come back to this popup and select the character you made.", type: "select", options:characters.map(c => ({content:`${c.name} #${c.id}`, value:c.id}))},
      });
      if(!result) return;
      let characterId = Number(result.characterId);
      let thread = await db.threads.get(activeThreadId);
      if(!thread.replyAsCharacterIds) thread.replyAsCharacterIds = [];
      if(!thread.replyAsCharacterIds.includes(characterId)) thread.replyAsCharacterIds.push(characterId);
      await db.threads.update(thread.id, {replyAsCharacterIds:thread.replyAsCharacterIds});
      window.setThreadCurrentReplyAsCharacterId({threadId:thread.id, characterId:characterId, characterName:characters.find(c => c.id === characterId).name});
    };

    if($.threadReplyAsCharacterListPopup.querySelector("#removeCharacterFromReplyAsListButton")) {
      $.threadReplyAsCharacterListPopup.querySelector("#removeCharacterFromReplyAsListButton").onclick = async function() {
        $.threadReplyAsCharacterListPopup.querySelectorAll(".replyAsCharacterListCharacterButton").forEach(btn => {
          // their current onclick does setThreadCurrentReplyAsCharacterId, but we overwrite that:
          btn.onclick = async function() {
            let characterId = Number(btn.dataset.characterId)
            let thread = await db.threads.get(activeThreadId);
            if(!thread.replyAsCharacterIds) thread.replyAsCharacterIds = [];
            thread.replyAsCharacterIds = thread.replyAsCharacterIds.filter(id => id !== characterId);
            let setObj = {replyAsCharacterIds:thread.replyAsCharacterIds};
            if(thread.currentReplyAsCharacterId === characterId) {
              setObj.currentReplyAsCharacterId = null;
              $.messageInput.placeholder = `Type your reply here...`;
            }
            await db.threads.update(thread.id, setObj);
            hideEl($.threadReplyAsCharacterListPopup);
          };
          btn.querySelector(".replyAsCharacterListCharacterButtonAvatar").outerHTML = "➖ ";
        });
        // don't *remove* these - otherwise messes with handler which closes list popup based on clicking outside it (deleted = considered "outside" the list)
        $.threadReplyAsCharacterListPopup.querySelector("#removeCharacterFromReplyAsListButton").style.display = "none";
        $.threadReplyAsCharacterListPopup.querySelector("#addCharacterToReplyAsListButton").style.display = "none";
      };
    }
  }
  window.setThreadCurrentReplyAsCharacterId = async function({threadId, characterId, characterName}) {
    await db.threads.update(threadId, {currentReplyAsCharacterId:characterId});
    hideEl($.threadReplyAsCharacterListPopup);
    $.messageInput.placeholder = `Type your reply as ${characterName}...`;
  }

  // $.replyLoopButton.addEventListener("click", async function() {

  // });

  // let alreadyAutoReplying = false;
  // $.replyWithButton.addEventListener("click", async function() {
  //   if(alreadyAutoReplying) {
  //     return;
  //   }
  //   alreadyAutoReplying = true;
  //   $.sendButton.disabled = true;
  //   $.replyWithButton.disabled = true;

  //   let threadId = activeThreadId;

  //   let availableVoiceNames = speechSynthesis.getVoices().map(v => v.name).sort((a,b) => a.toLowerCase().includes("english") ? -1 : 1);

  //   // get list of characters, sorting by lastMessageTime
  //   const characters = await db.characters.orderBy("lastMessageTime").reverse().toArray();
  //   const promptResult = await prompt2({
  //     characterId: {label: "Choose a character to reply with:", type: "select", options:characters.map(c => ({content:`${c.name} #${c.id}`, value:c.id}))},
  //     repeat: {label: "How many replies?", type: "textLine", defaultValue: "10"},
  //     textToSpeechVoicesEnabled: {label: "Text-to-Speech Voices?", type: "select", options: [{content: "Disabled", value: "disabled"}, {content: "Enabled", value: "enabled"}]},
  //     threadCharVoiceName: {show:d=>d.textToSpeechVoicesEnabled==="enabled", label: "Existing chatacter voice:", type: "select", options:availableVoiceNames.map(v => ({content: v, value: v})) },
  //     otherCharVoiceName: {show:d=>d.textToSpeechVoicesEnabled==="enabled", label: "Reply-with character voice:", type: "select", options:availableVoiceNames.map(v => ({content: v, value: v})) },
  //   });
  //   if(!promptResult) {
  //     alreadyAutoReplying = false;
  //     $.replyWithButton.disabled = false;
  //     $.sendButton.disabled = false;
  //     return;
  //   }

  //   let ttsEnabled = promptResult.textToSpeechVoicesEnabled === "enabled";
  //   let threadCharVoiceName = promptResult.threadCharVoiceName;
  //   let otherCharVoiceName = promptResult.otherCharVoiceName;

  //   let characterToReplyWith = await db.characters.get(parseInt(promptResult.characterId));
  //   let repeat = parseInt(promptResult.repeat);
  //   let i = 0;
  //   let signals, result;
  //   while(i < repeat) {
  //     signals = {stop:false, wasDeleted:false};
  //     result = {};
  //     let success = await doBotReplyInPlaceOfUser({characterToReplyWith, signals, result});
  //     if(!success) break;

  //     if(signals.stop) {
  //       break;
  //     }

  //     if(threadId !== activeThreadId) {
  //       break; // if the user clicked into a different thread, stop replying
  //     }

  //     if(ttsEnabled) {
  //       // chrome has a bug that occurs if you try to speak text that's too long
  //       // so we split message up into sentences and speak each one
  //       let sentences = result.message.match(/[^\.!\?]+[\.!\?]+/g)?.map(s => s.trim()) ?? [result.message];
  //       for(let sentence of sentences) {
  //         let result = await textToSpeech({text: sentence, voiceName: otherCharVoiceName}).catch(e => {
  //           console.error(e);
  //           alert("There was an error with speech synthesis. You may need to close this tab and re-open it (not just refresh) if you're using Chrome due to a weird bug that sometimes causes this.\n\n"+e.toString());
  //           return false;
  //         });
  //         if(result === false) break;
  //       }
  //     }

  //     await delay(100);

  //     signals = {stop:false, wasDeleted:false};
  //     result = {};
  //     await doBotReplyIfNeeded({signals, result});

  //     if(signals.stop) {
  //       break;
  //     }

  //     if(ttsEnabled) {
  //       let sentences = result.message.match(/[^\.!\?]+[\.!\?]+/g)?.map(s => s.trim()) ?? [result.message];
  //       for(let sentence of sentences) {
  //         let result = await textToSpeech({text: sentence, voiceName: threadCharVoiceName}).catch(e => {
  //           console.error(e);
  //           alert("There was an error with speech synthesis. You may need to close this tab and re-open it (not just refresh) if you're using Chrome due to a weird bug that sometimes causes this.\n\n"+e.toString());
  //           return false;
  //         });
  //         if(result === false) break;
  //       }
  //     }

  //     // // wait for the other bot to respond
  //     // while(1) {
  //     //   await delay(100);
  //     //   let messages = await db.messages.where("threadId").equals(threadId).toArray();
  //     //   messages.sort((a,b) => a.order - b.order);
  //     //   // get characterId of this thread
  //     //   let thread = await db.threads.get(threadId);
  //     //   let thisThreadCharacterId = thread.characterId;
  //     //   let lastMessage = messages[messages.length-1];
  //     //   if(lastMessage.characterId === thisThreadCharacterId) {
  //     //     if(ttsEnabled) {
  //     //       let sentences = lastMessage.message.match(/[^\.!\?]+[\.!\?]+/g);
  //     //       for(let sentence of sentences) {
  //     //         let result = await textToSpeech({text: sentence, voiceName: threadCharVoiceName}).catch(e => {
  //     //           console.error(e);
  //     //           alert("There was an error with speech synthesis. You may need to close this tab and re-open it (not just refresh) if you're using Chrome due to a weird bug that sometimes causes this.\n\n"+e.toString());
  //     //           return false;
  //     //         });
  //     //         if(result === false) break;
  //     //       }
  //     //     }
  //     //     break;
  //     //   }
  //     // }

  //     i++;
  //   }
  //   alreadyAutoReplying = false;
  //   $.replyWithButton.disabled = false;
  //   $.sendButton.disabled = false;
  // });

  $.newThreadButton.addEventListener("click", async function() {
    document.querySelectorAll("#middleColumn > .middleColumnScreen").forEach(el => hideEl(el));
    showEl($.characterSelection);

    activeThreadId = null;
    if(threadLoadingModal) {
      threadLoadingModal.delete();
    }

    await updateCustomCodeIframeVisibility();
    // deselect selected thread
    document.querySelectorAll("#chatThreads .thread").forEach(el => el.classList.remove("selected"));
    await renderCharacterList();

    if(isMobile) {
      closeLeftColumn();
    } else {
      hideEl($.characterSelectionOpenLeftColumnButton);
    }
  });


  $.threadSearchButton.addEventListener("click", async function() {
    let query = $.threadSearchInput.value.trim();
    $.threadSearchButton.disabled = true;
    let originalTextContent = $.threadSearchButton.textContent;
    $.threadSearchButton.textContent = "⏳";
    try {
      if(query) {
        await renderThreadList({filterWithQuery: query});
      } else {
        // show all threads
        await renderThreadList();
      }
    } catch(e) {
      console.error(e);
    }
    $.threadSearchButton.disabled = false;
    $.threadSearchButton.textContent = originalTextContent;
  });
  $.threadSearchInput.addEventListener("keydown", async e => {
    if(e.key === "Enter") {
      $.threadSearchButton.click();
    }
  });
  // if user deletes all text from the search input, show all threads
  $.threadSearchInput.addEventListener("input", async e => {
    if(!$.threadSearchInput.value.trim()) {
      await renderThreadList();
    }
  });

  function resizeMessageInputTextAreaToFitContent() {
    $.messageInput.style.height = "";
    let height = Math.min(window.innerHeight*0.75, $.messageInput.scrollHeight);
    $.messageInput.style.height = height + "px";
  }

  // this executes on page load, so it should give us the full height.
  // note that if the user zooms on the page, it will change, so it's not full-proof for detecting e.g. on-screen keyboard, as we do below
  window.fullVisualViewportHeight = window.visualViewport.height;

  function isTouchDevice() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
  }

  $.messageInput.addEventListener("keydown", async e => {
    if(isMobile) return; // on mobile, if enter/returns triggers send, then people can't add linebreaks
    if(isTouchDevice() && window.visualViewport.height < window.fullVisualViewportHeight*0.9) return; // likely indicates that onscreen keyboard is open, so we want to allow them to create a new line with 'enter' (shift+enter on a touch-screen keyboard is not ergonomic/possible)

    if(e.key === "Enter") {
      if(e.shiftKey) {
        // if shift is held, wait a moment (so the text area can have the new line added), then increase the height of the text area to match the full height of the content
        await delay(10);
        resizeMessageInputTextAreaToFitContent();
      } else {
        e.preventDefault();
        $.sendButton.click();
      }
    }
  });
  // if user pastes text into the message input, increase the height of the text area to match the full height of the content
  $.messageInput.addEventListener("paste", async e => {
    await delay(10);
    resizeMessageInputTextAreaToFitContent();
  });

  $.messageInput.addEventListener("blur", async e => {
    await delay(10);
    $.messageInput.style.height = "";
  });

  $.messageInput.addEventListener("focus", async e => {
    await delay(10);
    resizeMessageInputTextAreaToFitContent();
  });

  $.messageInput.addEventListener("click", async e => {
    await delay(10);
    resizeMessageInputTextAreaToFitContent();
  });

  $.messageInput.addEventListener("input", async e => {
    if($.messageInput.value.length % 5 === 0) {
      await delay(10);
      resizeMessageInputTextAreaToFitContent();
    }
  });

  // User messages sent history:
  {
    let lastTapTime = 0;
    let lastClickTime = 0;

    $.messageInput.addEventListener('touchstart', handleDoubleTap);
    $.messageInput.addEventListener('click', handleDoubleClick);

    function handleDoubleTap(e) {
      let currentTime = new Date().getTime();
      let tapInterval = currentTime - lastTapTime;

      if (tapInterval < 300 && tapInterval > 0) {
        onDoubleTapOrClick();
      }
      lastTapTime = currentTime;
    }

    function handleDoubleClick(e) {
      e.preventDefault();
      let currentTime = new Date().getTime();
      let clickInterval = currentTime - lastClickTime;

      if (clickInterval < 300 && clickInterval > 0) {
        onDoubleTapOrClick();
      }
      lastClickTime = currentTime;
    }

    async function onDoubleTapOrClick() {
      console.log('Double-tap/double-click on message input textarea detected');
      let threadId = activeThreadId;
      let thread = await db.threads.get(threadId);
      if(thread.userMessagesSentHistory.length === 0) return;
      // sort so isPinned items are at the end:
      thread.userMessagesSentHistory.sort((a, b) => {
        if(a.isPinned && !b.isPinned) return 1;
        if(!a.isPinned && b.isPinned) return -1;
        return 0;
      });
      // create the history messages element:
      let ctn = document.createElement("div");
      ctn.innerHTML = thread.userMessagesSentHistory.map(m => `<div class="historyItem" data-is-pinned="${m.isPinned}" data-message-text="${encodeURIComponent(m.text)}"><span class="pinButton">📌</span><span class="text">${sanitizeHtml(m.text.slice(0, 500).replaceAll("\n", " "))}</span><span class="deleteButton">🗑️</span></div>`).join("");
      // position it above the message input text area, with same width:
      ctn.style.cssText = `
        max-height: min(40vh, 200px);
        overflow: auto;
        background: var(--textarea-bg);
        border: 1px solid var(--button-border-color);
        border-radius: var(--border-radius);
        padding: 5px;
        position: absolute;
        bottom: 0;
        width: 100%;
      `;

      // if user clicks the pin button, toggle the fav status of the message and save the userMessagesSentHistory
      ctn.querySelectorAll(".historyItem .pinButton").forEach(el => {
        el.addEventListener("click", async function(e) {
          e.stopPropagation();
          let messageText = decodeURIComponent(el.parentElement.dataset.messageText);
          let message = thread.userMessagesSentHistory.find(m => m.text === messageText);
          message.isPinned = !message.isPinned;
          await db.threads.update(threadId, {userMessagesSentHistory:thread.userMessagesSentHistory});
          el.closest(".historyItem").dataset.isPinned = message.isPinned;
        });
      });

      ctn.querySelectorAll(".historyItem .deleteButton").forEach(el => {
        el.addEventListener("click", async function(e) {
          e.stopPropagation();
          let messageText = decodeURIComponent(el.parentElement.dataset.messageText);
          let message = thread.userMessagesSentHistory.find(m => m.text === messageText);
          thread.userMessagesSentHistory.splice(thread.userMessagesSentHistory.indexOf(message), 1);
          await db.threads.update(threadId, {userMessagesSentHistory:thread.userMessagesSentHistory});
          el.closest(".historyItem").remove();
          if(!$.userMessagesSentHistoryCtn.querySelector(".historyItem")) {
            ctn.remove(); // no more items left, so delete the container
          }
        });
      });

      // add it to the DOM:
      $.userMessagesSentHistoryCtn.appendChild(ctn);
      // when the user clicks anywhere else, remove it from the DOM:
      function clickAnywhereElseHandler(e) {
        if(e.target === ctn || ctn.contains(e.target)) return;
        window.removeEventListener("click", clickAnywhereElseHandler);
        ctn.remove();
      }
      window.addEventListener("click", clickAnywhereElseHandler);
      // when user clicks a message, add it to the message input text area:
      ctn.querySelectorAll(".historyItem").forEach(el => {
        el.addEventListener("click", function() {
          $.messageInput.value = decodeURIComponent(el.dataset.messageText);
          $.messageInput.focus();
          window.removeEventListener("click", clickAnywhereElseHandler);
          ctn.remove();
        });
      });

      // scroll to bottom of ctn:
      ctn.scrollTop = ctn.scrollHeight;
    }
  }


  $.settingsButton.addEventListener("click", async function() {
    // use prompt2 to collect user's name and avatar, using defaults from db.misc
    let userNameOriginal = (await db.misc.get("userName"))?.value || defaultUserName;
    let userAvatarUrlOriginal = (await db.misc.get("userAvatarUrl"))?.value || "";
    let userRoleInstructionOriginal = (await db.misc.get("userRoleInstruction"))?.value || "";
    // let openAiApiKeyOriginal = (await db.misc.get("openAiApiKey"))?.value || "";
    // let customModelConfigsOriginal = (await db.misc.get("customModelConfigs"))?.value || [];
    let showInlineReminderOriginal = (await db.misc.get("showInlineReminder"))?.value || "yes";
    // let customPostPageLoadMainThreadCodeOriginal = (await db.misc.get("customPostPageLoadMainThreadCode"))?.value || "";
    const result = await prompt2({
      userName: {label: "Your default nickname:", type: "textLine", defaultValue: userNameOriginal},
      userAvatarUrl: {label: "Your default avatar pic URL:", type: "textLine", placeholder: "(optional)", disableSpellCheck:true /* <-- else lag for data URLs */, defaultValue: userAvatarUrlOriginal},
      userRoleInstruction: {label: "Your default character/role description (try to keep this under 500 words):", type: "text", placeholder: "(optional)", defaultValue: userRoleInstructionOriginal},
      darkModeNotice: {html: `<div style="font-size:80%; margin-top:0.5rem;"><b>Dark Mode:</b> Note that this web app respects your system's dark mode setting. Use your device/OS settings page to switch your device to dark/night mode, and then refresh this page and it'll be in dark mode.</div>`, type: "none"},
      showInlineReminder: {hidden:true, label: "Show 'inline' reminder edit button:", type: "select", options:[{value:"yes"}, {value:"no"}], defaultValue: showInlineReminderOriginal},
      // customPostPageLoadMainThreadCode: {hidden:true, height:"fit-content", cssText:"white-space:pre; font-family:monospace;", label: "This code will be run on this page after page load. You can use it to mod the OpenCharacters UI, or to e.g. <a href='https://perchance.org/ai-character-chat-docs#custom-code' target='_blank'>proxy all `fetch` requests</a>, or whatever. Note that there are no backwards-compatibility guarantees on the main thread UI, so your code may break eventually. <b>This code can access all your data</b> - make sure it's from a trustworthy source if you didn't write it yourself (maybe ask GPT-4 what it does if you don't know how to code and are weary). Refresh the page after saving for your code to take effect.", placeholder:"// add code here", type: "text", defaultValue: customPostPageLoadMainThreadCodeOriginal},
    }, {showHiddenInputsText: "show advanced settings"});
    if(!result) return;

    // save to db
    await db.misc.put({key: "userName", value: result.userName});
    await db.misc.put({key: "userAvatarUrl", value: result.userAvatarUrl});
    await db.misc.put({key: "userRoleInstruction", value: result.userRoleInstruction});
    await db.misc.put({key: "showInlineReminder", value: result.showInlineReminder});

    // update the user's name and avatar in the message feed:
    if($.messageFeed.offsetHeight > 0) {
      let threadId = activeThreadId;
      await renderMessageFeed(threadId, {forceFullRender:true});
    }
  });

