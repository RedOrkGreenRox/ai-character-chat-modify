
<h1 id="hiddenH1Element" style="display:none;">AI Character Chat</h1>

<div id="topNotification" style="position:fixed; top:1rem; left:0; right:0; z-index:1000; display:none;">
  <div id="topNotificationContent" style="margin:0 auto; max-width:350px; background:var(--notification-bg-color); color:white; text-align: center; padding: 0.5rem; border-radius: var(--border-radius);"></div>
</div>

<div id="main" style="visibility:hidden; display:flex; position:fixed; top:0; right:0; left:0; bottom:0;">
  <div id="leftColumn" style="display:flex; flex-direction:column; width:270px; min-width:270px; padding:0.5rem; ">
    <div style="display:flex;">
      <button id="newThreadButton" style="width:100%; cursor:pointer; min-height:2rem;">💬 new chat / character</button>
      <button id="closeLeftColumnButton" style="cursor:pointer;min-height:2rem;margin-left: 0.5rem;min-width: 2rem;">☰</button>
    </div>
    <div id="threadSearchCtn" style="display:flex; width:100%; margin-top:0.5rem;">
      <input id="threadSearchInput" title="Surround your search in slashes to do a wildcard search, like this: /mouse.+forest/ This will find any chats with messages that have the text 'mouse' and then some point later 'forest'. The '.+' part is the wildcard that represents any text. For more complex searches, you can use any valid 'Regular Expression'." style="height: 100%; flex-grow: 1; min-width: 0; padding-left: 0.5rem;" type="text" placeholder="search threads...">
      <button id="threadSearchButton" style="cursor:pointer;min-height: 2rem;min-width: 2rem;margin-left: 0.5rem;">🔎</button>
    </div>
    <!-- <div id="threadFolderNavigationBar" style="display:flex; width:100%; margin-top:0.5rem;">
      <button id="threadFolderBackButton" style="cursor:pointer;min-height: 2rem;min-width: 2rem;margin-left: 0.5rem;">🔙</button>
    </div> -->
    <!-- <div id="chatThreadFolders" data-current-folder-path=""></div> -->
    <div id="chatThreads" data-current-folder-path=""></div>
    <div id="appOptions">
      <div style="display:flex;">
        <button id="settingsButton" class="appOptionButton">⚙️ settings</button>
        <button id="tipsButton" class="appOptionButton" style="margin-left: 0.5rem; max-width:max-content; padding:0 0.5rem;" onclick="window.open('https://perchance.org/ai-character-chat-docs#tips')">❓ tips</button>
        <button class="appOptionButton" style="margin-left: 0.5rem; max-width:max-content; padding:0 0.5rem;">[fullscreenButtonPlugin("⇱", "⇲", "background:transparent; border:none; color:inherit; width:min-content; height:100%;")]</button> <!--<svg xmlns="http://www.w3.org/2000/svg" height="16" width="14" viewBox="0 0 448 512"><path d="M32 32C14.3 32 0 46.3 0 64v96c0 17.7 14.3 32 32 32s32-14.3 32-32V96h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H32zM64 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H64V352zM320 32c-17.7 0-32 14.3-32 32s14.3 32 32 32h64v64c0 17.7 14.3 32 32 32s32-14.3 32-32V64c0-17.7-14.3-32-32-32H320zM448 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H320c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V352z"/></svg></button>-->
      </div>
      <div style="display: flex;">
        <button id="clearDataButton" class="appOptionButton" style="width: 4rem;">🗑️</button>
        <button id="exportDataButton" class="appOptionButton" style="margin-left: 0.5rem; margin-right: 0.5rem;">💾 export</button>
        <button class="appOptionButton" style="position:relative;">📁 import<input id="importDataFileInput" style="position:absolute; top:0; left:0; right:0; bottom:0; opacity:0; cursor:pointer;" type="file"></button>
      </div>
      <!-- PERCHANCE EDIT: -->
      <!--<div style="height:0px; position:relative;">
        <div id="feedbackModalCtn" style="position:absolute; bottom:-0.5rem; width:100.5%;"></div>
      </div>
      <button id="toggleFeedbackButton" onclick="toggleFeedbackModal()" class="appOptionButton">💬 feedback / chat</button>
      <script>
        function toggleFeedbackModal() {
          if(!feedbackModalCtn.innerHTML) {
            let html = root.commentsPlugin({width:"100%", height:"min(600px,80vh)"});
            feedbackModalCtn.innerHTML = html;
            toggleFeedbackButton.innerHTML = "❌ hide feedback / chat";
          } else {
            feedbackModalCtn.innerHTML = "";
            toggleFeedbackButton.innerHTML = "💬 feedback / chat";
          }
        }
      </script>-->
      <div style="display:flex;">
        <button id="showFeedbackButton" onclick="showFeedbackModal()" class="appOptionButton" style="max-width: max-content; padding: 0 0.5rem;">📝 feedback</button>
        <button id="showCommentsButton" onclick="showCommentsModal()" class="appOptionButton" style="margin-left:0.5rem;">🙋 comments</button>
      </div>
      <script>
        function showFeedbackModal() {
          const isLikelyMobile = window.innerWidth < 500;
          let feedbackWindow = createFloatingWindow({
            header:"Feedback",
            initialWidth: Math.min(700, window.innerWidth-20),
            initialHeight: isLikelyMobile ? `min(${window.innerHeight-20}px, calc(100vh - 20px))` : Math.min(300, window.innerHeight-20),
            // initialHeight: Math.min(300, window.innerHeight-20),
            top: 10,
          });

          // Change the below variable to `false` to disable debug info (e.g. browser version, device type, localStorage size limits, etc.) with feedback submissions.
          // See   perchance.org/bug-report-plugin   for more info.
          let enableBrowserDebugInfoWithFeedback = true;

          if(enableBrowserDebugInfoWithFeedback) bugReport.initAutoErrorCapture(); // <-- must be initialized at page load

          let options = {channel:"feedback", width:"100%", height:"100%", hideComments: (location.hash==="#showfeedback" ? false : true), commentPlaceholderText:"Feel free to make suggestions or provide feedback here. Don't share personal info - feedback data is public. If you're running into errors/issues, please provide as much detail as possible, including the device, browser, etc. that you're using, and the error messages you saw (if any), character share link (if possible), and so on. I recommend using 𝗖𝗵𝗿𝗼𝗺𝗲 𝗼𝗿 𝗙𝗶𝗿𝗲𝗳𝗼𝘅.\n\nNote: Your chat data is stored 𝗰𝗼𝗺𝗽𝗹𝗲𝘁𝗲𝗹𝘆 privately in your browser storage - 𝗻𝗼𝘁 on a server. So I'm unable to debug issues related to your specific chats unless you provide enough explanation and/or links to exports/characters/etc.\n\n", hideFullscreenButton:true, hideSettingsButton:true}
          async function beforeSubmit({inputText}) {
            if(!inputText.trim()) return null;

            let url = await bugReport.createTemporaryDebugInfoUrl({ // this URL is not permanent - i.e. debug data is deleted after a few months. See   perchance.org/bug-report-plugin   for more info.
              customData: {
                // possible sources of lag/bugs:
                numCharacters: await db.characters.count(),
                numThreads: await db.threads.count(),
                numMessages: await db.messages.count(),
                timeSincePageLoad: Date.now()-window.pageLoadStartTime,
                lastWindowOnErrorMessage: window.lastWindowOnErrorMessage,
                storageEstimate: await navigator.storage.estimate(),
              },
              // Debug info is encrypted with this public key to increase user privacy. IF you're developing your own version of this generator, you can generate your own public/private key pairs here:  https://perchance.org/public-key-encryption-tool
              publicKey: "PUBLIC_1_VhWWC5YZSOvjJcKEPLEA6FfirbpAaSqNFkEFyuEk78CUdWGJyfSUt4HXL4fZZLZSCV8GVaSeZSsyVUiXLwd8PuFFcYMDLoig04JpvQAgvGGYZPJtDQ4aDdpTIUZSLBSkZZVFiCdqgnFk8xQWKq0dVkipUCQiZSO7beiEfEQ71PJ6AstsiolKwUBH8Cy28DmETkopYDe9y4QlohxXholANkpUdNLGgfctNAdebGw7O1CPABAhWFJRYlVpa4tEn2JUgcBywPUFQ7tEV1eRVqm7gJFMC0ItxvuwUYokiZSQpAbDN0WptNCWZP5CiG5owi0iqV0ncQ3sM1MgsKRadF3EqiHni0ceY9OoQ0wzhZSQ2tL6dCeZSxGW9Wt0AWirPlQvNzaqeJBZPVfe0R7SaNKdWm9OVFRKkJtIZS5WRlfDUUyTmdHGuFkBoZZalqrugNG62WSffMczMofsiaqeVxakUpW5XyFhRsPUATIdws7KeqgX8MZP6zAtZZ8BM6fkkg6ywT4oepCGAqwYY8iWJ1lGbdkBXrqN7y7iXQDRlAEFVmAgzaMK41oJQgcuZSB2MZPHZPGCHkeINZPVLwGpIDsyp8zuXDxA0w0YzmnSEWPRdIOVgGZPaGa4W5TSy01co9Oip2YLobLKYCrXt5Dca44UB0GowQMlqWZP2xVS7MS2ngZPyGmH1fpzNakwM5wEnJsTZPFsql6LN9aXPYhqrpYtw7bmEVTUqpDYVdOFUbepspmQJdgRFBDUb0UwZSZShB4kHCyZZigcZZ4Ae5HBIFNcYcLid6KeLe8whUyyVE7d8ukG8Y2Ed4FsYRxO8HbpzJiS6WBCyu9uPYga6OVSGB8M6SUuKaZZhlxNmpwrZZZShXF5ZZTxVOJvMouWDm9yvUBu0ygpZSfyAN5locFrSwtZShAD7eT7EYPcAEe8CQUmgF8ddUTTzhWzbmk5eBjDBHHZS1w2NTGRoVnGsfCwZPrCzLLCpFASyZZ4mAcWoGBpJXuDKMftslWRGCvZZKQFCCZZVYtvC8eJIWlZP97dus9GfKZSXOEKcZZFeeH3ZPkUbipiaPMEXZSIuzjUkeZPmM9uhxM1Cap3tf5iXBG3QU0Aiw2sK8NXYkrwiyQNxsGIA02ZSJ2K7hZZsJFVjmWQB3JjSrmHF0PFpWYXRRx4puQ7m2hlqSNPxEkGpaADR6d80Ahpartj9UZZ1DGxzKMex7sKZSCgehOfi64rcdTfDIEZPxMoJhXhlZZ5YFJcLXQjeHOwFQkUXTh2BxQf48O7VpagJlwEGBlYBkghVLShBElVHEU2p8RUcLQbX4YQNlBPzZZO8TRnBvuK8jKEIY4xsWadBUEPOZPWAJStNLDrOiRtedt3vNpUQKh4ZZOqNSXdAECgVtmTVBVuBAri0uEyjer39ZZH6WUXYYo5CKG9RfQrXhhfqeVyUIUK8XcUQjMpeotKQFGdyhsrD4aOFsEmqzrFf3BnWFYruIsY5Kx9ADpyZZdWFTzyMzyhpWaRJviBjx1IZSQFSf92A93bUU8Ka83hZZIE1WyKGwkgAlKD2qcNZZFhVkAY7DNqHCAIg6ZZARFgzQ5ecr1iCQ4mUY6EncnNrPRbn5m0jeXYX1pjIcSoTPNn69P7E8ZP8wk4RXw84ZE_PUBLIC_END",
            });
            return `${inputText}\n\nBrowser Debug Info:\n${url}`;
          }
          if(enableBrowserDebugInfoWithFeedback) options.beforeSubmit = beforeSubmit;

          com = root.commentsPlugin(options);
          feedbackWindow.bodyEl.innerHTML = com;
          feedbackWindow.bodyEl.style.overflow = "hidden";
        }

        function showCommentsModal() {
          let isLikelyMobile = window.innerWidth < 500;
          let feedbackWindow = createFloatingWindow({
            header:"Comments",
            initialWidth: Math.min(700, window.innerWidth-20),
            initialHeight: isLikelyMobile ? `min(${window.innerHeight-20}px, calc(100vh - 20px))` : Math.min(300, window.innerHeight-20),
            // initialHeight: Math.min(500, window.innerHeight-100),
            top: 10,
          });
          feedbackWindow.bodyEl.innerHTML = "";
          feedbackWindow.bodyEl.append(tabbedCommentsPlugin({
            channels: root.commentChannels,
            defaultChannelOptions: root.defaultCommentOptions,
            allowBots: false,
            fillHeight: true,
          })); // root.commentsPlugin(root.commentsPluginOptions);
          feedbackWindow.bodyEl.style.overflow = "hidden";
        }
      </script>
    </div>
  </div>

  <div id="middleColumn" style="flex-grow:1; display:flex; flex-direction:column; position:relative; overflow:hidden; min-width:200px; z-index:1;">
    <div id="middleColumnShadowOverlay" style="display:none; position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5); z-index:20;"></div>
    <div id="characterSelection" class="middleColumnScreen" style="flex-grow:1; display:none; overflow: auto;">
      <button id="characterSelectionOpenLeftColumnButton" class="openLeftColumnButton" style="background: var(--button-bg);border-radius: var(--border-radius);border: 1px solid var(--button-border-color);padding: 0.25rem;width: 2rem;min-height: 2rem;margin-right: 0.5rem;position: absolute;top: 0.5rem;left: 0.5rem;">☰</button>

      <div id="createCharacterAreaCtn" style="display:flex; flex-direction:column; margin-top:1rem; justify-content:center; align-items:center; gap:0.5rem;">
        <div style="width:500px; max-width:100%; background:var(--box-color); padding:0.4rem; border:1px solid var(--border-color); border-radius:3px;">
          <div style="opacity:0.7; font-size:80%; margin-bottom:0.125rem;">🌐 Generate a character from <b>any</b> web page:</div>
          <div style="margin:0 auto; display:flex; gap:0.25rem;">
            <input id="generateCharacterFromUrlInputEl" oninput="charFromUrlExtraInstrCtn.hidden=!this.value.trim()" placeholder="https://shrek.fandom.com/wiki/Shrek_(character)" style="flex-grow:1; min-width:8rem;"><button id="generateCharacterFromUrlBtn" style="padding:0.25rem 0.5rem; min-width:max-content;" onclick="generateCharacterFromUrl()">✨ generate</button>
          </div>
          <div hidden id="charFromUrlExtraInstrCtn" style="margin:0 auto;display:flex;gap:0.25rem;margin-top: 0.25rem;">
            <input id="generateCharacterFromUrlExtraInstructionsInputEl" placeholder="Optional instructions - e.g. 'AU where he is a Hogwarts professor'" style="flex-grow:1; min-width:8rem;">
            <script>if(window.innerWidth < 500) generateCharacterFromUrlExtraInstructionsInputEl.placeholder=`(Optional) e.g. 'AU where he is a Hogwarts professor'`;</script>
          </div>
        </div>
        <button id="newCharacterButton" style="padding:0.25rem; font-size:110%; display:block; max-height:min-content;">🛠️ create new character</button>
      </div>
      <style>
        @media screen and (max-width: 630px) {
          #createCharacterAreaCtn {
            padding-left: 3rem;
          }
        }
      </style>

      <h2 id="yourCharactersTitleEl" style="text-align:center; margin-bottom: 0.25rem; margin-top: 1.5rem; font-size: 1.3rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
        <span>Your Characters</span>
        <button onclick="yourCharactersTitleEl.hidden=true; characterSearchCtn.hidden=false; characterSearchInputEl.focus()">🔎</button>
      </h2>
      <div id="characterSearchCtn" hidden="" style="margin-top: 1.75rem; display:flex; align-items:center; justify-content:center; gap: 0.25rem;">
        <input id="characterSearchInputEl" placeholder="search your characters..." onkeydown="if(event.which===13) { characterSearchBtn.click() }">
        <button id="characterSearchBtn" onclick="filterAndRenderCharacterList(characterSearchInputEl.value)">🔎</button>
      </div>
      <div style="margin-bottom: 0.5rem;display: flex;justify-content: center;">
        <!-- <button id="newFolderCharacterButton" style="padding: 0.25rem; margin-left: 0.5rem;">📁 new folder</button> -->
      </div>
      <div id="characterFoldersList" data-current-folder-path=""></div>
      <div id="characterList"></div>
      <button id="loadAllCharactersBtn" onclick="this.disabled=true; window.renderCharacterList({characterCountLimit:999999999}).then(_ => this.disabled=false)" style="margin:0 auto; display:block; margin-top:1rem; padding:0.5rem 0.75rem; font-size:1rem;">show all characters</button>
      <div hidden id="tapACharacterHintEl" style="text-align: center; opacity: 0.7; font-size: 80%; margin-top: 1rem;">(<b>tap a character</b> to start a new chat with them)</div>
      <script>if(!localStorage.hasStartedThreadViaCharacterTap) tapACharacterHintEl.hidden=false;</script>

      <div><h2 style="text-align:center; margin-bottom: 0.75rem; margin-top: 4rem; font-size: 1.3rem;">Example Characters</h2></div>
      <div id="starterCharacterList"></div>

      <br><br>
      <p id="storageNoticeEl" style="text-align:left; font-size:70%; opacity:0.8; padding:0.4rem; border:1px solid var(--border-color); border-radius:3px; max-width:500px; margin:0 auto; background:var(--box-color);"></p>

      <!--
      <div id="introVideoCtn" style="text-align:center; padding:0.4rem; border:1px solid var(--border-color); border-radius:3px; max-width:max-content; margin:0 auto; background:var(--box-color); margin-top:2rem;">
        <div style="margin-bottom:0.25rem; font-size:70%; opacity:0.7; text-align:center;">I found this helpful intro video by <a href="https://www.youtube.com/watch?v=V8R1P6jM1es" target="_blank">CrossLax on YouTube</a>:</div>
        <div id="introVideoIframeWrapperEl"></div>
        <div style="text-align:center;"><button onclick="localStorage.seenIntroVideo='1'; introVideoCtn.remove();">hide</button></div>
      </div>
      <script>
        if(localStorage.seenIntroVideo) {
          introVideoCtn.remove();
        } else {
          introVideoIframeWrapperEl.innerHTML = `<iframe style="max-width:100%; aspect-ratio:336/189;" width="336" height="189" src="https://www.youtube-nocookie.com/embed/V8R1P6jM1es?si=yu1HV7DbKKNlHKLI&amp;hd=1&amp;start=158" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
        }
      </script>
      -->

      <p style="text-align: center;font-size: 80%;opacity: 0.8; padding:0 0.5rem; margin-bottom:0.25rem; margin-top:1rem;">This chat app thing is powered by the <a href="/ai-text-plugin" target="_blank">ai-text-plugin</a> and the <a href="/text-to-image-plugin" target="_blank">text-to-image-plugin</a>.</p>
      <p style="text-align: center;font-size: 80%;opacity: 0.8; padding:0 0.5rem; margin-bottom:0.25rem; margin-top:0;">For a simpler interface, try <a href="https://perchance.org/ai-chat" target="_blank">/ai-chat</a> or <a href="https://perchance.org/ai-rpg" style="font-weight:bold; color:#2bbb00;" target="_blank">/ai-rpg</a>.</p>
      <p style="text-align: center;font-size: 80%;opacity: 0.8; padding:0 0.5rem; margin-bottom:0.25rem; margin-top:0;">For a more complex interface, copy the <a href="https://perchance.org/ai-character-chat-docs#custom-code" target="_blank">docs</a> to an AI and tell it to write some custom code for you.</p>
      <p style="text-align: center;font-size: 60%;opacity: 0.4; padding:0 0.5rem; margin-bottom:0.25rem; margin-top:1rem;">Special thanks to the <a href="https://en.wikipedia.org/wiki/Ozone_layer", target="_blank">ozone layer</a> for sponsoring development, whose support does not influence editorial decisions.</p>
      <br><br>
    </div>
    <div id="chatInterface" class="middleColumnScreen" style="display:flex; flex-grow:1; flex-direction:column; height:100%; position:relative;">
      <div id="customCodeChatInterfaceWrapper" style="display:none;"></div>
      <div id="builtInChatInterfaceWrapper">
        <div id="musicPlayerCtn" hidden style="display:flex; position:fixed; top:0; right:0; width:max-content; gap:0.5rem; padding:0.25rem; z-index:10;">
          <audio id="musicPlayer" controls hidden style="min-width:40vw;"></audio>
          <button style="height: min-content;" onclick="musicPlayer.hidden=!musicPlayer.hidden;">🔊</button>
        </div>
        <div id="messageFeedHeaderBar" style="pointer-events:none; opacity:0; display: flex; position:absolute;height: 2rem;right: 0;left: 0;margin: 0.5rem; z-index:9999999999;"> <!-- HIGH Z INDEX to be above thread loading modal in case of infinite load due to customCode error or whatever - necessary to 'escape' thread on mobile -->
          <button id="messageFeedOpenLeftColumnButton" class="openLeftColumnButton" style="display:none; pointer-events:auto; background: var(--button-bg);border-radius: var(--border-radius);border: 1px solid var(--button-border-color);padding: 0.25rem; min-width: 2rem; height: 100%; margin-right:0.5rem;">☰</button>
          <div style="opacity:0; pointer-events:none; background: var(--button-bg); display:flex; height: 100%; border-radius: var(--border-radius);border: 1px solid var(--button-border-color);padding: 0.25rem;">
            <div style="display: flex;align-items: center;font-size:var(--button-font-size);margin-right: 0.25rem;">model:</div>
            <select id="threadModelSelector" style="max-width:130px;"></select>
          </div>
          <!-- <div id="threadSettingsButton" style="margin-left:0.5rem; cursor:pointer;   background: var(--button-bg); display:flex; height: 100%; border-radius: var(--border-radius);border: 1px solid var(--button-border-color);padding: 0.25rem;">
            <div style="display: flex;align-items: center;justify-content:center;font-size:var(--button-font-size);min-width:1.5rem;">⚙️</div>
          </div> -->
        </div>
        <div id="chatBackgroundCtn" style="pointer-events:none; position:absolute; top:0; left:0; right:0; bottom:0; z-index:-10;"></div>
        <div id="noMessagesNotice" style="display:none; text-align:center; padding:1rem; margin-top:1rem;">Type a message below to begin the chat.</div>
        <div id="messageFeed" style="flex-grow:1; overflow-y:auto;"></div>
        <div id="statusNotifier" style="text-align: center; display: none; height: 0; position: relative; top:0; display: flex; align-items: center; justify-content: center; z-index:10;"></div>
        <div id="inputWrapper" style="display:flex; padding:0.5rem; padding-left:0; padding-right:0; flex-direction:column;">
          <!-- <div style="display:flex;margin-bottom: 0.25rem;">
            <button id="editReminderMessageButton" style="font-size:0.7rem;">✏️ reminder msg</button>
          </div> -->
          <div id="userMessagesSentHistoryCtn"></div>
          <div id="shortcutButtonsCtn"></div>
          <div style="display:flex;">
            <textarea id="messageInput" placeholder="Type your reply here..." style="flex-grow:1; min-height:4.5rem; font-size:100%; max-height:60vh; resize:none;" title="commands:&#10;/ai - prompt a reply from ai&#10;/ai &lt;instruction&gt; - prompt reply with instruction&#10;/ai @CharName#123 &lt;instruction&gt; - prompt reply with another character (ID=123)&#10;/user &lt;instruction&gt; - generate a user reply&#10;/sys &lt;instruction&gt; - prompt system reply with instruction&#10;/sum - open summary editor&#10;/mem - open memory editor&#10;/lore - open lore editor&#10;/lore &lt;text&gt; - add a lore entry&#10;/name &lt;name&gt; - set your name for this thread&#10;/avatar &lt;url&gt; - set your avatar image for this thread&#10;/import - add chat messages in bulk&#10;&#10;• You can add '/ai &lt;instruction&gt;' as the final line in your normal messages to instruct AI for its reply.&#10;• Double-click this text box to show input history"></textarea>
            <div style="display:flex; flex-direction:column; margin-left:0.25rem;">
              <button id="sendButton" style="min-width:80px; flex-grow:1;">send ➡️</button>
              <div style="position:relative;">
                <div id="threadOptionsPopup" data-original-display-value="flex" style="position:absolute; display:none; padding:0.5rem; background:var(--background); border-radius:var(--border-radius); width:max-content; right:0; bottom:0; border:1px solid var(--border-color); flex-direction: column; gap: 0.25rem;">
<!--                   <button id="addShortcutButton" style="text-align:left;">✨ add shortcut</button> -->
                  <button onclick="toggleAvatarPicDisplay()" style="text-align:left;">[combineEmojis("🚫", "👤")] toggle pics</button>
                  <button id="changeThreadUserNameButton" style="text-align:left;">🏷️ change user name</button>
                  <button id="changeThreadUserAvatarUrlButton" style="text-align:left;">👤 change user pic</button>
                  <button id="toggleAutoReplyToUserButton" style="text-align:left;">🗣️ toggle autoreply</button>
                  <button id="threadLevelResponseLengthButton" style="text-align:left;">📏 response length…</button>
                  <button id="addCharacterOptionsButton" style="text-align:left;">➕ add character</button>
                  <button id="editCharacterOptionsButton" style="text-align:left;">✏️ edit character</button>
                  <button id="replyAsOptionsButton" style="text-align:left;">💬 reply as…</button>
                  <!-- <button id="replyLoopButton">➰ reply loop</button> -->
                </div>
                <div id="threadReplyAsCharacterListPopup" data-original-display-value="flex" style="position:absolute; display:none; padding:0.5rem; background:var(--background); border-radius:var(--border-radius); width:max-content; right:0; bottom:0; border:1px solid var(--border-color); flex-direction: column; gap: 0.25rem;"></div>
              </div>
              <button id="threadOptionsButton" style="min-width:80px; max-height:1.5rem; margin-top:0.25rem; display:flex; align-items:center; justify-content:center;">⚒️ options</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div id="rightColumn" style="width:min-content;" data-visible="no">
    <div id="customCodeColumn" style="width:min-content; display:none; height:100%;">
      <div id="customCodeIframeHorizontalResizeBar"></div>
      <div id="customCodeIframeCtn" style="height:100%; flex-grow:1;"></div>
    </div>
  </div>
</div>

<button id="toggleRightColumnButton" style="position:fixed; top:0.5rem; right:0.5rem; min-height:2rem; min-width:2rem; display:none; align-items:center; justify-content:center; z-index:500;">⚛️</button>

