async confirmAsync(message, opts) =>
  if(!opts) opts = {};
  if(!message) message = "Are you sure?"
  return new Promise(resolve => {
    const overlay = Object.assign(document.createElement("div"), { tabIndex: 0 });
    overlay.style.cssText = `position:fixed;inset:0;z-index:99999999;display:grid;place-items:center;background-color:rgba(0,0,0,.65);font:16px/1.4 system-ui`;
    overlay.innerHTML = `<div style="text-align:left !important;max-width:min(97vw, 450px);padding:15px;border-radius:8px;background-color:light-dark(#fff,#222);color:light-dark(#000,#fff);box-shadow:0 2px 8px rgba(0,0,0,.2);">
      <p style="margin:0 0 20px;white-space:pre-wrap;">${message.replace(/[<>&]/g, m => ({"<":"&lt;","&":"&amp;",">":"&gt;"}[m]))}</p>
      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button ${opts.hideCancel ? "hidden" : ""} style="padding:6px 16px;border:1px solid light-dark(#ccc,#555);border-radius:6px;background-color:light-dark(#f6f6f6,#333);color:inherit;cursor:pointer;">Cancel</button>
        <button autofocus style="padding:6px 16px;border:none;border-radius:6px;background-color:light-dark(#1677ff,#2b87ff);color:#fff;cursor:pointer;">Okay</button>
      </div>
    </div>`;
    const [cancelBtn, okBtn] = overlay.querySelectorAll("button");
    const finish = val => { overlay.remove(); resolve(val); };
    cancelBtn.onclick = () => finish(false);
    okBtn.onclick = () => finish(true);
    overlay.onkeydown = e => {
      if (e.key === "Escape") finish(false);
      else if (e.key === "Enter") finish(true);
    };
    document.body.append(overlay);
    overlay.focus({ preventScroll: true }); // enables Esc handling immediately
  });

