<script type="module">
  console.log("load log: main script start", Date.now()-window.pageLoadStartTime);

  // let dependencyBundleUrl = document.querySelector("#mainDependencyBundleScriptEl").src;
  // if(!window.DOMPurify) { // not sure why, but for some people it's not loading, so try downloading again
  //   console.error("window.DOMPurify is falsy. Downloading dependencyBundleUrl and adding script dynamically.");
  //   const script = document.createElement('script');
  //   let content = await fetch(dependencyBundleUrl+`?v=${Math.random()}`).then(r => r.text()).catch(console.error);
  //   if(content === undefined) { // maybe user.uploads.dev domain blocked for some reason
  //     content = await root.superFetch(dependencyBundleUrl+`?v=${Math.random()}`).then(r => r.text()).catch(console.error);
  //   }
  //   script.textContent = content;
  //   document.head.appendChild(script); // note: this executes the script *synchronously* which is what we need here
  // }

  // Important that this is high up in case of corrupted DB
  $.clearDataButton.addEventListener("click", async function() {
    if(!confirm("🚨 Are you sure you want to DELETE ALL DATA? This cannot be undone. 🚨")) {
      return;
    }
    await delay(1000);
    if(!confirm("🚨 Click OK again to confirm FULL DELETION of all your data. 🚨")) {
      return;
    }
    await db.delete();
    window.location.reload();
  });
  setTimeout(() => {
    initialPageLoadingModal.style.display = "none"; // in case of corrupted db, remove modal so they have the option to click the delete-all-data button
  }, 1000*15);

  window.toggleAvatarPicDisplay = function() {
    if(document.querySelector("#avatarPicHideStyle")) {
      document.querySelector("#avatarPicHideStyle").remove();
    } else {
      let style = document.createElement("style");
      style.textContent = `#messageFeed .message .avatar { display: none !important; }`;
      style.id = "avatarPicHideStyle";
      document.head.append(style);
    }
  };

  const animatedLoadingSvg = `<svg style="height:1rem; width:2rem; overflow:hidden; border-radius:3px; vertical-align:top; position:relative; top:0.01rem; margin-left:0.125rem;" height="1rem" width="2rem" class="loading-animation-ctn"> <circle class="loading-animation-dot" cx="0.5rem" cy="0.5rem" r="3" style="fill:grey;"></circle> <circle class="loading-animation-dot" cx="1rem" cy="0.5rem" r="3" style="fill:grey;"></circle> <circle class="loading-animation-dot" cx="1.5rem" cy="0.5rem" r="3" style="fill:grey;"></circle> </svg>`;

  try {
    window.isTouchScreen = window.matchMedia("(pointer: coarse)").matches;
  } catch(e) {
    window.isTouchScreen = false;
    console.error(e);
  }

  try {
    // I think there's a function in utils js file before `addBackgroundToElement` that Opera (and maybe Safari) don't like.
    if(typeof addBackgroundToElement === "undefined") {
      console.error(`typeof addBackgroundToElement === "undefined"`);
      alert(`The Opera (and possibly Safari browsers) have a bug that breaks this site. I'm going to try work around it, but in the meantime, please use Chrome or Firefox.`);
    }
  } catch(e) {
    console.error(e);
  }

  // NOTE: If you change this, compare the native embeddings to the JS ones, and ensure the level of resolution that I'm keeping via the toFixed in `window.textEmbedderFunction` is an appropriate amount.
  const currentDefaultTextEmbeddingModelName = 'Xenova/bge-base-en-v1.5';

  window.JSON5 = null;
  (async function() {
    let attempts = 0;
    while(1) {
      await delay(2000); // because it's only needed for imports, and we don't want to slow down the page load at all
      window.JSON5 = await import('https://cdn.jsdelivr.net/npm/json5@2.2.2/dist/index.min.mjs').then(m => m.default).catch(console.error);
      if(window.JSON5) break;
      if(attempts++ > 5) break;
    }
  })();

  window.blobToDataUrl = function(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  window.processAvatarImageUrl = async function(imageUrl, opts={}) {
    if(opts.noCrop) {
      // JUST RESIZE:
      const maxSize = opts.maxSize || 768;
      let blob = await root.superFetch(imageUrl).then(r => r.blob());
      const imageBitmap = await createImageBitmap(blob);
      const scaleFactor = Math.min(1, maxSize / Math.max(imageBitmap.width, imageBitmap.height));
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = Math.floor(imageBitmap.width * scaleFactor);
      canvas.height = Math.floor(imageBitmap.height * scaleFactor);
      ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg');
    } else {
      // center-crop and resize, unless it's a very tall image, in which case we center-upper-ish-crop and resize
      const maxSize = opts.maxSize || 768;
      let blob = await root.superFetch(imageUrl).then(r => r.blob());
      const imageBitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const size = Math.min(imageBitmap.width, imageBitmap.height);
      const startX = (imageBitmap.width - size) / 2;
      const isTall = imageBitmap.height / imageBitmap.width >= 1.3; // If height is 1.3x or more than width, we consider it tall
      const startY = isTall ? (imageBitmap.height - size) / 6 : (imageBitmap.height - size) / 2; // For tall images, move the crop area upwards
      const scaleFactor = Math.min(1, maxSize / size);
      canvas.width = canvas.height = Math.floor(size * scaleFactor);
      ctx.drawImage(imageBitmap, startX, startY, size, size, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg');
    }
  }

  let existingGenerateCharacterFromUrlNotifyCtn;
