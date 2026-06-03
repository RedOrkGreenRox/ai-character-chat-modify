<script>
  // Display the 'emergency' export button after several seconds if the UI hasn't loaded yet.
  // This setInterval is cleared after UI load.
  window.lastKnownActivelyLoadingTime = Date.now(); // for e.g. lore loading, we update this, to inform this timeout that it's taking a long time for 'legit' reasons
  window.emergencyExportButtonDisplayTimeout = setInterval(() => {
    if(Date.now()-window.lastKnownActivelyLoadingTime > 10000) {
      emergencyExportCtn.hidden = false;
      initialPageLoadingModal.hidden = true;
      clearInterval(window.emergencyExportButtonDisplayTimeout);
    }
  }, 5000);

  async function emergencyDeleteAllDataClickHandler() {
    emergencyDeleteDataBtn.disabled = true;
    emergencyDeleteDataBtn.textContent = `Deleting...`;
    await new Promise(r => setTimeout(r, 500));

    const request = window.indexedDB.deleteDatabase(window.dbName);

    request.onerror = function(event) {
      console.error("Error deleting database:", event);
      emergencyDeleteDataBtn.textContent = `⚠️ error`;
      alert(`Failed to delete data. Please ask for help on the forum. Screenshot this error info: ${event}`);
    };
    request.onsuccess = function(event) {
      console.log("Database deleted successfully");
      emergencyDeleteDataBtn.textContent = `✅ deleted`;
      alert(`Database deleted successfully. You can now reload/refresh the page.`);
    };
  }

  async function emergencyExportClickHandler() {
    if(!window.alreadyTriedEmergencyExport && confirm(`This could take up to 10 minutes. Please keep this browser tab visible while it runs. It'll save your data to your downloads folder when it is finished. Continue?`)) {
      window.alreadyTriedEmergencyExport = true;
      emergencyExportBtn.textContent = '⏳ loading...';

      let error = null;

      let result = await exportRawDb(window.dbName, {
        onProgress:(e) => {
          console[e.type]("exportRawDb: "+e.message);
        },
        corruptItemReplacer: ({storeName, id, dbData}) => {
          let example = dbData[storeName][0] ? JSON.parse(JSON.stringify(dbData[storeName][0])) : {};
          if(storeName === "characters") {
            example.id = id;
            example.name = "CORRUPT";
            console.warn("REPLACED CORRUPT:", example);
            return example;
          }
          if(storeName === "threads") {
            // try to find characterId based on messages:
            let characterId;
            let firstNonUserNonSystemMessageInThread = dbData["messages"].filter(m => m.threadId === id).find(m => m.characterId >= 0);
            characterId = firstNonUserNonSystemMessageInThread ? firstNonUserNonSystemMessageInThread.characterId : dbData["characters"][0].id;
            example.id = id;
            example.characterId = characterId;
            example.name = "CORRUPT";
            return example;
          }
          // Note: we don't bother with indiviual messages/lore/etc. because they won't break the whole UI. I.e. we effectively just delete the corrupt item
        },
      }).catch(e => { error=e; console.error(e); return false; });

      await new Promise(r => setTimeout(r, 3000)); // just to be safe (e.g. in case of interference with file download permission popup)

      if(result === false) {
        emergencyExportBtn.textContent = '⚠️ failed (pls ask for help on forum)';
        alert(`Export failed. Please screenshot this and share on the forum:\n${error} ${error.stack}`);
      } else {
        emergencyExportBtn.textContent = '✅ exported';
        emergencyDeleteDataBtn.hidden = false;
        alert(`Export complete. It has been saved to your downloads folder (filename ends with '.cbor.gz'). Please try opening this page in an incognito/private/guest browsing session and import the file to test it works. If it does, then you can click the 'delete all data' button on this page to clear your current data, and then import the file.`);
      }
    }
  }

  async function exportRawDb(dbName, opts={}) {
    let startTime = performance.now();
    const databases = await indexedDB.databases();
    const dbInfo = databases.find(db => db.name === dbName);
    if (!dbInfo) throw new Error('Database not found');

    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, dbInfo.version);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    const objectStores = Array.from(db.objectStoreNames);
    const exportObj = {};
    const storePromises = [];
    const corruptItems = [];

    for (const storeName of objectStores) {
      if(opts.skipStores && opts.skipStores.includes(storeName)) continue;
      let promise = (async function() {
        let storeStartTime = performance.now();
        const data = await new Promise((resolve, reject) => {
          const transaction = db.transaction(storeName, 'readonly');
          transaction.onabort = (e) => { alert(`TRANSACTION ABORTED (this doesn't mean the export process failed, it's still going, but please let me know on the forum if you see this): ${storeName} ${e.type}`) };

          const store = transaction.objectStore(storeName);
          // let request = storeName == "characters" ? {} : store.getAll(); // for testing
          let request = store.getAll();

          let getAllTimeout;
          request.onerror = () => { clearTimeout(getAllTimeout); reject(request.error); };
          request.onsuccess = () => { clearTimeout(getAllTimeout); resolve(request.result); };

          // If getAll times out, then we get all items one-by-one:
          getAllTimeout = setTimeout(async () => {
            if(opts.onProgress) opts.onProgress({message:`getAllTimeout: Doing individual gets for ${storeName}`, type:"warn"});
            let items = [];
            let consecutiveFails = 0;
            let alreadyGotIds = new Set(); // just for safety
            for (let id = 0; id < 1000000; id++) {
              await new Promise(r => setTimeout(r, 3));
              let resultPromise = new Promise((res, rej) => {
                let transaction = db.transaction(storeName, 'readonly');
                let store = transaction.objectStore(storeName);
                // let request = id===3814 ? {} : store.get(id); // for testing
                let request = store.get(id);

                request.onerror = () => rej(request.error);
                request.onsuccess = () => res(request.result);
              });

              let result = await Promise.race([
                resultPromise,
                new Promise(r => setTimeout(() => r({__TIMEOUT__:1}), 10000)),
              ]).catch(console.error);

              if (result && result.__TIMEOUT__) {
                if(opts.onProgress) opts.onProgress({message:`Timeout for id=${id} of storeName=${storeName}.${opts.corruptItemReplacer ? " Replacing with dummy item." : ""}`, type:"error"});
                corruptItems.push({storeName, id});
                result = null;
              }

              if (result) {
                if(!alreadyGotIds.has(result.id)) {
                  alreadyGotIds.add(result.id);
                  items.push(result);
                }
                consecutiveFails = 0;
              } else {
                consecutiveFails++;
                if(consecutiveFails > 10000) break;
              }
            }
            resolve(items);
          }, 30*1000); // it's actually okay if this triggers even when it doesn't need to, since whichever one resolves first (this, or getAll) will still just resolve with the correct data, and the second resolve call is ignored.
        }).catch(e => {
          console.error(e);
          if(opts.onProgress) opts.onProgress({message:`Error getting data for: ${storeName}: ${e}`, type:"error"});
          return null;
        });
        exportObj[storeName] = data;
        let timeTaken = performance.now()-storeStartTime;
        if(opts.onProgress) opts.onProgress({message:`Got data for: ${storeName} (took ${Math.round(timeTaken)}ms)`, timeTaken, type:"log"});
      })();
      storePromises.push(promise);
    }

    await Promise.race([
      new Promise(r => setTimeout(r, 5*60*1000)), // timeout
      Promise.all(storePromises),
    ]);

    if(opts.corruptItemReplacer) {
      for(let {storeName, id} of corruptItems) {
        if(!exportObj[storeName]) exportObj[storeName] = [];
        let item = opts.corruptItemReplacer({storeName, id, dbData:exportObj});
        if(item) exportObj[storeName].push(item);
      }
    }

    for (const storeName of objectStores) {
      if(!exportObj[storeName]) {
        if(opts.onProgress) opts.onProgress({message:`Timeout while waiting for data from: ${storeName}`, type:"error"});
      }
    }

    let CBOR = await import("https://user.uploads.dev/file/4cc84b2c503aad595e5c6e9fffe24602.js").then(r => r.default).catch(console.error);
    if(!CBOR) CBOR = await import(`https://user.uploads.dev/file/4cc84b2c503aad595e5c6e9fffe24602.js?v=${Math.random()}`).then(r => r.default).catch(console.error);
    if(!CBOR) CBOR = await import(URL.createObjectURL(await root.superFetch(`https://user.uploads.dev/file/4cc84b2c503aad595e5c6e9fffe24602.js`).then(r => r.blob()))).then(r => r.default).catch(console.error);
    if(!CBOR) { // no idea why the above aren't working for some people, final fallback:
      await import(`https://unpkg.com/cbor-x@1.6.0/dist/index.js`).catch(console.error); // adds it as a global
      CBOR = self.CBOR;
    }

    let jsonToSave = { meta:{type:"ai-character-chat-db-raw-export-v1", dbName}, stores:exportObj };

    if(opts.onProgress) opts.onProgress({message:`Encoding...`, type:"log"});

    // Encode with CBOR and compress (encoding and compression take similar amounts of time, based on a 300MB test I did):
    let cborBytes = CBOR.encode(jsonToSave);
    let cborBlob = new Blob([cborBytes], { type: 'application/cbor' });
    if(opts.onProgress) opts.onProgress({message:`Compressing...`, type:"log"});
    let compressedCborBlob = await new Response(cborBlob.stream().pipeThrough(new CompressionStream('gzip'))).blob();

    let url = URL.createObjectURL(compressedCborBlob);
    let a = document.createElement('a');
    a.href = url;
    a.download = `ai-character-chat-db-raw-export-v1.cbor.gz`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000*60*2);
    db.close();
    let timeTaken = performance.now()-startTime;
    if(opts.onProgress) opts.onProgress({finished:true, message:`Done. (took ${Math.round(timeTaken)}ms)`, timeTaken, type:"log"});
  }
</script>
