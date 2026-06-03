  const numMessagesPerDisplayBatch = 50;
  let previouslyRenderedMessageFeedThreadId = null;
  async function renderMessageFeed(threadId, opts={}) {
    let thread = (await db.threads.where("id").equals(threadId).toArray())[0];
    if(!thread) {
      console.error("!thread in renderMessageFeed");
      alert("There was an error while trying to load the thread. Please report error number 739 using the feedback button.");
      thread = (await db.threads.toArray())[0];
    }

    $.messageFeed.dataset.threadId = threadId;

    const messages = await db.messages.where("threadId").equals(threadId).toArray();
    messages.sort((a,b) => a.order - b.order);
    const threadCharacter = (await db.characters.where("id").equals(thread.characterId).toArray())[0];
    let userCharacter = await getUserCharacterObj();
    let systemCharacter = await getSystemCharacterObj();
    let showInlineReminder = (await db.misc.get("showInlineReminder"))?.value || "yes";

    let displayedMessages = messages.slice(-numMessagesPerDisplayBatch);

    displayedMessages = await renderMessagesForReader({messages:displayedMessages, reader:"user", threadId});

    let characterIdToCharacterObj = {
      "-1": userCharacter,
      "-2": systemCharacter,
      [threadCharacter.id]: threadCharacter,
    };

    // for(let message of displayedMessages) {
    //   if(message.characterId === -1) {
    //     message.character = userCharacter;
    //   } else if(message.characterId === -2) {
    //     message.character = systemCharacter;
    //   } else {
    //     message.character = character;
    //   }
    // }

    // get message feed scroll position:
    // let originalScrollPosition = $.messageFeed.scrollTop;

    let messagesWeNeedToAdd = displayedMessages.slice(0);

    // shift messages off `messagesWeNeedToAdd` until we find one that doesn't *exactly* match the same-index element that is already in the feed
    let lastMatchingMessageEl;
    let preexistingMessageEls = [];
    if(!opts.forceFullRender) {
      for(let messageEl of $.messageFeed.querySelectorAll(".message")) {
        let messageObj = messagesWeNeedToAdd[0];
        let messageObjHash = await sha256Text(JSON.stringify(messageObj));
        if(messageEl.dataset.hash === messageObjHash) {
          lastMatchingMessageEl = messageEl;
          messagesWeNeedToAdd.shift();
          preexistingMessageEls.push(messageEl);
        } else {
          break;
        }
      }
    }

    // This is an optimization so the messageElsToAdd call to createMessageElement doesn't have to re-fetch the character for every message
    let uniqueCharacterIdsInMessages = [...new Set(messagesWeNeedToAdd.map(m => m.characterId))].filter(id => id >= 0);
    let uniqueCharactersInMessages = await Promise.all(uniqueCharacterIdsInMessages.map(id => db.characters.get(id)));
    for(let c of uniqueCharactersInMessages) {
      characterIdToCharacterObj[c.id] = c;
    }

    // Since this is async, it should come *before* HTML modification, since we want that to be "instant", especially due to other things potentially referencing e.g. currentlyStreamingMessages elements - i.e. we don't want code that expects the message feed to be rendered properly to execute in between deletion and creation.
    let messageElsToAdd = await Promise.all(messagesWeNeedToAdd.map(m => createMessageElement(m, {character:characterIdToCharacterObj[m.characterId], thread, threadCharacter, userCharacter, characterIdToCharacterObj})));

    // these messages "don't exist yet" so we remove them and then add them back afterwards:
    let currentlyStreamingMessages = [...$.messageFeed.querySelectorAll(".message")].filter(el => el.dataset.currentlyStreaming).map(el => {
      let prevMessage = el.previousElementSibling;
      while(prevMessage && !prevMessage.classList.contains("message")) prevMessage = prevMessage.previousElementSibling;
      return {prevMessageId:prevMessage?prevMessage.dataset.id:null, el};
    });
    for(let {prevMessageId, el} of currentlyStreamingMessages) {
      el.remove();
    }

    // remove all elements after the last matching element (including non-message elements - e.g. "undo deletion" buttons):
    if(lastMatchingMessageEl) {
      if(lastMatchingMessageEl !== [...$.messageFeed.querySelectorAll(".message")].at(-1)) { // if it's the last one, we don't need to do anything (and we want to avoid removing an 'undo delete' button that might come after it, for example)
        let el = lastMatchingMessageEl.nextSibling;
        while(el) {
          let nextEl = el.nextSibling;
          el.remove();
          el = nextEl;
        }
      }
    } else {
      // no messages matched, so clear the feed:
      $.messageFeed.innerHTML = "";
    }

    $.messageFeed.dataset.characterId = threadCharacter.id;
    for(let el of messageElsToAdd) {
      $.messageFeed.appendChild(el);
    }

    for(let {prevMessageId, el} of currentlyStreamingMessages) {
      let prevMessage = (prevMessageId === null) ? null : $.messageFeed.querySelector(`.message[data-id='${prevMessageId}']`);
      if(prevMessage) prevMessage.after(el);
      else $.messageFeed.append(el);
    }

    $.messageFeed.querySelectorAll(".message").forEach(messageEl => {
      if(preexistingMessageEls.includes(messageEl)) return;
      if(messageEl.dataset.currentlyStreaming) return;

      attachEventHandlersToMessageEl(messageEl);
    });

    // if(previouslyRenderedMessageFeedThreadId === threadId) {
    //   // restore message feed scroll position:
    //   $.messageFeed.scrollTop = originalScrollPosition;
    // } else {
    //   // scroll to bottom of feed
    //   $.messageFeed.scrollTop = $.messageFeed.scrollHeight;
    // }

    $.messageFeed.scrollTop = $.messageFeed.scrollHeight;
    setTimeout(() => {
      $.messageFeed.scrollTop = $.messageFeed.scrollHeight; // not sure why, but without this it doesn't *quite* scroll all the way to the bottom
    }, 100);

    if(displayedMessages.length === 0) {
      showEl($.noMessagesNotice);
    } else {
      hideEl($.noMessagesNotice);
    }

    if(!$.messageFeed.querySelector("#messageFeedTopQuickButtonsCtn")) { // needed since otherwise for characters with custom code it creates duplicate buttons after every message
      let buttonsEl = document.createElement("div");
      buttonsEl.innerHTML = `<div id="messageFeedTopQuickButtonsCtn" style="text-align:center; height:2rem; margin:0.5rem; display:flex; align-items:center; justify-content:center; gap:0.5rem;">
        <button onclick="window.editCharacterById(window.activeCharacterId)">${root.combineEmojis("✏️", "👤")} edit character</button>
        <button onclick="window.changeThreadUserNameHandler()">🪪 set ur name/pic</button>
      </div>`;
      buttonsEl = buttonsEl.firstElementChild;
      $.messageFeed.prepend(buttonsEl);
    }

    if(messages.length > displayedMessages.length) {
      setTimeout(() => { // <-- do this in a set timeout so the message feed has time to render, else it might get triggered right away
        // add a "load earlier" element at the top of the feed with an intersection observer that triggers when it's scrolled into view
        let triggerEl = document.createElement("div");
        triggerEl.cssText = `height:50px;`;
        let triggerIsEnabled = true;
        $.messageFeed.insertBefore(triggerEl, $.messageFeed.firstChild);
        // add intersection observer
        let observer = new IntersectionObserver((entries, observer) => {
          entries.forEach(async entry => {
            if(entry.isIntersecting && triggerIsEnabled) {
              triggerIsEnabled = false;
              let { finished } = await prependEarlierMessagesToFeed();
              if(finished) {
                observer.unobserve(triggerEl);
                triggerEl.remove();
              } else {
                // move trigger to top of message feed and enable:
                $.messageFeed.prepend(triggerEl);
                $.messageFeed.prepend($.messageFeed.querySelector("#messageFeedTopQuickButtonsCtn"));
                triggerIsEnabled = true;
              }
            }
          });
        });
        observer.observe(triggerEl);
      }, 100);
    }

    await updateInlineReminderMessage({threadCharacter, thread, showInlineReminder});
    await updateThreadScene();

    previouslyRenderedMessageFeedThreadId = threadId;

    if(opts.triggerBotReply !== false) {
      // if(messages.at(-1) && messages.at(-1).characterId === -1 && thread.customData.$autoReplyToUser === false) {
      if(thread.autoReplyDisabled) {
        // don't auto reply
      } else {
        doBotReplyIfNeeded(); // we shouldn't `await` this because thread is already rendered.
      }
    }
  }

  // for debugging:
  window.renderMessageFeed = renderMessageFeed;

  let threadIdToMusicPermission = {}
  let updateThreadSceneCounter = 0;
  async function updateThreadScene() {
    if($.messageFeed.offsetWidth === 0) {
      console.warn("Tried to update thread scene but message feed was not visible.");
      return;
    }
    updateThreadSceneCounter++;
    let threadId = activeThreadId;
    let thread = await db.threads.get(threadId);
    let character = await db.characters.get(thread.characterId);
    let messages = await db.messages.where("threadId").equals(threadId).toArray();
    messages.sort((a,b) => a.order - b.order);
    let scene = character.scene || {}; // character scene is always used as a "base", latest message scene overrides it.
    let lastMessageWithScene = messages.findLast(m => m.scene);
    if(lastMessageWithScene) {
      applyObjectOverrides({object:scene, overrides:lastMessageWithScene.scene});
    }
    // note that dev can fully override scene with an 'empty' scene by just adding a scene with background.url=null, etc.
    // if they just add message.scene={} then it will just use the character's scene.

    if(scene.background?.url) {
      if(sceneBackground.currentUrl !== scene.background.url) {
        sceneBackground.change(scene.background.url);
      }
      if(scene.background.filter) {
        sceneBackground.filter(scene.background.filter);
      } else {
        sceneBackground.filter(null);
      }
    } else {
      sceneBackground.change(null);
    }

    if(scene.music?.url) {
      $.musicPlayerCtn.hidden = false;
      if($.musicPlayer.src !== scene.music.url) {
        $.musicPlayer.src = scene.music.url;
      }
      (async function() { // <-- async so it doesn't block thread from loading
        if(threadIdToMusicPermission[threadId] === undefined) {
          // threadIdToMusicPermission[threadId] = confirm("Allow this thread to play background music?");
          let result = await prompt2({
            message: {type:"none", "html":`<p style="margin:0; text-align: center; padding: 1rem;">Allow this thread to play background music?</p>`},
          }, {cancelButtonText:"No, mute music 🔇", submitButtonText:"Yes, play music 🔊"});
          threadIdToMusicPermission[threadId] = result===null ? false : true;
        }
        if(threadIdToMusicPermission[threadId] && $.musicPlayer.paused) {
          (async function(sceneUpdateI) {
            // wait for page to be activated, but then only go ahead and play it if we're still on the same scene update:
            while(!navigator.userActivation.hasBeenActive) {
              await delay(1000);
              console.log("Waiting for page to be activated before playing sound...");
            }
            if(sceneUpdateI === updateThreadSceneCounter && $.musicPlayer.paused) $.musicPlayer.play();
          })(updateThreadSceneCounter);
        }
      })();
    } else {
      $.musicPlayer.src = "";
      $.musicPlayer.pause();
      $.musicPlayerCtn.hidden = true;
    }

    // note: we don't need lots of extra customization here (e.g. exposing play/pause/seek api), because devs can do whatever they want in custom code - this is just for *end-users* to easily add music to their characters/stories in the character editor
    $.musicPlayer.volume = scene.music.volume === undefined ? 1 : scene.music.volume;
    $.musicPlayer.loop = scene.music.loop === undefined ? true : scene.music.loop;
  }

  async function prependEarlierMessagesToFeed() {
    let threadId = activeThreadId;
    // get id of first message in feed
    let firstMessageOrder = parseInt($.messageFeed.querySelector(".message").dataset.order);
    // get all messages before that from db
    let messages = await db.messages.where("threadId").equals(threadId).and(m => m.order < firstMessageOrder).toArray();
    messages.sort((a,b) => a.order - b.order);
    if(messages.length === 0) {
      return {finished:true};
    }
    // grab the last `numMessagesPerDisplayBatch` messages
    let displayedMessages = messages.slice(-numMessagesPerDisplayBatch);
    const thread = (await db.threads.where("id").equals(threadId).toArray())[0];
    const threadCharacter = (await db.characters.where("id").equals(thread.characterId).toArray())[0];

    let characterIdToCharacterObj = {
      "-1": await getUserCharacterObj(),
      "-2": await getSystemCharacterObj(),
      [threadCharacter.id]: threadCharacter,
    };

    // get top element in feed
    let topEl = $.messageFeed.querySelector(".message");
    // get scroll distance from top element
    let scrollDistanceFromTopEl = topEl.getBoundingClientRect().top - $.messageFeed.getBoundingClientRect().top;

    let messageEls = await Promise.all(displayedMessages.map(m => createMessageElement(m, {character:characterIdToCharacterObj[m.characterId], thread, threadCharacter, userCharacter:characterIdToCharacterObj[-1]})));
    messageEls.reverse();
    for(let el of messageEls) {
      $.messageFeed.prepend(el);
      attachEventHandlersToMessageEl(el);
    }

    // scroll to original top element, restoring original distance
    $.messageFeed.scrollTop = topEl.getBoundingClientRect().top - $.messageFeed.getBoundingClientRect().top - scrollDistanceFromTopEl;

    return {finished:false};
  }

  // function createInlineSummaryEditor(summaryText) {
  //   let tmp = document.createElement("div");
  //   if(summaryText.length > 50) summaryText = summaryText.slice(0, 30) + "…";
  //   tmp.innerHTML = `
  //     <div class="inlineSummaryEditor" style="margin-bottom: 0.25rem;">
  //       <div style="opacity: 0.5;font-size: 0.7rem;text-align: center;"><b>Summary so far:</b> <span>${summaryText}</span> <span class="inlineSummaryEditButton" style="cursor: pointer;">✏️</span></div>
  //     </div>
  //   `;
  //   let el = tmp.firstElementChild;
  //   el.querySelector(".inlineSummaryEditButton").addEventListener("click", async function() {
  //     let threadSummariesArr = await db.summaries.where('threadId').equals(threadId).toArray();
  //     let latestSummary = threadSummariesArr.sort((a,b) => b.id-a.id)[0];
  //     let result = await prompt2({
  //       summaryText: {label: "Summary of preceding messages:", height:"fit-content", type: "text", defaultValue: reminderMessage, placeholder: "Write your summary here."}
  //     });
  //     if(result) {
  //       await db.summaries.update(characterId, {reminderMessage:result.reminderMessage});
  //       await updateInlineSummaryEditor();
  //     }
  //   });
  //   return el;
  // }

  // async function updateInlineSummaryEditor() {
  //   $.messageFeed.querySelectorAll(".inlineSummaryEditor").forEach(el => el.remove());
  //   let threadId = activeThreadId;
  //   let threadSummariesArr = await db.summaries.where('threadId').equals(threadId).toArray();
  //   let messagesArr = await db.messages.where('threadId').equals(threadId).toArray();
  //   let undeletedMessageIds = messagesArr.map(m => m.id);
  //   let latestSummaryObj = threadSummariesArr.sort((a,b) => b.id-a.id)[0];

  //   if(!latestSummaryObj) {
  //     return;
  //   }
  //   let latestMessage = botMessages.at(-1);
  //   let el = createInlineSummaryEditor(latestSummaryObj);
  //   lastBotMessageEl.before(el);
  // }

  function createInlineReminderMessage(reminderMessage) {
    let tmp = document.createElement("div");
    if(reminderMessage.length > 50) reminderMessage = reminderMessage.slice(0, 30) + "…";
    tmp.innerHTML = `
      <div class="inlineReminderMessage" style="margin-bottom: 0.25rem;">
        <div style="opacity: 0.5;font-size: 0.7rem;text-align: center;"><span>${reminderMessage}</span> <span class="inlineReminderMessageEditButton" style="cursor: pointer;">✏️</span></div>
      </div>
    `;
    let el = tmp.firstElementChild;
    el.querySelector(".inlineReminderMessageEditButton").addEventListener("click", async function() {
      let threadId = activeThreadId;
      let thread = await db.threads.get(threadId);
      let characterId = thread.characterId;
      let character = await db.characters.get(characterId);

      let reminderMessage = character.reminderMessage || "";

      let usingThreadReminderMessage = false;
      if(typeof thread.character.reminderMessage === "string") {
        usingThreadReminderMessage = true;
        reminderMessage = thread.character.reminderMessage;
      }

      let result = await prompt2({
        reminderMessage: {label: "Edit the character's reminder message. <b>Note:</b> If your reminder message is too long, the AI might get confused and respond to the reminder message as if it were part of the conversation. The <a href='https://perchance.org/ai-character-chat-docs#instruction-and-reminder' target='_blank'>advanced syntax</a> may also be useful.", height:"fit-content", type: "text", defaultValue: reminderMessage, focus:true, placeholder: "Enter a reminder message here. A reminder message is a 'system' message that helps remind/command/instruct the AI on how to respond."}
      });
      // debugger;
      if(result) {
        if(usingThreadReminderMessage) {
          await db.transaction('rw', db.threads, async tx => {
            thread = await tx.table("threads").get(threadId);
            thread.character.reminderMessage = result.reminderMessage;
            await tx.table("threads").put(thread);
          });
        } else {
          await db.characters.update(characterId, {reminderMessage:result.reminderMessage});
        }
        await updateInlineReminderMessage();
      }
    });
    return el;
  }

  async function updateInlineReminderMessage(opts={}) {
    if(activeCharacterId === null || activeThreadId === null) return;
    // note: opts.threadCharacter and opt.thread can be passed for performance reasons if the caller already has the threadCharacter object

    // place reminder element before the most recent bot message
    let characterId = activeCharacterId;
    let threadId = activeThreadId;
    let character;
    if(!opts.threadCharacter){
      character = await db.characters.get(characterId);
    } else {
      character = opts.threadCharacter;
    }

    let thread;
    if(!opts.thread){
      thread = await db.threads.get(threadId);
    } else {
      thread = opts.thread;
    }

    let showInlineReminder;
    if(!opts.showInlineReminder) {
      showInlineReminder = (await db.misc.get("showInlineReminder"))?.value || "yes";
    } else {
      showInlineReminder = opts.showInlineReminder;
    }

    let reminderMessage = character.reminderMessage || "";
    let usingThreadReminderMessage = false;
    if(typeof thread.character.reminderMessage === "string") {
      usingThreadReminderMessage = true;
      reminderMessage = thread.character.reminderMessage;
    }

    let botMessages = [...$.messageFeed.querySelectorAll(`.message[data-character-id='${characterId}']`)];

    // remove existing inline reminder messages (important to do this after the async db call above to be sure that if updateInlineReminderMessage is for some reason called twice very close together, we won't get too inline reminders)
    $.messageFeed.querySelectorAll(".inlineReminderMessage").forEach(el => el.remove());

    if(!reminderMessage.trim() || botMessages.length === 0) {
      return;
    }

    let lastBotMessageEl = botMessages.at(-1);

    if($.messageFeed.querySelector(".message") === lastBotMessageEl) {
      return; // don't put it on the very first message in the feed, because it looks weird and is probably unnecessary anyway
    }

    let el = createInlineReminderMessage(reminderMessage);

    if(showInlineReminder === "no") {
      el.style.display = "none";
    }

    let shouldScrollDown = messageFeedIsNearBottom();

    lastBotMessageEl.before(el);

    if(shouldScrollDown) $.messageFeed.scrollTop = $.messageFeed.scrollHeight;
  }

