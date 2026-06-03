    try {
      await navigator.storage.persist().then(async (persistent) => {
        if(persistent) {
          console.log("Storage will not be cleared except by explicit user action.");
          let storageNoticeEl = document.querySelector("#storageNoticeEl");
          if(storageNoticeEl) storageNoticeEl.innerHTML = `✅ Your browser has indicated that it will <u>not</u> clear the storage for this page without asking you first. You should still <u>backup your data regularly</u> using the export button since your browser may still delete your data without notice if your device's storage space is critically low.`;
        } else {
          console.warn("Storage may be cleared by the browser under storage pressure.");
          let storageNoticeEl = document.querySelector("#storageNoticeEl");
          if(storageNoticeEl) storageNoticeEl.innerHTML = `⚠️ Your browser has indicated that it <u>may</u> clear the storage for this page (without asking you first). You should <u>backup your data regularly</u> using the export button to prevent data loss.`;

          // Can't just use e.g. message count because they could have just imported a bunch of messages.
          let datesApplicationWasUsedInThisBrowser = (await db.misc.get("datesApplicationWasUsedInThisBrowser"))?.value ?? [];
          if(datesApplicationWasUsedInThisBrowser.length > 10 && Date.now()-Number(localStorage.timeLastSentBrowserStorageUnpersistedAlert || 0) > 1000*60*60*24*2) {
            localStorage.timeLastSentBrowserStorageUnpersistedAlert = Date.now();
            alert("Your browser is not allowing this page to store data in a way that is 100% permanent. Your browser may clear your chat data if your hard drive is nearly full, or for other reasons. If you're using a normal web browser, and you have ample storage space available, then the browser will eventually grant permission once it recognises that you are a regular user of this site (i.e. once you demonstrate that you trust this site), but until then, please be sure to backup/export your data often. If you're a regular user of this AI Chat app and you're still seeing this message after a week or so of use, and you have lots of storage available on your device, please submit a bug report using the feedback button.");
          }
        }
      });
    } catch(e) {
      console.error(e);
    }
  }

  let DOMPurify = window.DOMPurify; // just in case it's caused by a weird scoping bug

  // TODO: allow <style> when you work out how to scope it to the current message only - maybe just use a CSS parser and add .messageText prefix to selectors - https://github.com/jotform/css.js
  // TODO: allow sandboxed iframes in messages? so devs can add dynamic/interactive message content? I think they may even be able to communicate with their custom code iframe?!
  let domPurifyOptions = {
    ADD_TAGS: ['iframe'],
    FORBID_TAGS: ['style'],
    ADD_ATTR: ['onclick'], // WARNING: I'm using a hook (below) to make this safe. Be careful when editing this stuff.
  };
  DOMPurify.addHook('uponSanitizeAttribute', function (node, data) {
    if(data.attrName === "onclick") {
      node.dataset.onClickCode = data.attrValue;
      data.attrValue = "window.runCodeInCustomCodeIframe(this.dataset.onClickCode)";
    }
  });
  DOMPurify.addHook('afterSanitizeAttributes', function (node) {
    // DOMPurify deletes `target` attribute by default.
    // set all elements owning target to target=_blank
    if('target' in node) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener');
    }
  });

  const markedRenderer = new marked.Renderer();
  markedRenderer.code = (source, lang) => {
    const escapedSource = sanitizeHtml(source);
    if(lang) {
      return `<pre data-markdown-codeblock="${sanitizeHtml(lang)}">${escapedSource}</pre>`;
    } else {
      return `<pre data-markdown-codeblock>${escapedSource}</pre>`;
    }
  };
  marked.setOptions({
    renderer: markedRenderer,
  });

  window.onerror = function(error, url, lineNumber, columnNumber, errorObj) {
    console.error({error, url, lineNumber, columnNumber, errorObj});
    let errorMsg;
    if(typeof error === "object") {
      errorMsg = error.stack;
      if(!errorMsg) errorMsg = error.message;
    } else {
      errorMsg = error;
    }
    window.lastWindowOnErrorMessage = `${errorMsg} --- ${errorObj?.name || ""} --- ${errorObj?.message || ""}`;

    if(errorMsg.toLowerCase().includes("resizeobserver")) return false; // benign errors regarding resize observer not being able to deliver all notifications within a single animation frame due to lag or whatever

    alert(`Please report this error using the feedback button:\n\n${errorMsg} ${errorObj?.name || ""} ${errorObj?.message || ""}\n\nstack: ${errorObj?.stack}\n\nline: ${lineNumber}`);
    console.error("window.onerror handler:", {error, url, lineNumber, columnNumber, errorObj});
    if(errorObj?.stack.toLowerCase().includes("databaseclosederror")) {

    }
    return false;
  }

  // $.messageFeed.addEventListener("keydown", async function(e) {
  //   debugger;
  // });

  try {
    // This is so on mobile if you tap the textbox when you're scrolled to the bottom, then the virtual keyboard doesn't make it so you can no longer see the bottom message (as you're typing your response to that message)
    let lastMessageFeedHeight = messageFeed.offsetHeight;
    const resizeObserver = new ResizeObserver(entries => {
      const newHeight = entries[0].contentRect.height;
      const change = newHeight - lastMessageFeedHeight;
      // console.log(`Message feed height changed by ${change}px (${lastMessageFeedHeight}px → ${newHeight}px)`);
      if(change < 0) messageFeed.scrollTop -= change;
      lastMessageFeedHeight = newHeight;
    });
    resizeObserver.observe(messageFeed);
  } catch(e) {
    console.error("Couldn't add message feed resize observer.");
  }

  // polyfill for navigator.userActivation
  if(!navigator.userActivation) {
    navigator.userActivation = {hasBeenActive:false};
    let pageActivationClickHandler = (e) => {
      if(e.isTrusted) {
        navigator.userActivation.hasBeenActive = true;
        window.removeEventListener("click", pageActivationClickHandler);
      }
    }
    window.addEventListener("click", pageActivationClickHandler);
  }

  const sceneBackground = addBackgroundToElement($.chatBackgroundCtn);

  // dragula([$.messageFeed], {
  //   moves: function (el, source, handle, sibling) {
  //     return el.classList.contains("message") && handle.classList.contains("avatar");
  //   },
  //   revertOnSpill: true,
  // });

  prompt2.defaults = {
    backgroundColor: "var(--background)",
    borderColor: "var(--border-color)",
  };
  createFloatingWindow.defaults = {
    backgroundColor: "var(--background)",
    borderColor: "var(--border-color)",
  };

  let summariesWindow = createFloatingWindow({header:"Logs"});
  summariesWindow.hide();
  function addToDebugLog(html) {
    let ctn = document.createElement("div");
    ctn.innerHTML = html;
    ctn.style.cssText = "font-size:0.8rem; padding:0.5rem; solid var(--border-color); font-family:monospace;";
    let initialScrollTop = summariesWindow.bodyEl.scrollTop;
    summariesWindow.bodyEl.appendChild(ctn);

    setTimeout(function() {
      // wait for render and then scroll to bottom if it was near bottom previously
      if(Math.abs(initialScrollTop - summariesWindow.bodyEl.scrollTop) < 10) {
        summariesWindow.bodyEl.scrollTop = summariesWindow.bodyEl.scrollHeight;
      }
    }, 10);

    // delete earlier children if there are too many
    while(summariesWindow.bodyEl.children.length > 50) {
      summariesWindow.bodyEl.removeChild(summariesWindow.bodyEl.children[0]);
    }
  }

  // TODO: improve this heuristic. this isn't just about screen width - it's also about touch screens (no pointer hover events).
  // ALSO: This is a bit of a misnomer. It's used for stuff like determining how to show the right column, which is really about screen width, not mobile/touchscreen stuff.
  const isMobile = window.innerWidth < 700;

  if(isMobile) {
    document.body.classList.add("isMobile"); // to use in CSS selectors
  }

  // PERCHANCE EDIT:
