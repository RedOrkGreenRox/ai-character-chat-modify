  const defaultThreadName = "Unnamed Thread";
  const defaultSystemName = "System";

  async function createNewThreadWithCharacterId(characterId) {
    let folderPath = $.chatThreads.dataset.currentFolderPath;
    const thread = await addThread({name:defaultThreadName, characterId, folderPath});

    const threadCharacter = await db.characters.get(characterId);
    let userCharacter = await getUserCharacterObj();

    let userName = thread.userCharacter.name ?? threadCharacter.userCharacter.name ?? userCharacter.name;
    let characterName = thread.character.name ?? threadCharacter.name;

    // add initial messages
    for(let m of threadCharacter.initialMessages) {
      let characterId;
      if(m.author === "user") characterId = -1;
      if(m.author === "system") characterId = -2;
      if(m.author === "ai") characterId = threadCharacter.id;
      if(characterId === undefined) alert("Error in createNewThreadWithCharacterId - invalid message author?");

      let data = {threadId:thread.id, message:m.content, characterId};

      data.expectsReply = m.expectsReply;

      if(m.hiddenFrom) data.hiddenFrom = m.hiddenFrom;
      if(typeof m.name === "string") data.name = m.name;
      // if(m.hideButtons) data.hideButtons = m.hideButtons;

      data.message = data.message.replaceAll("{{user}}", userName);
      data.message = data.message.replaceAll("{{char}}", characterName);

      let messageObj = createMessageObj(data);
      await addMessageToDb(messageObj, {doNotReRenderThreadList:true}); // hyper hacky: doNotReRenderThreadList, since we do that below anyway
    }

    await renderThreadList();
    await showThread(thread.id);
  }


  // $.threadModelSelector.addEventListener("change", async function() {
  //   let threadId = activeThreadId;
  //   let thread = await db.threads.get(threadId);
  //   let modelName = $.threadModelSelector.value;
  //   await db.threads.update(threadId, {modelName});
  //   await renderThreadList();
  // });

  async function renderMessageInputPlaceholder(threadId, opts={}) {
    if(activeThreadId !== threadId) return;
    let thread = opts.thread || await db.threads.get(threadId);
    let threadCharacter = opts.threadCharacter || await db.characters.get(thread.characterId);
    let userCharacter = opts.userCharacter || await getUserCharacterObj();
    let placeholder = threadCharacter.messageInputPlaceholder || `Type your reply here...`
    placeholder = placeholder.replaceAll("{{char}}", thread.character.name ?? threadCharacter.name);
    placeholder = placeholder.replaceAll("{{user}}", thread.userCharacter.name ?? threadCharacter.userCharacter.name ?? userCharacter.name);
    $.messageInput.placeholder = placeholder;
  }

  let threadLoadingModal;
  window.activeThreadId = null; // <-- used globally
  window.activeCharacterId = null; // <-- used globally
  async function showThread(threadId) {
    let thread = await db.threads.get(threadId);
    if(!thread) console.error(`showThread: threadId=${threadId} (typeof threadId === ${typeof threadId}) thread=${thread}`);

    // if(thread.currentSummaryHashChain === undefined) {
    //   let { instructionHashChain } = await computeAndSaveThreadSummaryIfNeeded({threadId, exitOnFirstHashMissAndReturnHashChain:true});
    //   thread.currentSummaryHashChain = instructionHashChain;
    //   await db.threads.update(threadId, {currentSummaryHashChain:instructionHashChain});
    // }

    activeThreadId = threadId;
    activeCharacterId = thread.characterId;

    $.threadModelSelector.value = thread.modelName;

    let threadCharacter = await db.characters.get(thread.characterId);
    let userCharacter = await getUserCharacterObj();

    let currentReplyAsCharacterId = thread.currentReplyAsCharacterId ?? -1;
    if(currentReplyAsCharacterId === -1 || currentReplyAsCharacterId === -2) {
      renderMessageInputPlaceholder(threadId, {thread, threadCharacter, userCharacter}); // no need to await this
    } else {
      let replyAsCharacter = await db.characters.get(currentReplyAsCharacterId);
      $.messageInput.placeholder = `Type your reply as ${replyAsCharacter.name}...`;
    }

    updateFavicon(threadCharacter.avatar.url);
    hiddenH1Element.textContent = `${thread.name} - ${threadCharacter.name}`;

    if($.chatThreads.dataset.currentFolderPath !== thread.folderPath) {
      $.chatThreads.dataset.currentFolderPath = thread.folderPath;
      await renderThreadList();
    }

    // thread could be past the "show more threads" button, so we render all threads if so:
    let threadEl = $.chatThreads.querySelector(`.thread[data-thread-id="${threadId}"]`);
    if(!threadEl) {
      await renderThreadList({maxShownThreads:999999999});
    }
    threadEl = $.chatThreads.querySelector(`.thread[data-thread-id="${threadId}"]`);

    $.messageFeed.innerHTML = "";

    $.musicPlayer.pause();

    if(threadLoadingModal) {
      threadLoadingModal.delete();
    }

    // to prevent flash for fast-loading threads:
    let loadingModalCreationTimeout = setTimeout(() => {
      threadLoadingModal = createLoadingModal("Loading...", $.middleColumn);
    }, 200);

    document.querySelectorAll("#chatThreads .thread").forEach(el => el.classList.remove("selected"));
    threadEl.classList.add("selected");

    document.querySelectorAll("#middleColumn > .middleColumnScreen").forEach(el => hideEl(el));
    showEl($.chatInterface);

    if(isMobile) {
      closeLeftColumn();
    }

    $.threadModelSelector.value = thread.modelName;

    // this must come before rendering the message feed because we may need to render the messages with `oc.messageRenderingPipeline`
    if(!customCodeIframes[threadId] && threadCharacter.customCode.trim()) {
      await createNewCustomCodeIframeForThread(threadId); // this adds iframe as here: customCodeIframes[threadId]
    }

    // CAUTION: careful about changing the order of these calls! there are cursed dependencies

    await renderMessageFeed(threadId);

    await db.threads.where({id:threadId}).modify({lastViewTime:Date.now()});

    await updateCustomCodeIframeVisibility();

    await renderShortcutButtons(thread);

    $.messageInput.value = thread.unsentMessageText;

    clearTimeout(loadingModalCreationTimeout);
    if(threadLoadingModal) threadLoadingModal.delete();

  }

  // function shortcutsFromTextFormat(text) {
  //   const regex = /(?:^|\n+)@name=(.*?)\n@message=(.*?)\n@insertionType=(replace|append|prepend)\n@autoSend=(yes|no)\n@clearAfterSend=(yes|no)/gs;
  //   let matches;
  //   let parsedShortcuts = [];
  //   while((matches = regex.exec(text))) {
  //     let shortcut = {
  //       name: matches[1],
  //       message: matches[2],
  //       insertionType: matches[3],
  //       autoSend: matches[4] === 'yes',
  //       clearAfterSend: matches[5] === 'yes',
  //       type: "message",
  //     };
  //     parsedShortcuts.push(shortcut);
  //   }
  //   return parsedShortcuts;
  // }

  function shortcutsFromTextFormat(text) {
    let blocks = text.split(/(^|\n)@name=/).map(b => b.trim()).filter(b => b).map(b => "@name="+b);
    let parsedShortcuts = [];
    for(let block of blocks) {
      let data = {};
      let lines = block.split("\n").filter(l => l.startsWith("@"));
      for(let line of lines) {
        let key = line.split("=")[0].slice(1);
        let value = line.split("=").slice(1).join("=");
        data[key] = value;
      }
      let shortcut = {
        name: data.name || "",
        message: data.message || "",
        insertionType: ["replace", "append", "prepend"].includes(data.insertionType) ? data.insertionType : 'replace',
        autoSend: data.autoSend==="yes",
        clearAfterSend: data.clearAfterSend==="yes",
        type: "message",
      };
      if(shortcut.name && shortcut.message) {
        parsedShortcuts.push(shortcut);
      }
    }
    return parsedShortcuts;
  }

  function shortcutsToTextFormat(shortcuts) {
    return shortcuts.map(s => `@name=${s.name}\n@message=${s.message}\n@insertionType=${s.insertionType}\n@autoSend=${s.autoSend ? "yes" : "no"}\n@clearAfterSend=${s.clearAfterSend ? "yes" : "no"}`).join("\n\n");
  }

  async function showAddCharacterShortcutToThreadPopup() {
    let addCharChoice = null;

    let characters = await db.characters.orderBy("lastMessageTime").reverse().toArray();

    let thread = await db.threads.get(window.activeThreadId);
    let threadCharacterId = thread.characterId;

    if(characters.length > 1) {
      let addCharChoiceControls = {};
      function handleCharChoiceButtonClick(c) {
        addCharChoiceControls.cancel();
        addCharChoice = c;
      }
      let result = await prompt2({
        message: {type:"none", html:`<div style="margin-bottom: 1rem;font-size: 90%;text-align: center;">Add a character shortcut above the reply box:</div>`},
        choices: {type:"buttons", label:null, buttons:[
          {text:"🗂️ use an existing character", onClick:() => handleCharChoiceButtonClick("existing-character")},
          {text:"🆕 make a new character", onClick:() => handleCharChoiceButtonClick("new-character")},
        ]},
      }, {submitButtonText:"cancel", cancelButtonText:null, controls:addCharChoiceControls});
      if(!addCharChoice) return;
    } else {
      addCharChoice = "new-character";
    }

    let characterId;
    let emoji = "🗣️";
    let instruction = "";
    let autoSend = "no";
    let customLabel = "";
    if(addCharChoice === "new-character") {
      const result = await characterDetailsPrompt();
      if(!result) return;
      const character = await addCharacter(result);
      characterId = character.id;
      const promptResult = await prompt2({
        header: { html: `<div style="border-radius:3px;font-size: 0.8rem;padding: 0.5rem;border: 1px solid var(--border-color); margin-bottom:1rem;"><b>Note</b>: If you need to go back and make edits to this character, use the 'new chat' button in the top-right to show the character list, and then click the character's edit button.</div>`, type:"none" },
        emoji: {label: "(Optional) Emoji for this character's button:", type: "textLine", placeholder:"(optional)", defaultValue:emoji},
        instruction: {label: "(Optional) A short writing instruction that will be triggered via the button:", type: "textLine", placeholder:`e.g. "write her current internal thoughts"`, defaultValue:""},
        autoSend: {hidden:true, label: "Send immediately when clicked?", type: "select", options:[{content:"Yes, send when clicked", value:"yes"}, {content: "No, allow for custom instructions", value:"no"}], defaultValue:"no"},
        customLabel: {hidden:true, label: "(Optional) Custom button label:", type: "textLine", placeholder:`e.g. "Alice's Thoughts"`, defaultValue:""},
      }, {showHiddenInputsText:"show more options", submitButtonText:"create"});
      if(!promptResult) return;
      emoji = promptResult.emoji.trim();
      instruction = promptResult.instruction.trim();
      autoSend = promptResult.autoSend.trim() === "yes";
      customLabel = promptResult.customLabel.trim();
    } else if(addCharChoice === "existing-character") {
      const result = await prompt2({
        characterId: {label: "Choose a character to bring into this chat:", type: "select", options:characters.filter(c => c.id !== threadCharacterId).map(c => ({content:`${c.name} #${c.id}`, value:c.id}))},
        emoji: {label: "(Optional) Emoji for this character's button:", type: "textLine", placeholder:"(optional)", defaultValue:emoji},
        instruction: {label: "(Optional) A short writing instruction that will be triggered via the button:", type: "textLine", placeholder:`e.g. "write her current internal thoughts"`, defaultValue:""},
        autoSend: {hidden:true, label: "Send immediately when clicked?", type: "select", options:[{content:"Yes, send when clicked", value:"yes"}, {content: "No, allow for custom instructions", value:"no"}], defaultValue:"no"},
        customLabel: {hidden:true, label: "(Optional) Custom button label:", type: "textLine", placeholder:`e.g. "Alice's Thoughts"`, defaultValue:""},
      }, {showHiddenInputsText:"show more options", submitButtonText:"create"});
      if(!result) return;
      characterId = Number(result.characterId);
      emoji = result.emoji.trim();
      instruction = result.instruction.trim();
      autoSend = result.autoSend.trim() === "yes";
      customLabel = result.customLabel.trim();
    }
    if(characterId === undefined || characterId === null) return;

    let character = await db.characters.get(characterId);

    thread.shortcutButtons.push({
      autoSend,
      insertionType: "replace",
      message: `/ai @${character.name.replace(/\s+/g, "")}#${character.id}${instruction ? " "+instruction : (autoSend ? "" : " <optional instruction>")}`,
      name: customLabel ? customLabel : `${emoji ? emoji+" " : ""}${character.name}`,
      clearAfterSend: false,
      type: "message",
    });
    await db.threads.where({id:thread.id}).modify({shortcutButtons:thread.shortcutButtons});
    updateCustomCodePropIfNeeded({threadId:thread.id, prop:"thread.shortcutButtons", value:thread.shortcutButtons});
    await renderShortcutButtons();
  }

  async function renderShortcutButtons(thread=null) {
    if(!thread) {
      thread = await db.threads.get(activeThreadId);
    }
    let threadCharacter = await db.characters.get(thread.characterId);
    let userCharacter = await getUserCharacterObj();
    shortcutButtonsCtn.innerHTML = "";
    let buttonWrapper = htmlToElement(`<div style="width:max-content;"></div>`);
    if(thread.shortcutButtons.length > 0) {
      shortcutButtonsCtn.appendChild(buttonWrapper);
      for(let shortcut of thread.shortcutButtons) {
        let name = shortcut.name.replace("{{char}}", thread.character.name || threadCharacter.name).replace("{{user}}", thread.userCharacter.name ?? threadCharacter.userCharacter.name ?? userCharacter.name);
        name = sanitizeHtml(name); // <-- IMPORTANT since customCode can set shortcutButtons now
        let shortcutBtn = htmlToElement(`<button style="max-height:1.5rem; display:inline-flex; align-items:center; justify-content:center;" title="${shortcut.autoSend ? `` : `Double-tap to quick-send.`}">${name}</button>`);
        buttonWrapper.appendChild(shortcutBtn);
        shortcutBtn.addEventListener("click", async function() {
          if(shortcut.type === "message") {
            let originalMessageInput = $.messageInput.value;
            let message = shortcut.message;
            window.mostRecentTappedReplacementShortcutButtonText = null;
            if(shortcut.insertionType === "replace") {
              $.messageInput.value = message;
              window.mostRecentTappedReplacementShortcutButtonText = message.split("<")[0]; // this is so we can clear if they click send and it's exactly the same text (*even if* clearAfterSend is false). This is a good default since they can easily tap the button again if need.
            } else if(shortcut.insertionType === "append") {
              $.messageInput.value += message;
            } else if(shortcut.insertionType === "prepend") {
              $.messageInput.value = message + $.messageInput.value;
            }
            if(shortcut.clearAfterSend) {
              window.clearInputAfterNextSendButtonClickIfMaintainedPrefix = message.split("<")[0];
            }

            $.messageInput.focus();
            let selectIndexStart = message.indexOf("<");
            let selectIndexEnd = message.indexOf(">");
            if(selectIndexStart !== -1 && selectIndexEnd !== -1) {
              $.messageInput.setSelectionRange(selectIndexStart, selectIndexEnd+1);
            }

            if(shortcut.autoSend || $.messageInput.value === originalMessageInput) { // check against original message input because if they double-tap a non-autosend button, then we send the message
              await sendButtonClickHandler();
            }
          }
        });
      }
   }
   if(shortcutButtonsCtn.innerHTML !== "") {
      let bulkEditButton = htmlToElement(`<button>✏️</button>`);
      bulkEditButton.addEventListener("click", async function() {

        let initialChoiceControls = {};
        let choice = null;

        function handleChoiceButtonClick(c) {
          initialChoiceControls.cancel();
          choice = c;
        }

        let result = await prompt2({
          choices: {type:"buttons", label:null, buttons:[
            {text:"🗣️ add a character shortcut", onClick:() => handleChoiceButtonClick("add-character")},
            {text:"✨ add a custom shortcut", onClick:() => handleChoiceButtonClick("add-custom")},
          ]},
          bottomRow: {type:"buttons", label:null, buttons:[
            {text:"📝 bulk edit/delete shortcuts", onClick:() => handleChoiceButtonClick("bulk-edit")},
          ]},
        }, {submitButtonText:"cancel", cancelButtonText:null, controls:initialChoiceControls});
        if(!choice) return;

        if(choice === "add-character") {

          await showAddCharacterShortcutToThreadPopup();

        } else if(choice === "bulk-edit") {
          let thread = await db.threads.get(activeThreadId);

          let shortcutsInTextFormat = shortcutsToTextFormat(thread.shortcutButtons);
          let result = await prompt2({
            shortcutsInTextFormat: {label: `Bulk-edit shortcuts. Ensure there's a blank line between each shortcut. Learn about commands and shortcuts <a href="https://perchance.org/ai-character-chat-docs#tips" target="_blank">here</a>.`, type: "text", defaultValue:shortcutsInTextFormat, height:"fit-content"},
          }, {submitButtonText:"save"});
          if(!result) return;

          // parse shortcuts:
          let parsedShortcuts = shortcutsFromTextFormat(result.shortcutsInTextFormat);
          thread.shortcutButtons = parsedShortcuts;
          await db.threads.where({id:thread.id}).modify({shortcutButtons: thread.shortcutButtons});
          updateCustomCodePropIfNeeded({threadId:thread.id, prop:"thread.shortcutButtons", value:thread.shortcutButtons});

        } else if(choice === "add-custom") {
          window.showAddShortcutButtonModal();
        }
        await renderShortcutButtons();
      });
      buttonWrapper.insertBefore(bulkEditButton, buttonWrapper.firstChild);
    }
  }

  // If you change this, update stuff in prepareMessagesForBot too
  // const characterNameValidationPattern = "^[A-Za-z0-9_\\- ]{1,64}$";

  async function characterDetailsPrompt(defaultValues={}, opts={}) {
    defaultValues = structuredClone(defaultValues);

    let existingCharacter;
    if(opts.editingExistingCharacter) {
      existingCharacter = await db.characters.get({uuid:defaultValues.uuid});
    }

    let initialMessagesText;
    if(defaultValues.initialMessages) initialMessagesText = generateTextFormatFromMessages(defaultValues.initialMessages);
    else initialMessagesText = "";

    let loreBookUrlsText;
    if(defaultValues.loreBookUrls) loreBookUrlsText = defaultValues.loreBookUrls.join("\n");
    else loreBookUrlsText = "";

    let shortcutButtonsText = shortcutsToTextFormat(defaultValues.shortcutButtons || [])

    let controls = {};
    if(opts.autoSubmit) {
      setTimeout(async () => {
        while(!controls.submit) {
          await delay(5);
        }
        controls.submit();
      }, 1);
    }

    function showMessageStyleExamples({inputEl}) {
      const examples = [
        `color:white; background:#202936; border:2px solid black; border-radius:6px; padding:0.25rem;`,
        `color:#333; background:#e8f4ff; border:1px solid #a8d4ff; border-radius:12px; padding:0.5rem;`,
        `color:white; background:linear-gradient(45deg, #FF6B6B, #4ECDC4); border:none; border-radius:20px; padding:0.75rem;`,
        `color:#2c3e50; background:#ecf0f1; border-left:4px solid #3498db; border-radius:4px; padding:0.5rem;`,
        `color:white; background:#34495e; box-shadow:0 2px 4px rgba(0,0,0,0.2); border-radius:8px; padding:0.5rem;`,
        `color:#2c3e50; background:#fff; border:2px dashed #3498db; border-radius:10px; padding:0.5rem;`,
        `color:white; background:#8e44ad; border:none; border-radius:15px 15px 2px 15px; padding:0.5rem;`,
        `color:#333; background:#f1f1f1; border:1px solid #ddd; border-radius:4px; box-shadow:2px 2px 8px rgba(0,0,0,0.1); padding:0.5rem;`,

        // Modern & Professional
        `color: #ffffff; background: #0f172a; border-radius: 12px; padding: 0.75rem; font-family: system-ui; border: 1px solid #1e293b;`,
        `color: #1a1a1a; background: #f8fafc; border-radius: 8px; padding: 0.75rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;`,

        // Hacker/Retro
        `color: #00ff00; background: #000000; border: 1px solid #00ff00; font-family: monospace; padding: 0.5rem; text-shadow: 0 0 5px #00ff00;`,
        `color: #ff8c00; background: #1a1a1a; border: 2px solid #ff8c00; font-family: "Courier New"; padding: 0.5rem; text-transform: uppercase;`,
        `color: #0f0; background: #111111; border-radius: 0; border: 3px double #0f0; padding: 0.5rem; font-family: "DOS"; text-shadow: 2px 2px 0px #003300;`,

        // Pastel & Cute
        `color: #5d4037; background: #ffcdd2; border-radius: 20px; padding: 0.75rem; border: 2px dashed #f8bbd0; box-shadow: 3px 3px 0 #fce4ec;`,
        `color: #6a1b9a; background: #e1bee7; border-radius: 15px 15px 15px 0; padding: 0.75rem; border: 2px solid #ce93d8;`,
        `color: #558b2f; background: #dcedc8; border-radius: 25px; padding: 0.75rem; border: 3px dotted #aed581;`,

        // Neocities/Web 1.0
        `color: #ff00ff; background: #000000; border: 3px ridge #ff00ff; padding: 0.5rem; font-family: "Comic Sans MS"; text-shadow: 2px 2px #00ffff;`,
        `color: #ffff00; background: repeating-linear-gradient(45deg, #000000, #000000 10px, #1a1a1a 10px, #1a1a1a 20px); border: 4px groove #ffff00; padding: 0.75rem;`,
        `color: #ffffff; background: #ff0000; border: 5px outset #ff69b4; padding: 0.5rem; font-weight: bold; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;`,

        // Gradient & Modern
        `color: #ffffff; background: linear-gradient(135deg, #6366f1, #a855f7); border-radius: 12px; padding: 0.75rem; border: none; box-shadow: 0 4px 6px rgba(0,0,0,0.1);`,
        `color: #ffffff; background: linear-gradient(45deg, #3b82f6, #14b8a6); border-radius: 8px; padding: 0.75rem; border: 1px solid rgba(255,255,255,0.1);`,

        // Minimalist
        `color: #333333; background: #ffffff; border-left: 4px solid #000000; padding: 0.75rem; border-radius: 2px;`,
        `color: #ffffff; background: #18181b; border-right: 4px solid #3f3f46; padding: 0.75rem; border-radius: 2px;`,

        // Playful
        `color: #000000; background: #ffffff; border: 3px solid #000000; border-radius: 25px; padding: 0.75rem; box-shadow: 5px 5px 0px #000000;`,
        `color: #ffffff; background: #ff4081; border-radius: 20px 20px 0 20px; padding: 0.75rem; transform: rotate(-1deg); box-shadow: 2px 2px 0px #f50057;`,

        // Tech/Futuristic
        `color: #00ffff; background: #1a1a1a; border: 1px solid #00ffff; border-radius: 4px; padding: 0.75rem; box-shadow: 0 0 10px rgba(0,255,255,0.3); text-shadow: 0 0 5px #00ffff;`,
        `color: #ffffff; background: #000000; border: 2px solid #333333; border-radius: 8px; padding: 0.75rem; box-shadow: inset 0 0 10px #00ffff, 0 0 10px #00ffff;`,

        // Vintage
        `color: #2c1810; background: #fdf1db; border: 2px solid #8b4513; border-radius: 0; padding: 0.75rem; box-shadow: 3px 3px 0 #8b4513; font-family: serif;`,
        `color: #006400; background: #f5f5dc; border: 1px solid #006400; border-radius: 0; padding: 0.75rem; font-family: "Times New Roman";`,

        // Text Adventure
        `color: #33ff33; background: #000000; font-family: "VT323", monospace; border: 1px solid #33ff33; padding: 1rem; border-radius: 0; cursor: pointer; font-size: 1.1em; text-shadow: 0 0 5px #33ff33;`,
        `color: #ffb500; background: #000000; font-family: "Press Start 2P", monospace; padding: 0.75rem; border: 2px solid #ffb500; text-transform: uppercase; letter-spacing: 1px;`,

        // Medieval/Fantasy
        `color: #2c1810; background: #f4d03f; font-family: "MedievalSharp", cursive; border: 8px double #8b4513; padding: 1rem; border-radius: 0; text-transform: capitalize;`,
        `color: #efd8a1; background: #800000; font-family: "Luminari", fantasy; border: 3px solid #c19a49; padding: 0.75rem; border-radius: 10px; box-shadow: 0 0 10px rgba(193, 154, 73, 0.5);`,

        // Cyberpunk
        `color: #ff2a6d; background: #05001a; border: 2px solid #ff2a6d; border-radius: 2px; padding: 0.75rem; box-shadow: 0 0 20px rgba(255, 42, 109, 0.5); text-shadow: 0 0 5px #ff2a6d;`,
        `color: #00fff9; background: linear-gradient(45deg, #120458, #000000); border: 1px solid #00fff9; padding: 0.75rem; clip-path: polygon(0 0, 100% 0, 100% 80%, 95% 100%, 0 100%);`,

        // Literary/Book
        `color: #2f3640; background: #f5e6d3; font-family: "Sorts Mill Goudy", serif; border-left: 4px solid #8c7ae6; padding: 1rem; border-radius: 0;`,
        `color: #1c2833; background: #f0f3f4; font-family: "Baskerville", serif; border: 1px solid #cacfd2; padding: 0.75rem; border-radius: 3px; box-shadow: 2px 2px 5px rgba(0,0,0,0.1);`,

        // Vaporwave
        `color: #ff71ce; background: linear-gradient(45deg, #01cdfe, #b967ff); border: 3px solid #05ffa1; padding: 0.75rem; border-radius: 0; text-shadow: 2px 2px #2d00ff;`,
        `color: #ffffff; background: #ff6ad5; border: 4px double #8c1eff; padding: 0.75rem; box-shadow: 5px 5px 0px #00f6ff, 10px 10px 0px #fdb9fc;`,

        // Newspaper
        `color: #000000; background: #f9f7f1; font-family: "Times New Roman", serif; border: 1px solid #2c3e50; padding: 1rem; column-rule: 1px solid #2c3e50;`,
        `color: #2c3e50; background: #ecf0f1; font-family: "Georgia", serif; border: 2px solid #000000; padding: 0.75rem; border-radius: 0; box-shadow: 3px 3px 0 #000000;`,

        // Handwritten
        `color: #1a5f7a; background: #fff9c4; font-family: "Indie Flower", cursive; border: none; padding: 1rem; transform: rotate(-1deg); box-shadow: 0 4px 8px rgba(0,0,0,0.1);`,
        `color: #333333; background: #ffffff; font-family: "Caveat", cursive; border: 1px dashed #666666; padding: 0.75rem; border-radius: 8px; transform: rotate(1deg);`,

        // Sci-Fi Terminal
        `color: #0abdc6; background: #123; border: 1px solid #0abdc6; padding: 0.75rem; font-family: "Share Tech Mono", monospace; text-shadow: 0 0 10px #0abdc6;`,
        `color: #ffffff; background: #000000; border: 2px solid #00ff00; padding: 1rem; font-family: "Source Code Pro", monospace; box-shadow: inset 0 0 20px #00ff00;`,

        // Underwater/Aquatic
        `color: #e0f7ff; background: linear-gradient(180deg, #006994, #003366); border: 2px solid #80c4ff; border-radius: 20px; padding: 0.75rem; box-shadow: 0 0 15px rgba(0, 100, 148, 0.5);`,
        `color: #ffffff; background: linear-gradient(135deg, #01579b, #0277bd); border: 3px solid #40c4ff; padding: 0.75rem; border-radius: 15px 15px 50px 15px;`,

        // Abstract/Art
        `color: #ffffff; background: #000000; border: 3px dashed #ff0000; padding: 1rem; clip-path: polygon(0% 0%, 100% 0%, 95% 100%, 5% 100%); transform: skew(-5deg);`,
        `color: #000000; background: repeating-linear-gradient(45deg, #ffffff, #ffffff 10px, #f0f0f0 10px, #f0f0f0 20px); border: 5px solid #000000; padding: 0.75rem; border-radius: 30px 0 30px 0;`,

        // Clean Sans-Serif - Light
        `color: #2c3e50; background: #ffffff; font-family: 'Inter', sans-serif; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.875rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);`,
        // Clean Sans-Serif - Dark
        `color: #e2e8f0; background: #1a202c; font-family: 'Inter', sans-serif; border: 1px solid #2d3748; border-radius: 8px; padding: 0.875rem; box-shadow: 0 1px 3px rgba(0,0,0,0.3);`,

        // Modern Minimalist - Light
        `color: #1a202c; background: #f7fafc; font-family: 'DM Sans', sans-serif; border-left: 4px solid #4a5568; border-radius: 4px; padding: 0.75rem;`,
        // Modern Minimalist - Dark
        `color: #f7fafc; background: #2d3748; font-family: 'DM Sans', sans-serif; border-left: 4px solid #a0aec0; border-radius: 4px; padding: 0.75rem;`,

        // Contemporary - Light
        `color: #374151; background: #ffffff; font-family: 'Plus Jakarta Sans', sans-serif; border: 1px solid #e5e7eb; border-radius: 10px; padding: 0.875rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05);`,
        // Contemporary - Dark
        `color: #e5e7eb; background: #111827; font-family: 'Plus Jakarta Sans', sans-serif; border: 1px solid #4b5563; border-radius: 10px; padding: 0.875rem; box-shadow: 0 2px 4px rgba(0,0,0,0.2);`,

        // Modern Serif - Light
        `color: #1f2937; background: #ffffff; font-family: 'Fraunces', serif; border: 1px solid #d1d5db; border-radius: 6px; padding: 1rem; line-height: 1.6;`,
        // Modern Serif - Dark
        `color: #f3f4f6; background: #111827; font-family: 'Fraunces', serif; border: 1px solid #374151; border-radius: 6px; padding: 1rem; line-height: 1.6;`,

        // Elegant Serif - Light
        `color: #2d3748; background: #f8fafc; font-family: 'Crimson Pro', serif; border-bottom: 2px solid #64748b; border-radius: 4px; padding: 0.875rem;`,
        // Elegant Serif - Dark
        `color: #f8fafc; background: #1a202c; font-family: 'Crimson Pro', serif; border-bottom: 2px solid #a0aec0; border-radius: 4px; padding: 0.875rem;`,

        // Classic Reading - Light
        `color: #334155; background: #ffffff; font-family: 'Newsreader', serif; border: 1px solid #cbd5e1; border-radius: 8px; padding: 1rem; font-size: 1.05em;`,
        // Classic Reading - Dark
        `color: #e2e8f0; background: #0f172a; font-family: 'Newsreader', serif; border: 1px solid #475569; border-radius: 8px; padding: 1rem; font-size: 1.05em;`,

        // Professional Sans - Light
        `color: #18181b; background: #fafafa; font-family: 'Work Sans', sans-serif; border: 1px solid #e4e4e7; border-radius: 12px; padding: 0.875rem; line-height: 1.5;`,
        // Professional Sans - Dark
        `color: #fafafa; background: #18181b; font-family: 'Work Sans', sans-serif; border: 1px solid #3f3f46; border-radius: 12px; padding: 0.875rem; line-height: 1.5;`,

        // Modern Professional - Light
        `color: #27272a; background: #ffffff; font-family: 'Public Sans', sans-serif; border-left: 3px solid #71717a; border-radius: 4px; padding: 0.75rem;`,
        // Modern Professional - Dark
        `color: #ffffff; background: #27272a; font-family: 'Public Sans', sans-serif; border-left: 3px solid #a1a1aa; border-radius: 4px; padding: 0.75rem;`,

        // Clean Modern - Light
        `color: #3f3f46; background: #f4f4f5; font-family: 'Albert Sans', sans-serif; border: 1px solid #d4d4d8; border-radius: 8px; padding: 0.875rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05);`,
        // Clean Modern - Dark
        `color: #f4f4f5; background: #3f3f46; font-family: 'Albert Sans', sans-serif; border: 1px solid #52525b; border-radius: 8px; padding: 0.875rem; box-shadow: 0 1px 2px rgba(0,0,0,0.2);`,

        // Elegant Readable - Light
        `color: #1c1917; background: #fafaf9; font-family: 'Outfit', sans-serif; border: 1px solid #e7e5e4; border-radius: 10px; padding: 1rem; line-height: 1.6;`,
        // Elegant Readable - Dark
        `color: #fafaf9; background: #292524; font-family: 'Outfit', sans-serif; border: 1px solid #57534e; border-radius: 10px; padding: 1rem; line-height: 1.6;`,

        // Literary - Light
        `color: #292524; background: #ffffff; font-family: 'Literata', serif; border-bottom: 2px solid #78716c; border-radius: 6px; padding: 0.875rem;`,
        // Literary - Dark
        `color: #fafaf9; background: #1c1917; font-family: 'Literata', serif; border-bottom: 2px solid #a8a29e; border-radius: 6px; padding: 0.875rem;`,

        // Modern Clean - Light
        `color: #44403c; background: #fefcfb; font-family: 'Sora', sans-serif; border: 1px solid #d6d3d1; border-radius: 8px; padding: 0.875rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);`,
        // Modern Clean - Dark
        `color: #fefcfb; background: #292524; font-family: 'Sora', sans-serif; border: 1px solid #78716c; border-radius: 8px; padding: 0.875rem; box-shadow: 0 1px 3px rgba(0,0,0,0.2);`,

        // Romance Novel
        `color: #4a4a4a; background: #fff5f5; font-family: 'Playfair Display', serif; border: 1px solid #ffb3b3; border-radius: 12px; padding: 1rem; box-shadow: 0 2px 10px rgba(255,179,179,0.2);`,
        `color: #5c2626; background: linear-gradient(to right, #fff5f5, #fff0f0); font-family: 'Cormorant Garamond', serif; border: 2px solid #ffd1d1; border-radius: 15px; padding: 1rem; line-height: 1.6;`,

        // Isekai Light Novel
        `color: #2b4c7c; background: #f0f7ff; font-family: 'Nunito', sans-serif; border: 2px solid #b8d4ff; border-radius: 8px; padding: 0.875rem; box-shadow: 0 0 15px rgba(184,212,255,0.3);`,
        `color: #1a365d; background: linear-gradient(135deg, #f0f7ff, #e6f0ff); font-family: 'M PLUS Rounded 1c', sans-serif; border: 1px solid #93c5fd; border-radius: 10px; padding: 1rem;`,

        // Skyrim/Nordic
        `color: #2d3436; background: #e4d5c3; font-family: 'Cinzel', serif; border: 3px double #8b7355; border-radius: 0; padding: 1rem; text-transform: capitalize;`,
        `color: #463e33; background: linear-gradient(to bottom, #d5c4a1, #e4d5c3); font-family: 'MedievalSharp', cursive; border: 2px solid #8b7355; border-radius: 0; padding: 1rem; box-shadow: 2px 2px 0 #8b7355;`,

        // Stardew Valley
        `color: #2c5530; background: #effad3; font-family: 'Varela Round', sans-serif; border: 2px dashed #8ec07c; border-radius: 12px; padding: 0.875rem; box-shadow: 0 2px 0 #a9d18e;`,
        `color: #403d3d; background: #fbf6e4; font-family: 'Mali', cursive; border: 3px solid #8ec07c; border-radius: 10px; padding: 1rem; box-shadow: 3px 3px 0 #a9d18e;`,

        // Classic JRPG
        `color: #2c3e50; background: #ecf0f1; font-family: 'Press Start 2P', monospace; border: 4px solid #34495e; border-radius: 0; padding: 1rem; box-shadow: 4px 4px 0 #34495e;`,
        `color: #2d3436; background: #dfe6e9; font-family: 'VT323', monospace; border: 3px solid #636e72; border-radius: 0; padding: 0.875rem; text-transform: uppercase;`,

        // Ghibli-inspired
        `color: #5c6e91; background: #f3f8ff; font-family: 'Quicksand', sans-serif; border: 2px solid #b8c9f5; border-radius: 20px; padding: 1rem; box-shadow: 0 4px 15px rgba(184,201,245,0.3);`,
        `color: #4a5568; background: linear-gradient(135deg, #f3f8ff, #e6f0ff); font-family: 'Cabin', sans-serif; border: 1px solid #a4c1f4; border-radius: 15px; padding: 1rem;`,

        // Minecraft-inspired
        `color: #3b3b3b; background: #e1e1e1; font-family: 'Minecraft', 'VT323', monospace; border: 3px solid #7e7e7e; border-radius: 0; padding: 0.875rem; box-shadow: 3px 3px 0 #7e7e7e;`,
        `color: #404040; background: repeating-linear-gradient(45deg, #e1e1e1, #e1e1e1 10px, #d4d4d4 10px, #d4d4d4 20px); font-family: 'Minecraft', 'Press Start 2P', monospace; border: 4px solid #7e7e7e; padding: 1rem;`,

        // Persona-inspired
        `color: #e63946; background: #f1faee; font-family: 'Montserrat', sans-serif; border: 2px solid #e63946; border-radius: 5px; padding: 1rem; transform: skew(-3deg); font-weight: bold;`,
        `color: #2b2d42; background: linear-gradient(45deg, #f1faee, #ffffff); font-family: 'Poppins', sans-serif; border: 3px solid #2b2d42; border-radius: 4px; padding: 0.875rem; transform: skew(-2deg);`,

        // Hollow Knight
        `color: #4a5859; background: #e7ecf0; font-family: 'Marcellus', serif; border: 2px solid #a6b3b9; border-radius: 6px; padding: 1rem; box-shadow: 0 0 20px rgba(166,179,185,0.3);`,
        `color: #2f3e46; background: linear-gradient(to bottom, #e7ecf0, #d8e2e7); font-family: 'Cormorant', serif; border: 1px solid #84a9ac; border-radius: 8px; padding: 1rem;`,

        // Animal Crossing
        `color: #5c8374; background: #f8f5e4; font-family: 'Fredoka', sans-serif; border: 3px solid #9ec2b6; border-radius: 25px; padding: 1rem; box-shadow: 0 4px 0 #9ec2b6;`,
        `color: #557153; background: #faf1e4; font-family: 'Sniglet', cursive; border: 2px solid #7d8f69; border-radius: 20px; padding: 0.875rem; letter-spacing: 0.5px;`,

        // Accessible Modern - Light
        `color: #0f172a; background: #f8faff; font-family: 'Atkinson Hyperlegible', sans-serif; border: 1px solid #cbd5e1; border-radius: 12px; padding: 0.875rem; line-height: 1.5;`,
        // Accessible Modern - Dark
        `color: #f8faff; background: #0f172a; font-family: 'Atkinson Hyperlegible', sans-serif; border: 1px solid #475569; border-radius: 12px; padding: 0.875rem; line-height: 1.5;`,

        // Clear Reading - Light
        `color: #1e293b; background: #ffffff; font-family: 'Lexend', sans-serif; border-left: 3px solid #94a3b8; border-radius: 4px; padding: 0.875rem;`,
        // Clear Reading - Dark
        `color: #f1f5f9; background: #1e293b; font-family: 'Lexend', sans-serif; border-left: 3px solid #cbd5e1; border-radius: 4px; padding: 0.875rem;`,

        // Modern Simple - Light
        `color: #334155; background: #f1f5f9; font-family: 'Figtree', sans-serif; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.875rem;`,
        // Modern Simple - Dark
        `color: #f1f5f9; background: #334155; font-family: 'Figtree', sans-serif; border: 1px solid #64748b; border-radius: 8px; padding: 0.875rem;`,

        // Contemporary Clean - Light
        `color: #475569; background: #ffffff; font-family: 'Onest', sans-serif; border: 1px solid #cbd5e1; border-radius: 10px; padding: 0.875rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05);`,
        // Contemporary Clean - Dark
        `color: #f8fafc; background: #334155; font-family: 'Onest', sans-serif; border: 1px solid #64748b; border-radius: 10px; padding: 0.875rem; box-shadow: 0 1px 2px rgba(0,0,0,0.2);`,

        // Professional Reading - Light
        `color: #1e293b; background: #f8fafc; font-family: 'Commissioner', sans-serif; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.875rem; line-height: 1.6;`,
        // Professional Reading - Dark
        `color: #f8fafc; background: #1e293b; font-family: 'Commissioner', sans-serif; border: 1px solid #475569; border-radius: 8px; padding: 0.875rem; line-height: 1.6;`,

        // Elegant Professional - Light
        `color: #334155; background: #ffffff; font-family: 'Petrona', serif; border-left: 3px solid #64748b; border-radius: 4px; padding: 0.875rem;`,
        // Elegant Professional - Dark
        `color: #e2e8f0; background: #1e293b; font-family: 'Petrona', serif; border-left: 3px solid #94a3b8; border-radius: 4px; padding: 0.875rem;`,

        // Accessible Clean - Light
        `color: #0f172a; background: #ffffff; font-family: 'Red Hat Text', sans-serif; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.875rem; line-height: 1.5;`,
        // Accessible Clean - Dark
        `color: #f8fafc; background: #0f172a; font-family: 'Red Hat Text', sans-serif; border: 1px solid #334155; border-radius: 8px; padding: 0.875rem; line-height: 1.5;`,

        // Modern Classic - Light
        `color: #1e293b; background: #f8fafc; font-family: 'Source Serif 4', serif; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.875rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05);`,
        // Modern Classic - Dark
        `color: #f8fafc; background: #1e293b; font-family: 'Source Serif 4', serif; border: 1px solid #475569; border-radius: 6px; padding: 0.875rem; box-shadow: 0 1px 2px rgba(0,0,0,0.2);`,

        // Crazy:
        `color: #00ff00; background: black; font-family: 'Rubik Glitch', cursive; border: 3px double #ff00ff; padding: 1rem; clip-path: polygon(0 0, 100% 0, 98% 95%, 95% 100%, 0 98%); text-shadow: 2px 0 #ff0000, -2px 0 #00ffff; box-shadow: inset 0 0 20px #00ff00, 0 0 30px #ff00ff; background-image: repeating-linear-gradient(45deg, rgba(0,255,0,0.1) 0px, rgba(0,255,0,0.1) 2px, transparent 2px, transparent 4px); text-transform: uppercase; letter-spacing: 2px; transform: perspective(500px) rotateX(10deg);`,
        `color: transparent; background: linear-gradient(45deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #8f00ff); font-family: 'Faster One', cursive; border: 10px ridge gold; border-radius: 50% 20% / 20% 50%; padding: 2rem; background-size: 400% 400%; text-shadow: 2px 2px 4px rgba(255,255,255,0.5); box-shadow: 0 0 30px gold, inset 0 0 50px rgba(255,255,255,0.5); transform: rotate(-3deg) scale(1.02); -webkit-background-clip: text; background-clip: text; filter: drop-shadow(0 0 5px gold);`,
        `color: #fff; background: conic-gradient(from 0deg, #000000, #3a015c, #4f0147, #8c0327, #000000); font-family: 'Tourney', cursive; border: 8px solid transparent; border-image: linear-gradient(45deg, #ff00ff, #00ffff) 1; padding: 1.5rem; box-shadow: inset 0 0 50px #ff00ff, 0 0 30px #00ffff; clip-path: polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%); backdrop-filter: hue-rotate(45deg); text-shadow: 0 0 10px #fff, 0 0 20px #fff, 0 0 30px #fff;`,
        `color: #ff00ff; background: linear-gradient(90deg, #ff00ff, #00ffff, #ff00ff); font-family: 'Nabla', cursive; border: 15px groove lime; padding: 1.5rem; filter: saturate(200%) hue-rotate(45deg); text-shadow: 3px 3px 0 #00ff00, -3px -3px 0 #0000ff; box-shadow: 0 0 40px rgba(0,255,255,0.8), inset 0 0 60px rgba(255,0,255,0.8); transform: skew(-5deg) rotate(2deg); background-size: 200% 100%;`,
        `color: #0f0; background: repeating-radial-gradient(circle at 50% 50%, #000 0, #000 2px, #001a00 2px, #001a00 4px); font-family: 'Share Tech Mono', monospace; border: 6px double #0f0; padding: 1rem; text-shadow: 0 0 5px #0f0, 0 0 10px #0f0, 0 0 20px #0f0; box-shadow: inset 0 0 30px #0f0, 0 0 20px #0f0; transform-style: preserve-3d; transform: perspective(1000px) rotateY(20deg); backdrop-filter: brightness(150%) contrast(150%);`,
        `color: #b500ff; background: radial-gradient(circle at center, #000 0%, #1a0033 50%, #000 100%); font-family: 'Creepster', cursive; border: 10px solid; border-image: repeating-linear-gradient(45deg, #ff00ff, #000, #00ffff, #000, #ff00ff) 1; padding: 1.5rem; text-shadow: -1px -1px 0 #ff0, 1px -1px 0 #f0f, -1px 1px 0 #0ff, 1px 1px 0 #ff0; filter: brightness(120%) contrast(150%); clip-path: polygon(0% 20%, 20% 0%, 80% 0%, 100% 20%, 100% 80%, 80% 100%, 20% 100%, 0% 80%);`,
        `color: #fff; background: linear-gradient(135deg, rgba(255,0,255,0.5), rgba(0,255,255,0.5)), repeating-conic-gradient(from 45deg, #ff0000 0deg 10deg, #00ff00 10deg 20deg, #0000ff 20deg 30deg); font-family: 'Bungee Shade', cursive; border: 12px outset rgba(255,255,255,0.5); border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; padding: 2rem; box-shadow: inset 0 0 50px rgba(255,255,255,0.8), 0 0 30px rgba(255,0,255,0.8); backdrop-filter: blur(1px) brightness(150%); transform-style: preserve-3d; transform: rotateX(10deg) rotateY(5deg);`,
        `color: #fff; background: linear-gradient(to right, #000, #000), repeating-radial-gradient(circle at 50% 50%, transparent 0, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px); font-family: 'Tilt Prism', cursive; border: 8px solid; border-image: linear-gradient(45deg, #ff0, #f0f, #0ff, #ff0) 1; padding: 1.5rem; text-shadow: 0 0 10px #fff, 0 0 20px #0ff, 0 0 30px #f0f; box-shadow: inset 0 0 50px #f0f, 0 0 30px #0ff; background-blend-mode: overlay; filter: contrast(150%) brightness(120%);`,
        `color: #fff; background: repeating-conic-gradient(from 0deg at 50% 50%, #ff0000 0deg 10deg, #00ff00 10deg 20deg, #0000ff 20deg 30deg); font-family: 'Audiowide', cursive; border: 15px solid transparent; border-image: linear-gradient(to right, #f0f, #0ff) 1; padding: 2rem; clip-path: polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%); text-shadow: 0 0 10px rgba(255,255,255,0.8); box-shadow: inset 0 0 60px rgba(255,0,255,0.8), 0 0 40px rgba(0,255,255,0.8); backdrop-filter: hue-rotate(90deg) brightness(150%);`,
        `color: #fff; background: conic-gradient(from 0deg at 50% 50%, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #8f00ff, #ff0000); font-family: 'Righteous', cursive; border: 20px groove #ff00ff; border-radius: 42% 58% 37% 63% / 55% 49% 51% 45%; padding: 2rem; transform: rotate(5deg) scale(1.02); text-shadow: 2px 2px #000, -2px -2px #fff; box-shadow: inset 0 0 50px rgba(255,255,255,0.5), 0 0 30px rgba(255,0,255,0.8); filter: saturate(200%) contrast(150%);`,
      ];

      // Create modal container
      const modalOverlay = document.createElement('div');
      modalOverlay.style.cssText = `position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); display: flex; justify-content: center; align-items: center; z-index: 10000000;`;
      const modalContent = document.createElement('div');
      modalContent.style.cssText = `background: var(--box-color); border-radius: 8px; width: 90%; max-width: 500px; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);`;
      const header = document.createElement('div');
      header.style.cssText = `padding: 1rem; border-bottom: 1px solid var(--border-color); font-weight: bold; font-size: 1.1rem;`;
      header.textContent = 'Click a style to use it';
      const content = document.createElement('div');
      content.style.cssText = `padding: 1rem; overflow-y: auto; flex-grow: 1;`;

      examples.forEach((style) => {
        loadGoogleWebFontsInMessageWrapperStyleIfNeccessary(style);

        const bubble = document.createElement('div');
        bubble.style.cssText = `${style}`;
        bubble.textContent = "Here's an example message";
        let outerDiv = document.createElement("div");
        outerDiv.onmouseover = () => outerDiv.style.transform = 'scale(1.02)';
        outerDiv.onmouseout = () => outerDiv.style.transform = 'scale(1)';
        outerDiv.onclick = () => { inputEl.value = style; modalOverlay.remove(); };
        outerDiv.style.cssText = "cursor:pointer; transition:transform 0.2s; margin-bottom:1rem";
        content.appendChild(outerDiv);
        outerDiv.appendChild(bubble);
      });

      const footer = document.createElement('div');
      footer.style.cssText = `padding: 1rem; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end;`;

      const cancelButton = document.createElement('button');
      cancelButton.style.cssText = `padding: 0.5rem 1rem; background: var(--button-bg); border: none; border-radius: 4px; cursor: pointer; transition: background 0.2s;`;
      cancelButton.textContent = 'Cancel';
      cancelButton.onmouseover = () => cancelButton.style.background = 'var(--button-bg-hover)';
      cancelButton.onmouseout = () => cancelButton.style.background = 'var(--button-bg)';
      cancelButton.onclick = () => modalOverlay.remove();

      footer.appendChild(cancelButton);

      modalContent.appendChild(header);
      modalContent.appendChild(content);
      modalContent.appendChild(footer);
      modalOverlay.appendChild(modalContent);

      modalOverlay.onclick = (e) => { if(e.target === modalOverlay) { modalOverlay.remove(); } };

      document.body.appendChild(modalOverlay);
    }

    let avatarIconSvg = `data:image/svg+xml;base64,${btoa(`<svg version="1.2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 602 784" width="602" height="784"><style> .s0 { fill: #444444 } </style> <path class="s0" d="m301 392c33.9 0 66.5-13.5 90.5-37.5 24-24 37.5-56.6 37.5-90.5 0-33.9-13.5-66.5-37.5-90.5-24-24-56.6-37.5-90.5-37.5-33.9 0-66.5 13.5-90.5 37.5-24 24-37.5 56.6-37.5 90.5 0 33.9 13.5 66.5 37.5 90.5 24 24 56.6 37.5 90.5 37.5zm-45.7 48c-98.5 0-178.3 79.8-178.3 178.3 0 16.4 13.3 29.7 29.7 29.7h388.6c16.4 0 29.7-13.3 29.7-29.7 0-98.5-79.8-178.3-178.3-178.3z"/> </svg>`)}`;

    document.querySelector(":root").style.setProperty(`--current-character-details-prompt-avatar-url`, `url('${defaultValues.avatar?.url || avatarIconSvg}')`);
    let avatarUrlLeftSideHtml = `<div style="height:100%; width: 60px; margin-right:0.5rem; background-image: var(--current-character-details-prompt-avatar-url); background-position: center; background-size: cover; border-radius: 3px;"></div>`;
    let avatarUrlOnInput = function() { document.querySelector(":root").style.setProperty(`--current-character-details-prompt-avatar-url`, `url('${this.value.trim() || avatarIconSvg}')`); }

    document.querySelector(":root").style.setProperty(`--current-character-details-prompt-user-character-avatar-url`, `url('${defaultValues.userCharacter?.avatar?.url || avatarIconSvg}')`);
    let userCharacterAvatarUrlLeftSideHtml = `<div style="height:100%; width: 60px; margin-right:0.5rem; background-image: var(--current-character-details-prompt-user-character-avatar-url); background-position: center; background-size: cover; border-radius: 3px;"></div>`;
    let userCharacterAvatarUrlOnInput = function() { document.querySelector(":root").style.setProperty(`--current-character-details-prompt-user-character-avatar-url`, `url('${this.value.trim() || avatarIconSvg}')`); }

    const result = await prompt2({
      header: { html: opts.editingExistingCharacter ? `<div style="border-radius:3px;font-size: 0.8rem;padding: 0.5rem;border: 1px solid var(--border-color);">You're currently <b>editing</b> an existing character named '${existingCharacter.name}'.</div>` : opts.existingCharacterSameNameWarningOnShareLinkPageLoad ? `<div style=" font-size: 80%; background: #005d7b; color: #e9e9e9; border-radius: 3px; margin-bottom:1rem; padding: 0.5rem;"><b>Note</b>: You've loaded a <u>character sharing link</u> page (see the 'data' in browser address bar), so you're being prompted to add a character. <b style="color:#3bd100;">You've already got a character with this name</b>, so maybe you didn't mean to visit this share link again? It's fine to have multiple characters with the same name, but if you <i>didn't</i> intend to add this character, you can just click 'cancel'.</div>` :"", type:"none" },
      name: { label: "🪪 Character name:", type:"textLine", placeholder: "Sammy", defaultValue: defaultValues.name || "" },
      roleInstruction: { label: `🎭 Character description/personality/instruction/role. <i style="opacity:0.7;">This should ideally be less than 1000 words (<a href='https://perchance.org/ai-character-chat-docs#instruction-and-reminder' target='_blank'>read more</a>). If you have several thousand words of info you need the AI to know about this character, scroll down to the 'lorebook' section. Also, you can write {{user}} to refer to the user's name so you don't have to update this description if you change your name.</i>`, infoTooltip:`This note defines the personality or 'role' that the AI will take during the chat. Every writing request to the AI will include this text. If you later decide to edit this, all existing and new threads will be immediately updated, so you don't need to start a fresh chat for it to take effect. This text will never get 'summarized away' by the summarization algorithm - it will *always* be present as the first message. If you make this text too long, it'll reduce the longer-term memory of your bot.`, type:"text", height:"fit-content", placeholder: "Include the most important details first. Also, it's a good idea to include example dialogue if you can - show the AI how you want the character to speak.", defaultValue: defaultValues.roleInstruction || "" },
      avatarUrl: { label: `👤 Character avatar image URL. <i style="opacity:0.7;">For example, a png/jpg/webp/gif/etc. Use the upload button below, or you can <a href="https://perchance.org/ai-character-generator" target="_blank">generate an image here</a> and then <a href="https://perchance.org/upload" target="_blank">upload it here</a>.</i>`, type:"textLine", placeholder: "(optional) https://user.uploads.dev/file/example.jpeg", disableSpellCheck:true /* <-- else lag for data URLs */, dataUrlUploadButton:"image/*", cssText:"white-space:pre; font-family:monospace;", leftSideHtml:avatarUrlLeftSideHtml, onInput:avatarUrlOnInput, defaultValue: defaultValues.avatar?.url || "" },
      maxParagraphCountPerMessage: { label: `📏 Strict message length limit. <i style="opacity:0.7;">Try setting this to one paragraph if the character keeps undesirably talking/acting on your behalf.</i>`, type:"select", options:[{value:"", content:"No reply length limit"}, {value:"1", content:"𝗢𝗻𝗲 paragraph, max"}, {value:"2", content:"𝗧𝘄𝗼 paragraphs, max"}, {value:"3", content:"𝗧𝗵𝗿𝗲𝗲 paragraphs, max"}, {value:"4", content:"𝗙𝗼𝘂𝗿 paragraphs, max"}, {value:"5", content:"𝗙𝗶𝘃𝗲 paragraphs, max"}], defaultValue:defaultValues.maxParagraphCountPerMessage ? defaultValues.maxParagraphCountPerMessage.toString() : "" },
      userCharacterName: { label: `User's name. <i style="opacity:0.7;">This overrides the user's default username when creating a new chat thread with this character.</i>`, placeholder:"(optional)", type:"textLine", defaultValue: defaultValues.userCharacter?.name || "" },
      userCharacterRoleInstruction: { label: `User's description/role. <i style="opacity:0.7;">What role do you, the user, play when talking to this character? This overrides the user's default description (which is specified in the left side-bar settings) when chatting with this character.</i>`, type:"text", placeholder:"(optional)", defaultValue: defaultValues.userCharacter?.roleInstruction || "" },
      userCharacterAvatarUrl: { label: `User's avatar pic URL. <i style="opacity:0.7;">This overrides the user's default avatar pic (the one that's specified your user settings) when chatting to this character.</i>`, placeholder:"(optional) https://user.uploads.dev/file/example.jpeg", type:"textLine", disableSpellCheck:true /* <-- else lag for data URLs */, dataUrlUploadButton:"image/*", cssText:"white-space:pre; font-family:monospace;", leftSideHtml:userCharacterAvatarUrlLeftSideHtml, onInput:userCharacterAvatarUrlOnInput, defaultValue: defaultValues.userCharacter?.avatar?.url || "" },
      reminderMessage: { label: `💭 Character reminder note. <i style="opacity:0.7;">Remind the AI of important things, writing tips, and so on. Use this for important stuff that the AI often forgets. Try to keep this under 100 words - i.e. about a paragraph at most. (<a href='https://perchance.org/ai-character-chat-docs#instruction-and-reminder' target='_blank'>read more</a>)</i>`, height:"fit-content", minHeight:"3rem", type:"text", placeholder: `(optional) e.g. "Responses should be short and creative. Always stay in character."`, defaultValue: defaultValues.reminderMessage || "" },
      generalWritingInstructionsPreset: { label: `🪶 General writing instructions. <i style="opacity:0.7;">These instructions apply to the <u>whole</u> chat, regardless of which character is currently speaking. It's for defining general writing style, overarching rules, and defining the "type of experience" that you'd like chats with this character to be.</i>`, infoTooltip:`If you bring another character into your thread, the new character's "general writing instructions" will not have any effect. Only the writing instructions of the 'main' character of the thread (i.e. the character you started the thread with) are used.`, type:"select", options:[{value:"@roleplay1", content:"Roleplay Style 1"}, {value:"@roleplay2", content:"Roleplay Style 2"}, {value:"@custom", content:"𝗖𝘂𝘀𝘁𝗼𝗺 ↓"}], defaultValue:defaultValues.generalWritingInstructions===undefined ? "@roleplay1" : ["@roleplay1", "@roleplay2"].includes(defaultValues.generalWritingInstructions) ? defaultValues.generalWritingInstructions : "@custom" },
      generalWritingInstructions: { show:d=>d.generalWritingInstructionsPreset==="@custom", label: `🪶 Define your <b>custom</b> writing instructions here. <i style="opacity:0.7;">Use this to give high-level instructions about the overall experience, writing style, etc. Note that this box is <u>not</u> for defining how this particular character speaks/writes (use the character description for that). This box is for more general instructions. <a href="https://user.uploads.dev/file/c4611a05d87b4d3a3db3d12ae36d8706.txt" target="_blank">Here's a complex example</a> (yours can be much more simple).</i>`, type:"text", placeholder:`Example instructions:\n- Each message should generally include dialogue, actions, and thoughts.\n- Ground your writing in rich sensory details: the crunch of gravel underfoot, the faint hum of machinery, the sharp tang of iron in the air\n...`, height:"fit-content", minHeight:"7rem", defaultValue: defaultValues.generalWritingInstructions===undefined ? "" : ["@roleplay1", "@roleplay2"].includes(defaultValues.generalWritingInstructions) ? "" : defaultValues.generalWritingInstructions },
      initialMessagesText: { label: `💬 Initial chat messages. <i style="opacity:0.7;">You can use this to teach the AI how this character typically speaks, and/or to define an initial scenario. Follow the "<b>[AI]:</b> ... <b>[USER]:</b> ..." format which is fully explained <a href="https://perchance.org/ai-character-chat-docs#initial-messages" target='blank'>here</a>.</i>`, infoTooltip:"During the creation of every new chat thread with this character, these messages will be created and placed at the start of the thread. Note that the summarization algorithm will eventually summarize these messages - so they won't stay around forever (unlike the description/instruction and reminder note, which *do* stay around forever). Also note that if you edit the initial messages in the box below, only *new* chat threads that you create will have the updated initial messages. Existing/old threads will have the old initial messages.", type:"text", height:"fit-content", placeholder: "[USER]: hey\n[AI]: um hi\n[SYSTEM; hiddenFrom=ai]: The AI can't see this message. Useful for user instructions / welcome messages / credits / etc.", defaultValue: initialMessagesText ?? "" },
      userCharacterReminderMessage: { hidden:true, label: `💭 User reminder note. <i style="opacity:0.7;">In case you get the AI to write on your behalf, this is the reminder note used in that case.</i>`, height:"fit-content", minHeight:"3rem", type:"text", placeholder: `(optional) e.g. "Responses should be short and creative. Always stay in character."`, defaultValue: defaultValues.userCharacter?.reminderMessage || "" },
      messageWrapperStyle: { hidden:true, label: `🔤 Default message style (color, font, size, etc.). <i style="opacity:0.7;">E.g. try adding <span style="background: #747474; border-radius: 2px; padding: 0 0.125rem;">color:blue; font-size:90%;</span>, and <a href='https://rentry.org/2avsa' target='_blank'>read this</a> to learn other options - it's very customizable - message bubble background color/image, glowing text, etc. You can start with a preset, and then ask an AI to tweak it for you.</i>`, type:"textLine", placeholder:"Click button for presets 👉", button:{label:"💡 show examples", onClick:showMessageStyleExamples}, defaultValue: defaultValues.messageWrapperStyle ?? "" },
      sceneBackgroundUrl: { hidden:true, label: `🖼️ Chat background image/video URL. <i style="opacity:0.7;">Use <a href='https://perchance.org/upload' target='_blank'>perchance.org/upload</a> to upload your images/videos. URL should end in <b>.jpg</b> or <b>.webp</b> or <b>.webm</b> or <b>.mp4</b>, etc.</i>`, type:"textLine", placeholder:"https://user.uploads.dev/file/example.jpeg", defaultValue: defaultValues.scene?.background?.url ?? "" },
      sceneMusicUrl: { hidden:true, label: `🎵 Chat background music/audio URL. <i style="opacity:0.7;">Use <a href='https://perchance.org/upload' target='_blank'>perchance.org/upload</a> to upload your audio. The URL should generally end in <b>.mp3</b> or <b>.webm</b> or <b>.mp4</b> or <b>.ogg</b>, etc.</i>`, infoTooltip:"Permission is always requested from the user before playing audio - i.e. music will not autoplay because that could annoy some users. You can use a video file for audio - the visuals will obviously not be shown.", type:"textLine", placeholder:"https://user.uploads.dev/file/example.mp3", defaultValue: defaultValues.scene?.music?.url ?? "" },
      imagePromptPrefix: { hidden:true, label: `🖼️➡️ Image generation prompt starter. <i style="opacity:0.7;">This text will be automatically added to the <b style='text-decoration:underline;'>start</b> of all image generation requests. This text will strongly affect the style and content of the generated images. You can use <a href='https://perchance.org' target='_blank'>Perchance</a> syntax and <a href='/text-to-image-plugin' target='_blank'>text-to-image-plugin</a> prompt syntax.</i>`, type:"textLine", defaultValue: defaultValues.imagePromptPrefix ?? "", placeholder:'ghibli style anime art, {soft|pastel} colors, ' },
      imagePromptSuffix: { hidden:true, label: `🖼️🔚 Image generation prompt ending. <i style="opacity:0.7;">This text will be automatically added to the <b style='text-decoration:underline;'>end</b> of all image generation requests. You can use <a href='https://perchance.org' target='_blank'>Perchance</a> syntax and <a href='/text-to-image-plugin' target='_blank'>text-to-image-plugin</a> prompt syntax.</i>`, type:"textLine", defaultValue: defaultValues.imagePromptSuffix ?? "", placeholder:', breathtaking visual, (negativePrompt:::blurry, bad quality)' },
      imagePromptTriggers: { hidden:true, height:"fit-content", cssText:"white-space:pre; font-family:monospace;", label: `🖼️🪤 Image prompt keyword triggers. <i style="opacity:0.7;">Use this feature to add situation-specific visual info about characters, places, etc. The word/phrase before the ":" is the trigger. If that trigger text appears in any image generation prompt that the AI writes in your chat, then the "description" text that you write after the ":" will be added to the <u>end</u> of the existing image prompt. Each line should be look like <span style="background: #747474; border-radius: 2px; padding: 0 0.125rem; white-space:pre;">the trigger: the description text...</span>. If you want the description text to be added to the <u>start</u> of the text, write "@prepend" at the start of the description.</i>`, type:"text", defaultValue: defaultValues.imagePromptTriggers ?? "", placeholder:`Katie: Katie has brown hair, green eyes and a bob haircut. She [...]\nFruiford: Fruiford is a city with large stone walls and [...]\nCarrot Boy: Carrot Boy is a supervillain who [...]\n/your.?regex.*pattern/: Here's a regex-triggered {example|demo} with Perchance syntax.\nBlah: @prepend This text will be added to the start of the prompt when the AI writes 'Blah' in an image generation prompt in your chat.` },
      loreBookUrlsText: { hidden:true, height:"fit-content", cssText:"white-space:pre; font-family:monospace;", label: `📖 Lorebook URLs - one URL per line. <i style="opacity:0.7;">URL should generally end in <b>.txt</b>. Use <a href='https://perchance.org/upload' target='_blank'>perchance.org/upload</a> to upload your lore files. Each lore file/URL can contain <i>thousands</i> of entries, so you will most often need only <b>one</b> URL in the box below. Each entry within a particular lore file/URL should be a fact about the character/world, and should be no longer than one or two sentences. There should be a blank line between entries/sentences in the file. For lorebook changes to propagate to <b>preexisting</b> threads, you need to use the <b style="white-space:nowrap;">/lore</b> command and click the reload button. Visit <a href='https://perchance.org/ai-character-chat-docs#memories-and-lore' target='_blank'>this page</a> to learn more.</i>`, type:"text", height:"fit-content", defaultValue: loreBookUrlsText, placeholder: "https://user.uploads.dev/file/my-character-lore.txt\nhttps://user.uploads.dev/file/my-world-lore.txt\nhttps://user.uploads.dev/file/abc123.txt" },
      fitMessagesInContextMethod: { hidden:true, label: "Method for fitting messages within model's context limit.", infoTooltip:"You should only disable summaries if you don't need your AI to remember stuff from several-dozen messages ago. For example, the AI Artist example character has summaries disabled because the really old messages aren't relevant to what the user is currently asking the AI to create, so there's no need to include a summarized version of those old messages in the text that we give to the AI for use in generating its response. But most 'normal' characters will benefit from summaries of old messages.", type:"select", options:[{value:"dropOld", content:"ignore oldest messages (not recommended)"}, {value:"summarizeOld", content:"summarize oldest messages"}], defaultValue: defaultValues.fitMessagesInContextMethod ?? "summarizeOld" },
      // textEmbeddingModelName: { hidden:true, label: "Text embedding model:", infoTooltip:"Yep, there's currently only one option for this. Will add more in the future. It's what converts each memory/lore entry (text) into a bunch of numbers that can be efficiently used for search/similarity/lookup.", type:"select", options:[], defaultValue: defaultValues.textEmbeddingModelName ?? "text-embedding-ada-002" },
      autoGenerateMemories: { hidden:true, show:d=>d.fitMessagesInContextMethod==="summarizeOld", label: "💽 Extended character memory (AI response will be slower, but often smarter)", infoTooltip:"This gives the character the ability to 'save' memories, and 'recall' them when they're relevant. It basically allows the character to remember stuff from waaaay back in the chat history - like, thousands of messages ago. It makes the AI's response a bit slower, but the character will be smarter. You can use /mem to manually add memories. Currently memories are not referenced 'across' threads - i.e. characters can't recall details from *other* chat threads. You can manually copy memories over into a new thread if needed.", type:"select", options:[{value:"none", content:"Long-term memory 𝗱𝗶𝘀𝗮𝗯𝗹𝗲𝗱"}, {value:"v1", content:"Long-term memory 𝗲𝗻𝗮𝗯𝗹𝗲𝗱"}], defaultValue: defaultValues.autoGenerateMemories ?? "none" },
      avatarSize: { hidden:true, label: `📏 <b>Character</b>'s avatar pic size. <i style="opacity:0.7;">As a multiple of the default size (i.e. 2 means twice as big).</i>`, type:"textLine", defaultValue: defaultValues.avatar?.size ?? "1" },
      avatarShape: { hidden:true, label: `🟦 <b>Character</b>'s avatar shape.`, type:"select", options:[{value:"square"}, {value:"circle"}, {value:"portrait"}], defaultValue: defaultValues.avatar?.shape ?? "square" },
      userAvatarSize: { hidden:true, label: `📏 <b>User</b>'s avatar pic size. <i style="opacity:0.7;">As a multiple of the default size (i.e. 2 means twice as big).</i>`, type:"textLine", placeholder:"leave blank to fallback to user's default settings", defaultValue: defaultValues.userCharacter?.avatar?.size ?? "" },
      userAvatarShape: { hidden:true, label: `🟦 <b>User</b>'s avatar shape.`, type:"select", options:[{value:"default"}, {value:"square"}, {value:"circle"}, {value:"portrait"}], defaultValue: defaultValues.userCharacter?.avatar?.shape ?? "default" },
      shortcutButtonsText: { hidden:true, label: `👆 Shortcut buttons (above reply box). <i style="opacity:0.7;">Leave this empty to use the defaults.</i>`, infoTooltip:"Follow the text format shown in the placeholder text. You can edit this on a per-thread basis using the edit button above the reply box. When a new thread is created, a snapshot of these buttons is loaded into the thread. So changing this won't change the shortcut buttons of already-existing threads - only newly created threads will get the updated shortcut buttons.", type:"text", minHeight:"220px", placeholder:'@name=🗣️ {{char}}\n@message=/ai <optional writing instruction>\n@insertionType=replace\n@autoSend=no\n\n@name=🗣️ {{user}}\n@message=/user <optional writing instruction>\n@insertionType=replace\n@autoSend=no\n\n@name=🗣️ Narrator\n@message=/nar <optional writing instruction>\n@insertionType=replace\n@autoSend=no\n\n@name=🖼️ Image\n@message=/image --num=3\n@insertionType=replace\n@autoSend=yes', defaultValue: shortcutButtonsText },
      // initialThreadMemories: { hidden:true, show:d=>d.autoGenerateMemories!=="none", label: "Initial thread-specific memories. The character will create memories based on the chat, but you can add some starter memories/lore here.", infoTooltip:"Manually-written memories can be used as 'dynamic' instruction/role/reminders that engage when relevant. This saves you from having to pack too much text into your instruction/reminder, which will 'eat up' your context, which means the AI will be able to see fewer recent messages, and summarization will have to be done more often.", type:"text", defaultValue: defaultValues.textEmbeddingModelName ?? "" },
      // temperature: { hidden:true, label: "🌡️ Creativity ('temperature'). Choose a value between 0 and 2. Higher values will make the output more random, while lower values will make it more focused and deterministic.", infoTooltip:"People seem to get good results between 0.7 and 1.2 - higher values may sacrifice some 'correctness' but should result in more 'imagination'.", type:"textLine", defaultValue: defaultValues.temperature ?? 0.85 },
      customCode: { hidden:true, height:"fit-content", cssText:"white-space:pre; font-family:monospace;", label: `🧑‍💻 Custom JavaScript code. <i style="opacity:0.7;">This allows you to e.g. give your bot access to the internet and do a whole lot of other fancy stuff. Visit <a href='https://perchance.org/ai-character-chat-docs#custom-code' target='_blank'>this page</a> to learn more.</i>`, type:"text", subType:"javascript", height:"fit-content", defaultValue: defaultValues.customCode ?? "", placeholder:'oc.thread.on("MessageAdded", function({message}) {\n  message.content += " :)"; // add a smiley to end of each message\n});' },
      systemCharacterName: { hidden:true, label: "System's name:", type:"textLine", defaultValue: defaultValues.systemCharacter?.name || "" },
      systemCharacterAvatarUrl: { hidden:true, label: "System's avatar pic URL:", type:"textLine", defaultValue: defaultValues.systemCharacter?.avatar?.url || "" },
      messageInputPlaceholder: { hidden:true, label: "Message input placeholder:", type:"textLine", placeholder:`e.g. "Type your reply to {{char}} here..."`, defaultValue: defaultValues.messageInputPlaceholder || "" },
      metaTitle: { hidden:true, label: `Social media share link preview <b>title</b>.`, type:"textLine", defaultValue: defaultValues.metaTitle || "" },
      metaDescription: { hidden:true, label: `Social media share link preview <b>description</b>.`, type:"textLine", defaultValue: defaultValues.metaDescription || "" },
      metaImage: { hidden:true, label: `Social media share link preview <b>image URL</b>.`, type:"textLine", defaultValue: defaultValues.metaImage || "" },
    }, {
      controls,
      submitButtonText: opts.submitButtonText || "save character",
      submitButtonCssText: opts.submitButtonCssText || "background-color:green; border-color:#00a500; color:white;",
      showHiddenInputsText: "show more settings",

      // they clicked cancel, meaning they probably didn't know to remove the share link from their browser address bar.
      // so we reload the page without the share link by making the cancel button text a link:
      cancelButtonText: opts.existingCharacterSameNameWarningOnShareLinkPageLoad ? `<a href="https://perchance.org/${window.generatorName}" style="text-decoration:none; color:inherit;">cancel</a>` : "cancel",
    });

    if(!result) return;

    // CAUTION: we can't actually delete these like I thought we could, because dexie's `update` function is by default a "$set", so if it's missing, then it doesn't overwrite the existing value
    // if(!result.metaTitle) delete result.metaTitle;
    // if(!result.metaDescription) delete result.metaDescription;
    // if(!result.metaImage) delete result.metaImage;

    if(result.maxParagraphCountPerMessage === "") {
      result.maxParagraphCountPerMessage = undefined; // we can't delete this, because dexie's `update` function is by default a "$set", so if it's missing, then it doesn't overwrite the existing value
    } else {
      result.maxParagraphCountPerMessage = Number(result.maxParagraphCountPerMessage);
      if(isNaN(result.maxParagraphCountPerMessage)) {
        result.maxParagraphCountPerMessage = undefined;
      }
    }

    // Note: The generalWritingInstructionsPreset is not an actual character property.
    if(["@roleplay1", "@roleplay2"].includes(result.generalWritingInstructionsPreset)) {
      result.generalWritingInstructions = result.generalWritingInstructionsPreset;
    }
    delete result.generalWritingInstructionsPreset;

    // PERCHANCE EDIT:
    result.modelName = "perchance-ai";
    result.temperature = 0.8; // this does nothing - just so it's a valid value in case of any bugs/errors it'd otherwise cause
    result.maxTokensPerMessage = 500; // this does nothing - just so it's a valid value in case of any bugs/errors it'd otherwise cause

    // NOTE: textEmbeddingModelName is thread-specific (inherited from character at time of creation), and there aren't any cross-thread embedding things, so (as of writing at least) this default can be safely changed.
    result.textEmbeddingModelName = currentDefaultTextEmbeddingModelName;

    result.messageWrapperStyle = result.messageWrapperStyle.trim();

    result.name = result.name.trim();

    if(result.name === "") result.name = "_";
    result.name = result.name.replaceAll("#", ""); // just to be sure - a hash is used for `/ai @charName#123 <instruction>` so it's important that it's not in the name

    if(result.customCode.trim() === "") result.customCode = ""; // if the custom code box just contained whitespace, remove it

    // PERCHANCE EDIT:
    // if(result.maxTokensPerMessage.trim() === "") result.maxTokensPerMessage = null;
    // if(result.maxTokensPerMessage) result.maxTokensPerMessage = Number(result.maxTokensPerMessage);


    // process prompt results back into well-formed character object:

    if(defaultValues.initialMessages && result.initialMessagesText === initialMessagesText) {
      result.initialMessages = defaultValues.initialMessages; // if unchanged, use the original
    } else {
      if(result.initialMessagesText?.trim()) {
        result.initialMessages = parseMessagesFromTextFormat(result.initialMessagesText);
        if(result.initialMessages === null) { // invalid, so just throw it all into a single message (mainly so they don't lose their work)
          result.initialMessages = [{content:result.initialMessagesText, author:"ai", hiddenFrom:[]}];
        }
      } else {
        result.initialMessages = [];
      }
    }
    delete result.initialMessagesText;

    try {
      result.shortcutButtons = shortcutsFromTextFormat(result.shortcutButtonsText);
    } catch(e) {
      alert(`There was an error while parsing the shortcut buttons. Possibly due to incorrect formatting.`);
      result.shortcutButtons = defaultValues.shortcutButtons;
    }
    delete result.shortcutButtonsText;

    if(result.loreBookUrlsText?.trim()) {
      result.loreBookUrls = result.loreBookUrlsText.trim().split("\n").map(url => url.trim()).filter(url => url);
      for(let i = 0; i < result.loreBookUrls.length; i++) {
        let url = new URL(result.loreBookUrls[i]);
        if(url.hostname === "rentry.org" || url.hostname === "rentry.co") {
          url.pathname = url.pathname.replace(/\/$/, "");
          if(!url.pathname.endsWith("/raw")) {
            url.pathname += "/raw";
          }
          result.loreBookUrls[i] = url.toString();
        }
      }
    } else {
      result.loreBookUrls = [];
    }
    delete result.loreBookUrlsText;

    result.avatar = {
      url: result.avatarUrl,
      size: isNaN(Number(result.avatarSize)) ? 1 : Number(result.avatarSize),
      shape: result.avatarShape,
    };
    delete result.avatarUrl;
    delete result.avatarSize;
    delete result.avatarShape;

    result.scene = {
      background: {
        url: result.sceneBackgroundUrl,
      },
      music: {
        url: result.sceneMusicUrl,
      },
    };
    delete result.sceneBackgroundUrl;
    delete result.sceneMusicUrl;

    result.temperature = Number(result.temperature);

    if(isNaN(result.temperature)) result.temperature = 0.8;

    // user character object overrides:
    result.userCharacter = {avatar:{}};
    if(result.userCharacterName.trim()) result.userCharacter.name = result.userCharacterName;
    delete result.userCharacterName;
    if(result.userCharacterAvatarUrl.trim()) result.userCharacter.avatar.url = result.userCharacterAvatarUrl;
    delete result.userCharacterAvatarUrl;
    if(result.userCharacterRoleInstruction.trim()) result.userCharacter.roleInstruction = result.userCharacterRoleInstruction;
    delete result.userCharacterRoleInstruction;
    if(result.userCharacterReminderMessage.trim()) result.userCharacter.reminderMessage = result.userCharacterReminderMessage;
    delete result.userCharacterReminderMessage;

    if(result.userAvatarSize.trim() && !isNaN(Number(result.userAvatarSize.trim()))) result.userCharacter.avatar.size = Number(result.userAvatarSize.trim());
    delete result.userAvatarSize;
    if(result.userAvatarShape.trim() && result.userAvatarShape.trim() !== "default") result.userCharacter.avatar.shape = result.userAvatarShape.trim();
    delete result.userAvatarShape;

    // system character object overrides:
    result.systemCharacter = {avatar:{}};
    if(result.systemCharacterName.trim()) result.systemCharacter.name = result.systemCharacterName;
    delete result.systemCharacterName;
    if(result.systemCharacterAvatarUrl.trim()) result.systemCharacter.avatar.url = result.systemCharacterAvatarUrl;
    delete result.systemCharacterAvatarUrl;

    // this is not editable in the UI, but it's needed for a valid character obj
    result.streamingResponse = true;

    result.folderPath = defaultValues.folderPath ?? "";
    result.customData = defaultValues.customData ?? {};

    if(existingCharacter) {
      result.uuid = existingCharacter.uuid;
    } else {
      result.uuid = defaultValues.uuid ?? null;
    }

    // If it contains [AI], [SYSTEM], or [USER], but doesn't *start* with one of those, warn them that it's being treated as one big system message
    if(/(^|\s)\[(AI|SYSTEM|USER)\]:/.test(result.reminderMessage) && !/^\[(AI|SYSTEM|USER)\]:/.test(result.reminderMessage.trim())) {
      alert("It looks like you're using the advanced [AI]/[USER]/[SYSTEM] reminder message format, but your reminder message doesn't start with either [AI]: or [USER]: or [SYSTEM]:. If you want to use the advanced format, make sure your reminder message starts with [AI]: or [USER]: or [SYSTEM]:, otherwise your whole reminder message will be assumed to be one big 'SYSTEM' message (i.e. it assumes you're not using the advanced format).");
    }

    if((result.loreBookUrls || []).join("\n") !== (defaultValues.loreBookUrls || []).join("\n")) {
      await ensureLoreUrlsAreLoaded({loreBookUrls:result.loreBookUrls, modelName:result.textEmbeddingModelName}).catch(e => console.error(e));
    }

    return result;
  }

  function generateTextFormatFromMessages(messages) {
    let text = '';

    messages.forEach(message => {
      const author = message.author.toUpperCase();
      let paramsObj = {};
      if(message.hiddenFrom && message.hiddenFrom.length > 0) paramsObj.hiddenFrom = message.hiddenFrom;
      if(typeof message.name === "string") paramsObj.name = message.name;
      // note: currently expectsReply is not supported in initial messages
      const parameters = Object.entries(paramsObj)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');

      const paramString = parameters ? `; ${parameters}` : '';
      const content = message.content.replace(/\n/g, '\n');

      text += `[${author}${paramString}]: ${content}\n`;
    });

    return text.trim();
  }

  window.parseMessagesFromTextFormat = function(text) {
    text = text.trim();
    if(!/^\[(SYSTEM|USER|AI)(?:;[\s]*[\w]+=[^;]+)*\]:/.test(text)) {
      return null;
    }
    const lines = text.split('\n');
    const messages = [];
    let currentMessage = null;

    lines.forEach(line => {
      const match = line.match(/^\[(SYSTEM|USER|AI);?(.*?)\]:\s*(.*)/);

      if(match) {
        if(currentMessage) {
          messages.push(currentMessage);
        }

        currentMessage = {
          author: match[1].toLowerCase(),
          content: match[3],
          parameters: {}
        };

        if(match[2]) {
          const params = match[2].trim().split(';');
          params.forEach(param => {
            const [key, value] = param.split('=');
            currentMessage.parameters[key.trim()] = value.trim();
          });
        }
      } else if(currentMessage) {
        currentMessage.content += '\n' + line;
      }
    });

    if (currentMessage) {
      messages.push(currentMessage);
    }

    // parse out valid parameters:
    for(let m of messages) {
      if(m.parameters.hiddenFrom) {
        if(m.parameters.hiddenFrom === "ai") m.hiddenFrom = ["ai"];
        if(m.parameters.hiddenFrom === "user") m.hiddenFrom = ["user"];
        if(m.parameters.hiddenFrom === "both") m.hiddenFrom = ["ai", "user"];
      }
      if(!m.hiddenFrom) m.hiddenFrom = [];
      // note: currently expectsReply is not supported in initial messages
      if(m.parameters.name) m.name = m.parameters.name;
      delete m.parameters;
    }

    for(let m of messages) {
      m.content = m.content.trim(); // to allow messages to be separated by multiple newlines, and to allow a space after [AI]:/[USER]:/[SYSTEM]:
    }

    return messages;
  }

  async function addCharacter(inputs) {
    if(!inputs.name) throw new Error("addCharacter called with no 'name' property.");
    if(!inputs.avatar) throw new Error("addCharacter called with no 'avatar' property.");
    const characterObj = {
      ...inputs,
      creationTime: Date.now(),
      lastMessageTime: Date.now(),
    };
    await db.characters.add(characterObj);
    return characterObj;
  }

  // PERCHANCE EDIT
  // async function getOpenAiApiKey() {
  //   let apiKey = (await db.misc.get("openAiApiKey"))?.value;
  //   while(!apiKey) {
  //     let result = await prompt2({
  //       openAiApiKey: { label: "Please create a new OpenAI API secret key and paste it here. Go to <a style='color:blue' href='https://platform.openai.com/account/api-keys' target='_blank'>this page</a> to do that. You can change or delete this later by clicking the 'settings' button.", type:"textLine", placeholder:"sk-...", focus:true },
  //     });
  //     if(!result || !result.openAiApiKey) continue;
  //     apiKey = result.openAiApiKey;
  //     break;
  //   }
  //   await db.misc.put({ key: "openAiApiKey", value: apiKey });
  //   return apiKey;
  // }


