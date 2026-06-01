async loadDataFromUrlThatReferencesCloudStorageFile() =>
  if(!window.DecompressionStream) {
    alert("Character share links use a browser feature that's only available in modern browsers. Please upgrade your browser to the latest version to allow for loading data from character share links.");
    return null;
  }

  let loadingModal = createLoadingModal("Loading character data...");

  try {
    // example URL:  https://perchance.org/ai-character-chat?data=Game_Master~85jf93h8hiifnd84hdksrkeh.gz
    let searchParams = new URL(window.location.href).searchParams;
    let dataParamValue = searchParams.get("data");
    if(!dataParamValue) {
      if(searchParams.get("char") && urlNamedCharacters[searchParams.get("char")]) { // see `urlNamedCharacters` list below - for URLs like https://perchance.org/ai-character-chat?char=ai-adventure
        dataParamValue = "foo~"+urlNamedCharacters[searchParams.get("char")];
      } else {
        throw new Error("Invalid share URL.");
      }
    }
    let fileName = dataParamValue.split("~").slice(-1)[0];
    let fileUrl = "https://user.uploads.dev/file/"+fileName;

    let blob = await fetch(fileUrl, {signal:AbortSignal.timeout ? AbortSignal.timeout(15000) : null}).then(res => res.ok ? res.blob() : null).catch(console.error);
    if(!blob) {
      loadingModal.delete();
      await confirmAsync(`It seems you've tried to load a character share URL, but the file specified by the URL does not exist. If you believe it should exist, you can ask for help on the community forum, or check if the file has been quarantined:\n\nperchance.org/quarantined-files`, {hideCancel:true});
      return null;
    }
    let text;
    if(fileUrl.endsWith(".gz")) {
      let decompressedBlob = await decompressBlobWithGzip(blob);
      text = await decompressedBlob.text();
    } else {
      // can add other file formats in the future if needed
      throw new Error("Invalid share URL.");
    }
    let data = JSON.parse(text);
    loadingModal.delete();
    return data;
  } catch(e) {
    alert(`Failed to load chat data: ${e.message}`);
    console.error(e);
  }

  loadingModal.delete();
  return null;

async decompressBlobWithGzip(blob) =>
  const ds = new DecompressionStream("gzip");
  const decompressedStream = blob.stream().pipeThrough(ds);
  return await new Response(decompressedStream).blob();

async evaluatePerchanceTextInSandbox(text, opts) =>
  if(!opts) opts = {};
  let iframe = document.querySelector('#perchanceCodeEvaluationSandboxIframe');
  if(!iframe) {
    iframe = document.createElement("iframe");
    iframe.src = "https://7deabe31ae18ea5ed27c5f71b9633999.perchance.org/ai-character-chat-sandboxed-executor";
    iframe.id = "perchanceCodeEvaluationSandboxIframe";
    iframe.sandbox = "allow-scripts allow-same-origin";
    iframe.style.cssText = "position:fixed; width:1px; height:1px; opacity:0.01; top:-10px; right:-10px; pointer-events:none; border:0; outline:0; user-select:none;";
    document.body.append(iframe);
    iframe._resolvers = {};
    let iframeLoadResolver;
    let iframeLoadPromise = new Promise(r => iframeLoadResolver=r);
    window.addEventListener('message', (event) => {
      if(event.origin === 'https://7deabe31ae18ea5ed27c5f71b9633999.perchance.org') {
        if(event.data.finishedLoading) {
          iframeLoadResolver();
          return;
        }
        const { requestId, text } = event.data;
        if(iframe._resolvers[requestId]) {
          iframe._resolvers[requestId](text);
          delete iframe._resolvers[requestId];
        }
      }
    });
    await iframeLoadPromise;
  }
  const requestId = Math.random().toString();
  return new Promise((resolve, reject) => {
    iframe._resolvers[requestId] = resolve;
    if(opts.timeout) {
      setTimeout(() => {
        if(iframe._resolvers[requestId]) reject("Sandbox did not respond in time.");
      }, opts.timeout);
    }
    iframe.contentWindow.postMessage({ text, requestId }, 'https://7deabe31ae18ea5ed27c5f71b9633999.perchance.org');
  });

