        // let warnThatAvatarUrlWasRemoved = false;
        // let avatarUrl = character.avatar.url;
        // if(avatarUrl && avatarUrl.startsWith("data:")) {
        //   character.avatar.url = "";
        //   warnThatAvatarUrlWasRemoved = true;
        // }

        // PERCHANCE EDIT:
        await root.generateShareLinkForCharacter({addCharacter:character, quickAdd:true});

        // let urlHashData = encodeURIComponent(JSON.stringify({addCharacter:character})).replace(/[!'()*]/g, function(c) {
        //   return '%' + c.charCodeAt(0).toString(16); // since encodeURIComponent doesn't encode some characters (like parentheses) and I think they mess up markdown links
        // });
        // const url = `https://perchance.org/${window.generatorName}#${urlHashData}`;
        // await navigator.clipboard.writeText(url);
        // $.topNotificationContent.innerHTML = `Copied character link to clipboard!`;
        // showEl($.topNotification);

        // if(warnThatAvatarUrlWasRemoved) {
        //   await new Promise(resolve => setTimeout(resolve, 1000));
        //   let result = await prompt2({
        //     message: {type:"none", "html":`<p style="margin:0;">All character data is embedded within character share links, but this character's avatar image was stored as text (using a <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs" target="_blank">'data' URL</a>), and that would result in a huge share URL, so the avatar image was removed from the share link.<br><br>If you click 'Open avatar in new tab', then you can right-click/long-press it and save the avatar image, and then upload it to catbox.moe or a similar website, and then edit your character and replacing the 'data:' avatar URL with the new 'https:' URL that you got from the image hosting service. That way your share link will include the avatar image.</p>`},
        //   }, {cancelButtonText:"Share charater without avatar", submitButtonText:"Open avatar in new tab"});
        //   if(result !== null) {
        //     let blobUrl = await dataUrlToCachedBlobUrl(avatarUrl);
        //     window.open(blobUrl, "_blank");
        //   }
        // }
