  const characterPropertiesVisibleToCustomCode = {
    name: "name",
    avatar: "avatar",
    roleInstruction: "roleInstruction",
    reminderMessage: "reminderMessage",
    initialMessages: "initialMessages",
    customCode: "customCode",
    imagePromptPrefix: "imagePromptPrefix",
    imagePromptSuffix: "imagePromptSuffix",
    imagePromptTriggers: "imagePromptTriggers",
    shortcutButtons: "shortcutButtons",
    messageInputPlaceholder: "messageInputPlaceholder",
    // temperature: "temperature",
    // topP: "topP",
    // frequencyPenalty: "frequencyPenalty",
    // presencePenalty: "presencePenalty",
    // bestOf: "bestOf",
    // maxTokens: "maxTokens",
    stopSequences: "stopSequences",
    modelName: "modelName",
    userCharacter: "userCharacter",
    // scene: "scene", // TODO: expose this. but devs can edit scene by adding to messages anyway so no rush here.
    streamingResponse: "streamingResponse",
    customData: "customData",
    maxTokensPerMessage: "maxTokensPerMessage",
  };


  const customCodeIframes = {}; // threadId -> iframe
  async function createNewCustomCodeIframeForThread(threadId) {

    let thread = await db.threads.get(threadId);
    let character = await db.characters.get(thread.characterId);
    let userCharacter = await getUserCharacterObj();
    let customCode = (await db.characters.get(thread.characterId)).customCode || "";

    if(customCodeIframes[threadId]) {
      delete customCodeIframes[threadId];
    }

    let iframe = document.createElement("iframe");

    let pageLoadId = Math.random().toString();
    let iframeLoadPromise = new Promise((resolve, reject) => {
      function handler(e) {
        if(e.data._id === pageLoadId) {
          resolve();
          window.removeEventListener("message", handler);
        }
      }
      window.addEventListener("message", handler);
    });

    iframe.setAttribute("sandbox", "allow-scripts");
    // we MUST NOT set display:none here, because otherwise window.innerWidth/innerHeight are zero on init, which can confuse plugin devs.
    // instead we set opacity:0 and pointer-events:none, and then switch to display:none after load.
    iframe.style.cssText = "border:0; width:100%; height:100%; pointer-events:none; opacity:0; display:absolute; background:var(--background);";
    iframe.dataset.threadId = threadId;

    // let floatingWindow = createFloatingWindow({header:character.name, closeButtonAction:"hide"});
    // floatingWindow.bodyEl.appendChild(iframe);
    // floatingWindow.hide();

    $.customCodeIframeCtn.appendChild(iframe);
    customCodeIframes[threadId] = iframe;

    let srcDoc = dedent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width">
      <base target="_blank">
    </head>
    <body>
    <script type="module">
      window.___dataInitializationFINISHED_836283628 = false;

      (function() {

        // Proxy fetch to remove CORS restrictions
        const proxyHandler = {
          apply: async function (target, thisArg, argumentsList) {
            let url;
            if(typeof argumentsList[0] === "object") url = argumentsList[0].href || argumentsList[0].url; // can be URL object or {url, method, etc}
            else url = argumentsList[0];

            if(url.startsWith("blob:") || url.startsWith("data:")) return target.call(thisArg, ...argumentsList);

            let origin = new URL(url).origin;

            // for performance, exclude some CDNs that don't need CORS proxying
            if(
              origin.endsWith("jsdelivr.net")
              || origin.endsWith("catbox.moe")
              || (origin.endsWith("huggingface.co") && url.includes("/resolve/"))
              || origin === "https://raw.githubusercontent.com"
            ) {
              return target.call(thisArg, ...argumentsList);
            }

            // // This is what allows characters to make arbitrary requests to resources on the internet.
            // // DO NOT use this URL directly in your code. The URL may change in future and your code will break.
            // // Just use 'fetch' as normal and this proxy will be used automatically.
            // // Note: I was originally trying a normal fetch and then only falling back to this CORS proxy if it failed, but the problem with that is that this would hit the endpoint twice, which may have side effects, and the user might not want that.
            // // I may eventually have to add manual "exemptions" to skip proxying certain URLs that don't need it - like huggingface models, for example, since we could start to become bandwidth limited.
            // const proxiedUrl = "https://opencharacters-cors-proxy.glitch.me?url=" + encodeURIComponent(url);
            // try {
            //   if(typeof argumentsList[0] === "object") {
            //     argumentsList[0] = new Request(proxiedUrl, argumentsList[0]);
            //     return target.call(thisArg, ...argumentsList);
            //   } else {
            //     return target.call(thisArg, proxiedUrl, ...argumentsList.slice(1));
            //   }
            // } catch(e) {
            //   console.error(e);
            //   return target.call(thisArg, ...argumentsList); // try unproxied if proxied fails
            // }

            let finalArgs;
            if(typeof argumentsList[0] === "object" && argumentsList[0].url) {
              argumentsList[0] = new Request(url, argumentsList[0]);
              finalArgs = argumentsList;
            } else {
              finalArgs = [url, ...argumentsList.slice(1)];
            }

            let result = await callParentWindow({type:"proxiedFetch", args:finalArgs});
            return new Response(result.bodyThing, {status:result.status}); // if browser supports transferrable streams, bodyThing is a stream, otherwise it's an arraybuffer, and Response constructor accepts both.
          },
        };
        const originalFetch = window.fetch;
        window.fetch = new Proxy(fetch, proxyHandler);


        let userHandlers = {
          messageadded: [],
          messageedited: [],
          messagedeleted: [],
          messageinserted: [],
          streamingmessagechunk: [],
          streamingmessage: [],
        };
        let dataChangedByCustomCode = false;
        let dataSnapshotWhenLastSentToMainThread = null;

        window.oc = {
          thread: Object.seal({
            name: undefined,
            messages: [],
            userCharacter: Object.seal({
              name: undefined,
              avatar: Object.seal({
                url: undefined,
                size: undefined,
                shape: undefined,
              }),
              reminderMessage: undefined,
              roleInstruction: undefined,
            }),
            systemCharacter: Object.seal({
              name: undefined,
              avatar: Object.seal({
                url: undefined,
                size: undefined,
                shape: undefined,
              }),
            }),
            character: Object.seal({
              name: undefined,
              avatar: Object.seal({
                url: undefined,
                size: undefined,
                shape: undefined,
              }),
              reminderMessage: undefined,
              roleInstruction: undefined,
            }),
            customData: null,
            messageWrapperStyle: null,
            shortcutButtons: null,
            on: function(eventName, callback) {
              userHandlers[eventName.toLowerCase()].push(callback);
            },
            off: function(eventName, callback) {
              let i = userHandlers[eventName.toLowerCase()].indexOf(callback);
              if(i !== -1) userHandlers[eventName.toLowerCase()].splice(i, 1);
            },
            once: function(eventName, callback) {
              let handler = function() {
                callback.apply(this, arguments);
                this.off(eventName, handler);
              }.bind(this);
              this.on(eventName, handler);
            },
          }),
          character: Object.seal({
          ${Object.values(characterPropertiesVisibleToCustomCode).map(prop => `
            ${prop}: null,
          `).join("\n")}
            avatarUrl: null, // for backwards-compat
          }),
          userCharacter: Object.freeze({ // read-only! this is the user's 'GLOBAL' settings - a character's custom code can't change it
            name: "${(userCharacter.name || "").replace(/"/g, '\\"').replace(/\n/g, "\\n")}",
            avatar: Object.freeze({
              url: ${userCharacter.avatar?.url ? `"${userCharacter.avatar?.url.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"` : `undefined`},
              size: undefined,
              shape: undefined,
            }),
            reminderMessage: "${(userCharacter.reminderMessage || "").replace(/"/g, '\\"').replace(/\n/g, "\\n")}",
            roleInstruction: "${(userCharacter.roleInstruction || "").replace(/"/g, '\\"').replace(/\n/g, "\\n")}",
          }),
          window: Object.seal({
            show: function(args={}) {
              window.parent.postMessage({type:"showWindow", threadId:${threadId}, args}, "*");
            },
            hide: function(args={}) {
              window.parent.postMessage({type:"hideWindow", threadId:${threadId}, args}, "*");
            },
          }),
          //getCompletion: async function(options) {
          //  let data = {type:"getCompletion", options};
          //  return callParentWindow(data);
          //},
          getChatCompletion: async function(options) {
            let data = {type:"getChatCompletion", options};
            return callParentWindow(data);
          },
          getInstructCompletion: async function(options) {
            if(typeof options === "string") options = {instruction:options};
            if(!options.instruction) throw new Error("Invalid params given to getInstructCompletion - must at least give 'instruction' in input object");
            let data = {type:"getInstructCompletion", options};
            let result = await callParentWindow(data);
            let strObj = new String(result.text || ""); // to match behavior of ai-text-plugin
            strObj.text = result.text;
            strObj.generatedText = result.generatedText;
            strObj.stopReason = result.stopReason;
            return strObj;
          },
          generateText: async function(options) {
            return await window.oc.getInstructCompletion(options);
          },
          textToImage: async function(options) {
            if(!options.prompt) throw new Error("Invalid params given to textToImage - must at least give 'prompt' in input object");
            let data = {type:"textToImage", options};
            return callParentWindow(data);
          },
          // forceSaveData: async function() {
          //   return window._do_not_use_this_use_oc_dot_pushDataChanges_instead___sendBackDataUpdatesIfNeeded();
          // },
          messageRenderingPipeline: [],
        };


        // Construct StreamingMessage event out of StreamingMessageChunk events:
        class AsyncQueue {
          constructor() {
            this.queue = [];
            this.resolvers = [];
          }
          push(value) {
            if(this.resolvers.length > 0) this.resolvers.shift()(value);
            else this.queue.push(value);
          }
          async pop() {
            if(this.queue.length > 0) return this.queue.shift();
            return new Promise((resolve) => { this.resolvers.push(resolve); });
          }
        }
        async function* readChunks(streamId, queue) {
          while (true) {
            const chunk = await queue.pop();
            if(!chunk) break;
            yield chunk;
            if(chunk.last) {
              streamQueues.delete(streamId);
              break;
            }
          }
        }

        const streamQueues = new Map();
        oc.thread.on("StreamingMessageChunk", async function (chunk) {
          const { streamId } = chunk;
          let queue = streamQueues.get(streamId);
          if(!queue) {
            queue = new AsyncQueue();
            streamQueues.set(streamId, queue);
            for(let handler of userHandlers.streamingmessage) {
              handler({ streamId, chunks: readChunks(streamId, queue) });
            }
          }
          queue.push(chunk);
        });

        function callParentWindow(data) {
          let _id = Math.random().toString()+Math.random().toString();
          return new Promise((resolve, reject) => {
            window.parent.postMessage({_id, data, threadId:${threadId}}, "*");
            function handler(e) {
              if(e.data._id === _id) {
                window.removeEventListener("message", handler);
                if(e.data.success) resolve(e.data.result);
                else reject(e.data.result);
              }
            }
            window.addEventListener("message", handler);
          });
        }

        const originalOcObject = window.oc;

        // function watchObject(obj, callback) {
        //   let proxy = new Proxy(obj, {
        //     set: function(target, prop, value) {
        //       target[prop] = value;
        //       callback(prop, value);
        //       return true;
        //     }
        //   });
        //   return proxy;
        // }
        // function watchArray(arr, callback) {
        //   // note that we need to watch set and get because get is called for push/pop/etc.
        //   let proxy = new Proxy(arr, {
        //     set: function(target, prop, value) {
        //       target[prop] = value;
        //       callback(prop);
        //       return true;
        //     },
        //     get: function(target, prop) {
        //       if(isNaN(Number(prop))) { // ignore array indexing
        //         callback(prop);
        //       }
        //       return target[prop];
        //     }
        //   });
        //   return proxy;
        // }

        // TODO: later we can track changes in a more fine-grained way to reduce data transfer between this frame and parent

        // oc.thread.messages = watchArray(oc.thread.messages, (prop) => {
        //   dataChangedByCustomCode = true;
        // });
        // let currentThreadMessagesArray = oc.thread.messages;
        // let ignoreMessagePropSetter = false;
        // window.oc.thread = watchObject(oc.thread, (prop, value) => {
        //   if(ignoreMessagePropSetter) return;
        //   // if they set the messages prop to a new array, we need to watch that array:
        //   if(prop === "messages" && value && value !== currentThreadMessagesArray) { // NOTE: oc.thread.messages is *already* set to 'value', so we need to track with currentThreadMessagesArray
        //     ignoreMessagePropSetter = true; // need to ignore because we're about to change oc.thread.messages which would cause infinite loop
        //     oc.thread.messages = watchArray(value, (prop) => {
        //       dataChangedByCustomCode = true;
        //     });
        //     ignoreMessagePropSetter = false;
        //     currentThreadMessagesArray = oc.thread.messages;
        //   }
        //   dataChangedByCustomCode = true;
        // });
        // window.oc.character = watchObject(oc.character, (prop) => {
        //   dataChangedByCustomCode = true;
        // });


        // https://stackoverflow.com/a/58983264/11950764
        // This tracks all changes to the object, including nested objects, and including new objects/arrays that are added as properties.
        let deepOnChangeProxyCache = new WeakMap();
        function createDeepOnChangeProxy(target, onChange) {
          return new Proxy(target, {
            get(target, property) {
              const item = target[property];
              if (item && typeof item === 'object') {
                if (deepOnChangeProxyCache.has(item)) return deepOnChangeProxyCache.get(item);
                const proxy = createDeepOnChangeProxy(item, onChange);
                deepOnChangeProxyCache.set(item, proxy);
                return proxy;
              }
              return item;
            },
            set(target, property, newValue) {
              target[property] = newValue;
              onChange();
              return true;
            },
          });
        }


        window.oc.character = createDeepOnChangeProxy(window.oc.character, function() {
          dataChangedByCustomCode = true;
        });
        window.oc.thread = createDeepOnChangeProxy(window.oc.thread, function() {
          dataChangedByCustomCode = true;
        });

        window.oc = Object.freeze(window.oc);

        // this is for sending updates to this iframe from the main thread - e.g. if user manually changes stuff like thread.shortcutButtons
        window.___setDataWithoutTriggeringChange = function(propChain, value) {
          let dataChangedByCustomCode_original = dataChangedByCustomCode;

          try {
            let obj = window.oc;
            for(let prop of propChain.slice(0, -1)) obj = obj[prop];
            obj[propChain.at(-1)] = value;

            let objSnapshot = dataSnapshotWhenLastSentToMainThread;
            for(let prop of propChain.slice(0, -1)) objSnapshot = objSnapshot[prop];
            objSnapshot[propChain.at(-1)] = value;
          } catch(e) {
            console.log("Error in ___setDataWithoutTriggeringChange:", e);
          }

          dataChangedByCustomCode = dataChangedByCustomCode_original;
        };


        function getCurrentData() {
          // we need to ignore the Proxy trigger while we do this:
          let origFlag = dataChangedByCustomCode;
          let data = JSON.parse(JSON.stringify(oc));
          dataChangedByCustomCode = origFlag;
          return data;
        }
        function getChangedData() {
          let origFlag = dataChangedByCustomCode;
          let prevData = dataSnapshotWhenLastSentToMainThread;
          let changedData = getCurrentData();
          // delete any values of changedData that were the same as existing data so we only send back changes:
          for(let key in prevData.thread) {
            if(typeof prevData.thread[key] === "object") {
              // need to stringify to test sameness of arrays and other non-primitives:
              // TODO: maybe make this more efficient at some point - stringifying a huge thread could be sluggish
              // TODO: and it should really just send back a *delta*, rather than whole messages array
              if(JSON.stringify(prevData.thread[key]) === JSON.stringify(changedData.thread[key])) delete changedData.thread[key];
            } else {
              if(prevData.thread[key] === changedData.thread[key]) delete changedData.thread[key];
            }
          }
          for(let key in prevData.character) {
            if(typeof prevData.character[key] === "object") {
              if(JSON.stringify(prevData.character[key]) === JSON.stringify(changedData.character[key])) delete changedData.character[key];
            } else {
              if(prevData.character[key] === changedData.character[key]) delete changedData.character[key];
            }
          }
          dataChangedByCustomCode = origFlag;
          return changedData;
        }

        window._do_not_use_this_use_oc_dot_pushDataChanges_instead___sendBackDataUpdatesIfNeeded = async function() {
          await sendBackDataUpdatesIfNeeded();
          // wrapped sendBackDataUpdatesIfNeeded this just we I don't accidentally return internal data from sendBackDataUpdatesIfNeeded to userland with some later change that I make
        }

        async function sendBackDataUpdatesIfNeeded() {
          if(dataChangedByCustomCode) {
            let changedData = getChangedData();
            // if(changedData.thread.messages && new Set(changedData.thread.messages.map(m => m.content)).size < changedData.thread.messages.length) {
            //   debugger;
            // }
            dataChangedByCustomCode = false;
            dataSnapshotWhenLastSentToMainThread = getCurrentData();
            console.log("Custom code changed character/thread data:", changedData);
            await callParentWindow({type:"dataChanged", data:changedData})
          }
        }

        let currentlyProcessingMessageActionHandlers = false;
        (async function() {
          while(1) {
            try {
              // TODO: make this more efficient - polling is not ideal
              await new Promise(r => setTimeout(r, 100));

              // MessageAdded/MessageEdited event is special in that it sends data back immediately afterwards,
              // so to prevent any weirdness, we wait for it to finish:
              while(currentlyProcessingMessageActionHandlers) {
                await new Promise(r => setTimeout(r, 100));
              }

              if(dataChangedByCustomCode) {
                await sendBackDataUpdatesIfNeeded();
              }
            } catch(e) {
              console.error(e);
            }
          }
        })();




        window.addEventListener("message", async function(e) {
          if(e.source !== window.parent || e.origin !== "${window.location.origin}") return;

          if(e.data.eventName?.toLowerCase() !== "streamingmessagechunk") {
            // console.log("customCode iframe received message (note: streamingmessagechunk messages are not logged):", e.data);
          }

          if(!e.data._id) return;
          if(window.oc !== originalOcObject) {
            // oc is frozen and oc.character/thread are sealed, but they can still overwrite window.oc - however, this is a security issue, since oc gets JSONified and sent back to the main thread when data changes, and I don't want to have to deal with unexpected properties on the main thread because it could be dangerous
            window.parent.postMessage({_id:e.data._id, success:false, result:"oc has been modified. Please do not modify window.oc."}, "${window.location.origin}");
            return;
          }

          if(e.data.type === "function") {
            try {
              let fn = new Function(\`return (\${e.data.functionText})\`)();
              let output = await fn(e.data.functionArg);
              window.parent.postMessage({_id:e.data._id, success:true, result:output}, "${window.location.origin}");
            } catch(err) {
              console.error(err);
              window.parent.postMessage({_id:e.data._id, success:false, result:err.message+"\\n"+err.stack}, "${window.location.origin}");
            }
          }

          if(e.data.type === "event") {
            let eventName = e.data.eventName.toLowerCase();

            if(eventName === "messageadded" || eventName === "messageedited"  || eventName === "messagedeleted" || eventName === "messageinserted") {
              currentlyProcessingMessageActionHandlers = true; // <-- we use this variable to pause the normal data update polling.
              let returnData = null;
              try {
                let updates = e.data.data.updates;
                let eventData = e.data.data.eventData;

                let userFacingEventData = {};

                // this must come *before* overwriting oc.thread.messages because after that point we can't get the original message object
                if(eventName === "messagedeleted") {
                  userFacingEventData.message = oc.thread.messages.find(m => m.id === eventData.messageId);
                  userFacingEventData.originalIndex = oc.thread.messages.findIndex(m => m.id === eventData.messageId);
                }

                let origFlag = dataChangedByCustomCode;
                oc.thread.messages = updates.thread.messages;
                dataChangedByCustomCode = origFlag;

                // this must come *after* overwriting oc.thread.messages because we want event.message to be an actual reference to the message object that's currently in the oc.thread.messages array.
                if(eventName !== "messagedeleted") {
                  if(eventName === "messageadded") {
                    userFacingEventData.message = oc.thread.messages.at(-1);
                  } else {
                    userFacingEventData.message = oc.thread.messages.find(m => m.id === eventData.messageId);
                  }
                }

                await Promise.all(userHandlers[eventName].map(handler => handler(userFacingEventData)));

                if(dataChangedByCustomCode) {
                  returnData = getChangedData();
                  dataChangedByCustomCode = false;
                  dataSnapshotWhenLastSentToMainThread = getCurrentData();
                }
              } catch(e) {
                console.error(\`There was an error while processing the \${eventName} event:\`);
                console.error(e);
              }
              // console.log("custom code iframe sending back:", returnData);
              window.parent.postMessage({_id:e.data._id, success:true, result:returnData}, "${window.location.origin}");
              currentlyProcessingMessageActionHandlers = false;
            }

            if(eventName === "streamingmessagechunk") {
              let data = e.data.data;
              await Promise.all(userHandlers.streamingmessagechunk.map(handler => handler(data)));
            }

          }

          if(e.data.type === "init") {

            function applyObjectOverrides({object, overrides}) {
              for(let key in overrides) {
                if(Array.isArray(overrides[key])) {
                  object[key] = structuredClone(overrides[key]); // arrays are treated as "final" values - we don't go "into" them
                } else if(typeof overrides[key] === "object" && overrides[key] !== null) {
                  if (!object.hasOwnProperty(key) || typeof object[key] !== "object" || object[key] === null) {
                    object[key] = {};
                  }
                  applyObjectOverrides({object:object[key], overrides:overrides[key]});
                } else {
                  object[key] = overrides[key];
                }
              }
            }

            let data = e.data.initialData;
            applyObjectOverrides({object:oc.thread, overrides:data.thread});
            applyObjectOverrides({object:oc.character, overrides:data.character});
            window.___dataInitializationFINISHED_836283628 = true;
            dataChangedByCustomCode = false;
            dataSnapshotWhenLastSentToMainThread = getCurrentData();

            // it's important that we wait for custom code to finish loading before we indicate that init has finished.
            let loopDelay = 5;
            let waitedTime = 0;
            while(1) {
              if(window.__customCodeInitializationIsComplete_846298638) {
                break;
              }
              if(waitedTime > 10 && !window.__customCodeInitializationSTARTED_846298638) {
                // it should at least *START* in milliseconds, so this almost certainly indicates they had a syntax error in their code which prevented the whole script tag from executing at all.
                // note: *non-syntax* errors are caught by a try/catch loop. this is just for syntax errors.
                break; // <-- break to prevent endless loading screen
              }
              await new Promise(r => setTimeout(r, loopDelay));
              waitedTime += loopDelay;
            }

            window.parent.postMessage({_id:e.data._id, success:true, result:null}, "${window.location.origin}");
          }
        });
      })();

      // this must come before the wait-for-initialization below, because it's what ends up triggering initialization
      window.addEventListener("load", () => {
        window.parent.postMessage({_id:"${pageLoadId}"}, "${window.location.origin}");
      });

    <\/script>

    <!-- note: this must be a separate code block from above, because otherwise static imports are initialised before window.oc exists -->
    <script type="module" class="customCodeScriptElement">
      window.__customCodeInitializationSTARTED_846298638 = true;

      // we need to wait for the oc data to load because they may immediately reference it in their custom code
      while(1) {
        if(window.___dataInitializationFINISHED_836283628) break;
        await new Promise(r => setTimeout(r, 5));
      }
      console.log("Data initialization of sandboxed iframe is complete.");
      try {
        // currently the only reason this is wrapped in an async function is to throw an error if the user's code contains a static import, since static imports are pre-loaded and thus jump ahead of initialization
        // oh and maybe we need it to be able to catch wrap this try/catch around it too?
        await (async () => {
          {{customCode}}
        })();
      } catch(e) {
        console.error(e);
      }

      // backwards-compat with old processMessages function:
      if(window.processMessages) {
        oc.thread.on("MessageAdded", async function() {
          await window.processMessages(window.oc.thread.messages);
        });
      }
      window.__customCodeInitializationIsComplete_846298638 = true;
    <\/script>

    <!-- some code for helping devs with custom code bugs/problems: -->
    <script type="module">
      await new Promise(r => setTimeout(r, 100));

      let customCodeScriptElementText = document.querySelector(".customCodeScriptElement")?.textContent || ""; // optional chaining is needed since they may have deleted it via document.body.innerHTML=...

      if(!window.__customCodeInitializationSTARTED_846298638) { // if it hasn't *started* after 1 second, it's almost certainly a parsing bug
        let staticImportRegex = ${/(^|\s)import(\s+(\*\s+as\s+\w+|{[^}]*})?\s+from)?\s*['"][^'"]+\.js['"]\s*;?/.toString()};
        if(staticImportRegex.test(customCodeScriptElementText)) {
          console.warn("It looks like your character's custom code may have static import statements like:\\n\\nimport 'foo.js';  or  import { abc } from 'foo.js';\\n\\nIf so, please change them to dynamic imports like this:\\n\\nawait import('foo.js');  or  let { abc } = await import('foo.js');\\n\\nFor technical reasons, static imports are not supported in custom code.");
        }
      }
    <\/script>

    </body>
    </html>`); // need to escape the closing script tag so it doesn't close the script tag that this code is within

    // using template+split+join so dedent works properly
    iframe.srcdoc = srcDoc.split("{{customCode}}").join(customCode);

    await iframeLoadPromise;

    iframe.style.pointerEvents = "";
    iframe.style.opacity = "";
    iframe.style.display = "none";

    if(isMobile && activeThreadId === threadId && thread.customCodeWindow.visible && $.rightColumn.dataset.visible === "no") {
      // this is necessary (and must come before the triggerInitCustomCodeEvent call, below) because some iframes will require user interaction to initialize the thread - if dev shows the iframe, then they probably want the mobile user to see it first (new users probably wouldn't know to click the button that shows the iframe)
      $.toggleRightColumnButton.click();
    }

    await triggerInitCustomCodeEvent(threadId);

  }

  let customCodeResolvers = {}; // id -> resolver
  window.addEventListener("message", function(e) {
    let resolver = customCodeResolvers[e.data._id];
    if(resolver) {
      if(e.data.success) {
        resolver(e.data.result);
      } else {
        console.error("There was a problem with this character's custom code:", e);
        alert("There was a problem with this character's custom code:\n\n"+e.data.result);
        resolver(null);
      }
      delete customCodeResolvers[e.data._id];
    }
  });

  window.addEventListener("message", async function(e) {
    let threadId = e.data.threadId;
    let args = e.data.args;
    let types = ["showWindow", "hideWindow"];
    if(types.includes(e.data?.type) && customCodeIframes[threadId]?.contentWindow === e.source) {
      let visible = null;
      if(e.data.type === "showWindow") visible = true;
      if(e.data.type === "hideWindow") visible = false;
      let thread = await db.threads.get(threadId);
      thread.customCodeWindow.visible = visible;
      if(args.width !== undefined && typeof args.width === "number" || typeof args.width === "string") {
        thread.customCodeWindow.width = args.width;
      }
      await db.threads.update(threadId, {customCodeWindow: thread.customCodeWindow});
      await updateCustomCodeIframeVisibility();
    }
  });


  async function updateCustomCodeIframeVisibility() {
    let visibleThreadId = null;
    if($.messageFeed.offsetWidth > 0 && activeThreadId !== null) {
      visibleThreadId = activeThreadId;
    }
    let visibleThread = null;
    if(visibleThreadId !== null) visibleThread = await db.threads.get(visibleThreadId);

    let character = null;
    if(visibleThread !== null) character = await db.characters.get(visibleThread.characterId);

    $.customCodeIframeCtn.querySelectorAll(`iframe`).forEach(iframe => iframe.style.display = "none");
    $.customCodeColumn.style.display = "none";

    if(visibleThread !== null && character.customCode.trim() && visibleThread.customCodeWindow.visible === true) {
      customCodeIframes[visibleThreadId].style.display = "block";
      let width = visibleThread.customCodeWindow.width ?? "300px";
      if(typeof width === "number") width = width+"px";
      $.customCodeIframeCtn.style.width = width;
      $.customCodeColumn.style.display = "flex";
      if(isMobile) {
        $.toggleRightColumnButton.style.display = "flex";
        $.customCodeIframeCtn.style.width = "100%";
        if($.rightColumn.dataset.visible === "no") {
          $.toggleRightColumnButton.click();
        }
      }
    } else {
      if(isMobile) {
        $.toggleRightColumnButton.style.display = "none";
        if($.rightColumn.dataset.visible === "yes") {
          $.toggleRightColumnButton.click();
        }
      }
    }
  }

  $.customCodeIframeHorizontalResizeBar.addEventListener("mousedown", function(e) {
    e.preventDefault();

    // display an element that covers the entire screen, so that the user can drag the mouse over the iframe without losing mouse events:
    let cover = document.createElement("div");
    cover.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;z-index:99";
    document.body.appendChild(cover);
    cover.addEventListener("mouseup", function() {
      cover.remove();
    });

    let startX = e.clientX;
    let startWidth = $.customCodeIframeCtn.offsetWidth;
    let mousemove = function(e) {
      let newWidth = startWidth - (e.clientX - startX);
      $.customCodeIframeCtn.style.width = newWidth+"px";
    };
    let mouseup = async function(e) {
      window.removeEventListener("mousemove", mousemove);
      window.removeEventListener("mouseup", mouseup);
      let visibleThreadId = activeThreadId;
      let visibleThread = await db.threads.get(visibleThreadId);
      visibleThread.customCodeWindow.width = $.customCodeIframeCtn.offsetWidth;
      await db.threads.update(visibleThreadId, {customCodeWindow: visibleThread.customCodeWindow});
    };
    window.addEventListener("mousemove", mousemove);
    window.addEventListener("mouseup", mouseup);
  });


  let botIsCurrentlyReplyingPromise = null;


  // TODO: make this a user setting (in misc db)
  const customCodeCompletionTokenWarnLimit = 5_000_000; // $10 at current turbo-3.5 prices

  const customCodeCompletionUsage = {}; // token counts for each thread
  const threadIdsAllowedToGoOverTokenLimit = new Set();
  const threadIdsBlockedFromGoingOverTokenLimit = new Set();
  window.addEventListener("message", async function(e) {
    let threadId = e.data.threadId;
    let types = ["getChatCompletion", "getInstructCompletion", "textToImage", "dataChanged", "proxiedFetch"];
    const data = e.data.data;
    if(data && types.includes(data.type) && customCodeIframes[threadId]?.contentWindow === e.source) {
      let thread = await db.threads.get(threadId);
      let character = await db.characters.get(thread.characterId);

      if(data.type === "textToImage") {
        let options = data.options;

        if(!options.prompt || typeof options.prompt !== "string") {
          console.error("Invalid parameter: Must give `prompt` string to `oc.textToImage`.");
          customCodeIframes[e.data.threadId].contentWindow.postMessage({_id:e.data._id, success:false, result:null}, "*");
          return;
        }

        let resultObj = root.textToImagePlugin({
          prompt: options.prompt,
          negativePrompt: options.negativePrompt,
          seed: options.seed,
          guidanceScale: options.guidanceScale,
          resolution: options.resolution,
          style: "z-index:10000; opacity:0.4; position:fixed; top:0.5rem; right:0.5rem; transform-origin:top right; transform:scale(0.3);",
        });

        // need to display the iframe on page in case captcha verification stuff is needed
        let tmp = document.createElement("div");
        tmp.innerHTML = resultObj.iframeHtml;
        let iframeEl = tmp.firstElementChild;
        document.body.append(iframeEl);

        let resultData = await resultObj.onFinishPromise;
        iframeEl.remove();

        let sendResult = {dataUrl:resultData.dataUrl};
        customCodeIframes[e.data.threadId].contentWindow.postMessage({_id:e.data._id, success:true, result:sendResult}, "*");
        return;
      } else if(data.type === "proxiedFetch") {
        let error;
        let response = await window.root.superFetch(...data.args).catch(e => {error=e});

        if(error) {
          customCodeIframes[e.data.threadId].contentWindow.postMessage({_id:e.data._id, success:false, result:error}, "*");
          return;
        }

        let transferrableStreamsSupported = false;
        if(transferrableStreamsSupported) {
          customCodeIframes[e.data.threadId].contentWindow.postMessage({_id:e.data._id, success:true, result:{bodyThing:response.body, status:response.status}}, {transfer:[response.body], targetOrigin:"*"});
          return;
        } else {
          let arrayBuffer = await response.arrayBuffer();
          customCodeIframes[e.data.threadId].contentWindow.postMessage({_id:e.data._id, success:true, result:{bodyThing:arrayBuffer, status:response.status}}, "*");
          return;
        }

      } else if(data.type === "getInstructCompletion") {
        let options = data.options;

        if(!options.instruction || typeof options.instruction !== "string") {
          console.error("Invalid parameter: Must give `instruction` string to `oc.getInstructCompletion`.");
          customCodeIframes[e.data.threadId].contentWindow.postMessage({_id:e.data._id, success:false, result:null}, "*");
          return;
        }

        let streamObj = root.aiTextPlugin({
          instruction: options.instruction,
          startWith: options.startWith,
          stopSequences: options.stopSequences,
        });
        let resultData = await streamObj;
        customCodeIframes[e.data.threadId].contentWindow.postMessage({_id:e.data._id, success:true, result:{text:resultData.text, generatedText:resultData.generatedText, stopReason:resultData.stopReason}}, "*");
        return;

      } else if(data.type === "getChatCompletion") {
        let options = data.options;

        let messages = options.messages;

        if(!messages || !messages[0].content || !messages[0].author) {
          console.error("Invalid parameter: The first input to oc.getChatCompletion should be an options object, and 'options.messages' must be an array of objects with 'content' and 'author' properties.");
          customCodeIframes[e.data.threadId].contentWindow.postMessage({_id:e.data._id, success:false, result:null}, "*");
          return;
        }

        // transform and clean the options data:
        options.messages.forEach(m => {
          m.content = m.content+"";
          m.role = m.author==="user"?"user" : m.author==="ai"?"assistant" : m.author==="system"?"system" : "system";
          if(m.name) m.name = m.name+"";
          let allowedKeys = ["content", "role", "name"];
          for(let key in m) {
            if(!allowedKeys.includes(key)) delete m[key];
          }
        });
        let o = {
          messages: options.messages,
          modelName: thread.modelName,
          temperature: options.temperature === undefined ? undefined : Number(options.temperature),
          stopSequences: Array.isArray(options.stopSequences) ? options.stopSequences.map(s => s+"") : undefined,
          topP: options.topP === undefined ? undefined : Number(options.topP),
          frequencyPenalty: options.frequencyPenalty === undefined ? undefined : Number(options.frequencyPenalty),
          presencePenalty: options.presencePenalty === undefined ? undefined : Number(options.presencePenalty),
        };
        if(!customCodeCompletionUsage[threadId]) customCodeCompletionUsage[threadId] = 0;
        let tokens = await countTokensInMessages(o.messages, thread.modelName);
        customCodeCompletionUsage[threadId] += tokens;
        if(customCodeCompletionUsage[threadId] > customCodeCompletionTokenWarnLimit && !threadIdsAllowedToGoOverTokenLimit.has(threadId)) {
          if(threadIdsBlockedFromGoingOverTokenLimit.has(threadId)) {
            return;
          }
          if(confirm(`This character's custom code has used ${customCodeCompletionUsage[threadId].toLocaleString()} words/tokens, which is quite a lot - it could indicate an infinite loop. Would you like to continue?`)) {
            threadIdsAllowedToGoOverTokenLimit.add(threadId);
          } else {
            threadIdsBlockedFromGoingOverTokenLimit.add(threadId);
            return;
          }
        }


        o.threadId = threadId; // this is just for tracking token usage

        let result = await getChatCompletion(o);
        customCodeCompletionUsage[threadId] += countTokens(result, thread.modelName);
        customCodeIframes[e.data.threadId].contentWindow.postMessage({_id:e.data._id, success:true, result}, "*");
      }


      if(data.type === "dataChanged") {
        let receivedData = data.data;

        // EDIT: I've commented this out because now renderMessageFeed handles `data-currently-streaming="1"` messages correctly.
        // if(botIsCurrentlyReplyingPromise) {
        //   await botIsCurrentlyReplyingPromise; // otherwise we'll render the feed and thus delete the "typing indicator" placeholder or the streaming response
        // }

        await updateDbWithNewDataFromCustomCode({threadId, receivedData});
        if(threadId === activeThreadId) {
          console.log("Rendering message feed after updateDbWithNewDataFromCustomCode");
          await renderMessageFeed(threadId);

          try { // new code so try/catch
            // Re-render currentlyStreaming messages:
            let currentlyStreamingMessages = $.messageFeed.querySelectorAll(`.message[data-currently-streaming='1']`);
            if(currentlyStreamingMessages.length > 0) {
              let thread = await db.threads.get(threadId);
              for(let el of currentlyStreamingMessages) {
                let messageObj = el.messageObj;
                if(!messageObj) continue;
                surgicallyRerenderStreamingMessageEl({el, messageObj, thread});
              }
            }
          } catch(e) { console.error(e); }
        }
        customCodeIframes[e.data.threadId].contentWindow.postMessage({_id:e.data._id, success:true, result:null}, "*");
      }

    }
  });
  async function surgicallyRerenderStreamingMessageEl({el, messageObj, thread}) {
    // TODO: add more stuff here as needed - this is just a hacky MVP for common things like changing avatar pic in the StreamingMessage handler so e.g. can change expression image at start of message, rather than waiting for it to be fully written.
    let dummyEl = await createMessageElement(messageObj, {thread}); // use a dummy message to compute relevant styles/content since there is a lot of complicated fallback logic that we don't want to have to replicate here.
    el.style.cssText = dummyEl.style.cssText; // for `wrapperStyle` updates.
    el.querySelector(".avatar").style.cssText = dummyEl.querySelector(".avatar").style.cssText;
    el.querySelector(".characterName").innerHTML = dummyEl.querySelector(".characterName").innerHTML;
  }
  async function sendCustomCodeIframeMessage(threadId, data) {
    let iframe = customCodeIframes[threadId];
    let _id = Math.random().toString()+Math.random().toString();
    data._id = _id;
    iframe.contentWindow.postMessage(data, "*");
    return new Promise(r => {
      customCodeResolvers[_id] = r;
    });
  }

  // this is for onclick handlers in messages
  window.runCodeInCustomCodeIframe = async function(code, opts={}) {
    let threadId = opts.threadId || activeThreadId;
    let functionText = `function() {
      ${code}
    }`;
    if(!customCodeIframes[threadId]) await delay(500);
    if(!customCodeIframes[threadId]) await delay(1000);
    return sendCustomCodeIframeMessage(threadId, {type:"function", functionText, functionArg:undefined});
  };

  async function getDataForCustomCode(threadId, opts={}) {
    let thread = opts.thread;
    if(!thread) {
      thread = await db.threads.get(threadId);
    }

    let threadCharacter = opts.threadCharacter;
    if(!threadCharacter) {
      threadCharacter = await db.characters.get(thread.characterId);
    }

    // let userCharacter = await getUserCharacterObj();

    if(!threadCharacter.customCode?.trim()) return;

    let messages = await db.messages.where("threadId").equals(threadId).toArray();
    messages.sort((a,b) => a.order - b.order);
    // console.log("@@@@@@@@@@@ getDataForCustomCode: messages before formatting for custom code: ", messages);
    let formattedMessages = await messagesToCustomCodeFormat({messages, thread, threadCharacter});
    let data = {
      thread: { // this is bascally 'threadPropertiesVisibleToCustomCode'
        name: thread.name,
        messages: formattedMessages,
        userCharacter: thread.userCharacter,
        systemCharacter: thread.systemCharacter,
        customData: thread.customData,
        character: thread.character,
        messageWrapperStyle: thread.messageWrapperStyle,
        shortcutButtons: thread.shortcutButtons,
      },
      character: {},
    };
    for(let key in characterPropertiesVisibleToCustomCode) {
      data.character[characterPropertiesVisibleToCustomCode[key]] = threadCharacter[key];
    }

    // backwards-compat properties:
    data.character.avatarUrl = threadCharacter.avatar.url;

    return {data, originalMessages:messages};
  }

  async function triggerInitCustomCodeEvent(threadId) {
    let {data, originalMessages} = await getDataForCustomCode(threadId, {});
    await sendCustomCodeIframeMessage(threadId, {type:"init", initialData:data});
  }

  // this function runs after every message is added: https://perchance.org/ai-character-chat-docs#custom-code
  async function triggerMessageActionCustomCodeEvent({threadId, eventData, eventName, triggerBotReply=true}={}) {
    let thread = await db.threads.get(threadId);
    let threadCharacter = await db.characters.get(thread.characterId);

    if(!threadCharacter.customCode) return;

    $.statusNotifier.innerHTML = "<span style='opacity: 0.6; font-size: 0.9rem;'>⌛ custom code processing</span><div style='width:0.5rem;'></div>"+createTypingIndicatorHtml();
    showEl($.statusNotifier);

    let { data, originalMessages } = await getDataForCustomCode(threadId, {thread, threadCharacter});
    let updates = data;
    // console.log(`@@@@@@@@@@@ Data sent to custom code for ${eventName} handler:`, updates);
    let receivedData = await sendCustomCodeIframeMessage(threadId, {type:"event", eventName:eventName.toLowerCase(), data:{updates, eventData}});
    // console.log(`@@@@@@@@@@@ Data received from custom code after ${eventName} handler:`, receivedData);
    if(receivedData) await updateDbWithNewDataFromCustomCode({threadId, receivedData, originalMessages});
    $.statusNotifier.innerHTML = "";
    hideEl($.statusNotifier);

    let currentThreadId = activeThreadId;
    if(threadId === currentThreadId) { // <-- since user may have switched threads
      await renderMessageFeed(threadId, {triggerBotReply});
    }
  }

  // let lastChunkIndexA = -1;
  async function triggerStreamingMessageChunkCustomCodeEvent(threadId, chunkData, threadCharacter) {
    if(!threadCharacter.customCode) return;

    // if(chunkData.index !== lastChunkIndexA+1) console.warn("OUT OF ORDER **BEFORE POSTING** CHUNK111", chunkData);
    // lastChunkIndexA = chunkData.index;

    await sendCustomCodeIframeMessage(threadId, {type:"event", eventName:"streamingmessagechunk", data:chunkData});
  }

  // let alreadyCurrentlyUpdatingDbWithNewDataFromCustomCode = false;
  async function updateDbWithNewDataFromCustomCode({threadId, receivedData, originalMessages}) {

    console.log("Updating DB with data recieved from custom code:", {threadId, receivedData, originalMessages});

    // backwards-compat:
    if(receivedData.character?.avatarUrl) {
      if(!receivedData.character?.avatar?.url?.trim()) {
        if(!receivedData.character.avatar) receivedData.character.avatar = {};
        receivedData.character.avatar.url = receivedData.character.avatarUrl;
      }
      delete receivedData.character.avatarUrl;
    }

    let thread = await db.threads.get(threadId);
    let threadCharacter = await db.characters.get(thread.characterId);

    let characterNamesPossiblyChanged = false;
    let threadShortcutButtonsPossiblyChanged = false;

    // THREAD MESSAGES:
    if(receivedData.thread?.messages) {
      // note that originalMessages will only be defined if this is part of the MessageHandler process - because in that case we actually sent the messages, whereas in the data polling updates, we didn't send anything
      // currentMessages and originalMessages can differ because e.g. a message could have been deleted by the user while the custom code was processing
      let currentMessages = await db.messages.where("threadId").equals(threadId).toArray();
      currentMessages.sort((a,b) => a.order - b.order);
      let outputMessageObjs = await messagesFromCustomCodeFormat({messages:receivedData.thread.messages, originalMessages: originalMessages ?? currentMessages, threadId});
      // console.log("@@@@@@@@@@@ Messages back in db format:", outputMessageObjs);

      // order the messages (from the db's perspective) according to how the custom code ordered the oc.thread.messages array
      let order = 0;
      for(let m of outputMessageObjs) {
        m.order = order++;
      }

      for(let m of outputMessageObjs) {
        if(typeof m.id !== "number") {
          delete m.id;
        }
      }

      // they may have duplicated an object, which means there'll be an id collision, so we remove all later duplicate ids
      let idsGotAlready = [];
      for(let m of outputMessageObjs) {
        if(idsGotAlready.includes(m.id)) {
          delete m.id;
        } else {
          idsGotAlready.push(m.id);
        }
      }

      // if they have added an id that's not an id that exists in currentMessages, we remove that message's id:
      let currentMessageIds = currentMessages.map(m => m.id);
      for(let m of outputMessageObjs) {
        if(typeof m.id === "number" && !currentMessageIds.includes(m.id)) {
          delete m.id;
        }
      }

      // if messages have been deleted, then we need to set those m.messageIdsUsed to -1
      for(let m of outputMessageObjs) {
        m.messageIdsUsed = m.messageIdsUsed.map(referencedId => {
          if(currentMessageIds.includes(referencedId)) return referencedId;
          else return -1;
          // if(!originalOrCurrentMessageIds.includes(referencedId) && referencedId !== -1) {
          //   // this is fine (i.e. not an error) if we *don't* have originalMessages (i.e. if we're relying on a fresh db request right at this moment) because it's possible that e.g. the user deleted a message while the custom code was processing.
          //   // but if we *do* have originalMessages, then something is wrong - why would messageIdsUsed (which isn't exposed to custom code, to be clear) contain ids of messages that don't exist in the *original* messages that we sent to the custom code iframe?
          //   if(originalMessages) {
          //     throw new Error("messageIdsUsed should only contain ids of messages that exist in the original messages");
          //   } else {
          //     return -1;
          //   }
          // }
          // if(deletedMessageIds.includes(referencedId)) return -1;
          // else return referencedId;
        });
      }

      // note that messagesFromCustomCodeFormat re-numbers `message.order` so it matches the order of the oc.thread.messages array that was returned.

      // replace messages in the database with the new messages
      // we need to make sure that no other db.messages code runs between .delete and .bulkAdd, so we use a transaction that gets a read-write lock on the messages table.
      // otherwise e.g. another call to updateDbWithNewDataFromCustomCode could run between them, and that would cause `db.messages.where("threadId").equals(threadId).toArray()` to incorrectly return zero messages.
      try {
        await db.transaction('rw', db.messages, async (tx) => {
          let existingMessageIds = await tx.table("messages").where("threadId").equals(threadId).toArray().then(arr => arr.map(m => m.id));
          await safelyDeleteMessagesByIds(existingMessageIds, {tx});

          let ids = outputMessageObjs.filter(m => m.id !== undefined).map(m => m.id);
          if(new Set(ids).size !== ids.length) {
            throw new Error("Duplicate message ids after custom code processing. This is a bug.");
          }

          await tx.table("messages").bulkAdd(outputMessageObjs);
        });
      } catch(e) {
        console.error("There was an error during custom code handling - updateDbWithNewDataFromCustomCode:", e);
        alert("There was an error during custom code handling - updateDbWithNewDataFromCustomCode.\n\n"+e.stack);
        throw e;
      }

      // let newMessages = await db.messages.where("threadId").equals(threadId).toArray();
      // debugger;
    }

    // OTHER THREAD STUFF:
    let threadListChanged = false;
    await db.transaction('rw', db.threads, async tx => {
      let thread = await tx.table("threads").get(threadId);
      let changed = false;
      if(receivedData.thread?.userCharacter) {
        applyObjectOverrides({object:thread.userCharacter, overrides:receivedData.thread.userCharacter});
        changed = true;
        characterNamesPossiblyChanged = true;
      }
      if(receivedData.thread?.systemCharacter) {
        applyObjectOverrides({object:thread.systemCharacter, overrides:receivedData.thread.systemCharacter});
        changed = true;
        characterNamesPossiblyChanged = true;
      }
      if(receivedData.thread?.character) {
        applyObjectOverrides({object:thread.character, overrides:receivedData.thread.character});
        changed = true;
        characterNamesPossiblyChanged = true;
      }
      if(receivedData.thread?.customData) {
        thread.customData = receivedData.thread.customData;
        changed = true;
      }
      if(receivedData.thread?.messageWrapperStyle) {
        thread.messageWrapperStyle = receivedData.thread.messageWrapperStyle;
        changed = true;
      }
      if(receivedData.thread?.name) {
        thread.name = receivedData.thread.name;
        threadListChanged = true;
        changed = true;
      }
      if(receivedData.thread?.shortcutButtons) {
        thread.shortcutButtons = receivedData.thread.shortcutButtons;
        threadShortcutButtonsPossiblyChanged = true;
        changed = true;
      }
      if(changed) {
        await tx.table("threads").put(thread);
      }
    });


    // CHARACTER updates:
    let characterKeysChanged = Object.keys(receivedData.character);
    for(let key in characterPropertiesVisibleToCustomCode) {
      let k = characterPropertiesVisibleToCustomCode[key]; // since "public api" naming is different to db naming
      if(characterKeysChanged.includes(k)) {
        if(key === "customCode" && threadCharacter.customCode !== receivedData.character.customCode) {
          // custom code has changed, so we need to reload the iframe
          await createNewCustomCodeIframeForThread(threadId);
        }

        if(k === "shortcutButtons") {
          let shortcutButtons = receivedData.character[k];
          if(!Array.isArray(shortcutButtons) && shortcutButtons !== null && shortcutButtons !== undefined) {
            console.error("Invalid 'shortcutButtons' recieved from customCode iframe (must be an array, or undefined/null):", shortcutButtons);
            continue;
          }
        }

        threadCharacter[key] = receivedData.character[k];

        if(key === "avatar" || key === "name") {
          threadListChanged = true;
        }
        if(key === "name") {
          characterNamesPossiblyChanged = true;
        }
      }
    }

    await db.characters.put(threadCharacter);

    let renderPromises = [];

    if(threadListChanged) {
      renderPromises.push(renderThreadList());
    }

    if(characterNamesPossiblyChanged) { // because shortcut names can contain {{char}} and {{user}}
      threadShortcutButtonsPossiblyChanged = true;
    }

    if(characterNamesPossiblyChanged || characterKeysChanged.includes("messageInputPlaceholder")) {
      renderMessageInputPlaceholder(threadId, {thread, threadCharacter}); // no need to await this
    }

    if(threadShortcutButtonsPossiblyChanged) {
      renderPromises.push(renderShortcutButtons(thread));
    }

    await Promise.all(renderPromises);

  }


