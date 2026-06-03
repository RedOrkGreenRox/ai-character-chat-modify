  window.applyObjectOverrides = function({object, overrides}) {
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


  window.objectKeysAndTypesAreValid = function(obj, validStructure, opts={}) { // if you don't set opts.requireAllKeys=true, it allows missing keys in the obj
    if (typeof obj !== 'object' || obj === null || typeof validStructure !== 'object' || validStructure === null) {
      return false;
    }

    const objKeys = Object.keys(obj);
    const structureKeys = Object.keys(validStructure);

    if (opts.requireAllKeys && objKeys.length !== structureKeys.length) {
      return false;
    }

    for (let key of objKeys) {
      if (!structureKeys.includes(key)) {
        return false;
      }

      const objValue = obj[key];
      const structureValue = validStructure[key];

      if (typeof objValue !== typeof structureValue) {
        return false;
      }

      if (typeof objValue === 'object' && !objectKeysAndTypesAreValid(objValue, structureValue, {requireAllKeys:opts.requireAllKeys})) {
        return false;
      }
    }

    return true;
  }



  window.addBackgroundToElement = function(element) {
    // note: assumes that `element` has `position:relative;` so the position:absolute of the media elements works as expected
    const media = [
      { type: 'video', el: document.createElement('video') },
      { type: 'video', el: document.createElement('video') },
      { type: 'img', el: document.createElement('img') },
      { type: 'img', el: document.createElement('img') },
    ];
    let currentMedia = 0;

    media.forEach(item => {
      const { el } = item;
      el.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 1s;';
      if(item.type === 'video') {
        el.muted = true;
        el.loop = true;
      }
      element.appendChild(el);
    });

    function isVideoUrl(url) {
      return /\.(mp4|webm|ogg)$/i.test(url);
    }

    function getMediaType(url) {
      return isVideoUrl(url) ? 'video' : 'img';
    }

    let currentUrl = null;

    return {
      get currentUrl() { return currentUrl; },
      change: (url) => {
        currentUrl = url;
        if(url === null) {
          media.forEach(({ el }) => {
            el.style.opacity = 0;
          });
          return;
        }

        const nextMediaIndex = (currentMedia + 1) % 4;
        const mediaType = getMediaType(url);
        const nextMedia = media.find((item, index) => index !== currentMedia && item.type === mediaType);

        if(mediaType === 'video') {
          nextMedia.el.src = url;
          nextMedia.el.play();
          nextMedia.el.addEventListener('canplay', () => {
            media[currentMedia].el.style.opacity = 0;
            nextMedia.el.style.opacity = 1;
            currentMedia = media.indexOf(nextMedia);
          }, { once: true });
        } else {
          nextMedia.el.src = url;
          nextMedia.el.addEventListener('load', () => {
            media[currentMedia].el.style.opacity = 0;
            nextMedia.el.style.opacity = 1;
            currentMedia = media.indexOf(nextMedia);
          }, { once: true });
        }
      },
      filter: (filterValue) => {
        media.forEach(({ el }) => {
          el.style.filter = filterValue ?? "";
        });
      },
      destroy: () => {
        media.forEach(({ el }) => {
          el.remove();
        });
      },
    };
  }


  window.importStylesheet = function(src) {
    return new Promise(function (resolve, reject) {
      let link = document.createElement('link');
      link.href = src;
      link.rel = 'stylesheet';
      link.onload = () => resolve(link);
      link.onerror = () => reject(new Error(`Style load error for ${src}`));
      document.head.append(link);
    });
  }


  window.htmlToElement = function(html) {
    var template = document.createElement('template');
    html = html.trim();
    template.innerHTML = html;
    return template.content.firstChild;
  }


  // this function avoids maximum-string-length errors by not using JSON.stringify
  window.jsonToBlob = function(json) {
    const textEncoder = new TextEncoder();
    const seen = new WeakSet();
    let buffer = new Uint8Array(1024 * 1024); // Start with 1MB buffer
    let position = 0;
    let stringBuffer = '';

    function ensureCapacity(additionalBytes) {
      if (position + additionalBytes > buffer.length) {
        let newBufferSize = Math.max(Math.round(buffer.length * 1.5), position + additionalBytes);
        const newBuffer = new Uint8Array(newBufferSize);
        newBuffer.set(buffer);
        buffer = newBuffer;
        console.log(`jsonToBlob new buffer size: ${newBufferSize}`);
      }
    }

    function writeToBuffer(str) {
      const encoded = textEncoder.encode(str);
      ensureCapacity(encoded.length);
      buffer.set(encoded, position);
      position += encoded.length;
    }

    function flushStringBuffer() {
      if (stringBuffer.length > 0) {
        writeToBuffer(stringBuffer);
        stringBuffer = '';
      }
    }

    function processValue(value) {
      if (seen.has(value)) {
        throw new TypeError("Converting circular structure to JSON");
      }

      if (value && typeof value.toJSON === "function") {
        value = value.toJSON();
      }

      if (typeof value === 'object' && value !== null) {
        seen.add(value);

        const isArray = Array.isArray(value);
        stringBuffer += isArray ? '[' : '{';

        let first = true;
        for (const [key, val] of Object.entries(value)) {
          if (!first) stringBuffer += ',';
          first = false;

          if (!isArray) {
            stringBuffer += JSON.stringify(key) + ':';
          }

          processValue(val);
        }

        stringBuffer += isArray ? ']' : '}';
      } else if (typeof value === 'function' || typeof value === 'undefined') {
        stringBuffer += 'null';
      } else {
        stringBuffer += JSON.stringify(value);
      }

      // Flush the string buffer if it gets too large
      if (stringBuffer.length > 1024) {
        flushStringBuffer();
      }
    }

    processValue(json);
    flushStringBuffer();

    return new Blob([buffer.subarray(0, position)]);
  }

