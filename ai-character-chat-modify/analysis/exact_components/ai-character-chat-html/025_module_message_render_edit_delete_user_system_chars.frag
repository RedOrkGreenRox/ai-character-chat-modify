  let dataUrlToBlobUrlCache = new Map();
  let failDummyBlobUrl = null;
  async function dataUrlToCachedBlobUrl(dataUrl) {
    if(dataUrlToBlobUrlCache.has(dataUrl)) return dataUrlToBlobUrlCache.get(dataUrl);
    let blob = await fetch(dataUrl).then(r => r.blob()).catch(console.error);
    let blobUrl;
    if(blob) {
      blobUrl = URL.createObjectURL(blob);
      dataUrlToBlobUrlCache.set(dataUrl, blobUrl);
    } else {
      // Not sure what causes it to fail for some users. Maybe broken data URL or too long, or something.
      if(!failDummyBlobUrl) failDummyBlobUrl = URL.createObjectURL(await fetch(`data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAAXNSR0IB2cksfwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAANQTFRFAAAAp3o92gAAAApJREFUeJxjZAAAAAQAAiFkrWoAAAAASUVORK5CYII=`).then(r => r.blob()));
      blobUrl = failDummyBlobUrl;
    }
    return blobUrl;
  }

  let googleWebFontsAlreadyLoaded = new Set();
  function loadGoogleWebFontsInMessageWrapperStyleIfNeccessary(cssText) {
    let match = cssText.match(/font-family: *['"](.*?)['"]/);
    let name = match ? match[1] : null;
    if(name && !googleWebFontsAlreadyLoaded.has(name)) {
      let link = document.createElement('link');
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, "+")}&display=swap`;
      console.log("LOADED:", name);
      document.body.appendChild(link);
      if(cssText.includes("font-weight:")) { // attempt to load all weights if they've specified font-weight, since Google Fonts' new "variable weight" fonts won't load anything other than regular weight by default
        let link = document.createElement('link');
        link.rel = "stylesheet";
        link.href = `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, "+")}:wght@100..900&display=swap`;
        console.log("LOADED:", name);
        document.body.appendChild(link);
      }
      googleWebFontsAlreadyLoaded.add(name);
    }
  }

  async function createMessageElement(messageObj, opts={}) {

    let messageObjHash = await sha256Text(JSON.stringify(messageObj));

    if(messageObj.character) debugger; // we don't 'attach' it like this anymore - this shouldn't happen

    let thread = opts.thread;
    if(!thread) {
      console.warn("getting thread from db in createMessageElement");
      thread = await db.threads.get(messageObj.threadId);
    }

    let threadCharacter = opts.threadCharacter;
    if(!threadCharacter) {
      console.warn("getting threadCharacter from db in createMessageElement");
      threadCharacter = await db.characters.get(thread.characterId);
    }

    let userCharacter = opts.userCharacter ?? null;

    let character = opts.character;

    if(!character && messageObj.characterId === -1) {
      console.warn("getting character from db in createMessageElement (this is okay so long as it's not in a hot loop)");
      character = userCharacter ?? await getUserCharacterObj();
      userCharacter = character;
    }
    if(!character && messageObj.characterId === -2) {
      console.warn("getting character from db in createMessageElement (this is okay so long as it's not in a hot loop)");
      character = await getSystemCharacterObj();
    }
    if(!character && messageObj.characterId >= 0) {
      if(opts.characterIdToCharacterObj && opts.characterIdToCharacterObj[messageObj.characterId]) {
        character = opts.characterIdToCharacterObj[messageObj.characterId];
      } else {
        console.warn("getting character from db in createMessageElement (this is okay so long as it's not in a hot loop)");
        character = await db.characters.get(messageObj.characterId);
      }
    }

    let tmp = document.createElement("div");
    let currentVariantNumber = messageObj.variants.findIndex(v => v === null) + 1;

    let variantCtnCss;
    if(isMobile) {
      // on mobile we show when there are multiple variants
      if(messageObj.variants.length >= 2) {
        variantCtnCss = "margin-left:1rem;";
      } else {
        variantCtnCss = "margin-left:1rem; display:none;";
      }
    } else {
      // on desktop we show on hover:
      variantCtnCss = "display:none; position:absolute; bottom:1.4rem; padding: 0.125rem;";
    }

    let avatar = messageObjToCharacterAvatar(messageObj, {thread, character, threadCharacter});
    let avatarUrl = avatar.url;
    let avatarSize = avatar.size;
    let avatarShape = avatar.shape;

    if(avatarUrl && avatarUrl.startsWith("data:")) {
      avatarUrl = await dataUrlToCachedBlobUrl(avatarUrl).catch(e => (console.error(e), ""));
    }

    let wrapperStyle = messageObj.wrapperStyle || thread.messageWrapperStyle || "";
    if(!wrapperStyle) wrapperStyle = character.messageWrapperStyle || "";
    if(!wrapperStyle) wrapperStyle = threadCharacter.messageWrapperStyle || "";

    if(wrapperStyle.includes("font-family") && (wrapperStyle.includes("'") || wrapperStyle.includes(`"`))) {
      loadGoogleWebFontsInMessageWrapperStyleIfNeccessary(wrapperStyle);
    }

    let avatarWidth = 50 * (avatarSize ?? 1);
    let avatarHeight = 50 * (avatarSize ?? 1);
    let avatarBorderRadius = "var(--border-radius)";
    if(avatarShape === "circle") {
      avatarBorderRadius = "50%";
    }
    if(avatarShape === "portrait") {
      avatarHeight *= 1.5;
    }

    let characterName = messageObjToCharacterName(messageObj, {thread, character, threadCharacter});

    let showRecomputeWithAltButtonModel = false;
    // if(thread.modelName === "gpt-3.5-turbo" || thread.modelName === "gpt-4") {
    //   if(textContainsAsALanguageModelText(messageObj.message + messageObj.variants.join(" "))) {
    //     showRecomputeWithAltButtonModel = true;
    //   }
    // }

    tmp.innerHTML = `
      <div class="message ${messageObj.hiddenFrom?.includes("user") ? "hiddenFromUser" : ""}" data-id="${sanitizeHtml(messageObj.id)}" data-order="${sanitizeHtml(messageObj.order)}" data-character-id="${sanitizeHtml(messageObj.characterId)}" data-can-delete="true" data-hash="${messageObjHash}" style="${sanitizeHtml(wrapperStyle)}; position:relative;">
        <div style="text-align:center;"><button class="showHiddenMessageButton" style="cursor:pointer; font-size:0.65rem;">Show hidden message</button></div>
        <div class="bottomButtons">
          <div class="brainButton emojiButton">🧠</div>
        </div>
        <div class="messageWrap">
          <div class="avatar" style="${avatarUrl ? `background-image:url(${sanitizeHtml(avatarUrl)})` : ""};width:${sanitizeHtml(avatarWidth)}px; min-width:${sanitizeHtml(avatarWidth)}px; height:${sanitizeHtml(avatarHeight)}px; border-radius:${sanitizeHtml(avatarBorderRadius)};"></div>
          <div style="padding-left:0.5rem; min-width: 0; width:100%;">
            <div class="info" style="flex-grow:1; display:flex; font-size:80%; align-items:center; user-select:none;">
              <div class="characterName" style="font-weight:bold;">${sanitizeHtml(characterName)}</div>
              <!-- <div class="time" style="font-size:0.8rem; opacity:0.5; margin-left:0.5rem; display: flex; align-items: center;">${getDateTimeString(messageObj.creationTime)}</div> -->
              <div class="editButton emojiButton" style="font-size:0.8rem; margin-left:1rem; display: flex; align-items: center; cursor:pointer;">✏️</div>
              <div class="deleteButton emojiButton" style="font-size:0.8rem; margin-left:1rem; display: flex; align-items: center; cursor:pointer;">🗑️</div>
              <div style="position:relative;display:flex; align-items:center;">
                <div class="recomputeButton emojiButton" style="font-size:0.8rem; margin-left:1rem; display:flex; align-items: center; cursor:pointer;" title="You can use your arrow keys to switch between generated variations.">🔁</div>
                <div class="recomputeWithAltModelButton emojiButton" style="font-size:0.8rem; margin-left:1rem; display:${showRecomputeWithAltButtonModel ? "flex" : "none"}; align-items: center; cursor:pointer;" title="Regenerate this message with the davinci model (10x more expensive, but less filtered)">🙄</div>
                <div class="messageVariantsCtn" style="user-select:none; background: var(--button-bg); border: 1px solid var(--border-color); border-radius: var(--border-radius); min-width:max-content; ${sanitizeHtml(variantCtnCss)}">
                  <span class="prevMessageVariantButton emojiButton">◄</span>
                  <span class="currentVariantNumber">${sanitizeHtml(currentVariantNumber)}<span style="opacity:0.5">/${sanitizeHtml(messageObj.variants.length)}</span></span>
                  <span class="nextMessageVariantButton emojiButton">►</span>
                </div>
              </div>
              ${messageObj.hiddenFrom?.includes("ai") ? `<div class="hiddenFromAiIcon" onclick="alert('This icon indicates that this message is hidden from the AI.')" title="The AI cannot see this message." style="font-size:0.8rem; margin-left:1rem; display:flex; align-items: center; cursor:pointer;">🙈</div>` : ""}
              <div class="statusMessage" style="margin-left:1rem;display: flex;align-items: center;cursor:pointer;font-size: 0.7rem;opacity: 0.5;"></div>
            </div>
            <div class="messageText" style="overflow-wrap:break-word;"></div>
          </div>
        </div>
      </div>
    `;
    let el = tmp.firstElementChild;

    let messageText = messageObj.message;

    // PERCHANCE EDIT:
    // text-to-image parsing:
    // messageText = messageText.replace(/(^|\s)\/image (.+?)($|\n)/g, function(m, p1, p2, p3) {
    let imageReplacementTagToPrompt = {};
    // Had to do this weird "replacement tag" thing so we can do async evaluatePerchanceTextInSandbox call inside the transformation when needed.
    messageText = messageText.replace(/<image>(.+?)<\/image>/gs, function(m, p1) {
      let prompt = p1; // note that this can include params via the `(seed:::123)` type notation
      let tag = Math.random().toString()+Math.random().toString();
      imageReplacementTagToPrompt[tag] = prompt;
      return tag; // this gets replaced with the actual (transformed) prompt in the `for` loop below.
    });

    let userCharacterName; // needed for {{user}} replacement in image prompt prefix/suffix/triggers
    if(Object.entries(imageReplacementTagToPrompt).length > 0) {
      userCharacterName = thread.userCharacter?.name?.trim() ?? threadCharacter.userCharacter?.name?.trim() ?? (userCharacter ? userCharacter.name : (await getUserCharacterObj()).name);
    }

    for(let [tag, prompt] of Object.entries(imageReplacementTagToPrompt)) {
      // @noKeepButton - means don't display the 'keep' button. Useful for e.g. the 'Unknown' character creator, where the message is actually just temporary
      let noKeepButton = false;
      if(prompt.includes("@noKeepButton")) {
        prompt = prompt.replaceAll("@noKeepButton", "");
        noKeepButton = true;
      }

      let corePrompt = prompt; // i.e. without added prefix/suffix/etc. - MUST use this to key the __savedImages because the *actual* prompt can change every time you evaluate it (since suffix/prefix/triggers can have perchance syntax)

      if(messageObj.customData.__savedImages && messageObj.customData.__savedImages[corePrompt]) {

        let mobileCss = "margin:0.5rem 0; width:100%; overflow-x:auto;";
        let desktopCss = "margin:0.5rem 0; overflow-x:auto; display:inline-block; vertical-align:top;";

        // return p1+`<img src="${messageObj.customData.__savedImages[prompt].dataUrl}" style="max-width:450px; max-height:450px; margin:0.5rem 0;">`+p3;
        let result = `<div class="generated-image-container" style="${window.innerWidth < 700 ? mobileCss : desktopCss}">
          <img src="${messageObj.customData.__savedImages[corePrompt].dataUrl}" alt="${corePrompt.replaceAll('"', '')}" title="${corePrompt.replaceAll('"', '')}" style="max-width:450px; max-height:450px;">
        </div>`;
        messageText = messageText.replace(tag, result);
        continue;
      }

      // apply characters, or thread character's prompt prefix & suffix & triggers:
      let prompterChar = character.id < 0 ? threadCharacter : character; // <-- use thread character if this is a user or system message
      // note that {{char}} replacement must come BEFORE perchance syntax, due to curly brackets being perchance syntax.
      let imagePromptPrefix = (prompterChar.imagePromptPrefix ?? "").replace(/\{\{char\}\}/g, threadCharacter.name).replace(/\{\{user\}\}/g, userCharacterName);
      let imagePromptSuffix = (prompterChar.imagePromptSuffix ?? "").replace(/\{\{char\}\}/g, threadCharacter.name).replace(/\{\{user\}\}/g, userCharacterName);
      try {
        // Evaluate Perchance syntax in prefix/suffix if needed:
        if((imagePromptPrefix.includes("{") && imagePromptPrefix.includes("|") && imagePromptPrefix.includes("}")) || (imagePromptPrefix.includes("[") && imagePromptPrefix.includes("]"))) imagePromptPrefix = await window.root.evaluatePerchanceTextInSandbox(imagePromptPrefix, {timeout:500});
        if((imagePromptSuffix.includes("{") && imagePromptSuffix.includes("|") && imagePromptSuffix.includes("}")) || (imagePromptSuffix.includes("[") && imagePromptSuffix.includes("]"))) imagePromptSuffix = await window.root.evaluatePerchanceTextInSandbox(imagePromptSuffix, {timeout:500});
      } catch(e) {
        console.error(e);
      }

      prompt = `${imagePromptPrefix} ${prompt} ${imagePromptSuffix}`;

      // Add prompt trigger texts if any of them "fire":
      if(prompterChar.imagePromptTriggers) {
        // TODO: if it's a "group chat", shouldn't we pull in triggers from *ALL* characters involved?
        try {
          // cache the parsed trigger lines so we don't e.g. re-create the regexes for every single message
          if(!window.imagePromptTriggersParsedLinesCache) window.imagePromptTriggersParsedLinesCache = {};
          if(!window.imagePromptTriggersParsedLinesCache[prompterChar.imagePromptTriggers]) {
            let lines = prompterChar.imagePromptTriggers.split("\n").filter(l => l.trim());
            let parsedObjs = [];
            for(let line of lines) {
              if(/^\/.+?\/[gimsuv]*:.+/.test(line)) {
                // they're specifying a regex as the trigger:
                let match = line.match(/\/(.+?)\/([gimsuv]*):(.+)/);
                parsedObjs.push({
                  regex: new RegExp(match[1], match[2]),
                  text: match[3],
                });
              } else {
                // normal text/string as trigger:
                parsedObjs.push({
                  regex: new RegExp("\\b"+line.split(":")[0].replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')+"\\b"), // must escape regex characters
                  text: line.split(":").slice(1).join(":"),
                });
              }
            }
            window.imagePromptTriggersParsedLinesCache[prompterChar.imagePromptTriggers] = parsedObjs;
          }
          let objs = window.imagePromptTriggersParsedLinesCache[prompterChar.imagePromptTriggers];
          for(let obj of objs) {
            // just an optimization, since most prompts probably won't have Perchance syntax:
            if((obj.text.includes("{") && obj.text.includes("|") && obj.text.includes("}")) || (obj.text.includes("[") && obj.text.includes("]"))) {
              if(obj.regex.test(prompt)) {
                let text = await window.root.evaluatePerchanceTextInSandbox(obj.text, {timeout:300});
                text = text.replace("@prepend ", "");
                text = text.replace(/\{\{char\}\}/g, threadCharacter.name).replace(/\{\{user\}\}/g, userCharacterName);
                if(obj.text.trim().startsWith("@prepend")) prompt = `${text} ${prompt}`;
                else prompt = `${prompt} ${text}`;
              }
            } else {
              if(obj.regex.test(prompt)) {
                let text = obj.text;
                text = text.replace("@prepend ", "");
                text = text.replace(/\{\{char\}\}/g, threadCharacter.name).replace(/\{\{user\}\}/g, userCharacterName);
                if(obj.text.trim().startsWith("@prepend")) prompt = `${text} ${prompt}`;
                else prompt = `${prompt} ${text}`;
              }
            }
          }
        } catch(e) {
          alert("Error while evaluating imagePromptTriggers: "+e.message);
          console.error("Error while evaluating imagePromptTriggers:", e);
        }
      }

      let options = {
        prompt,
        onFinish: function(result) {
          result.iframe._textToImageResultDataUrl = result.canvas.toDataURL("image/jpeg");
          let keepButton = result.iframe.closest('.generated-image-container').querySelector('.keep-generated-image-button');
          if(keepButton) keepButton.style.display = "";
          let deleteButton = result.iframe.closest('.generated-image-container').querySelector('.delete-generated-image-button');
          if(deleteButton) deleteButton.style.display = "";
        },
      };
      if(!prompt.includes("(negativePrompt:::")) {
        options.negativePrompt = "low quality, worst quality, blurry";
      }
      if(!prompt.includes("(resolution:::")) {
        if(/\b(portrait|selfie)\b/i.test(prompt)) {
          options.resolution = "512x768";
        } else if(/\b(landscape|wide.?angle)\b/i.test(prompt)) {
          options.resolution = "768x512";
        } else {
          options.resolution = "768x768";
          // if(Math.random() < 0.5) {
          //   options.resolution = "512x768";
          // } else {
          //   options.resolution = "768x512";
          // }
        }
      }

      let keepButtonHtml = `<div style="height:0px; text-align:center; position:absolute; left:0; right:0;">
        <button class="keep-generated-image-button" data-message-id="${sanitizeHtml(messageObj.id)}" data-prompt="${sanitizeHtml(prompt)}" title="keep this image" style="display:none; position:relative; top:-15px; cursor:pointer;">✅ keep</button>
        <button class="delete-generated-image-button" data-message-id="${sanitizeHtml(messageObj.id)}" data-prompt="${sanitizeHtml(prompt)}" title="delete this image" style="display:none; position:relative; top:-15px; cursor:pointer; margin-left:1rem;">🗑️ delete</button>
      </div>`;
      if(noKeepButton) keepButtonHtml = ``;

      // NOTE: Originally this just had the 'mobileCss' and I was going to change it completely to the inline-block one, but I vaguely recall that I needed the width:100% stuff for it to work on mobile, becasue it needs to horizontally scroll.
      // So for now I'm being conservative and only enabling inline-block stuff on desktop, which is all that's needed anyway, there's not enough room for there to be multiple images in a single 'row' on mobile anyway.
      // CAUTION: if you change this, you also need to ctrl+f for generated-image-container and change it in the other place too
      let mobileCss = "margin:0.5rem 0; width:100%; overflow-x:auto; overflow-y:hidden;";
      let desktopCss = "margin:0.5rem 0; overflow-x:auto; overflow-y:hidden; display:inline-block; vertical-align:top;";

      let result = dedent(`
      <div class="generated-image-container" data-core-prompt="${sanitizeHtml(corePrompt)}" style="${window.innerWidth > 700 ? desktopCss : mobileCss}">
        <div style="width:min-content; position:relative; padding-bottom:0.5rem;">
          ${root.textToImagePlugin(options)}
          ${keepButtonHtml}
        </div>
      </div>`);
      // CAUTION: note that this line isn't always reached - see the 'continue' above.
      messageText = messageText.replace(tag, result);
    }
    if(!window.alreadyAddedKeepGeneratedImageButtonClickHandler) {
      window.alreadyAddedKeepGeneratedImageButtonClickHandler = true;
      window.addEventListener("click", async function(e) {
        let el = e.target;
        if(el.classList.contains("keep-generated-image-button")) {
          let messageObj = await db.messages.get(parseInt(el.dataset.messageId));
          if(!messageObj.customData.__savedImages) messageObj.customData.__savedImages = {};
          let generatedImageContainer = el.closest(".generated-image-container");
          let corePrompt = generatedImageContainer.dataset.corePrompt;
          let iframe = generatedImageContainer.querySelector("iframe");
          messageObj.customData.__savedImages[corePrompt] = {
            dataUrl: iframe._textToImageResultDataUrl,
          };
          await db.messages.put(messageObj);
          el.style.display = "none";
          iframe.outerHTML = `<img src="${iframe._textToImageResultDataUrl}" style="max-width:450px; max-height:450px;">`;

          let deleteButton = generatedImageContainer.querySelector(".delete-generated-image-button");
          if(deleteButton) deleteButton.style.display = "none";
        }
        if(el.classList.contains("delete-generated-image-button")) {
          let messageObj = await db.messages.get(parseInt(el.dataset.messageId));
          let generatedImageContainer = el.closest(".generated-image-container");
          let corePrompt = generatedImageContainer.dataset.corePrompt;
          messageObj.message = messageObj.message.replace(corePrompt, "");
          messageObj.message = messageObj.message.replace(/<image>\s*<\/image>/, ""); // remove empty image tags
          await db.messages.put(messageObj);
          generatedImageContainer.remove();
        }
      });
    }

    let messageTextEscaped = messageText.replace(/~+/g, m => m.length === 1 ? "\\~" : m); // only ~~ should cause a <del> elements (not single ~, which is commonly used in RP)
    let messageHtml = DOMPurify.sanitize(marked.parse(messageTextEscaped), domPurifyOptions);

    // // text-to-image parsing:
    // messageHtml = messageHtml.replace(/<p>\/image (.+?)<\/p>/g, function(m, p1) {
    //   return "<div>"+root.textToImagePlugin({
    //     prompt: p1, // note that this can include params via the `(seed:::123)` type notation
    //     // EDIT: commenting this out for now because what if they re-roll the iframe? you'd have multiple setTimeouts. This is just an optimization anyway, so I'm leaving it out for now. t2i plugin maybe needs an 'onRegen' handler?
    //     // onFinish: (result) => {
    //     //   let iframe = result.iframe;
    //     //   let canvas = result.canvas;
    //     //   // after a while, replace the iframe with a canvas for performance reasons:
    //     //   setTimeout(() => {
    //     //     if(document.body.contains(iframe)) {
    //     //       iframe.replaceWith(canvas);
    //     //     }
    //     //   }, 1000*60*15);
    //     // },
    //   })+"</div>";
    // });

    el.querySelector(".messageText").innerHTML = messageHtml;
    // el.querySelector(".messageText").querySelectorAll("pre > code").forEach(el => el.outerHTML = el.innerHTML); // not sure why `marked` is adding <pre><code>...</code></pre> around code blocks, but this fixes it

    highlightCodeBlocks(el.querySelector(".messageText"));

    // add 'copy' button to code blocks
    el.querySelectorAll('.messageText pre').forEach(pre => {
      const wrapper = document.createElement('div');
      const button = document.createElement('button');
      button.innerText = '📋 copy';
      button.style.cssText = 'font-size:80%; position:absolute; top:0.25rem; right:0.25rem;';
      wrapper.style.position = 'relative';
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);
      wrapper.appendChild(button);

      button.addEventListener('click', async () => {
        let text = pre.innerText.trim(); // trim removes trailing newlines from bash commands which is a very good idea
        await navigator.clipboard.writeText(text);
        button.innerText = '✅ copied';
        setTimeout(() => {
          button.innerText = '📋 copy';
        }, 2000);
      });
    });
    return el;
  }


  // function textContainsAsALanguageModelText(text) {
  //   let t = text.toLowerCase();
  //   return t.includes("as a language model")
  //     || t.includes("trained by openai")
  //     || t.includes("as a large language model")
  //     || t.includes("language model trained")
  //     || /\bas an ai\b/.test(t)
  //     || /\bi'm sorry.+(appropriate|acceptable)\b/.test(t)
  //     || /\bi apologi[zs]e.+(appropriate|acceptable)\b/.test(t)
  //     || /\b(i (can't|cannot) (assist|help)( you|) with that)\b/.test(t)
  //     || /\b(i'm |)sorry, i (can't|cannot)\b/.test(t.slice(0, 50))
  //     || /\bunfortunately,? i (can't|cannot)\b/.test(t.slice(0, 50))
  //     || /\bsorry.+(cannot|can't|won't be able to).+(generate|write|create|do that)\b/.test(t.slice(0, 50))
  // }

  async function messageEditButtonClickHandler(e) {
    e.preventDefault();
    e.stopPropagation();
    let messageEl = this.closest(".message");
    if(messageEl.dataset.canDelete === "false") return;
    const messageId = parseInt(messageEl.dataset.id);
    const originalMessage = await db.messages.get(messageId);
    let threadId = originalMessage.threadId;
    const thread = await db.threads.get(threadId);

    let insertNewMessageEl = document.createElement("div");
    insertNewMessageEl.style.cssText = "margin-top: 1rem;";
    insertNewMessageEl.innerHTML = `<span style="font-size:85%;">insert new message:</span> <button class="insertAbove">above</button> <button class="insertBelow">below</button>`;
    async function insertMessageHandler(aboveOrBelow) {
      const result = await prompt2({
        content: {label: "Message content:", type: "text", height:"fit-content", focus:true},
        author: {label: "Author:", type: "select", options:[{value:"user"}, {value:"ai"}, {value:"system"}], defaultValue: "user"},
        hiddenFrom: {hidden:true, label: "hidden from:", type: "select", options:[{value:"user"}, {value:"ai"}, {content:"both", value:"user,ai"}, {content:"neither", value:""}], defaultValue: originalMessage.hiddenFrom.join(",")},
      });
      if(!result) return;
      let characterId = result.author === "user" ? -1 : result.author === "system" ? -2 : thread.characterId;
      let messageObj = createMessageObj({threadId, message:result.content, characterId, hiddenFrom:result.hiddenFrom.split(",")});

      let messages = await db.messages.where({threadId}).toArray();
      messages.sort((a,b) => a.order - b.order);
      let messageIndex = messages.findIndex(m => m.id === messageId);
      let prevOrder, nextOrder;
      if(aboveOrBelow === "above") {
        prevOrder = messageIndex > 0 ? messages[messageIndex-1].order : messages[messageIndex].order-1;
        nextOrder = originalMessage.order;
      } else {
        prevOrder = originalMessage.order;
        nextOrder = messageIndex < messages.length-1 ? messages[messageIndex+1].order : messages[messageIndex].order+1;
      }
      messageObj.order = (prevOrder + nextOrder) / 2;
      messageObj.id = await addMessageToDb(messageObj);

      let opts = {};
      if(aboveOrBelow === "above") opts.insertBefore = messageEl;
      else opts.insertAfter = messageEl;

      await addMessageToFeed(messageObj, opts);

      await triggerMessageActionCustomCodeEvent({threadId, eventData:{messageId:messageObj.id}, eventName:"MessageInserted"});
    }
    insertNewMessageEl.querySelector(".insertAbove").addEventListener("click", insertMessageHandler.bind(null, "above"));
    insertNewMessageEl.querySelector(".insertBelow").addEventListener("click", insertMessageHandler.bind(null, "below"));

    let alreadyEditingCharacter = false;
    async function editCharacter() {
      if(alreadyEditingCharacter) return; // for safety in case of fast double click or whatever
      alreadyEditingCharacter = true;
      await editCharacterById(originalMessage.characterId);
      alreadyEditingCharacter = false;
    }

    let promptOpts = {};
    if(originalMessage.characterId >= 0) {
      promptOpts.topButtons = {type:"buttons", label:null, buttons:[
        {text:"🎭 edit this character", onClick:editCharacter},
      ]};
    }
    Object.assign(promptOpts, {
      // CAUTION: All types other than "none" and "buttons" must have a defaultValue, since we use it for change detection, below
      message: {label: `Edit the message below.${originalMessage.characterId === -1 ? ` To edit <b>your name</b>, use the 'options' button (next to the send button).` : ""} Note that instead of using this popup to edit messages, you can <b style='color:#00bc00;'>double-tap a message to quickly edit it</b> within the chat feed.`, type: "text", height:"fit-content", defaultValue: originalMessage.message, focus:true},
      instruction: {hidden:!!!originalMessage.instruction, label: "instruction:", type: "text", minHeight:"2rem", defaultValue: originalMessage.instruction || ""},
      hiddenFrom: {hidden:true, label: "hidden from:", type: "select", options:[{value:"user"}, {value:"ai"}, {content:"both", value:"user,ai"}, {content:"neither", value:""}], defaultValue: originalMessage.hiddenFrom.join(",")},
      insertMessage: {hidden:true, html: insertNewMessageEl, type: "none"},
    });

    const result = await prompt2(promptOpts, {submitButtonText:"save"});
    if(!result) return;

    let noChangesMade = true;
    for(let key of Object.keys(result)) {
      if(promptOpts[key].type === "none" || promptOpts[key].type === "buttons") continue;

      if(result[key] !== promptOpts[key].defaultValue) {
        noChangesMade = false;
        break;
      }
    }
    if(noChangesMade) return;

    result.hiddenFrom = result.hiddenFrom.split(",").filter(x => x);
    if(!result.instruction || !result.instruction.trim()) result.instruction = null;

    await db.messages.update(messageId, result);

    let newMessage = await db.messages.get(messageId);

    let currentMessageEl = $.messageFeed.querySelector(`.message[data-id='${messageId}']`);
    if(currentMessageEl && messageEl !== currentMessageEl) messageEl = currentMessageEl; // since the feed may have since re-rendered - e.g. due ot character edit.

    let shouldScrollDown = messageFeedIsNearBottom();
    await addMessageToFeed(newMessage, {inPlaceOf:messageEl});
    if(shouldScrollDown) $.messageFeed.scrollTop = $.messageFeed.scrollHeight;

    await triggerMessageActionCustomCodeEvent({threadId, eventData:{messageId}, eventName:"MessageEdited"});
  }

  window.currentlyQuickEditingAMessage = false;
  async function messageQuickEditButtonClickHandler(e) {
    e.preventDefault();
    e.stopPropagation();
    let messageTextEl = this;
    let messageEl = this.closest('.message');
    if(messageEl.dataset.canDelete === "false") return;
    const messageId = parseInt(messageEl.dataset.id);
    const originalMessage = await db.messages.get(messageId);
    let threadId = originalMessage.threadId;
    const thread = await db.threads.get(threadId);

    let originalMessageTextElCssText = messageTextEl.style.cssText;

    let editResolver;

    messageTextEl.style.paddingBottom = "1.5rem"; // to make room for the continue button under the textarea
    messageTextEl.style.minHeight = "7rem";

    let textareaWrapper = document.createElement("div");
    textareaWrapper.style.cssText = "position:absolute; top:0; bottom:1.5rem; left:0; right:0;";

    let textarea = document.createElement("textarea");
    textarea.style.cssText = "width:100%; height:100%; outline:none;";
    textarea.value = originalMessage.message;

    let bottomButtonsEl = messageEl.querySelector(".bottomButtons");
    if(bottomButtonsEl) bottomButtonsEl.hidden = true;

    textareaWrapper.append(textarea);
    messageTextEl.append(textareaWrapper);

    let continueButtonClicked = false;
    let continueBtn = document.createElement("button");
    continueBtn.style.cssText = "position: absolute; bottom: 0; right: 0; z-index: 110;";
    continueBtn.innerHTML = `▶️ auto-complete${window.innerWidth > 500 && !localStorage.knowsAboutTabMessageEditAutoCompletion ? " (tab)" : ""}`;
    messageTextEl.append(continueBtn);

    if(messageTextEl.closest(".message") === [...$.messageFeed.querySelectorAll(".message")].at(-1)) {
      $.messageFeed.scrollTop = $.messageFeed.scrollHeight;
    }

    textarea.focus();
    window.currentlyQuickEditingAMessage = true;

    continueBtn.addEventListener("click", function() {
      continueButtonClicked = true;
      editResolver(textarea.value);
    });
    textarea.onchange = async function() {
      await new Promise(r => setTimeout(r, 300)); // no idea why but without this massive delay the continueBtn handler doesn't get a change to fire if it was what causes this onchange event to fire (due to the textarea losing focus). small delay (e.g. 10ms) doesn't work
      editResolver(textarea.value);
    };
    textarea.addEventListener("keydown", function(e) {
      if(e.key == "Tab" && textarea.value.slice(textarea.selectionStart).trim() === "") {
        e.preventDefault();
        continueBtn.click();
        messageInput.focus();
        localStorage.knowsAboutTabMessageEditAutoCompletion = "1";
      }
    });
    function clickAnywhereHandler(e) {
      console.log(e);
      if(e.target !== textarea && e.target !== continueBtn) editResolver(textarea.value);
    }
    window.addEventListener("mousedown", clickAnywhereHandler); // mousedown rather than click else click-and-drag to highlight that ends outside of the textarea will trigger it
    let newMessageContent = await new Promise(resolve => {
      editResolver = resolve;
    });
    window.removeEventListener("mousedown", clickAnywhereHandler);

    window.currentlyQuickEditingAMessage = false;
    textareaWrapper.remove();
    continueBtn.remove();
    if(bottomButtonsEl) bottomButtonsEl.hidden = false;
    messageTextEl.style.cssText = originalMessageTextElCssText;

    if(newMessageContent === originalMessage.message && !continueButtonClicked) {
      return;
    }

    await db.messages.update(messageId, {message:newMessageContent});

    let newMessage = await db.messages.get(messageId);

    let shouldScrollDown = messageFeedIsNearBottom();
    let newMessageEl = await addMessageToFeed(newMessage, {inPlaceOf:messageEl});
    if(shouldScrollDown) $.messageFeed.scrollTop = $.messageFeed.scrollHeight;

    if(continueButtonClicked) {
      // NOTE: we don't call triggerMessageActionCustomCodeEvent in this case because regenerateMessage does that at the end - and triggerMessageActionCustomCodeEvent actually triggers a bot response, which would run before the message has been "regenerated" (i.e. 'continued')
      await regenerateMessage(newMessageEl, {
        startMessageWith: newMessage.message.trimEnd(),
      });
    } else {
      await triggerMessageActionCustomCodeEvent({threadId, eventData:{messageId}, eventName:"MessageEdited"});
    }
  }


  async function messageDeleteButtonClickHandler(e) {
    let messageEl = this.closest(".message");
    if(messageEl.dataset.canDelete === "false") return; // it doesn't exist (just a "typing indicator" place holder) - deletion during that time is handled within the doBotReplyIfNeeded function
    let threadId = activeThreadId;
    e.preventDefault();
    e.stopPropagation();
    const messageId = parseInt(messageEl.dataset.id);

    let prevMessageEl = messageEl.previousElementSibling;
    while(prevMessageEl && !prevMessageEl.classList.contains("message")) prevMessageEl = prevMessageEl.previousElementSibling;

    let messageObj = await db.messages.get(messageId);

    // remove any exsiting undo buttons
    for(let undoButton of $.messageFeed.querySelectorAll(".undoMessageDeleteButton")) {
      undoButton.remove();
    }

    let undoBtn = document.createElement("div");
    undoBtn.innerHTML = `<div class="undoMessageDeleteButton" style="text-align:center;"><button>undo deletion</button></div>`;
    undoBtn.querySelector("button").addEventListener("click", async function() {
      // add message back to db.
      // NOTE: the message will no longer be referenced in messageIdsUsed of other messages (due to safelyDeleteMessagesByIds tidying up those references), but that's not a big deal. Can improve this later if needed - TODO
      await db.messages.add(messageObj);

      let opts = {};
      if(prevMessageEl) opts.insertAfter = prevMessageEl;
      await addMessageToFeed(messageObj, opts);

      undoBtn.remove();

      await updateInlineReminderMessage();
      await updateThreadScene();
    });

    await safelyDeleteMessagesByIds([messageId]);
    messageEl.replaceWith(undoBtn);
    if(!$.messageFeed.querySelector(".message")) {
      showEl($.noMessagesNotice);
    }
    await updateInlineReminderMessage();
    await updateThreadScene();
    await triggerMessageActionCustomCodeEvent({threadId, eventData:{messageId}, eventName:"MessageDeleted", triggerBotReply:false});
  }

  const defaultUserName = "Anon";

  window.getUserCharacterObj = async function() {
    // set defaults:
    let characterObj = {
      id: -1,
      name: (await db.misc.get("userName"))?.value || defaultUserName,
      // avatarUrl: (await db.misc.get("userAvatarUrl"))?.value || "",
      roleInstruction: (await db.misc.get("userRoleInstruction"))?.value || "",
      reminderMessage: "",
      initialMessage: [],
      customCode: "",
      fitMessagesInContextMethod: "dropOld",
      avatar: {
        url: (await db.misc.get("userAvatarUrl"))?.value || "",
        // we leave `shape` and `size` as thread default
      },
      streamingResponse: true,
      maxTokensPerMessage: null,
    };

    // EDIT: we no longer apply overrides here. This function now returns the "true" userCharacter, and we apply overrides manually - via e.g. messageObjToCharacterName and messageObjToCharacterAvatar
    // // override with character and then thread-specific settings:
    // let thread = await db.threads.get(threadId);
    // let threadCharacter = await db.characters.get(thread.characterId);
    // applyObjectOverrides({object:characterObj, overrides:threadCharacter.userCharacter});
    // applyObjectOverrides({object:characterObj, overrides:thread.userCharacter});

    // console.warn("called getUserCharacterObj - make sure you're 'caching' these calls where possible");

    return characterObj;
  }



  async function getSystemCharacterObj() {
    let characterObj = {
      id: -2,
      name: defaultSystemName,
      avatar: {
        url: null,
        shape: null, // null => default to character setting
        size: null,
      },
      streamingResponse: true,
      maxTokensPerMessage: null,
    };

    // EDIT: we no longer apply overrides here. This function now returns the "true" systemCharacter, and we apply overrides manually - via e.g. messageObjToCharacterName and messageObjToCharacterAvatar
    // override with character and then thread-specific settings:
    // let thread = await db.threads.get(threadId);
    // applyObjectOverrides({object:characterObj, overrides:thread.systemCharacter});

    return characterObj;
  }

  {
    let debounceTimeout = null;
    $.messageInput.addEventListener("input", async function(e) {
      // debounce, and after 500ms, save current $.messageInput.value to thread.unsentMessageText
      if(debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(async function() {
        let threadId = activeThreadId;
        await db.threads.update(threadId, {unsentMessageText: $.messageInput.value});
      }, 500);

      if(window.clearInputAfterNextSendButtonClickIfMaintainedPrefix && !$.messageInput.value.startsWith(window.clearInputAfterNextSendButtonClickIfMaintainedPrefix)) window.clearInputAfterNextSendButtonClickIfMaintainedPrefix = null;
      if($.messageInput.value.trim() === "") window.clearInputAfterNextSendButtonClickIfMaintainedPrefix = null;

      window.mostRecentTappedReplacementShortcutButtonText = null;
    });
  }


