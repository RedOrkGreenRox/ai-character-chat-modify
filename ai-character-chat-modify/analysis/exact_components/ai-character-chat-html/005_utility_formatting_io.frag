  window.sanitizeHtml = function(text) {
    if(text === undefined) text = "";
    text = text+"";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;").replace(/\n/g, "&#10;").replace(/\r/g, "&#13;");
  }




  speechSynthesis.getVoices(); // this is needed to populate the list of voices in (some?) browsers

  window.textToSpeech = function({text, voiceName}) {
    return new Promise((resolve, reject) => {
      const voices = speechSynthesis.getVoices();
      const voice = voices.find(v => v.name === voiceName);
      const utterance = new SpeechSynthesisUtterance();
      utterance.text = text;
      utterance.voice = voice;
      utterance.rate = 1.3;
      utterance.pitch = 1.0;
      utterance.onend = function() {
        resolve();
      };
      utterance.onerror = function(e) {
        reject(e);
      };
      speechSynthesis.speak(utterance);
    });
  }


  window.sha256Text = async function(text) {
    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }


  window.dedent = function(str) {
    // find the first non-whitespace character on each line, and then we find the minimum indent of all lines
    // then we remove that many spaces from the beginning of each line
    let match = str.match(/^[ \t]*(?=\S)/gm);
    if (!match) {
      return str;
    }
    let indent = Math.min(...match.map(x => x.length));
    let re = new RegExp(`^[ \\t]{${indent}}`, 'gm');
    let result = indent > 0 ? str.replace(re, '') : str;
    return result.trim(); // trim because with indented multi-line strings, the first line will almost always have a newline at the beginning, assuming regular code formatting
  }


  window.downloadTextOrBlob = function(textOrBlob, filename) {
    let blob;
    if(typeof textOrBlob === "string") blob = new Blob([textOrBlob], {type: "application/json"});
    else blob = textOrBlob;

    const dataUri = URL.createObjectURL(blob);
    let linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", filename);
    linkElement.click();
    linkElement.remove();
    setTimeout(() => URL.revokeObjectURL(dataUri), 30*1000);
  }


  window.cosineDistance = function(vector1, vector2) {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    for(let i=0; i<vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      norm1 += vector1[i] * vector1[i];
      norm2 += vector2[i] * vector2[i];
    }
    return 1 - (dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2)));
  }

  window.createLoadingModal = function(initialContent, parentElement) {
    if(!parentElement) parentElement = document.body;
    let loadingModalCtn = document.createElement("div");
    loadingModalCtn.innerHTML = `<style>
      .loadingModalCtn-856246272937 {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0,0,0,0.5);
        z-index: 100;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 1rem;
        z-index: 99999999;
      }
      .loadingModalContent-856246272937 {
        background-color: white;
        border-radius: 3px;
        background-color: var(--background);
        border-radius: var(--border-radius);
        padding: 1rem;
        text-align: center;
        box-shadow: 0px 1px 10px 3px rgb(130 130 130 / 24%);
      }
    </style>`
    let contentEl = document.createElement("div");
    contentEl.classList.add("loadingModalContent-856246272937");
    contentEl.innerHTML = initialContent || "";
    loadingModalCtn.appendChild(contentEl);
    loadingModalCtn.classList.add("loadingModalCtn-856246272937");
    parentElement.appendChild(loadingModalCtn);
    return {
      updateContent: function(content) {
        contentEl.innerHTML = content;
      },
      delete: function() {
        loadingModalCtn.remove();
      },
    }
  }




  // this function crawls deeply through the overrides object and applies values to `obj` in the same "position" within the object - either overriding existing values, or creating new key/value pairs if they don't exist
