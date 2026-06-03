  async function doBotReplyIfNeeded({forceReply=false, replyInstruction=null, startMessageWith=null, signals=null, result={}, characterOverride=null, expectsReply=undefined, messageNameOverride=null, extraStopSequences=null, wrapInImageTags=null}={}) {
    while(Date.now()-lastBotReplyTime < 1000) {
      await delay(200); // don't reply too fast in case of infinite bot reply loop (e.g. due to custom code stuff)
    }

    lastBotReplyTime = Date.now();

    // if thread is not currently visible, don't reply
    let messageThreadIsVisible = messageFeed.offsetHeight > 0;
    if(!messageThreadIsVisible) return;

    // if page is not visible, wait for it to become visible (don't want to accidentally burn credits in the background - e.g. if character's custom code is causing a reply loop)
    while(document.visibilityState !== "visible") {
      await delay(300);
    }

    // get all messages in the thread so far, so we can send them to bot
    const threadId = activeThreadId;
    const messages = await db.messages.where("threadId").equals(threadId).toArray();
    messages.sort((a,b) => a.order - b.order);

    let messagesVisibleToAi = messages.filter(m => {
      if(m.hiddenFrom && m.hiddenFrom.includes("ai")) return false;
      return true;
    });

    const characterId = characterOverride?.id ?? activeCharacterId;
    let character;
    if(characterOverride) {
      character = characterOverride;
    } else {
      // remember, this doesn't work for 'System' character - it's not in the database - above if block handles that.
      character = await db.characters.get(characterId);
    }

    if(!forceReply) {
      let lastMessage = messagesVisibleToAi.at(-1);
      if(botIsCurrentlyReplying) return;
      if(!lastMessage) return;
      if(lastMessage.expectsReply === false) {
        return; // there is a message, and bot isn't replying, but the message explicitely says not to reply
      } else if(lastMessage.expectsReply === true) {
        // do response
      } else {
        // expectsReply was neither false, nor true, so we use the default behavior:
        if(lastMessage.characterId === characterId) {
          return; // last message was from bot, so don't reply
        } else {
          // do response
        }
      }
    }
    botIsCurrentlyReplying = true;

    // this is to prevent custom code data updates during bot replies, because otherwise it deletes the "typing indicator" and streaming response message during the renderMessageFeed() that follows
    let botIsCurrentlyReplyingPromiseResolve;
    botIsCurrentlyReplyingPromise = new Promise(r => botIsCurrentlyReplyingPromiseResolve = r);
    try {
      let messageObj = createMessageObj({threadId, message:"...", characterId, name: messageNameOverride || null, instruction:replyInstruction || null});
      // NOTE: You'd thing that if the characterId were a thread-external character, that we'd write that character's name/avatar
      // into the message object itself, but we don't do that because it causes problems - e.g. if the character's avatar is a data URL
      // then we end up bloating the database very quickly with lots of duplicate data. I probably should have the concept of "character assets"
      // or something to solve this. But for now, the source of truth remains *that thread-external character*, which does mean that if they delete it
      // their threads that include that character won't be able to load the 'correct' name/avatar for some messages.

      let messageEl = await addMessageToFeed(messageObj, {character, skipReaderRendering:true});
      messageEl.messageObj = messageObj; // this is so we can surgically re-render this message if custom code updates e.g. oc.thread.character.avatar.url during streaming of this message - see "dataChanged" event recieved from customCode iframe.
      messageEl.dataset.currentlyStreaming = "1";
      messageEl.querySelector(".messageText").innerHTML = createPaddedTypingIndicatorHtml();
      messageEl.dataset.canDelete = "false"; // to tell delete handler that this message "doesn't exist" yet - we handle the deletion in this function instead

      if(!signals) signals = {stop:false, wasDeleted:false};

      messageEl.querySelector(".info .deleteButton").addEventListener("click", async e => {
        e.preventDefault(); e.stopPropagation();
        signals.stop = true;
        signals.wasDeleted = true;
        botIsCurrentlyReplying = false;
        messageEl.remove();
        await updateInlineReminderMessage();
        $.sendButton.disabled = false;
      });

      let streamingChunkCount = 0;

      $.statusNotifier.innerHTML = `<button style='font-size: 0.9rem; margin-top:1.5rem; box-shadow:0px 1px 8px 5px var(--background); max-height:1.5rem; display:inline-flex; align-items:center; justify-content:center;'>🛑&nbsp;stop response&nbsp;${animatedLoadingSvg}</button>`;
      $.statusNotifier.querySelector("button").addEventListener("click", async (e) => {
        e.preventDefault(); e.stopPropagation();
        signals.stop = true;
        // we don't set botIsCurrentlyReplying=false here because getBotReply will return "successfully", except with a partially-streamed message
        if(!character.streamingResponse || (character.streamingResponse && streamingChunkCount === 0)) {
          messageEl.remove();
          signals.wasDeleted = true;
          botIsCurrentlyReplying = false;
        }
        await updateInlineReminderMessage();
        $.statusNotifier.innerHTML = "";
        hideEl($.statusNotifier);
        $.sendButton.disabled = false;
      });
      showEl($.statusNotifier);

      function onStreamingReplyChunk(c) {
        handleStreamingReplyChunk(c, messageEl);
        streamingChunkCount++;
      }

      const onProgressMessage = (e) => messageEl.querySelector(".statusMessage").innerHTML=e.message;
      let {message, memoryIdBatchesUsed, loreIdsUsed, summaryHashUsed, summariesUsed, memoryQueriesUsed, messageIdsUsed} = await getBotReply({messages, replyingCharacter:character, startMessageWith, replyingCharacterNameOverride:messageNameOverride, extraStopSequences, threadId, replyInstruction, onProgressMessage, onStreamingReplyChunk, signals}).catch(e => {
        if(e.name !== "AbortError") {
          console.error("doBotReplyIfNeeded --> getBotReply:", e);
          alert("There was an error during doBotReplyIfNeeded:\n\n"+e.stack);
        }
        messageEl.remove();
        return {};
      });
      messageEl.querySelector(".statusMessage").innerHTML = "";

      hideEl($.statusNotifier);
      $.statusNotifier.innerHTML = "";

      if(signals.wasDeleted || message === undefined) {
        // we don't need to set botIsCurrentlyReplying=false here because it's done in delete handler, and setting it here would disrupt other calls to this function since it's global
        return;
      }

      messageObj.memoryIdBatchesUsed = memoryIdBatchesUsed;
      messageObj.loreIdsUsed = loreIdsUsed;
      messageObj.summaryHashUsed = summaryHashUsed;
      messageObj.summariesUsed = summariesUsed;
      messageObj.memoryQueriesUsed = memoryQueriesUsed;
      messageObj.messageIdsUsed = messageIdsUsed;

      messageObj.expectsReply = expectsReply;

      // if `message` is not a string, it means the bot failed to reply, so delete the message
      if(typeof message !== "string" && message) { // I've added `&& message` because I think with streaming enabled, it could be an empty string even though there was an error? no harm either way.
        messageEl.remove();
      } else {
        if(wrapInImageTags) {
          if(typeof wrapInImageTags === "number") { // (can use this arg to specify how many images should be produced from the prompt)
            if(message.replace(/<image>.+?<\/image>/, "").trim().length === 0) {
              // the AI decided to add their *own* image tags around their message (since the AI knows that it can do that), so we remove them:
              message = message.trim().replace(/^<image>/, "").replace(/<\/image>$/, "").trim();
            }
            // we need to make each image prompt in a message unique, because the keys for the "keep" button are based on the prompt text. so clicking "keep" locks in *all* images with that same prompt. bit hacky, but we just add a zero-weighted tag at the end:
            // CAUTION: if you change this "(imgN:0)" format, you also need to change the place in the bot reply code that prepares messages by removing duplicate images from a message (since LLM obviously only needs to see one instance of the image caption)
            message = new Array(wrapInImageTags).fill(0).map((_, i) => `<image>${message} (img${i}:0)</image>`).join(" ");

          } else {
            if(!message.trim().startsWith("<image>")) message = `<image>${message}</image>`;
          }
        }

        if(message.endsWith("\n\n---")) message = message.replace(/\n\n---$/, "");

        messageObj.message = message;
        result.message = message;

        if(characterId >= 0) await db.characters.update(characterId, { lastMessageTime: Date.now() });

        messageObj.id = await addMessageToDb(messageObj);
        messageEl.dataset.id = messageObj.id;
        delete messageEl.dataset.currentlyStreaming;

        let shouldScrollDown = messageFeedIsNearBottom();

        let inPlaceOf = $.messageFeed.contains(messageEl) ? messageEl : undefined; // it's possible the thread has been re-rendered  in the meantime (e.g. due to username change or whatever) - in that case we set inPlaceOf to undefined (i.e. just add it to the end of the thread)

        await addMessageToFeed(messageObj, {character, inPlaceOf})
        if(shouldScrollDown) $.messageFeed.scrollTop = $.messageFeed.scrollHeight;

        // EDIT: new hierarchical summary approach doesn't "hold up" message generation, so we don't need to trigger summary here
        // if(character.fitMessagesInContextMethod === "summarizeOld") {
        //   // we don't await this because we want to do it in the background
        //   computeAndSaveThreadSummaryIfNeeded({threadId, continuePastCurrentSummary:true});
        // }

        messageEl.dataset.canDelete = "true";
        await triggerMessageActionCustomCodeEvent({threadId, eventData:{}, eventName:"MessageAdded"});
      }

    } catch(e) {
      if(e.name !== "AbortError") { // AbortError is thrown by AbortController.abort() when user clicks "stop response" - for some reason I can't catch it
        console.error("doBotReplyIfNeeded, final catch:", e);
        alert(e.stack);
        botIsCurrentlyReplying = false;
      }
    } finally {
      botIsCurrentlyReplying = false;
      botIsCurrentlyReplyingPromiseResolve();
      botIsCurrentlyReplyingPromise = null;
      $.sendButton.disabled = false;
    }

    autoNameThreadIfNeeded(threadId);
  }

  let alreadyRecomputingBotReply = false;
  async function regenerateMessage(messageEl, opts={}) {
    if(alreadyRecomputingBotReply) return;
    if(messageEl.dataset.canDelete === "false") return;
    alreadyRecomputingBotReply = true;
    try {

      if(currentBotReplySignals) {
        currentBotReplySignals.stop = true;
        currentBotReplySignals.wasDeleted = true;
        await delay(100);
      }

      let messageTextEl = messageEl.querySelector(".messageText");

      // to prevent a sudden "jump":
      let minHeight = messageTextEl.offsetHeight;
      if(minHeight > window.innerHeight*0.8) minHeight = window.innerHeight*0.8;
      messageTextEl.style.minHeight = minHeight + "px";

      messageTextEl.innerHTML = createPaddedTypingIndicatorHtml();

      let messageId = parseInt(messageEl.dataset.id);
      const messageObj = await db.messages.get(messageId);
      const threadId = messageObj.threadId;
      let thread = await db.threads.get(threadId);

      // this is hacky, but it's so the regen button works properly for `/image` command where they didn't specify an instruction
      let originalMessageStartedAndEndedWithImageTags = /^<image>.+<\/image>$/s.test(messageObj.message);

      let messages = await db.messages.where("threadId").equals(threadId).toArray();
      messages.sort((a,b) => a.order - b.order);

      const isLastMessage = messageId === messages.at(-1).id;

      // remove this message and all following messages from the array
      let contextMessages = messages.slice(0, messages.findIndex(m => m.id === messageObj.id));

      const threadCharacter = await db.characters.get(thread.characterId);
      let replyingCharacter; // <-- can of course be the same as the thread character
      if(messageObj.characterId === -1) {
        replyingCharacter = await getUserCharacterObj();
      } else if(messageObj.characterId === -2) {
        replyingCharacter = await getSystemCharacterObj();
      } else {
        replyingCharacter = await db.characters.get(messageObj.characterId);
      }

      let replyingCharacterNameOverride = null;
      if(replyingCharacter.name !== messageObj.name) {
        replyingCharacterNameOverride = messageObj.name; // since it's possible to e.g. write `/system @Narrator` - i.e. no Character ID, just using system character with different name
      }

      let signals = {stop:false, wasDeleted:false};

      messageEl.querySelector(".info .deleteButton").addEventListener("click", async e => {
        e.preventDefault(); e.stopPropagation();
        signals.stop = true;
        signals.wasDeleted = true;
        messageEl.remove();
      });

      let streamingChunkCount = 0;
      function onStreamingReplyChunk(c) {
        handleStreamingReplyChunk(c, messageEl);
        streamingChunkCount++;
      }

      $.statusNotifier.innerHTML = `<button data-stop-reponse-button='1' style='font-size: 0.9rem; margin-top:1.5rem; box-shadow:0px 1px 8px 5px var(--background); max-height:1.5rem; display:inline-flex; align-items:center; justify-content:center;'>🛑&nbsp;stop response&nbsp;${animatedLoadingSvg}</button>`;
      $.statusNotifier.querySelector("button").addEventListener("click", async (e) => {
        e.preventDefault(); e.stopPropagation();
        signals.stop = true;
        $.statusNotifier.innerHTML = "";
        hideEl($.statusNotifier);
        if(streamingChunkCount === 0) {
          await addMessageToFeed(messageObj, {inPlaceOf:messageEl}); // 'replace' the half-generated messsage with the unchanged original
        }
      });
      showEl($.statusNotifier);

      const onProgressMessage = (e) => messageEl.querySelector(".statusMessage").innerHTML=e.message;

      let botReplyOpts = {messages:contextMessages, threadId, signals, startMessageWith:opts.startMessageWith, onProgressMessage, onStreamingReplyChunk, replyingCharacterNameOverride};
      if(opts.modelNameOverride) botReplyOpts.modelNameOverride = opts.modelNameOverride;
      if(messageObj.instruction) botReplyOpts.replyInstruction = messageObj.instruction;
      if(messageObj.characterId !== threadCharacter.id) {
        botReplyOpts.replyingCharacter = replyingCharacter;
      }

      messageEl.dataset.currentlyStreaming = "1";
      messageEl.messageObj = messageObj; // this is so we can surgically re-render this message if custom code updates e.g. oc.thread.character.avatar.url during streaming of this message - see "dataChanged" event recieved from customCode iframe.

      let {message, memoryIdBatchesUsed, summaryHashUsed, summariesUsed, memoryQueriesUsed, messageIdsUsed} = await getBotReply(botReplyOpts);
      messageEl.querySelector(".statusMessage").innerHTML = "";

      delete messageEl.dataset.currentlyStreaming;

      hideEl($.statusNotifier);
      $.statusNotifier.innerHTML = "";

      if(signals.wasDeleted || message === undefined) {
        return;
      }

      if(message === undefined) {
        await addMessageToFeed(messageObj, {inPlaceOf:messageEl});
        return;
      }

      messageObj.memoryIdBatchesUsed = memoryIdBatchesUsed;
      messageObj.summaryHashUsed = summaryHashUsed;
      messageObj.memoryQueriesUsed = memoryQueriesUsed;
      messageObj.summariesUsed = summariesUsed;
      messageObj.messageIdsUsed = messageIdsUsed;

      if(message) {
        if(originalMessageStartedAndEndedWithImageTags && !message.trim().startsWith("<image>")) {
          message = `<image>${message}</image>`; // hacky but it'll do for now - see note where I set originalMessageStartedAndEndedWithImageTags
        }

        if(message.endsWith("\n\n---")) message = message.replace(/\n\n---$/, "");

        messageObj.variants[messageObj.variants.findIndex(v => v===null)] = messageObj.message;
        messageObj.variants.push(null);
        messageObj.message = message;

        let shouldScrollDown = messageFeedIsNearBottom();
        let newMessageEl = await addMessageToFeed(messageObj, {inPlaceOf:messageEl});
        if(shouldScrollDown) $.messageFeed.scrollTop = $.messageFeed.scrollHeight;

        let currentVariantNumber = messageObj.variants.findIndex(v => v===null) + 1;
        newMessageEl.querySelector(".currentVariantNumber").innerHTML = `${currentVariantNumber}<span style="opacity:0.5">/${messageObj.variants.length}</span>`;

        if(isMobile) showEl(newMessageEl.querySelector(".messageVariantsCtn"));

        // update db with bot's reply
        await db.messages.put(messageObj);
        // update thread's lastMessageTime
        await db.threads.update(threadId, { lastMessageTime: Date.now() });

        if(threadCharacter.id >= 0) await db.characters.update(threadCharacter.id, { lastMessageTime: Date.now() });

        // if this isn't at the top of the thread list, re-render the thread list
        let threadElements = [...$.chatThreads.querySelectorAll(".thread")];
        if(!thread.isFav) threadElements = threadElements.filter(el => el.querySelector(".favStar").dataset.isFav==="false");
        if(threadElements[0].dataset.threadId !== threadId.toString()) {
          await renderThreadList();
        }

        if(!signals.stop) { // <-- don't call custom code if they stopped the message
          await triggerMessageActionCustomCodeEvent({threadId, eventData:{messageId:messageObj.id}, eventName:"MessageEdited"});
        }
      }
    } catch(e) {
      console.error("regenerateMessage:", e);
      alert("regenerateMessage failed:\n"+e.stack);
    } finally {
      alreadyRecomputingBotReply = false;
    }
  }

  function createPaddedTypingIndicatorHtml() {
    return `<div style="margin-top:0.25rem; margin-left:0.25rem;">${createTypingIndicatorHtml()}</div>`;
  }
  function createTypingIndicatorHtml() {
    return `<div class="ticontainer"><div class="tiblock"><div class="tidot"></div><div class="tidot"></div><div class="tidot"></div></div></div>`;
  }

  function messageFeedIsNearBottom() {
    return $.messageFeed.scrollHeight - $.messageFeed.scrollTop - $.messageFeed.offsetHeight < 50;
  }

  async function addMessageToFeed(originalMessageObj, opts={}) {
    let threadId = originalMessageObj.threadId;
    let thread = await db.threads.get(threadId); // Note that `addMessageToFeed` is not meant to be called many times at once - so slow operations like this are okay. It's just used for e.g. when they click send, and when AI replies. Not for bulk rendering.

    if(Number($.messageFeed.dataset.threadId) !== threadId) {
      return; // user has since switched threads using the interface
    }

    let messageObj;
    if(opts.skipReaderRendering) {
      messageObj = originalMessageObj;
    } else {
      [ messageObj ] = await renderMessagesForReader({messages:[originalMessageObj], reader:"user", threadId});
    }

    let threadCharacter = opts.threadCharacter;
    if(!threadCharacter) {
      threadCharacter = await db.characters.get(thread.characterId);
    }

    let character = opts.character;
    if(!character) {
      if(messageObj.characterId === -1) character = await getUserCharacterObj();
      else if(messageObj.characterId === -2) character = await getSystemCharacterObj();
      else character = await db.characters.get(messageObj.characterId);
    }
    let el = await createMessageElement(messageObj, {character, thread, threadCharacter});

    if(opts.inPlaceOf) {
      opts.inPlaceOf.replaceWith(el);
    } else if(opts.insertAfter) {
      opts.insertAfter.after(el);
    } else if(opts.insertBefore) {
      opts.insertBefore.before(el);
    } else {
      // otherwise we append:
      let shouldScrollDown = messageFeedIsNearBottom();
      $.messageFeed.appendChild(el);
      if(shouldScrollDown) $.messageFeed.scrollTop = $.messageFeed.scrollHeight;
    }

    hideEl($.noMessagesNotice);
    attachEventHandlersToMessageEl(el, {showVariantsSelector:opts.showVariantsSelector});

    await updateInlineReminderMessage();
    await updateThreadScene();

    for(let undoButton of $.messageFeed.querySelectorAll(".undoMessageDeleteButton")) {
      undoButton.remove();
    }

    return el;
  }

  let mousePos = {x:0, y:0};
  window.addEventListener("mousemove", function(e) {
    mousePos = {x:e.clientX, y:e.clientY};
  });

  async function switchMessageVariant(messageEl, nextOrPrevious) {
    if(messageEl.dataset.canDelete === "false") return;
    if(nextOrPrevious === "previous") {
      let message = await db.messages.get(parseInt(messageEl.dataset.id));
      let currentIndex = message.variants.findIndex(v => v===null); // current message is represented with `null` in variant array
      message.variants[currentIndex] = message.message;
      if(currentIndex-1 < 0) currentIndex = message.variants.length;
      message.message = message.variants[currentIndex-1];
      message.variants[currentIndex-1] = null;
      await db.messages.put(message);
      let newMessageEl = await addMessageToFeed(message, {inPlaceOf:messageEl, showVariantsSelector:true});
      newMessageEl.querySelector(".currentVariantNumber").innerHTML = `${(currentIndex-1) + 1}<span style="opacity:0.5">/${message.variants.length}</span>`; // +1 because 1-indexed
    } else if(nextOrPrevious === "next") {
      let message = await db.messages.get(parseInt(messageEl.dataset.id));
      let currentIndex = message.variants.findIndex(v => v===null); // current message is represented with `null` in variant array
      message.variants[currentIndex] = message.message;
      if(currentIndex+1 >= message.variants.length) currentIndex = -1;
      message.message = message.variants[currentIndex+1];
      message.variants[currentIndex+1] = null;
      await db.messages.put(message);
      let newMessageEl = await addMessageToFeed(message, {inPlaceOf:messageEl, showVariantsSelector:true});
      newMessageEl.querySelector(".currentVariantNumber").innerHTML = `${(currentIndex+1) + 1}<span style="opacity:0.5">/${message.variants.length}</span>`; // +1 because 1-indexed
    } else {
      throw new Error("Invalid nextOrPrevious value: "+nextOrPrevious);
    }
  }

  function hasHorizontalScrollableAncestor(element) {
    while(element && element !== document.body) {
      // Check if the element has a horizontal scrollbar
      if(element.scrollWidth > element.clientWidth) {
        // Check if the element actually allows horizontal scrolling
        const style = window.getComputedStyle(element);
        const overflowX = style.getPropertyValue('overflow-x');
        if(overflowX === 'auto' || overflowX === 'scroll') {
          return true;
        }
      }
      element = element.parentElement;
    }
    return false;
  }

  function addHorizontalSwipeHandler(el, opts, callback) {
    let startX, currentX, startY, currentY;
    let dragShouldCauseSwipe = false;

    el.addEventListener('touchstart', function(event) {
      const tappedElement = document.elementFromPoint(event.touches[0].clientX, event.touches[0].clientY);
      if(hasHorizontalScrollableAncestor(tappedElement)) {
        // otherwise they can't horizontally scroll on stuff
        dragShouldCauseSwipe = false;
      } else {
        dragShouldCauseSwipe = true;
        startX = event.touches[0].pageX;
        startY = event.touches[0].pageY;
        currentX = startX;
        currentY = startY;
        el.style.transition = 'none';
      }
    });

    el.addEventListener('touchmove', function(event) {
      if(!dragShouldCauseSwipe) return;
      currentX = event.touches[0].pageX;
      currentY = event.touches[0].pageY;
      let movedTooFarVertically = Math.abs(startY-currentY) > 90;
      if(movedTooFarVertically) { // so while scrolling down the page, you don't accidentally swipe
        resetElementPosition();
        return;
      }
      if(!window.currentlyQuickEditingAMessage) {
        const deltaX = currentX - startX;
        if(Math.abs(deltaX) > opts.swipeTriggerDistance ?? 170) {
          callback({swipeDirection: deltaX > 0 ? "left-to-right" : "right-to-left"});
          resetElementPosition();
        } else if(Math.abs(deltaX) > 30) { // so that very slight horizontal movements don't trigger it - annoying e.g. when you're trying to vertically scroll
          el.style.transform = `translateX(${deltaX}px)`;
        }
      }
    });

    el.addEventListener('touchend', resetElementPosition);

    function resetElementPosition() {
      el.style.transition = 'transform 0.3s'; // so it returns to original position smoothly
      el.style.transform = 'translateX(0px)';
    }
  }


  function attachEventHandlersToMessageEl(messageEl, opts={}) {
    let messageTextEl = messageEl.querySelector(".messageText");
    const recomputeButton = messageEl.querySelector(".recomputeButton");

    let doubleTapTimeout = null;
    let doubleTapClickCounter = 0;
    let doubleTapEnabled = true;
    messageTextEl.addEventListener("click", async function(e) {
      if(!doubleTapEnabled) return;
      if(doubleTapTimeout) clearTimeout(doubleTapTimeout);
      doubleTapClickCounter++;
      if(doubleTapClickCounter === 2) {
        doubleTapEnabled = false; // so if e.g. double-tap in resulting text editor (to select a word) it doesn't trigger this handler
        await messageQuickEditButtonClickHandler.bind(this)(e).catch(console.error);
        doubleTapEnabled = true;
        doubleTapClickCounter = 0;
      }
      doubleTapTimeout = setTimeout(() => { doubleTapClickCounter = 0; }, 300);
    });

    messageEl.querySelector(".editButton").addEventListener("click", messageEditButtonClickHandler);
    recomputeButton.addEventListener("click", async function() {
      if(window.isTouchScreen && !localStorage.userKnowsAboutSwipeToRegenerate) {
        alert("Tip: You can also 𝘀𝘄𝗶𝗽𝗲 𝘁𝗼 𝗿𝗲𝗴𝗲𝗻𝗲𝗿𝗮𝘁𝗲, and to switch between message variants.");
        localStorage.userKnowsAboutSwipeToRegenerate = "1";
      }
      await regenerateMessage(messageEl);
    });

    addHorizontalSwipeHandler(messageTextEl, {swipeTriggerDistance:$.messageFeed.offsetWidth*0.5}, async ({swipeDirection}) => {
      if(messageEl.dataset.canDelete === "false") return;
      let message = await db.messages.get(parseInt(messageEl.dataset.id));
      let currentIndex = message.variants.findIndex(v => v===null); // current message is represented with `null` in variant array
      if(swipeDirection === "left-to-right") {
        if(currentIndex > 0) {
          await switchMessageVariant(messageEl, "previous");
        } else {
          await regenerateMessage(messageEl);
        }
      } else if(swipeDirection === "right-to-left") {
        if(currentIndex+1 >= message.variants.length) {
          await regenerateMessage(messageEl);
        } else {
          await switchMessageVariant(messageEl, "next");
        }
      }
    });

    messageEl.querySelector(".recomputeWithAltModelButton").addEventListener("click", async function() {
      let modelNameOverride = Date.now() < new Date("2024-01-04").getTime() ? "text-davinci-003" : "gpt-3.5-turbo-instruct";
      await regenerateMessage(messageEl, {modelNameOverride});
    });


    messageEl.querySelector(".prevMessageVariantButton").addEventListener("click", async function() {
      await switchMessageVariant(messageEl, "previous");
    });
    messageEl.querySelector(".nextMessageVariantButton").addEventListener("click", async function() {
      await switchMessageVariant(messageEl, "next");
    });

    if(!isMobile) { // on mobile the variants container is always visible after user has created at least 1 variant
      let variantsCtnHideTimeout = null;
      recomputeButton.addEventListener("mouseenter", function(e) {
        clearTimeout(variantsCtnHideTimeout);
        let variantsCtn = messageEl.querySelector(".messageVariantsCtn");
        showEl(variantsCtn);
        // hotizontally position variantsCtn so it sits directly above recomputeButton (centered)
        variantsCtn.style.left =  `${recomputeButton.offsetLeft + (recomputeButton.offsetWidth/2) - (variantsCtn.offsetWidth/2)}px`;
      });

      recomputeButton.addEventListener("mouseleave", async function() {
        let variantsCtn = messageEl.querySelector(".messageVariantsCtn");
        variantsCtnHideTimeout = setTimeout(() => hideEl(variantsCtn), 500);
      });

      messageEl.querySelector(".messageVariantsCtn").addEventListener("mouseenter", function() {
        clearTimeout(variantsCtnHideTimeout);
      });
      messageEl.querySelector(".messageVariantsCtn").addEventListener("mouseleave", function() {
        let variantsCtn = messageEl.querySelector(".messageVariantsCtn");
        variantsCtnHideTimeout = setTimeout(() => hideEl(variantsCtn), 500);
      });
      if(opts.showVariantsSelector) {
        recomputeButton.dispatchEvent(new Event("mouseenter"));
        delay(100).then(() => {
          // if mouse is not on top of variantsCtn, dispatch mouseleave:
          let variantsCtn = messageEl.querySelector(".messageVariantsCtn");
          let variantsCtnRect = variantsCtn.getBoundingClientRect();
          if(!(mousePos.x >= variantsCtnRect.left && mousePos.x <= variantsCtnRect.right && mousePos.y >= variantsCtnRect.top && mousePos.y <= variantsCtnRect.bottom)) {
            // debugger;
            recomputeButton.dispatchEvent(new Event("mouseleave"));
          }
        });
      }
    }

    messageEl.querySelector(".deleteButton").addEventListener("click", messageDeleteButtonClickHandler);
    messageEl.querySelector(".showHiddenMessageButton").addEventListener("click", showHiddenMessageClickHandler);
    // messageEl.querySelector(".messageText").querySelectorAll("pre > code").forEach(el => el.outerHTML = el.innerHTML); // not sure why `marked` is adding <pre><code>...</code></pre> around code blocks, but this fixes it
    // messageEl.querySelector(".statusMessage").addEventListener("click", () => summariesWindow.show());

    messageEl.querySelector(".brainButton")?.addEventListener("click", async function() {
      if(messageEl.dataset.canDelete === "false") return;
      let message = await db.messages.get(parseInt(messageEl.dataset.id));

      let memoryBatchesUsed = [];
      if(message.memoryIdBatchesUsed && message.memoryIdBatchesUsed.length > 0 && message.memoryIdBatchesUsed[0]) {
        if(typeof message.memoryIdBatchesUsed[0][0] === "number") {
          // old memory storage approach:
          let memoryIds = message.memoryIdBatchesUsed.flat();
          let memoriesUsed = await db.memories.where("id").anyOf(memoryIds).toArray();
          memoryBatchesUsed = message.memoryIdBatchesUsed;
          // replace ids in memoryBatchesUsed with memories from memoriesUsed:
          for(let batch of memoryBatchesUsed) {
            for(let i = 0; i < batch.length; i++) {
              batch[i] = memoriesUsed.find(m => m.id === batch[i]) ?? {text:"(memory not found - likely because it has since been edited or deleted)"};
            }
          }
        } else if(typeof message.memoryIdBatchesUsed[0][0] === "string" && message.memoryIdBatchesUsed[0][0].split("|").length === 3) {
          // new approach stores memories within the last message that they were 'constructed' with - memoriesEndingHere:
          // memoryIdBatchesUsed contains several arrays, each of which has string like `${messageId}|${level}|${indexWithinLevel}` (instead of integer memory ids as in old approach)
          let messageIds = [...new Set(message.memoryIdBatchesUsed.flat().map(m => Number(m.split("|")[0])))];
          let messages = await db.messages.where("id").anyOf(messageIds).toArray();
          let memoryIdStrToMemory = {};
          for(let message of messages) {
            for(let level in message.memoriesEndingHere || {}) {
              let i = 0;
              for(let memory of message.memoriesEndingHere[level] || []) {
                memoryIdStrToMemory[`${message.id}|${level}|${i}`] = memory;
                i++;
              }
            }
          }
          // replace the `${messageId}|${level}|${indexWithinLevel}` objects in memoryBatchesUsed with actual memory objects from memoriesUsed:
          memoryBatchesUsed = JSON.parse(JSON.stringify(message.memoryIdBatchesUsed));
          for(let batch of memoryBatchesUsed) {
            for(let i = 0; i < batch.length; i++) {
              batch[i] = memoryIdStrToMemory[batch[i]] ?? {text:"(memory not found - likely because it has since been edited or deleted)"};
            }
          }
        }
      }


      let loreEntriesUsed = await db.lore.where("id").anyOf(message.loreIdsUsed.filter(id => typeof id === "number")).toArray();

      let content = [];

      if(message.instruction) {
        content.push(`<b>Instruction Used:</b> ${message.instruction}`);
      }

      if(message.memoryQueriesUsed.length > 0) {
        content.push(`<b>Memory/Lore Search Queries Used:</b>\n<ul>${message.memoryQueriesUsed.map(q => `<li>${sanitizeHtml(q)}</li>`).join("")}</ul>`);
      }

      if(memoryBatchesUsed.length > 0) {
        content.push(`<b>Memories Used:</b>\n<ul>${memoryBatchesUsed.map(batch => batch.map(m => m.text).join(" ⮕ ")).map(t => `<li>${sanitizeHtml(t)}</li>`).join("")}</ul><div style="opacity:0.5;font-size: 80%; margin-top:0.5rem;">(you can add and edit memories by typing <b style="white-space:nowrap;">/mem</b> in the chat)</div>`);
      } else {
        content.push(`<b>Memories Used:</b>\n<div style="opacity:0.5;font-size: 80%; margin-top:0.5rem;">(No memories were used to generate this message. This is either because the conversation was not yet long enough to warrant memory storage/retrieval, or you don't have memories enabled in the character settings, or lore entries took precedence)</div>`);
      }

      if(loreEntriesUsed.length > 0) {
        content.push(`<b>Lore Entries Used:</b>\n<ul>${loreEntriesUsed.map(m => m.text).map(t => `<li>${sanitizeHtml(t)}</li>`).join("")}</ul><div style="opacity:0.5;font-size: 80%; margin-top:0.5rem;">(you can add and edit lore by typing <b style="white-space:nowrap;">/lore</b> in the chat)</div>`);
      } else {
        content.push(`<b>Lore Entries Used:</b>\n<div style="opacity:0.5;font-size: 80%; margin-top:0.5rem;">(No lore entries were used to generate this message. This is either because the conversation was not yet long enough to warrant memory storage/retrieval, or you don't have memories enabled in the character settings, or memory entries took precedence. You can add and edit lore by typing <b style="white-space:nowrap;">/lore</b> in the chat.)</div>`);
      }

      if(message.messageIdsUsed.length > 0) {
        // note that messageIdsUsed can contain ids of messages where summaries were actually used in place of the original message itself, but message.summariesUsed (which is an array of {messageId, summaryLevel}), tells us about that.
        let messageIds = message.messageIdsUsed.filter(id => id !== -1);
        let messages = await db.messages.where("id").anyOf(messageIds).toArray();
        messages.sort((a,b) => a.order - b.order);
        let messageIdToMessage = messages.reduce((acc, m) => { acc[m.id] = m; return acc; }, {});

        let messageIdToSummaryLevelUsed = {};
        for(let {messageId, level} of (message.summariesUsed || [])) {
          messageIdToSummaryLevelUsed[messageId] = level;
        }

        let preparedMessages = await prepareMessagesForBot({messages});

        for(let m of preparedMessages) {
          if(messageIdToSummaryLevelUsed[m.id]) {
            m.name = "[Summary (previous events)]";
            m.content = messageIdToMessage[m.id].summariesEndingHere[messageIdToSummaryLevelUsed[m.id]];
          }
        }

        let messagesText = preparedMessages.map(m => {
          if(message.messageIdsUsed.includes(m.id)) {
            return `<b>[${m.name}]:</b> ${sanitizeHtml(m.content)}`;
          } else {
            return "<b>[???]</b>: <span style='opacity:0.5;'>(Message no longer exists. May have been deleted by you, or by custom code.)</span>";
          }
        }).join("\n\n");

        content.push(`<b>Messages Used:</b>\n<details style="opacity:0.5; padding:1rem;"><summary style="cursor:pointer;">Click here to show messages</summary>\n${messagesText}</details>`);
      }

      prompt2({
        display:{html:`<div style="white-space:pre-wrap;">Here's some data that the character used to generate this message:\n\n${content.join("\n\n")}</div>`, type:"none"},
      }, { submitButtonText: "close", cancelButtonText: null });
    });
  }

  // right/left arrow to switch message variants:
  window.addEventListener("keydown", async function(e) {
    // if active element is a textarea/input, then return
    if(document.activeElement.tagName === "TEXTAREA" || document.activeElement.tagName === "INPUT") {
      return;
    }
    if($.messageFeed.offsetWidth === 0 || activeThreadId === null) {
      return;
    }

    // if they press right arrow, and the last message is on the final variant, then recompute the final message:
    if(e.key === "ArrowRight" || e.key === "ArrowLeft") {
      let threadId = parseInt($.messageFeed.dataset.threadId);
      let thread = await db.threads.get(threadId);
      let messages = await db.messages.where("threadId").equals(threadId).toArray();
      messages.sort((a,b) => a.order - b.order);
      let lastMessage = messages[messages.length-1];
      let lastMessageEl = [...$.messageFeed.querySelectorAll(".message")].pop();
      if(e.key === "ArrowRight") {
        // the `lastMessage.variants` array has `null` in the position of the 'current' message, so if null is at the end of the array, and they pressed right arrow, then we recompute:
        if(lastMessage.variants[lastMessage.variants.length-1] === null) {
          await regenerateMessage(lastMessageEl);
        } else {
          // otherwise we just move to the next variant:
          await switchMessageVariant(lastMessageEl, "next");
        }
      }
      if(e.key === "ArrowLeft") {
        // if the first variant is null, then we recompute:
        if(lastMessage.variants[0] === null) {
          await regenerateMessage(lastMessageEl);
        } else {
          // otherwise we just move to the previous variant:
          await switchMessageVariant(lastMessageEl, "previous");
        }
      }
    }
  });

  async function showHiddenMessageClickHandler() {
    let messageEl = this.closest(".message");
    if(messageEl.dataset.canDelete === "false") return;
    let messageObj = db.messages.get(parseInt(messageEl.dataset.id));
    messageEl.classList.remove("hiddenFromUser");
  }

