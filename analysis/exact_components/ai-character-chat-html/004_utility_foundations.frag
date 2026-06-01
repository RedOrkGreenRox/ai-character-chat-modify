<script>
  const aiTextPluginMetaObject = root.aiTextPlugin({getMetaObject:true});
  window.countTokens = aiTextPluginMetaObject.countTokens;
  window.idealMaxContextTokens = aiTextPluginMetaObject.idealMaxContextTokens;

  // TODO: swipe animation - slide it all the way off the screen, and slide a "..." dummy onto the screen

  window.$$ = (selector) => document.querySelectorAll(selector);

  // add a proxy to $ that captures function calls and has a getter for ids:
  window.$ = new Proxy(function(){}, {
    get: (target, prop) => {
      if(/^[a-zA-Z0-9]+$/.test(prop)) {
        return document.querySelector(`#${prop}`);
      }
    },
    apply: (target, thisArg, args) => {
      return document.querySelector(args[0]);
    }
  });

  window.showEl = (el) => {
    if(el.style.display !== 'none') return;
    el.style.display = el.dataset.originalDisplayValue || '';
  };
  window.hideEl = (el) => {
    if(el.style.display === 'none') return;
    el.dataset.originalDisplayValue = el.style.display;
    el.style.display = 'none';
  };

  window.delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


  window.createFloatingWindow = function(opts={}) {
    const defaults = { backgroundColor: getComputedStyle(document.body).getPropertyValue('background-color'), borderColor: "#eaeaea", borderRadius: "3px", initialWidth: 500, initialHeight: 300 };
    Object.keys(defaults).forEach(key => { if (!opts[key]) opts[key] = createFloatingWindow.defaults?.[key] ?? defaults[key]; });

    let initialHeightStr = typeof opts.initialHeight === "number" ? opts.initialHeight+"px" : opts.initialHeight;
    let initialWidthStr = typeof opts.initialWidth === "number" ? opts.initialWidth+"px" : opts.initialWidth;

    let left = Math.max(0, (window.innerWidth - opts.initialWidth) / 2)
    let top = opts.top ?? 50;
    let windowEl = document.createElement("div");
    windowEl.innerHTML = `
      <div class="window" style="background-color:${opts.backgroundColor}; border:1px solid ${opts.borderColor}; border-radius:${opts.borderRadius}; width:${initialWidthStr};height:${initialHeightStr};z-index:999999999;position:fixed; top:${top}px; left:${left}px; box-shadow:0px 1px 10px 3px rgb(130 130 130 / 24%); display:flex; flex-direction:column;">
        <div class="header" style="user-select:none; cursor:move; border-bottom: 1px solid var(--border-color);display: flex;justify-content: space-between; padding:0.25rem;">
          <div>${opts.header || ""}</div>
          <div class="closeButton" style="min-width: 1.3rem; background: #9e9e9e; display: flex; justify-content: center; align-items: center; cursor: pointer; border-radius:${opts.borderRadius};">✖</div>
        </div>
        <div class="body" style="overflow:auto; width:100%; height:100%;">${opts.body || ""}</div>
        <div class="cornerResizeHandle" style="position:absolute; bottom:0; right:0; cursor:se-resize; user-select:none;width: 0; height: 0; border-style: solid; border-width: 0 0 10px 10px; border-color: transparent transparent #9e9e9e transparent; z-index: 2;"></div>
        <div class="leftResizeBar" style="position:absolute; top:0; left:0; width:5px; height:100%; cursor:ew-resize; z-index: 1;"></div>
        <div class="rightResizeBar" style="position:absolute; top:0; right:0; width:5px; height:100%; cursor:ew-resize; z-index: 1;"></div>
      </div>
    `;
    windowEl = windowEl.firstElementChild;

    const elements = ['header', 'body', 'closeButton', 'cornerResizeHandle', 'leftResizeBar', 'rightResizeBar'].reduce((acc, el) => ({ ...acc, [el]: windowEl.querySelector(`.${el}`) }), {});

    let dragState = { active: false, x: 0, y: 0 };
    let resizeState = { active: null, startX: 0, startWidth: 0, startLeft: 0 };

    const handlers = {
      mousedown: (e) => { dragState = { active: true, x: e.clientX, y: e.clientY }; },
      mousemove: (e) => {
        if (dragState.active) {
          const dx = e.clientX - dragState.x, dy = e.clientY - dragState.y;
          const newTop = Math.max(0, Math.min(parseInt(windowEl.style.top) + dy, window.innerHeight - windowEl.offsetHeight));
          const newLeft = Math.max(0, Math.min(parseInt(windowEl.style.left) + dx, window.innerWidth - windowEl.offsetWidth));
          windowEl.style.top = `${newTop}px`; windowEl.style.left = `${newLeft}px`;
          dragState.x = e.clientX; dragState.y = e.clientY;
        }
        if (resizeState.active) {
          const dx = e.clientX - resizeState.startX;
          if (resizeState.active === 'left') {
            const newWidth = Math.max(200, resizeState.startWidth - dx);
            const newLeft = resizeState.startLeft + (resizeState.startWidth - newWidth);
            if (newLeft >= 0 && newLeft + newWidth <= window.innerWidth) {
              windowEl.style.width = `${newWidth}px`; windowEl.style.left = `${newLeft}px`;
            }
          } else if (resizeState.active === 'right') {
            const newWidth = Math.max(200, resizeState.startWidth + dx);
            if (resizeState.startLeft + newWidth <= window.innerWidth) windowEl.style.width = `${newWidth}px`;
          } else if (resizeState.active === 'corner') {
            const dy = e.clientY - resizeState.startY;
            let newWidth = Math.min(resizeState.startWidth + dx, window.innerWidth - parseInt(windowEl.style.left));
            let newHeight = Math.min(resizeState.startHeight + dy, window.innerHeight - parseInt(windowEl.style.top));
            if(newWidth < 200) newWidth = 200;
            if(newHeight < 200) newHeight = 200;
            windowEl.style.width = `${newWidth}px`; windowEl.style.height = `${newHeight}px`;
          }
        }
      },
      mouseup: () => { dragState.active = false; resizeState.active = null; },
      startResize: (e, side) => {
        resizeState = {
          active: side,
          startX: e.clientX,
          startY: e.clientY,
          startWidth: parseInt(windowEl.style.width, 10),
          startHeight: parseInt(windowEl.style.height, 10),
          startLeft: parseInt(windowEl.style.left, 10)
        };
      }
    };

    elements.header.addEventListener('mousedown', handlers.mousedown);
    elements.leftResizeBar.addEventListener('mousedown', (e) => handlers.startResize(e, 'left'));
    elements.rightResizeBar.addEventListener('mousedown', (e) => handlers.startResize(e, 'right'));
    elements.cornerResizeHandle.addEventListener('mousedown', (e) => handlers.startResize(e, 'corner'));

    ['mousemove', 'mouseup', 'mouseleave', 'contextmenu'].forEach(event => document.documentElement.addEventListener(event, handlers[event] || handlers.mouseup));

    (opts.appendTo || document.body).appendChild(windowEl);

    const api = {
      ctn: windowEl,
      headerEl: elements.header,
      bodyEl: elements.body,
      hide: () => { windowEl.style.opacity = "0"; windowEl.style.pointerEvents = "none"; },
      show: () => { windowEl.style.opacity = "1"; windowEl.style.pointerEvents = "auto"; },
      delete: () => {
        windowEl.remove();
        ['mousemove', 'mouseup', 'mouseleave', 'contextmenu'].forEach(event => document.documentElement.removeEventListener(event, handlers[event] || handlers.mouseup));
      }
    };

    elements.closeButton.addEventListener("click", opts.closeButtonAction === "hide" ? api.hide : api.delete);

    return api;
  }


