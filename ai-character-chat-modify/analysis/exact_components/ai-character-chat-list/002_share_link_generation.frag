async generateShareLinkForCharacter(json) =>
  if(!window.CompressionStream) {
    alert("Share links use a feature that's only available in modern browsers. Please upgrade your browser to the latest version to use this feature. If you're using Safari, switch to Chrome instead.");
    return;
  }

  let loadingModal = createLoadingModal("⏳ Generating share link...");

  let jsonString = JSON.stringify(json);

  let urlHashData = encodeURIComponent(JSON.stringify(json)).replace(/[!'()*]/g, function(c) {
    return '%' + c.charCodeAt(0).toString(16); // since encodeURIComponent doesn't encode some characters (like parentheses) and they mess up markdown links
  });
  console.log("shareUrl (hash version):", `https://perchance.org/${window.generatorName}#${urlHashData}`);

  // convert json text to blob:
  let dataUrlJsonString = jsonString.replace(/#/g, "%23"); // since hash is a special character in dataurls (like normal URLs)
  let blob = await fetch("data:text/plain;charset=utf-8,"+dataUrlJsonString).then(res => res.blob());

  // compress blob:
  let compressedBlob = await compressBlobWithGzip(blob);

  let { url, size, error } = await uploadPlugin(compressedBlob);
  if(error) {
    loadingModal.delete();
    alert(`Error: ${error}${error === "disallowed_content" ? ". If you believe this is incorrect, then you may need to edit the character description to explicitly state that the character is 18 or older, since the moderation system can make mistakes if there is ambiguity." : ""}`);
  } else {
    loadingModal.delete();
    let fileName = url.replace("https://user.uploads.dev/file/", "");
    let characterName = json.addCharacter.name.replace(/\s+/g, "_").replaceAll("~", ""); // this is just so URL is more readable - doesn't affect stored data at all
    let shareUrl = `https://perchance.org/${window.generatorName}?data=${characterName}~${fileName}`;
    console.log("shareUrl:", shareUrl);

    let colorScheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "light";
    let result = await window.prompt2({
      content: {type:"none", html:`<div style="margin-bottom:0.5rem; opacity:0.7; font-size:90%;">Here's a link to this character that you can share with others:</div><div style="display:flex; gap:0.5rem;"><input value="${shareUrl}" style="flex-grow:1; color-scheme:${colorScheme};"> <button onclick="navigator.clipboard.writeText(this.parentElement.querySelector('input').value); this.textContent='copied ✅'; setTimeout(() => { this.textContent='copy url'; }, 2000);">copy url</button> </div>`},
    }, {cancelButtonText:null, submitButtonText:"finished"});
  }

async compressBlobWithGzip(blob) =>
  const cs = new CompressionStream('gzip');
  const compressedStream = blob.stream().pipeThrough(cs);
  let outputBlob = await new Response(compressedStream).blob();
  return new Blob([outputBlob], { type: "application/gzip" }); // <-- to add the correct mime type

