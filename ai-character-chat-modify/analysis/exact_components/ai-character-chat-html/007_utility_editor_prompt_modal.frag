  window.applyCodeMirror5ToTextarea = async function(textarea, opts={}) { // opts.mode can be javascript, htmlmixed, etc.
    const defaultTheme = "material-darker";
    if(typeof CodeMirror === 'undefined') {
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://cdn.jsdelivr.net/npm/codemirror@5.65.13/lib/codemirror.min.css';
      document.head.appendChild(css);
      const style = document.createElement('style');
      style.textContent = `
        .CodeMirror { border: 1px solid #7f7f7f; height:auto; min-height:150px; cursor: text; }
        .CodeMirror-empty.CodeMirror-focused { outline: none; }
        .CodeMirror pre.CodeMirror-placeholder { color: #666; border-radius: 3px; }
        .CodeMirror-scroll { max-width: 100%; padding-bottom:150px; }
      `;
      document.head.appendChild(style);

      // NOTE: must load codemirror *before* plugins:
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/codemirror@5.65.17/lib/codemirror.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });

      let pluginPromises = [
        'https://cdn.jsdelivr.net/npm/codemirror@5.65.17/addon/display/placeholder.js',
      ].map(src => {
        return new Promise((resolve, reject) => {
          const script = document.createElement('script'); script.src = src;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      });
      await Promise.all(pluginPromises);
    }
    if(!CodeMirror.modes[opts.mode]) {
      await new Promise(resolve => {
        const script = document.createElement('script'); script.src = `https://cdn.jsdelivr.net/npm/codemirror@5.65.13/mode/${opts.mode}/${opts.mode}.js`;
        document.head.appendChild(script);
        script.onload = resolve;
      });
    }
    if(!document.querySelector(`link[href*="${opts.theme || defaultTheme}.min.css"]`)) { // Load theme
      await new Promise(resolve => {
        const themeCss = document.createElement('link');
        themeCss.rel = 'stylesheet';
        themeCss.href = `https://cdn.jsdelivr.net/npm/codemirror@5.65.13/theme/${opts.theme || defaultTheme}.min.css`;
        document.head.appendChild(themeCss);
        themeCss.onload = resolve;
      });
    }
    return CodeMirror.fromTextArea(textarea, {
      lineNumbers:true,
      mode:opts.mode,
      theme:opts.theme || defaultTheme,
      viewportMargin: Infinity, // along with height:auto on .CodeMirror, this makes editor auto-resize to content
    });
  }
  // document.body.innerHTML = `<textarea id="textareaEl"></textarea>`;
  // applyCodeMirror5ToTextarea(textareaEl, {mode:'htmlmixed', theme:'material-darker'});

  window.uploadDataUrlToTextInput = function(inputEl, opts = {}) {
    // Create a file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = opts.type || '*/*';
    fileInput.click();
    fileInput.addEventListener('change', function(event) {
      const file = event.target.files[0];
      if (!file) return; // User cancelled, do nothing
      const reader = new FileReader();
      reader.onload = async function(e) {
        // RESIZE + CENTER CROP:
        // const maxSize = 768;
        // let blob = await fetch(e.target.result).then(r => r.blob());
        // const imageBitmap = await createImageBitmap(blob);
        // const canvas = document.createElement('canvas');
        // const ctx = canvas.getContext('2d');
        // const size = Math.min(imageBitmap.width, imageBitmap.height);
        // const startX = (imageBitmap.width - size) / 2;
        // const startY = (imageBitmap.height - size) / 2;
        // const scaleFactor = Math.min(1, maxSize / size);
        // canvas.width = canvas.height = Math.floor(size * scaleFactor);
        // ctx.drawImage(imageBitmap, startX, startY, size, size, 0, 0, canvas.width, canvas.height);
        // inputEl.value = canvas.toDataURL('image/jpeg');

        // JUST RESIZE:
        const maxSize = 768;
        let blob = await fetch(e.target.result).then(r => r.blob());
        const imageBitmap = await createImageBitmap(blob);
        const scaleFactor = Math.min(1, maxSize / Math.max(imageBitmap.width, imageBitmap.height));
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = Math.floor(imageBitmap.width * scaleFactor);
        canvas.height = Math.floor(imageBitmap.height * scaleFactor);
        ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
        inputEl.value = canvas.toDataURL('image/jpeg');
        try { if(inputEl.onchange) inputEl.onchange() } catch(e) { console.error(e); }
        try { if(inputEl.oninput) inputEl.oninput() } catch(e) { console.error(e); }
      };
      reader.readAsDataURL(file);
    });
  }

  window.prompt2 = async function(specs, opts={}) {

    if(!opts.backgroundColor) opts.backgroundColor = prompt2.defaults.backgroundColor ?? (getComputedStyle(document.body).getPropertyValue('background-color')==="rgba(0, 0, 0, 0)" ? "#e8e8e8" : getComputedStyle(document.body).getPropertyValue('background-color'));
    if(!opts.borderColor) opts.borderColor = prompt2.defaults.borderColor ?? "#eaeaea";
    if(!opts.borderRadius) opts.borderRadius = prompt2.defaults.borderRadius ?? "3px";

    function sanitizeHtml(text) {
      if(text === undefined) text = "";
      text = text+"";
      return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    let textLineButtonIdToCallback = {};

    let ctn = document.createElement("div");
    let sections = "";
    let structuredSectionsI = 0;
    let i = 0;
    for(let [key, spec] of Object.entries(specs)) {
      if(spec.type == "select") {
        sections += `
          <section data-spec-key="${sanitizeHtml(key)}" class="structuredInputSection" data-is-hidden-extra="${spec.hidden === true ? "yes" : "no"}" style="${spec.hidden === true ? "display:none" : ""};">
            <div class="sectionLabel" style="${structuredSectionsI === 0 ? "margin-top:0;" : ""}">${spec.label}${spec.infoTooltip ? ` <span title="${sanitizeHtml(spec.infoTooltip)}" style="cursor:pointer;" onclick="alert(this.title)">ℹ️</span>` : ""}</div>
            <div style="display:flex;">
              <div style="flex-grow:1;">
                <select data-spec-key="${sanitizeHtml(key)}" value="${sanitizeHtml(spec.defaultValue)}" ${spec.disabled === true ? "disabled" : ""} style="width:100%;height:100%; padding:0.25rem;">${spec.options.map(o => `<option value="${sanitizeHtml(o.value)}" ${o.value === spec.defaultValue ? "selected" :""}>${sanitizeHtml(o.content) || sanitizeHtml(o.value)}</option>`).join("")}</select>
              </div>
            </div>
          </section>`;
        structuredSectionsI++;
      } else if(spec.type == "textLine") {
        let buttonHtml = ``;
        if(spec.dataUrlUploadButton) buttonHtml = `<button onclick="window.uploadDataUrlToTextInput(this.parentElement.querySelector('input'), {type:'${spec.dataUrlUploadButton}'})" style="margin-left:0.25rem; padding:0 0.25rem;">📂</button>`;
        if(spec.button) {
          let id = Math.random().toString();
          buttonHtml = `<button data-prompt2-text-line-button-id="${id}" style="margin-left:0.25rem; padding:0 0.25rem; white-space:pre;">${spec.button.label}</button>`;
          textLineButtonIdToCallback[id] = spec.button.onClick;
        }
        sections += `
          <section data-spec-key="${sanitizeHtml(key)}" class="structuredInputSection" data-is-hidden-extra="${spec.hidden === true ? "yes" : "no"}" style="${spec.hidden === true ? "display:none" : ""};">
            <div style="display:flex;">
              <div class="leftSideHtml" style="max-width:max-content; min-width:min-content;">${spec.leftSideHtml || ""}</div>
              <div style="flex-grow:1;">
                <div class="sectionLabel" style="${structuredSectionsI === 0 ? "margin-top:0;" : ""}">${spec.label}${spec.infoTooltip ? ` <span title="${sanitizeHtml(spec.infoTooltip)}" style="cursor:pointer;" onclick="alert(this.title)">ℹ️</span>` : ""}</div>
                <div style="display:flex;">
                  <div style="flex-grow:1;">
                    <input data-initial-focus="${spec.focus === true ? "yes" : "no"}" data-spec-key="${sanitizeHtml(key)}" ${spec.disabled === true ? "disabled" : ""} value="${sanitizeHtml(spec.defaultValue)}" style="width:100%;height:100%; border: 1px solid lightgrey; border-radius: 3px; padding: 0.25rem; ${spec.cssText || ""}" type="text" placeholder="${sanitizeHtml(spec.placeholder)}" ${spec.validationPattern ? `pattern="${sanitizeHtml(spec.validationPattern)}"` : ""} ${spec.disableSpellCheck ? `spellcheck="false"` : ``}>
                  </div>
                  ${buttonHtml}
                </div>
              </div>
            </div>
          </section>`;
        structuredSectionsI++;
      } else if(spec.type == "text") {
        sections += `
          <section data-spec-key="${sanitizeHtml(key)}" class="structuredInputSection" data-is-hidden-extra="${spec.hidden === true ? "yes" : "no"}" style="${spec.hidden === true ? "display:none" : ""};">
            <div class="sectionLabel" style="${structuredSectionsI === 0 ? "margin-top:0;" : ""}">${spec.label}${spec.infoTooltip ? ` <span title="${sanitizeHtml(spec.infoTooltip)}" style="cursor:pointer;" onclick="alert(this.title)">ℹ️</span>` : ""}</div>
            <div style="display:flex;">
              <div style="flex-grow:1; max-width:100%;">
                <textarea ${spec.subType === "javascript" ? `data-is-javascript-editor="true"` : ``} data-initial-focus="${spec.focus === true ? "yes" : "no"}" data-spec-key="${sanitizeHtml(key)}" ${spec.height === "fit-content" ? `data-height="fit-content"` : ``} ${spec.disabled === true ? "disabled" : ""} style="width:100%; ${spec.height === "fit-content" ? "" : `height:${sanitizeHtml(spec.height)}`}; min-height:${spec.minHeight ?? "4rem"}; max-height:${spec.maxHeight ?? "50vh"}; border: 1px solid lightgrey; border-radius: 3px; padding:0.25rem; resize:vertical; ${spec.cssText || ""};" type="text" placeholder="${sanitizeHtml(spec.placeholder)}" ${spec.disableSpellCheck ? `spellcheck="false"` : ``}>${sanitizeHtml(spec.defaultValue)}</textarea>
              </div>
            </div>
          </section>`;
        structuredSectionsI++;
      } else if(spec.type == "buttons") {
        sections += `
          <section data-spec-key="${sanitizeHtml(key)}" class="structuredInputSection" data-is-hidden-extra="${spec.hidden === true ? "yes" : "no"}" style="${spec.hidden === true ? "display:none" : ""};">
            <div class="sectionLabel" style="${structuredSectionsI === 0 ? "margin-top:0;" : ""}">${spec.label ?? ""}${spec.infoTooltip ? ` <span title="${sanitizeHtml(spec.infoTooltip)}" style="cursor:pointer;" onclick="alert(this.title)">ℹ️</span>` : ""}</div>
            <div style="display:flex;">
              <div style="flex-grow:1; display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 200px)); gap: 1rem; justify-content:center;">
                ${spec.buttons.map(b => `<button ${b.disabled === true ? "disabled" : ""} style="width:max-content; justify-self:center; align-self:center; border: 1px solid lightgrey; border-radius: 3px; padding:0.25rem; ${b.cssText || ""};">${b.text}</button>`).join(" ")}
              </div>
            </div>
          </section>`;
        structuredSectionsI++;
      } else if(spec.type == "none") {
        sections += `
          <section data-spec-key="${sanitizeHtml(key)}" data-is-hidden-extra="${spec.hidden === true ? "yes" : "no"}" data-requires-element-insert="${typeof spec.html === "string" ? "no" : "yes"}" style="${spec.hidden === true ? "display:none" : ""};">
            ${typeof spec.html === "string" ? spec.html : ""}
          </section>`;
      }
      i++;
    }
    ctn.innerHTML = `
      <div class="promptModalInnerContainer" style="background:rgba(0,0,0,0.7); position:fixed; top:0; left:0; right:0; bottom:0; z-index:9999999; display:flex; justify-content:center; color:inherit; font:inherit; padding:0.5rem;">
        <div style="width:600px; max-width:100%; background:${sanitizeHtml(opts.backgroundColor)}; height: min-content; padding:1rem; border:1px solid ${opts.borderColor}; border-radius:${opts.borderRadius}; box-shadow: 0px 1px 10px 3px rgb(130 130 130 / 24%); max-height: calc(100% - 1rem);display: flex; flex-direction: column;">
          <div class="sectionsContainer" style="overflow:auto;">
            ${sections}
            ${Object.values(specs).find(s => s.hidden === true) ? `
            <div style="text-align:center; margin-top:1rem; display:flex; justify-content:center;">
              <button class="showHidden" style="padding: 0.25rem;">${opts.showHiddenInputsText || "Show hidden inputs"}</button>
            </div>
            ` : ""}
          </div>
          <div style="text-align:center; margin-top:1rem; ${opts.cancelButtonText === null ? "" : `display:flex; justify-content:space-between;`}">
            ${opts.cancelButtonText === null ? "" : `<button class="cancel" style="padding: 0.25rem;">${opts.cancelButtonText ?? "cancel"}</button>`}
            <button class="submit" style="padding: 0.25rem; ${opts.submitButtonCssText || ""};">${opts.submitButtonText || "submit"}</button>
          </div>
        </div>
        <style>
          .promptModalInnerContainer .sectionsContainer > section .sectionLabel {
            margin:0.125rem 0;
            font-size:85%;
          }

          .promptModalInnerContainer .sectionsContainer > section .sectionLabel,
          .promptModalInnerContainer .sectionsContainer .leftSideHtml {
            margin-top: 1rem;
          }

          .promptModalInnerContainer .sectionsContainer input:invalid {
            background-color: lightpink;
          }
          .promptModalInnerContainer .sectionsContainer {
            -ms-overflow-style: none;  /* Internet Explorer 10+ */
            scrollbar-width: none;  /* Firefox */
          }
          .promptModalInnerContainer .sectionsContainer::-webkit-scrollbar {
            display: none;  /* Safari and Chrome */
          }
          .promptModalInnerContainer .sectionsContainer.scrollFade {
            padding-bottom: 30px;
            -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 30px), #ffffff00 100%);
            mask-image: linear-gradient(to bottom, black calc(100% - 30px), #ffffff00 100%);
          }
          .promptModalInnerContainer * {
            box-sizing: border-box;
          }
        </style>
      </div>
    `;
    document.body.appendChild(ctn);

    function updateFitHeights() { // settimeout to ensure rendered
      ctn.querySelectorAll("textarea[data-height=fit-content]").forEach(el => {
        let minHeight = el.offsetHeight; // textareas will always have min-height set, so we can use that via offsetHeight
        el.style.height = Math.max(minHeight, (el.scrollHeight+10)) + "px";
      });
    }

    setTimeout(updateFitHeights, 5);

    for(let id in textLineButtonIdToCallback) {
      ctn.querySelector(`button[data-prompt2-text-line-button-id='${id}']`).onclick = function() {
        textLineButtonIdToCallback[id]({inputEl:this.parentElement.querySelector('input')});
      }
    }

    if(ctn.querySelector("[data-is-javascript-editor='true']")) {
      let textareaEl = ctn.querySelector("[data-is-javascript-editor='true']");
      let observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(async entry => {
          if(entry.isIntersecting) {
            observer.disconnect();
            let editor = await window.applyCodeMirror5ToTextarea(textareaEl, {mode:"javascript"});
            editor.getWrapperElement().addEventListener("click", function() {
              editor.focus(); // by default it seems that you need to click on a line that 'exists' to focus the editor (which initially is only the first line), so this fixes that
            });
            Object.defineProperty(textareaEl, 'value', {
              get: function() {
                return editor.getValue();
              },
              set: function(newValue) {
                editor.setValue(newValue);
              }
            });
          }
        });
      });
      observer.observe(textareaEl);
    }

    if(ctn.querySelector("button.showHidden")) {
      ctn.querySelector("button.showHidden").onclick = () => {
        ctn.querySelectorAll('.sectionsContainer [data-is-hidden-extra=yes]').forEach(el => {
          el.style.display='';
          el.dataset.isHiddenExtra = "no";
        });
        ctn.querySelector("button.showHidden").remove();
        updateFitHeights();
        updateInputVisibilies();
      };
    }

    // insert non-string HTML elements for type==html specs
    let elementObjects = Object.values(specs).filter(s => s.html && typeof s.html !== "string").map(s => s.html);
    ctn.querySelectorAll('.sectionsContainer [data-requires-element-insert=yes]').forEach((el, i) => {
      el.append(elementObjects[i]);
    });


    // add onclick handlers for type==button specs
    let buttonSpecKeys = Object.entries(specs).filter(([key, spec]) => spec.type === "buttons").map(([key, spec]) => key);
    for(let key of buttonSpecKeys) {
      ctn.querySelectorAll(`.sectionsContainer [data-spec-key=${key}]`).forEach(el => {
        let buttonEls = [...el.querySelectorAll("button")];
        for(let i = 0; i < buttonEls.length; i++) {
          buttonEls[i].onclick = specs[key].buttons[i].onClick;
        }
      });
    }


    try {
      // add oninput and onchange handlers for all inputs that can have them
      for(let [key, spec] of Object.entries(specs)) {
        if(!specs[key].onInput && !specs[key].onChange) continue;

        if(spec.type === "textLine") {
          let el = ctn.querySelector(`.structuredInputSection[data-spec-key=${key}] input`);
          if(specs[key].onInput) el.oninput = specs[key].onInput;
          if(specs[key].onChange) el.onchange = specs[key].onChange;
        }
        if(spec.type === "text") {
          let el = ctn.querySelector(`.structuredInputSection[data-spec-key=${key}] textarea`);
          if(specs[key].onInput) el.oninput = specs[key].onInput;
          if(specs[key].onChange) el.onchange = specs[key].onChange;
        }
        if(spec.type === "select") {
          let el = ctn.querySelector(`.structuredInputSection[data-spec-key=${key}] select`);
          if(specs[key].onInput) el.oninput = specs[key].onInput;
          if(specs[key].onChange) el.onchange = specs[key].onChange;
        }
      }
    } catch(e) { console.error(e); }

    setTimeout(() => {
      // add scrollFade if sectionsContainer has scroll
      let sectionsContainerEl = ctn.querySelector(".promptModalInnerContainer .sectionsContainer");
      if(sectionsContainerEl.scrollHeight > sectionsContainerEl.offsetHeight) {
        sectionsContainerEl.classList.add("scrollFade");
      }
      // focus
      let focusEl = ctn.querySelector(".promptModalInnerContainer .sectionsContainer [data-initial-focus=yes]");
      if(!focusEl) focusEl = [...ctn.querySelectorAll(".promptModalInnerContainer input, .promptModalInnerContainer textarea")][0];
      if(focusEl) {
        focusEl.focus();
        focusEl.selectionStart = focusEl.value.length;
      }
    }, 5);

    function getAllValues() {
      let values = {};
      for(let el of [...ctn.querySelectorAll("[data-spec-key]")]) {
        if(el.tagName === "INPUT") {
          if(el.type == "file") {
            values[el.dataset.specKey] = el.files;
          } else {
            values[el.dataset.specKey] = el.value;
          }
        } else if(el.tagName === "TEXTAREA") {
          values[el.dataset.specKey] = el.value;
        } else if(el.tagName === "SELECT") {
          values[el.dataset.specKey] = el.value;
        }
      }
      return values;
    }

    // a spec can have a `show` function which determines whether it's shown based on the values of the other inputs
    function updateInputVisibilies() {
      const values = getAllValues();
      for(const el of [...ctn.querySelectorAll("[data-spec-key]")]) {
        const showFn = specs[el.dataset.specKey].show;
        if(!showFn) continue;
        if(showFn(values)) {
          el.closest('section').style.display = "";
        } else {
          el.closest('section').style.display = "none";
        }

        // the "show advanced" hidden-ness overrides the show() function
        if(el.closest("section").dataset.isHiddenExtra === "yes") {
          el.closest("section").style.display = "none";
        }
      }
    }
    updateInputVisibilies();
    for(const el of [...ctn.querySelectorAll("[data-spec-key]")]) {
      el.addEventListener("input", updateInputVisibilies);
    }

    let promptResolver;

    if(opts.controls) {
      // add a proxy to the controls object so that we can read and write spec values from the outside
      opts.controls.data = new Proxy({}, {
        set: function(obj, prop, value) {
          let el = ctn.querySelector(`[data-spec-key=${prop}]`);
          if(!el) return true;
          el.value = value;
          updateInputVisibilies();
          return true;
        },
        get: function(obj, prop) {
          let el = ctn.querySelector(`[data-spec-key=${prop}]`);
          if(!el) return undefined;
          return el.value;
        }
      });
      opts.controls.submit = function() {
        ctn.querySelector("button.submit").click();
      };
      opts.controls.cancel = function() {
        promptResolver(null);
      };
    }

    let values = await new Promise((resolve) => {
      promptResolver = resolve;
      ctn.querySelector("button.submit").onclick = () => {
        let values = getAllValues();
        resolve(values);
      };
      if(ctn.querySelector("button.cancel")) {
        ctn.querySelector("button.cancel").onclick = () => {
          resolve(null);
        };
      }
    });
    ctn.remove();
    return values;
  }
  prompt2.defaults = {};
</script>
