  window.generateCharacterFromUrl = async function() {
    let url = generateCharacterFromUrlInputEl.value.trim();
    if(!url) return;
    let extraInstructions = generateCharacterFromUrlExtraInstructionsInputEl.value.trim();

    let originalUrl = url;

    let originalButtonHtml = generateCharacterFromUrlBtn.innerHTML;
    let originalButtonOnClick = generateCharacterFromUrlBtn.onclick ? generateCharacterFromUrlBtn.onclick.bind(generateCharacterFromUrlBtn) : generateCharacterFromUrlBtn.onclick;
    let originalButtonCssText = generateCharacterFromUrlBtn.style.cssText;

    if(existingGenerateCharacterFromUrlNotifyCtn) existingGenerateCharacterFromUrlNotifyCtn.remove();
    let notifyCtn = document.createElement("div");
    existingGenerateCharacterFromUrlNotifyCtn = notifyCtn;

    function tidyUp() {
      generateCharacterFromUrlBtn.innerHTML = originalButtonHtml;
      generateCharacterFromUrlBtn.onclick = originalButtonOnClick;
      generateCharacterFromUrlBtn.style.cssText = originalButtonCssText;
      generateCharacterFromUrlBtn.disabled = false;
      generateCharacterFromUrlBtn.style.opacity = 1;
      notifyCtn.remove();
    }

    try {
      generateCharacterFromUrlBtn.innerHTML = `<span style="display:inline-block; animation:rotate 1.5s linear infinite;">⏳</span> generating... <span class="generatingCharacterProgressPercentage"></span>`;
      generateCharacterFromUrlBtn.disabled = true;
      generateCharacterFromUrlBtn.style.opacity = 0.7;

      notifyCtn.innerHTML = `<button disabled style="opacity:0.6;"><span style="display:inline-block; animation:rotate 1.5s linear infinite;">⏳</span> generating character...<span class="generatingCharacterProgressPercentage"></span></button>`;
      notifyCtn.style.cssText = `position:absolute; top:0.5rem; right:0.5rem; z-index:1000;`;
      document.body.append(notifyCtn);
      let notifBtn = notifyCtn.querySelector("button");

      localStorage.numCharactersGeneratedFromUrl = Number(localStorage.numCharactersGeneratedFromUrl || 0) + 1;
      if(Number(localStorage.numCharactersGeneratedFromUrl || 0) < 2) alert(`This will take about 60 seconds. It'll generate in the background, so you can do other stuff while you're waiting. This is a new feature, please give feedback if it doesn't work well for a specific URL 🙏`);

      if(/^https:\/\/aicharactercards\.com\//.test(url)) {
         let html = await root.superFetch(url, {signal:window.AbortSignal?.timeout(10000)}).then(r => r.text()).catch(e => false);
         let postId = html.match(/postid-([0-9]+)(\s|")/)?.[1];
         if(postId) url = `https://aicharactercards.com/?download_card_image=true&post_id=${postId}`;
      }
      if(/^https:\/\/char-archive\.evulid\.cc\/#\//.test(url)) {
        const urlObj = new URL(url);
        const [source, user, , character] = urlObj.hash.slice(2).split('/');
        url = `${urlObj.origin}/api/archive/v1/${source}/image/character/${user}/${character}?definition=true`;
      }
      if(/^https:\/\/character-tavern\.com\/character\//.test(url)) {
        url = url.replace("https://character-tavern.com/character/", "https://cards.character-tavern.com/").split("?")[0] + ".png?action=download";
      }
      if(/^https:\/\/cards\.character-tavern\.com\/cdn-cgi\/image\//.test(url)) {
        url = "https://cards.character-tavern.com/" + url.split("?")[0].split("/").slice(-2).join("/") + "?action=download";
      }
      if(/^https:\/\/cards\.character-tavern\.com\//.test(url)) {
        try {
          let blob = await root.superFetch(url).then(r => r.blob());
          if(await tryImportingExternalCharacterFileFormat(blob).catch(e => "fail") === "finished") {
            tidyUp();
            return;
          }
        } catch(e) { console.error(e); }
      }

      if(url.startsWith("https://www.characterhub.org/")) url = url.replace("https://www.characterhub.org/", "https://www.chub.ai/");
      if(/^https:\/\/(www\.|)chub\.ai\/characters\/.+/.test(url)) {
        try {
          let id = url.split("/").slice(4,6).join("/");
          let blob = await root.superFetch(`https://avatars.charhub.io/avatars/${id}/chara_card_v2.png?nocache=${Math.random()}`).then(r => r.blob());
          if(await tryImportingExternalCharacterFileFormat(blob).catch(e => "fail") === "finished") {
            tidyUp();
            return;
          }
        } catch(e) {
          console.warn(e);
        }
      }

      if(/^https:\/\/janitorai\.com/.test(url) || /^https:\/\/jannyai\.com/.test(url)) {
        try {
          let id = url.split("/").at(-1).split("?")[0];
          let text = await root.superFetch(`https://jannyai.com/characters/${id}`).then(r => r.text());
          let jsonText = text.match(/props="(\{&quot;imageUrl.+?)"/)[1].replace(/&quot;/g, `"`).replace(/&lt;/g, `<`).replace(/&gt;/g, `>`).replace(/&apos;/g, `'`).replace(/&#39;/g, `'`).replace(/&amp;/g, `&`);
          let json = JSON.parse(jsonText);
          let char = json.character[1];
          for(let key in char) {
            char[key] = char[key][1];
          }
          char.avatar = json.imageUrl[1];
          delete char.imageUrl;
          char.first_mes = char.firstMessage;
          delete char.firstMessage;
          char.example_dialogue = char.exampleDialogs;
          delete char.exampleDialogs;

          if(char.avatar) {
            char.avatar = await processAvatarImageUrl(char.avatar).catch(e => "")
          }

          let charJsonBlob = new Blob([JSON.stringify(char)], { type: "application/json" });
          if(await tryImportingExternalCharacterFileFormat(charJsonBlob).catch(e => "fail") === "finished") {
            tidyUp();
            return;
          }
        } catch(e) {
          console.error(e);
        }
      }

      if(/^https:\/\/www\.sakura\.fm/.test(url) || /^https:\/\/sakura\.fm/.test(url)) {
        try {
          let html = await root.superFetch(url).then(r => r.text());
          let jsonText = html.replace(/\\([^n])/g, "$1").match(/{"character":({".+?),"creatorImageUrl":/)?.[1]+"}";
          jsonText = jsonText.replaceAll(`"])<\/script><script>self.__next_f.push([1,"`, "");
          let json = JSON.parse(jsonText);
          let char = { name: json.name };
          if(json.imageUri) char.avatar = { url: await window.processAvatarImageUrl(json.imageUri, {noCrop:true}).catch(e => "") };
          if(json.firstMessage || json.scenario) {
            char.initialMessages = [];
            if(json.scenario) char.initialMessages.push({author:"system", name:"Narrator", content:json.scenario});
            if(json.firstMessage) char.initialMessages.push({author:"ai", content:json.firstMessage});
          }
          let roleInstruction = "";
          if(json.description) roleInstruction += `\n\n# {{char}} Description:\n${json.description}`;
          if(json.persona) roleInstruction += `\n\n# {{char}} Persona:\n${json.persona}`;
          if(json.exampleConversation && json.exampleConversation.filter(m => m.content).length > 0) {
            roleInstruction += `\n\n# {{char}} Roleplay Behavior Examples:\n${json.exampleConversation.map(m => `${m.role === "user" ? "{{user}}" : "{{char}}"}: ${m.content}`).join("\n")}`;
          }
          if(json.tags) roleInstruction += `\n\n# {{char}} Tags: ${json.tags.join(", ")}`;
          char.roleInstruction = roleInstruction.trim();

          if(json.instructions) char.reminderMessage = json.instructions.trim();
          if(json.backgroundImageUri) {
            let blob = await root.superFetch(json.backgroundImageUri).then(r => r.blob());
            // response has no content type, which is fine, but it's nice to not have data:application/octet-stream as the start of the dataURL, so:
            if(/(jpeg|jpg)$/.test(json.backgroundImageUri.split("?")[0])) blob = new Blob([blob], {type:"image/jpeg"});
            if(/(png)$/.test(json.backgroundImageUri.split("?")[0])) blob = new Blob([blob], {type:"image/png"});
            if(/(webp)$/.test(json.backgroundImageUri.split("?")[0])) blob = new Blob([blob], {type:"image/webp"});
            let backgroundImageDataUrl = await window.blobToDataUrl(blob);
            char.scene = {background:{url:backgroundImageDataUrl}};
          }

          char.messageWrapperStyle = "color:white; background:#202936; border:2px solid black; border-radius:6px; padding:0.25rem;";

          let result = await characterDetailsPrompt(char);
          if(result) {
            const newCharacter = await addCharacter(result);
            await createNewThreadWithCharacterId(newCharacter.id);
          }

          tidyUp();
          return;
        } catch(e) {
          console.error(e);
        }
      }

      // Try twice in case of network error:
      // if(!window.Readability) window.Readability = await import("https://esm.sh/@mozilla/readability@0.5.0?no-check").then(m => m.Readability).catch(console.error);
      if(!window.Readability) window.Readability = await import("https://user.uploads.dev/file/93edd249920ca5ac663278139c31868d.js").then(m => m.Readability).catch(console.error);
      if(!window.Readability) window.Readability = await import("https://user.uploads.dev/file/93edd249920ca5ac663278139c31868d.js?v=1").then(m => m.Readability).catch(console.error);
      // In case of user.uploads.dev block for some reason:
      if(!window.Readability) window.Readability = await import(URL.createObjectURL(await root.superFetch("https://user.uploads.dev/file/93edd249920ca5ac663278139c31868d.js").then(r => r.blob()))).then(m => m.Readability).catch(console.error);
      if(!window.Readability) window.Readability = await import("https://esm.sh/@mozilla/readability@0.5.0?no-check").then(m => m.Readability).catch(console.error);

      let blob;
      try {
        let response = await root.superFetch(url);
        if(response.status === 404) {
          console.error(`In generateCharacterFromUrl, couldn't find URL (404): ${url}`);
          tidyUp();
          return alert("Hmm. Couldn't find that page on the internet. Did you get the webpage address/URL correct? You should do a Google search for the character's name to find a page with the character info, and once you've found it, copy all the 'https://blahblahblah...' text from in the browser address/search bar and then paste it into this box, and click generate, and it should work. If not, please share the URL using the feedback button.");
          // let searchHtml = await root.superFetch(`https://www.google.com/search?q=${encodeURIComponent(url)}`).then(r => r.text());
        }
        blob = await response.blob();
      } catch(e) {
        console.error(`In generateCharacterFromUrl, ERROR while trying to superFetch URL: ${url}`, e);
        tidyUp();
        return alert("Hmm. There was some sort of error while trying to download that web page. Did you get the webpage address/URL correct? You should do a Google search for the character's name to find a page with the character info, and once you've found it, copy all the 'https://blahblahblah...' text from in the browser address/search bar and then paste it into this box, and click generate, and it should work. If not, please share the URL using the feedback button.");
      }

      let content;
      let avatarUrl = null;
      let initialMessages = null;
      let messageWrapperStyle = null;
      if(blob.type === "application/pdf") {
        if(!window.pdfjsLib) {
          window.pdfjsLib = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.min.mjs").then(m => m.default);
          pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs";
        }
        let text = await getPdfText(await blob.arrayBuffer());
        content = text.slice(0, 10000); // <-- grab only the first 10000 characters
      } else if(blob.type.startsWith("image/")) {
        if(await tryImportingExternalCharacterFileFormat(blob).catch(e => "fail") === "finished") {
          tidyUp();
          return;
        } else {
          avatarUrl = url;
        }
      } else {
        let html = await blob.text();
        let rawHtml = html;
        html = html.replace(/<head>/, `<head><base href="${url}"/>`) // so relative paths are correct

        // Since for some reason DOMParser tries to fetch these
        html = html.replace(/<link rel="stylesheet"[^>]*?\/>/gs, "");
        html = html.replace(/<script [^>]*?>.*?<\/script>/gs, "");

        let doc = new DOMParser().parseFromString(html, "text/html");

        // I don't think this is needed now that I add it before parsing, but I haven't tested, and it's harmless to leave this here for safety
        let baseEl = doc.createElement('base');
        baseEl.setAttribute('href', url);
        doc.head.append(baseEl);

        let done = false;
        if(/^https:\/\/character\.ai\//.test(url)) {
          content = "";
          if(/^https:\/\/character\.ai\/chat\//.test(url)) {
            let chatPageHtml = await root.superFetch(url).then(r => r.text());
            if(chatPageHtml.includes(`,"greeting":"`) && chatPageHtml.includes(`"character":{"external_id":"`)) {
              try { content += "\n\nScenario Starter Message: "+chatPageHtml.split(`"character":{"external_id":"`)[1].split(`,"greeting":"`)[1].split(`","identifier":"`)[0]; } catch(e) { console.error(e); }
              try { content += "\n\nCharacter Definition: "+chatPageHtml.split(`"character":{"external_id":"`)[1].split(`,"definition":"`)[1].split(`","upvotes":`)[0]; } catch(e) { console.error(e); }
              try { avatarUrl = "https://characterai.io/i/200/static/avatars/" + chatPageHtml.split(`"character":{"external_id":"`)[1].split(`,"avatar_file_name":"`)[1].split(`","`)[0]; } catch(e) { console.error(e); }
            }
            let charUrl = chatPageHtml.match(/,"characterPageUrl":"(.+?)"/)?.[1];
            if(!charUrl) {
              let id = chatPageHtml.match(/,"url":"https:\/\/character\.ai\/character\/(.+?)"/)?.[1];
              if(id) charUrl = "https://character.ai/character/" + id;
            }
            if(charUrl) url = charUrl; // so it triggers the next if block, to get extra character details
            done = true; // we're "done" since the next character page step is optional
          }
          if(/^https:\/\/character\.ai\/character\//.test(url) && html.includes(`prefetchedAboutInfo":`)) {
            try {
              content += "\n\n"+html.split(`"prefetchedAboutInfo":`)[1].replace(/"enableSSR\":.+/, "").replace(/"_sentryTraceData\":.+/, "").replace(/"customServer\":.+/, "");
              if(html.includes(`"avatar_file_name":"`)) avatarUrl = "https://characterai.io/i/200/static/avatars/" + html.split(`"avatar_file_name":"`)[1].split(`"`)[0];
              messageWrapperStyle = `color:#d1d5db; color:light-dark(#374151, #d1d5db); padding:0.75rem; background:#26272b; background:light-dark(#d6d6d6, #26272b); border-radius:1rem; font-family:'Onest', sans-serif; font-size:14px; font-weight:300; line-height:1.5;`;
              let greeting = (content.match(/,"greeting":"(.+?)","/s)?.[1] || "").replace(/\\n/g, "\n");
              if(greeting) initialMessages = [{author:"ai", content:greeting}];
              done = true;
            } catch(e) { console.warn(e); }
          }
          content = content.trim();
        }
        if(/^https:\/\/[^.]+.fandom\.com\/wiki\//.test(url)) {
          try {
            let urlObj = new URL(url);
            let wikiPageName = url.split("/wiki/").at(-1).split("?")[0];

            if(/^https:\/\/genshin-impact.fandom\.com\/wiki\/[^/]+$/.test(url) && !url.endsWith("/Lore")) {
              // try appending /Lore for genshin character pages, since lore pages have the personality info:
              try {
                let json = await root.superFetch(`https://${urlObj.hostname}/api.php?action=visualeditor&format=json&paction=wikitext&page=${wikiPageName}/Lore&uselang=en&formatversion=2`).then(r => r.json());
                content = json.visualeditor.content;
              } catch(e) { console.warn(e); }
            }

            if(!content) {
              let json = await root.superFetch(`https://${urlObj.hostname}/api.php?action=visualeditor&format=json&paction=wikitext&page=${wikiPageName}&uselang=en&formatversion=2`).then(r => r.json());
              content = json.visualeditor.content;
            }

            // remove excess dot points and other "weird"/short/syntaxy lines (e.g. for episodes a character appeared in, references, and stuff like that)
            if(content.length > 14000) {
              // console.log("CONTENT LENGTH:", content.length);
              let contentLines = content.split("\n");
              let newContentLines = [];
              let consecutiveSyntaxyLines = 0;
              let skippedLines = 0;
              for(let line of contentLines) {
                let isProbablySyntaxyLine = false;
                if(/^(\*|\[\[|\{|\}|<)/.test(line) && line.length < 300) isProbablySyntaxyLine = true;

                if(isProbablySyntaxyLine) consecutiveSyntaxyLines++
                else consecutiveSyntaxyLines = 0;

                if(!isProbablySyntaxyLine || consecutiveSyntaxyLines < 30) newContentLines.push(line);
                else skippedLines++;
              }
              content = newContentLines.join("\n");
              // console.log("CONTENT LENGTH:", content.length, skippedLines);
            }

            // ensure personality and appearance are moved to the top - otherwise it's missed cases like: e.g. https://danganronpa.fandom.com/wiki/Himiko_Yumeno?veaction=editsource
            let chunks = content.split(/(\n\n==[^=].+?\n\n(?===))/s);
            let reorderedChunks = [];
            for(let chunk of chunks) {
              if(/^== ?(Appearance|Personality)/.test(chunk.trim())) reorderedChunks.unshift(chunk);
              else reorderedChunks.push(chunk);
            }
            content = reorderedChunks.join("\n\n").replace(/\n{2,}/g, "\n\n").trim();
            content = content.replace(/<ref[ >].+<\/ref>/g, "");
            content = content.replace(/\[\[File:.+?\]\]/g, "");
            content = content.replace(/<br>/g, "\n");
            content = content.replace(/\[\[(.+?)\|(.+?)\]\]/g, "$2");
            content = content.replace(/\[\[[a-z][a-z]:.+?\]\]\n/g, "");
            avatarUrl = doc.querySelector(`meta[property='og:image']`)?.content;
            done = true;
          } catch(e) { console.warn(e); }
        }

        if(!avatarUrl) avatarUrl = doc.querySelector(`meta[property='og:image']`)?.content;

        if(!done) {
          // MUST give Readability its own fresh doc, since it edits the doc.
          let article = new Readability(new DOMParser().parseFromString(html, "text/html")).parse();
          if(!article) {
            article = {title:""};
            if(url.includes("youtube.com/")) article.textContent = (html.match(/("keywords":\[.+?)"thumbnail":{/s)?.[0] || "").slice(0, 5000).replace(/\\n/g, "\n"); // as of writing, this includes keywords and description
          }
          let title = article.title;
          if(doc.title) title = title + ` | ${doc.title}`;
          content = `# ${title || "(no page title)"}`;
          content += "\n\n";
          if(url.startsWith("https://instagram.com/") && html.match(/,"pronouns":\[(.+?)\]/)?.[1]) content += `pronouns: ${html.match(/,"pronouns":\[(.+?)\]/)?.[1]}`;
          if(url.startsWith("https://instagram.com/") && html.match(/,"biography":"(.+?)"/s)?.[1]) content += `biography: ${html.match(/,"biography":"(.+?)"/s)?.[1]}`;

          if(article.textContent) {
            content += article.textContent.replace(/\n+/g, "\n").replace(/ +/g, " ").replace(/( \n)+/g, "\n").replace(/(\n )+/g, "\n");
          } else {
            let newDoc = new DOMParser().parseFromString(html, "text/html");
            newDoc.querySelectorAll("script").forEach(el => el.remove());
            newDoc.querySelectorAll("noscript").forEach(el => el.remove());
            content += newDoc.body.textContent.replace(/\s+/g, " ");
            content = content.trim();

            if((!content || content.length < 500) && html.includes(`.js\\"],\\"name\\":\\"CharacterDetails\\",\\"async\\":false}\\n"])<\/script><script>self.__next_f.push([`)) {
              try {
                let chunk = html.split(`.js\\"],\\"name\\":\\"CharacterDetails\\",\\"async\\":false}\\n"])<\/script><script>self.__next_f.push([`)[1].split("self.__next_f.push([")[1].split("<\/script>")[0];
                chunk = chunk.split(`{\\"character\\":{`)[0].slice(0, 4000);
                content += "\n\n" + chunk;
              } catch(e) {
                console.warn(e);
              }
            }
          }

          let ogDescription = doc.querySelector(`meta[property='og:description'], meta[name='description']`)?.content;
          if(ogDescription) {
            content += "\n\nMeta Description: "+ogDescription;
          }

          let ogKeywords = doc.querySelector(`meta[property='og:keywords'], meta[name='keywords']`)?.content;
          if(ogKeywords) {
            content += "\n\nMeta Keywords: "+ogKeywords;
          }

          let jsonDescription = doc.body.innerHTML.match(/\\"avatar\\":\\".+?\\"description\\":\\"([^\\]+)\\",\\"greeting/)?.[1]
          if(jsonDescription) {
            content += "\n\nDescription: "+jsonDescription;
          }

          let schemaTextContent = doc.querySelector(`[itemtype="http://schema.org/Person"]`)?.textContent.replace(/\s+/g, " ");
          if(schemaTextContent) content += "\n\n"+schemaTextContent;

          // if(url.startsWith("https://charhub.ai/") && doc.querySelector(`form.button_to[action="/conversations"] [name="authenticity_token"]`)) {
          //   try {
          //     let convHtml = await root.superFetch("https://charhub.ai/conversations", {
          //       headers: { "content-type": "application/x-www-form-urlencoded" },
          //       body: `authenticity_token=${doc.querySelector(`form.button_to[action="/conversations"] [name="authenticity_token"]`).value}&conversation%5Bcharacter_id%5D=${url.split("/").pop().split("?")[0]}&conversation%5Bis_public%5D=false`,
          //       method: "POST",
          //     }).then(r => r.text()).catch(console.warn);
          //     if(convHtml) {
          //       let convDoc = new DOMParser().parseFromString(convHtml, "text/html");
          //       convDoc.querySelectorAll("script").forEach(el => el.remove());
          //       content += convDoc.body.textContent.replace(/\n+/g, "\n").replace(/ +/g, " ").replace(/( \n)+/g, "\n").replace(/(\n )+/g, "\n");
          //     }
          //   } catch(e) {
          //     console.warn(e);
          //   }
          // }

          let imageBoardTags = html.match(/id="image-container".+ data-tags="(.+?)"/)?.[1];
          // NOTE: weird chrome bug causes doc to sometimes get stripped of a bunch of content when we read textContent, so I'm creating a copy here:
          if(!imageBoardTags) imageBoardTags = [...doc.querySelectorAll(".search-tag")].map(el => el.textContent).join(" ");
          if(imageBoardTags) content += "\n\n# Character Avatar Image Tags:\n"+imageBoardTags;

          if(!avatarUrl && article.content && article.content.includes("<img")) doc.querySelector("img")?.src;

          if(!avatarUrl) avatarUrl = rawHtml.replaceAll("\n", "").match(/<img [^>]+?avatar[^>]+? src=['"]([^"']+?)['"]/i)?.[1];
          if(!avatarUrl) avatarUrl = rawHtml.replaceAll("\n", "").match(/<img [^>]+?profile[^>]+? src=['"]([^"']+?)['"]/i)?.[1];
          if(!avatarUrl) avatarUrl = rawHtml.replaceAll("\n", "").match(/<img [^>]+?pic[^>]+? src=['"]([^"']+?)['"]/i)?.[1];
          if(!avatarUrl) avatarUrl = rawHtml.replaceAll("\n", "").match(/<img [^>]+?user[^>]+? src=['"]([^"']+?)['"]/i)?.[1];

          if(!avatarUrl) avatarUrl = rawHtml.replaceAll("\n", "").match(/<img [^>]*src=['"]([^"']+?)['"]/i)?.[1];
          if(!avatarUrl) avatarUrl = doc.querySelector("img")?.src;

          // takes precedence over og:image, etc. since og:image is often a "banner" image for "social card" display
          if(doc.querySelector(`meta[property='og:type']`)?.content === "profile") {
            let profilePicEl = doc.querySelector("img#profilePicture");
            if(profilePicEl && profilePicEl.src) avatarUrl = profilePicEl.src;
          }
        }
      }

      if(avatarUrl) { // download, center crop + resize, resulting in a data URL:
        if(!avatarUrl.startsWith("//") && !avatarUrl.startsWith("https:") && !avatarUrl.startsWith("http:")) {
          avatarUrl = new URL(avatarUrl, url).href; // convert relative url like /image/foo.png to https://example.com/image/foo.png
        }
        avatarUrl = await processAvatarImageUrl(avatarUrl).catch(e => "")
      }

      let generatedText = "";
      let numTextChunksGenerated = 0;
      let expectedCharCount = 2500;

      let response = await root.aiTextPlugin({
        instruction: `TASK: The user has pasted a URL into a 'Generate a roleplay character based on any URL' input. The URL was ${url} and I've downloaded the content from that URL and attached it below. Your task is to use the content of the URL to generate a character description based on the webpage content/text. Your description should ideally include personality, appearance, speech examples/mannerisms, etc. such that an actor could read it and know how to roleplay as the character in all relevant aspects. Use an information-dense writing style to *succinctly* capture all aspects of the personality of the character that you generate. Your description should be between 200 and 600 words in length. Do your best to generate a character based on what you see below. Follow the details of the web page content (and ignoring irrelevant webpage text) to accurately capture the details that are most important to a roleplay.
${extraInstructions ? `\nEXTRA_USER_INSTRUCTIONS (important): ${extraInstructions} (use this instruction to 'alter' your depiction of the character)\n` : ""}
--- START OF WEB PAGE CONTENT ---\n\n${content}\n\n--- END OF WEB PAGE CONTENT ---

Reminder: Your task is to generate a character based on the above web page content. Your response should describe how the character looks/acts/speaks/behaves such that if someone read it, they would be able to accurately emulate or roleplay as the target character's mannerisms, personality, etc. No more than 600 words.${extraInstructions ? ` You *must* adjust the character to follow the underlying intent of the EXTRA_USER_INSTRUCTIONS when writing your response - the extra user instructions takes precedence over everything else.` : ""}

Use this template for your response:
<response_template>
# Name:
(name)

# Visual Description:
(ONE paragraph visual description)

# Personality Description:
(ONE paragraph personality description)

# Roleplay Behavior Examples:
(A numbered list of 5 separate and diverse examples of character speech/behavior, each starting with an asterisk or double-quote, which place the character in random roleplay situations, as if you've extracted random & diverse moments from a story, with sufficient context captured by the dialogue and actions themselves, to show the essence of who they are as a character, how they speak/act/react/etc. Each example should perfectly capture one aspect of who they are as a character. Each example should be its own separate momement from a hypothetical story, unrelated to the other examples that you write. You must use asterisks around actions and quotes around speech in typical roleplays style, for example [don't use this specific example in your response, it's just to demonstrate the syntax]: 1. "And why the..." *He gestures to the overturned carriage* "...grand entrance?" [...])

# Favorite Food:
(favorite food)
</response_template>`,
        startWith: `# Name:`,
        stopSequences: [`# Favorite Food:`],
        onChunk: (data) => {
          generatedText += data.textChunk;
          numTextChunksGenerated++;
          if(numTextChunksGenerated % 10 === 0) {
            if(generatedText.includes("# Roleplay Behavior Examples:")) expectedCharCount = generatedText.split("# Roleplay Behavior Examples:")[0].length + 1000;
            let percentage = Math.round(100*generatedText.length/expectedCharCount);
            if(percentage > 99) percentage = 99;
            notifBtn.querySelector(".generatingCharacterProgressPercentage").innerHTML = `&nbsp;${percentage}%`;
            generateCharacterFromUrlBtn.querySelector(".generatingCharacterProgressPercentage").innerHTML = `${percentage}%`
          }
        },
      });

      let name = response.trim().split("# Visual Description:")[0].split("# Name:")[1].trim();
      let roleInstruction = "# Visual Description:\n" + response.trim().replace(/# Favorite Food:$/, "").split("# Visual Description:")[1].trim();
      roleInstruction = roleInstruction.replace("# Roleplay Behavior Examples:\n\n", "# Roleplay Behavior Examples:\n"); // LLM often ads extra newline before list for some reason, only on this section
      roleInstruction = roleInstruction.replace("# Roleplay Behavior Examples:", "# {{char}} Roleplay Behavior Examples:");

      notifyCtn.classList.add("rotate-jiggle");
      setTimeout(() => notifyCtn.classList.remove("rotate-jiggle"), 3000);

      notifBtn.disabled = false;
      notifBtn.style.cssText = `background:#009600; color:white; border:1px solid #00c000;`;
      notifBtn.innerHTML = `👤 show generated character`;

      generateCharacterFromUrlBtn.innerHTML = `👤 show char`;
      generateCharacterFromUrlBtn.style.cssText = `background:#009600; color:white; border:1px solid #00c000;`;
      generateCharacterFromUrlBtn.disabled = false;

      let showCharHandler = async function() {
        tidyUp();
        let charObj = {
          name,
          roleInstruction,
          initialMessages: initialMessages ? initialMessages : [{author:"system", hiddenFrom:["ai"], content:`<i style="font-size:85%; opacity:0.6;"><b>Tip</b>: You can tap the 'Narrator' button above the reply box to generate a starting scenario.</i>`}],
        };
        if(messageWrapperStyle) charObj.messageWrapperStyle = messageWrapperStyle;
        if(avatarUrl) charObj.avatar = {url:avatarUrl};
        let result = await characterDetailsPrompt(charObj);
        if(result) {
          const newCharacter = await addCharacter(result);
          await createNewThreadWithCharacterId(newCharacter.id);
        }
      };
      generateCharacterFromUrlBtn.onclick = showCharHandler;
      notifBtn.onclick = showCharHandler;
    } catch(e) {
      console.error(`In generateCharacterFromUrl, something went wrong with URL: ${url}`, e);
      tidyUp();
      alert(`Something went wrong while trying to fetch the content at that URL. Please use the feedback button to report this error message: "${e.message}" - and please also 𝗶𝗻𝗰𝗹𝘂𝗱𝗲 𝘁𝗵𝗲 𝗨𝗥𝗟 𝘁𝗵𝗮𝘁 𝘆𝗼𝘂 𝘂𝘀𝗲𝗱 if possible.`);
    }
  };

  async function tryPersistBrowserStorageData() {
