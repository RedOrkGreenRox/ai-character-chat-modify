
// ============================================
// AI CHARACTER CHAT — MOBILE-FIRST UI MODULE
// ============================================
// 1) Patches createFloatingWindow to support touch via Pointer Events.
// 2) On phones (small viewport), opens windows full-screen with a
//    visible Back/Close header and no drag/resize.
// 3) Converts the existing /menu into a view-stack so sub-menus
//    (Policy, Files, Commands) replace the current view instead of
//    spawning a second modal on top.
// 4) Reimplements __aeShowBasePolicyModal as an embedded view (no prompt2),
//    so opening Base Policy from /menu does NOT stack two modals.
// ============================================

(function() {
  if (window.__aeMobileUiInstalled) return;
  window.__aeMobileUiInstalled = true;

  // ---------- helpers ----------
  function __aeIsMobile() {
    try {
      let narrow = Math.min(window.innerWidth, window.innerHeight) < 600;
      let ua = /Mobi|Android|iPhone|iPad|iPod|Phone/i.test(navigator.userAgent || '');
      return narrow || ua;
    } catch(e) { return false; }
  }
  window.__aeIsMobile = __aeIsMobile;

  // ---------- (1) patch createFloatingWindow for touch + mobile fullscreen ----------
  if (typeof window.createFloatingWindow === 'function') {
    let __aeOriginalCFW = window.createFloatingWindow;
    window.createFloatingWindow = function(opts) {
      opts = opts || {};
      let mobile = __aeIsMobile();
      if (mobile) {
        // On phones, make the window fullscreen, predictable and finger-friendly.
        opts.initialWidth = window.innerWidth;
        opts.initialHeight = window.innerHeight;
        opts.top = 0;
      }
      let win = __aeOriginalCFW(opts);

      try {
        let el = win.ctn;
        if (mobile) {
          // Force fullscreen positioning regardless of inline styles set by the original.
          el.style.left = '0px';
          el.style.top = '0px';
          el.style.width = '100vw';
          el.style.height = '100vh';
          el.style.maxWidth = '100vw';
          el.style.maxHeight = '100vh';
          el.style.borderRadius = '0';
          // Hide resize handles — they don't make sense fullscreen and they steal taps.
          let rh = el.querySelectorAll('.cornerResizeHandle,.leftResizeBar,.rightResizeBar');
          rh.forEach(function(r) { r.style.display = 'none'; });
          // Bigger close button on mobile.
          let closeBtn = el.querySelector('.closeButton');
          if (closeBtn) {
            closeBtn.style.minWidth = '2.4rem';
            closeBtn.style.minHeight = '2.4rem';
            closeBtn.style.fontSize = '1.2rem';
            closeBtn.setAttribute('aria-label', 'Close');
          }
          let header = el.querySelector('.header');
          if (header) {
            header.style.padding = '0.6rem 0.5rem';
            header.style.fontSize = '1.05rem';
            header.style.cursor = 'default'; // no dragging on mobile
          }
          let body = el.querySelector('.body');
          if (body) {
            body.style.WebkitOverflowScrolling = 'touch';
            body.style.overscrollBehavior = 'contain';
          }
        } else {
          // On desktop: add touch support via Pointer Events so the window
          // is still usable on touch laptops / tablets with mouse.
          let header = el.querySelector('.header');
          let corner = el.querySelector('.cornerResizeHandle');
          let leftB = el.querySelector('.leftResizeBar');
          let rightB = el.querySelector('.rightResizeBar');

          let drag = null;
          let resize = null;

          function onPointerDownHeader(e) {
            if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
            drag = { x: e.clientX, y: e.clientY };
            try { header.setPointerCapture(e.pointerId); } catch(_) {}
            e.preventDefault();
          }
          function onPointerMoveHeader(e) {
            if (!drag) return;
            let dx = e.clientX - drag.x, dy = e.clientY - drag.y;
            let newTop  = Math.max(0, Math.min(parseInt(el.style.top)+dy,  window.innerHeight - el.offsetHeight));
            let newLeft = Math.max(0, Math.min(parseInt(el.style.left)+dx, window.innerWidth  - el.offsetWidth));
            el.style.top  = newTop  + 'px';
            el.style.left = newLeft + 'px';
            drag.x = e.clientX; drag.y = e.clientY;
            e.preventDefault();
          }
          function endDrag() { drag = null; }

          function startResize(e, side) {
            if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
            resize = {
              side: side, startX: e.clientX, startY: e.clientY,
              startW: parseInt(el.style.width,10), startH: parseInt(el.style.height,10),
              startL: parseInt(el.style.left,10),  startT: parseInt(el.style.top,10)
            };
            try { e.target.setPointerCapture(e.pointerId); } catch(_) {}
            e.preventDefault();
          }
          function onResizeMove(e) {
            if (!resize) return;
            let dx = e.clientX - resize.startX, dy = e.clientY - resize.startY;
            if (resize.side === 'corner') {
              let nw = Math.max(220, Math.min(resize.startW + dx, window.innerWidth  - resize.startL));
              let nh = Math.max(220, Math.min(resize.startH + dy, window.innerHeight - resize.startT));
              el.style.width  = nw + 'px';
              el.style.height = nh + 'px';
            } else if (resize.side === 'right') {
              let nw2 = Math.max(220, Math.min(resize.startW + dx, window.innerWidth - resize.startL));
              el.style.width = nw2 + 'px';
            } else if (resize.side === 'left') {
              let nw3 = Math.max(220, resize.startW - dx);
              let nl3 = resize.startL + (resize.startW - nw3);
              if (nl3 >= 0) { el.style.width = nw3 + 'px'; el.style.left = nl3 + 'px'; }
            }
            e.preventDefault();
          }
          function endResize() { resize = null; }

          if (header) {
            header.addEventListener('pointerdown', onPointerDownHeader);
            header.addEventListener('pointermove', onPointerMoveHeader);
            header.addEventListener('pointerup', endDrag);
            header.addEventListener('pointercancel', endDrag);
          }
          if (corner) { corner.addEventListener('pointerdown', function(e){startResize(e,'corner');}); corner.addEventListener('pointermove', onResizeMove); corner.addEventListener('pointerup', endResize); corner.addEventListener('pointercancel', endResize); }
          if (leftB)  { leftB .addEventListener('pointerdown', function(e){startResize(e,'left');});   leftB .addEventListener('pointermove', onResizeMove); leftB .addEventListener('pointerup', endResize); leftB .addEventListener('pointercancel', endResize); }
          if (rightB) { rightB.addEventListener('pointerdown', function(e){startResize(e,'right');});  rightB.addEventListener('pointermove', onResizeMove); rightB.addEventListener('pointerup', endResize); rightB.addEventListener('pointercancel', endResize); }
        }
      } catch(e) {
        console.warn('[ae] mobile-ui CFW patch failed:', e);
      }
      return win;
    };
    console.log('[ae] createFloatingWindow patched: touch + mobile fullscreen.');
  }

  // ---------- (2) view-stack /menu ----------
  let __aeMenuWin = null;
  let __aeMenuStack = [];   // [{ view, params }]
  let __aeMenuViews = {};   // name -> async function(win, params)

  function __aeMenuPath() {
    return __aeMenuStack.map(function(s){ return s.view; }).join(' › ');
  }

  async function __aeMenuRender() {
    if (!__aeMenuWin) return;
    let top = __aeMenuStack[__aeMenuStack.length - 1];
    if (!top || !__aeMenuViews[top.view]) {
      __aeMenuWin.bodyEl.innerHTML = '<div style="padding:1rem;">View not found: ' + (top && top.view) + '</div>';
      return;
    }
    // Header with back button and breadcrumbs.
    let canGoBack = __aeMenuStack.length > 1;
    __aeMenuWin.bodyEl.innerHTML =
      '<div class="__aeMenuTopBar" style="display:flex;align-items:center;gap:.5rem;padding:.5rem .6rem;border-bottom:1px solid var(--border-color,#ccc);position:sticky;top:0;background:inherit;z-index:2;">' +
        (canGoBack ? '<button class="__aeMenuBackBtn" style="min-width:2.6rem;min-height:2.6rem;font-size:1.1rem;">‹</button>' : '') +
        '<div style="flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;">' + sanitizeHtml(__aeMenuPath()) + '</div>' +
      '</div>' +
      '<div class="__aeMenuViewSlot" style="padding:0;"></div>';
    if (canGoBack) {
      __aeMenuWin.bodyEl.querySelector('.__aeMenuBackBtn').addEventListener('click', function(){ __aeMenuBack(); });
    }
    let slot = __aeMenuWin.bodyEl.querySelector('.__aeMenuViewSlot');
    await __aeMenuViews[top.view]({ slot: slot, win: __aeMenuWin, params: top.params || {} });
  }

  function __aeMenuNavigate(view, params) {
    __aeMenuStack.push({ view: view, params: params || {} });
    __aeMenuRender();
  }
  function __aeMenuBack() {
    if (__aeMenuStack.length > 1) {
      __aeMenuStack.pop();
      __aeMenuRender();
    }
  }
  function __aeMenuReplace(view, params) {
    __aeMenuStack[__aeMenuStack.length - 1] = { view: view, params: params || {} };
    __aeMenuRender();
  }
  // Expose for other modules.
  window.__aeMenuNavigate = __aeMenuNavigate;
  window.__aeMenuBack = __aeMenuBack;
  window.__aeMenuReplace = __aeMenuReplace;
  window.__aeRegisterMenuView = function(name, fn) { __aeMenuViews[name] = fn; };

  // ---------- (3) HOME view (re-implementation of __aeShowExtensionsMenu) ----------
  __aeMenuViews['Menu'] = async function(ctx) {
    let slot = ctx.slot;
    let s = __aeLoadSettings();

    let activeFiles = [];
    let totalChars = 0;
    try {
      if (typeof __aeGetUploadedFiles === 'function') {
        activeFiles = await __aeGetUploadedFiles({ threadId: activeThreadId });
        totalChars = activeFiles.filter(function(f){ return f.contextActive !== false; })
                                .reduce(function(sum,f){ return sum + (f.contextCharCount || 0); }, 0);
      }
    } catch(e) {}

    let featureRows = [
      ['fileUpload', '📎 Text/file upload', 'file'],
      ['pdfExtract', '📄 PDF extract', 'pdf'],
      ['docxExtract', '📝 DOCX extract', 'docx'],
      ['spreadsheetExtract', '📊 Excel/spreadsheets', 'excel'],
      ['archiveExtract', '🗜️ ZIP archives', 'zip'],
      ['deepWebSearch', '🔎 Deep web search', 'deepsearch'],
      ['advancedImageAnalysis', '🧠 Advanced image/OCR', 'imageanalysis'],
      ['voiceProfile', '🗣️ Voice profile', 'voiceprofile'],
      ['imageCaption', '🖼️ Image analysis/caption', 'image'],
      ['audioTranscribe', '🎤 Audio/voice transcription', 'audio'],
      ['webSearch', '🌐 Web search + auto-search', 'search']
    ];

    let html = '';
    html += '<div style="padding:.75rem;font-size:0.95rem;">';
    html += '<div style="margin-bottom:.75rem;opacity:.8;">File context buffer: <b>' + totalChars + '</b> / ' + __AE_FILE_CONTEXT_BUFFER_CHARS + ' chars · files in thread: <b>' + activeFiles.length + '</b></div>';

    // Quick actions — big tap targets for mobile.
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.5rem;margin-bottom:1rem;">';
    html += '<button class="__aeBtnFile"    style="min-height:3rem;font-size:1rem;">📎 Files</button>';
    html += '<button class="__aeBtnFiles"   style="min-height:3rem;font-size:1rem;">🗂️ Explorer</button>';
    html += '<button class="__aeBtnVoice"   style="min-height:3rem;font-size:1rem;">🎙️ Voice</button>';
    html += '<button class="__aeBtnPolicy"  style="min-height:3rem;font-size:1rem;">🧭 Policy</button>';
    html += '<button class="__aeBtnSearch"  style="min-height:3rem;font-size:1rem;">🔍 Search</button>';
    html += '<button class="__aeBtnStatus"  style="min-height:3rem;font-size:1rem;">⚙️ Status</button>';
    html += '<button class="__aeBtnCancel"  style="min-height:3rem;font-size:1rem;">🛑 Cancel</button>';
    html += '<button class="__aeBtnCommands" style="min-height:3rem;font-size:1rem;">⌨️ Commands</button>';
    html += '</div>';

    // Feature toggles.
    html += '<div style="font-weight:600;margin:0.5rem 0;">Features</div>';
    html += '<div style="display:grid;grid-template-columns:1fr auto;gap:.45rem .75rem;align-items:center;">';
    featureRows.forEach(function(row) {
      let key = row[0], label = row[1], alias = row[2];
      html += '<label for="__aeToggle_' + key + '" style="line-height:1.2;">' + label +
              '<div style="font-size:.78rem;opacity:.65;">/toggle ' + alias + '</div></label>';
      html += '<input id="__aeToggle_' + key + '" class="__aeMenuToggle" data-key="' + key + '" type="checkbox" ' +
              (s[key] ? 'checked' : '') + ' style="transform:scale(1.5);min-width:1.4rem;min-height:1.4rem;">';
    });
    html += '</div>';
    html += '</div>';
    slot.innerHTML = html;

    // Wire toggles.
    slot.querySelectorAll('.__aeMenuToggle').forEach(function(input) {
      input.addEventListener('change', async function() {
        let settings = __aeLoadSettings();
        settings[input.dataset.key] = input.checked;
        __aeSaveSettings(settings);
        if (typeof __aeToast === 'function') __aeToast('⚙️ ' + input.dataset.key + ': ' + (input.checked ? 'ON' : 'OFF'), 2200);
        if (typeof activeThreadId === 'number' && Number.isFinite(activeThreadId) && typeof __aeEnsureShortcutButtons === 'function') {
          let thread = await db.threads.get(activeThreadId);
          if (thread) {
            await __aeEnsureShortcutButtons(thread);
            renderShortcutButtons(thread);
            if (typeof __aeStyleShortcutButtons === 'function') setTimeout(__aeStyleShortcutButtons, 50);
          }
        }
      });
    });

    // Wire quick actions.
    slot.querySelector('.__aeBtnFile')?.addEventListener('click', function() {
      if (typeof __aeFileInput !== 'undefined' && __aeFileInput) __aeFileInput.click();
    });
    slot.querySelector('.__aeBtnFiles')?.addEventListener('click', function() {
      __aeMenuNavigate('Files');
    });
    slot.querySelector('.__aeBtnVoice')?.addEventListener('click', function() {
      if (typeof __aeToggleVoiceRecording === 'function') __aeToggleVoiceRecording();
    });
    slot.querySelector('.__aeBtnPolicy')?.addEventListener('click', function() {
      __aeMenuNavigate('Policy');
    });
    slot.querySelector('.__aeBtnSearch')?.addEventListener('click', function() {
      __aeMenuNavigate('Search');
    });
    slot.querySelector('.__aeBtnStatus')?.addEventListener('click', function() {
      if (typeof __aeShowStatus === 'function') __aeShowStatus();
    });
    slot.querySelector('.__aeBtnCancel')?.addEventListener('click', function() {
      if (typeof __aeAbortAllProcessing === 'function') __aeAbortAllProcessing('User cancelled current processing.');
    });
    slot.querySelector('.__aeBtnCommands')?.addEventListener('click', function() {
      __aeMenuNavigate('Commands');
    });
  };

  // ---------- (4) Policy view (replaces prompt2 modal) ----------
  __aeMenuViews['Policy'] = async function(ctx) {
    let slot = ctx.slot;
    if (typeof activeThreadId !== 'number' || !Number.isFinite(activeThreadId)) {
      slot.innerHTML = '<div style="padding:1rem;opacity:.8;">Open a chat thread first.</div>';
      return;
    }
    let current = typeof __aeGetThreadBasePolicy === 'function'
        ? await __aeGetThreadBasePolicy(activeThreadId)
        : { allowedLanguagePacks: ['accm.lang.en'], primaryLanguagePack: 'accm.lang.en' };

    let packs = (typeof __aeGetAvailableLanguagePacks === 'function')
        ? __aeGetAvailableLanguagePacks()
        : [{ id: 'accm.lang.en', code: 'en', label: 'English', name: 'English' }];
    let allowed = new Set(current.allowedLanguagePacks || []);

    let html = '';
    html += '<div style="padding:.85rem;font-size:.95rem;">';
    html += '<div style="opacity:.85;margin-bottom:.6rem;">Base Policy is a persistent per-chat directive inserted before every reply. Select allowed languages. Changes are saved automatically; uncheck all languages to turn the policy off. Default is English.</div>';
    html += '<div style="display:grid;grid-template-columns:1fr auto;gap:.5rem .8rem;align-items:center;">';
    packs.forEach(function(p) {
      html += '<label for="__aeMenuPolicyLang_' + sanitizeHtml(p.id) + '">' + sanitizeHtml(p.label) + '<div style="font-size:.78rem;opacity:.6;">' + sanitizeHtml(p.id) + '</div></label>';
      html += '<input id="__aeMenuPolicyLang_' + sanitizeHtml(p.id) + '" class="__aePolicyLangToggle" data-id="' + sanitizeHtml(p.id) + '" type="checkbox" ' + (allowed.has(p.id) ? 'checked' : '') + ' style="transform:scale(1.45);min-width:1.4rem;min-height:1.4rem;">';
    });
    html += '</div>';
    html += '<div style="opacity:.65;font-size:.82rem;margin-top:.8rem;">Saved automatically. Use the back arrow in the header to return.</div>';
    html += '</div>';
    slot.innerHTML = html;

    async function savePolicyAutomatically() {
      let allowedIds = Array.from(slot.querySelectorAll('.__aePolicyLangToggle')).filter(function(x) { return x.checked; }).map(function(x) { return x.dataset.id; });
      let primary = allowedIds[0] || 'accm.lang.en';
      if (typeof __aeSetThreadBasePolicy === 'function') {
        let policy = await __aeSetThreadBasePolicy(activeThreadId, { allowedLanguagePacks: allowedIds, primaryLanguagePack: primary, fallbackLanguagePack: primary, language: allowedIds.length ? undefined : 'off' });
        current = policy;
        let names = (policy.allowedLanguagePacks || []).map(function(id) { return packs.find(function(p) { return p.id === id; }); }).filter(Boolean).map(function(p) { return p.label; });
        if (typeof __aeToast === 'function') __aeToast('🧭 Base Policy: ' + (names.join(', ') || 'Off'), 2200);
      }
    }
    slot.querySelectorAll('.__aePolicyLangToggle').forEach(function(input) {
      input.addEventListener('change', function() { savePolicyAutomatically().catch(function(e) { console.error(e); if (typeof __aeToast === 'function') __aeToast('Base Policy save failed: ' + e.message, 5000); }); });
    });
  };

  // Override the existing __aeShowBasePolicyModal so it now navigates inside the menu
  // instead of spawning a second modal on top of /menu. Direct /policy command still
  // works: it just opens the menu at the Policy view directly.
  let __aeMobileShowBasePolicyModal = async function() {
    if (!__aeMenuWin || !__aeMenuWin.ctn || !__aeMenuWin.ctn.isConnected) {
      __aeOpenMenu('Policy');
    } else {
      __aeMenuNavigate('Policy');
    }
  };
  try { __aeShowBasePolicyModal = __aeMobileShowBasePolicyModal; } catch(e) { window.__aeShowBasePolicyModal = __aeMobileShowBasePolicyModal; }
  window.__aeShowBasePolicyModal = __aeMobileShowBasePolicyModal;

  // ---------- (5) Files view (re-uses existing renderer if present) ----------
  __aeMenuViews['Files'] = async function(ctx) {
    let slot = ctx.slot;
    if (typeof activeThreadId !== 'number' || !Number.isFinite(activeThreadId)) {
      slot.innerHTML = '<div style="padding:1rem;opacity:.8;">Open a chat thread first.</div>';
      return;
    }
    if (typeof __aeRenderFileExplorerBody === 'function') {
      // Fake a "win" object whose bodyEl is our slot so the existing renderer works unchanged.
      let fakeWin = { bodyEl: slot };
      await __aeRenderFileExplorerBody(fakeWin, ctx.params || {});
    } else {
      slot.innerHTML = '<div style="padding:1rem;">File explorer module is not loaded.</div>';
    }
  };

  // ---------- (6) Search view ----------
  __aeMenuViews['Search'] = async function(ctx) {
    let slot = ctx.slot;
    let html = '';
    html += '<div style="padding:.85rem;">';
    html += '<label style="display:block;margin-bottom:.4rem;font-weight:600;">Web search query:</label>';
    html += '<textarea class="__aeSearchInput" placeholder="What do you want to look up?" style="width:100%;min-height:5rem;padding:.6rem;font-size:1rem;box-sizing:border-box;"></textarea>';
    html += '<label style="display:flex;align-items:center;gap:.5rem;margin:.6rem 0;">';
    html += '<input type="checkbox" class="__aeSearchDeep" style="transform:scale(1.4);"> Use deep web search (fetch top pages)';
    html += '</label>';
    html += '<div style="display:flex;gap:.5rem;margin-top:.5rem;">';
    html += '<button class="__aeSearchGo"     style="flex:2;min-height:3rem;font-size:1rem;">🔍 Search</button>';
    html += '<button class="__aeSearchCancel" style="flex:1;min-height:3rem;font-size:1rem;">Back</button>';
    html += '</div>';
    html += '<div style="opacity:.75;margin-top:.7rem;font-size:.85rem;">Web search sends your query and may share content with third-party services. See README → Privacy.</div>';
    html += '</div>';
    slot.innerHTML = html;

    let current = __aeLoadSettings();
    let deepCb = slot.querySelector('.__aeSearchDeep');
    deepCb.checked = !!current.deepWebSearch;

    slot.querySelector('.__aeSearchCancel').addEventListener('click', function(){ __aeMenuBack(); });
    slot.querySelector('.__aeSearchGo').addEventListener('click', async function() {
      let q = slot.querySelector('.__aeSearchInput').value.trim();
      if (!q) return;
      // Temporarily honour the deep checkbox without permanently flipping the setting.
      let settings = __aeLoadSettings();
      let prev = settings.deepWebSearch;
      settings.deepWebSearch = deepCb.checked;
      __aeSaveSettings(settings);
      try {
        __aeMenuBack();
        if (typeof __aePerformSearch === 'function') await __aePerformSearch(q);
      } finally {
        settings.deepWebSearch = prev;
        __aeSaveSettings(settings);
      }
    });
  };

  // ---------- (7) Commands view ----------
  __aeMenuViews['Commands'] = async function(ctx) {
    let slot = ctx.slot;
    let cmds = [
      ['/menu',         'Open this menu'],
      ['/file',         'Pick file(s) to upload'],
      ['/files',        'Open file explorer'],
      ['/voice',        'Start / stop voice recording'],
      ['/search <q>',   'Web search'],
      ['/toggle <f>',   'Toggle a feature (file, pdf, docx, excel, zip, image, audio, search, deepsearch, imageanalysis, voiceprofile)'],
      ['/policy',       'Open Base Policy editor (chat-wide language)'],
      ['/language <c>', 'Set language code directly (en, ru, es, …)'],
      ['/extensions',   'Show extension status in chat']
    ];
    let html = '<div style="padding:.85rem;font-size:.95rem;">';
    html += '<table style="width:100%;border-collapse:collapse;">';
    cmds.forEach(function(row) {
      html += '<tr style="border-bottom:1px solid rgba(127,127,127,0.15);">';
      html += '<td style="padding:.55rem .4rem;font-family:monospace;white-space:nowrap;">' + sanitizeHtml(row[0]) + '</td>';
      html += '<td style="padding:.55rem .4rem;opacity:.85;">' + sanitizeHtml(row[1]) + '</td>';
      html += '</tr>';
    });
    html += '</table></div>';
    slot.innerHTML = html;
  };

  // ---------- open helper ----------
  function __aeOpenMenu(initialView) {
    initialView = initialView || 'Menu';
    let alreadyOpen = __aeMenuWin && __aeMenuWin.ctn && __aeMenuWin.ctn.isConnected;
    if (alreadyOpen) {
      // Already open → just navigate.
      __aeMenuStack = [];
      __aeMenuNavigate(initialView);
      return __aeMenuWin;
    }
    __aeMenuStack = [];
    __aeMenuWin = createFloatingWindow({
      header: '🧩 ACCM Menu',
      initialWidth: Math.min(640, window.innerWidth - 40),
      initialHeight: Math.min(680, window.innerHeight - 80),
      body: '<div style="padding:1rem;">Loading...</div>'
    });
    __aeMenuNavigate(initialView);
    return __aeMenuWin;
  }
  window.__aeOpenMenu = __aeOpenMenu;

  if (window.__accm && window.__accm.ui && window.__accm.ui.globalButtons) {
    window.__accm.ui.globalButtons.register({
      id: 'menu',
      label: '🧩 Menu',
      title: 'Open extension actions inside sidebar',
      priority: 120,
      onClick: function() { __aeOpenMenu('Menu'); },
      panelItems: [
        { id:'file', label:'📎 Choose files', onClick:function(){ if (typeof __aeFileInput !== 'undefined' && __aeFileInput) __aeFileInput.click(); } },
        { id:'explorer', label:'🗂️ Explorer', onClick:function(){ if (typeof __aeShowFileExplorer === 'function') __aeShowFileExplorer({includeAllThreads:true}); } },
        { id:'voice', label:'🎙️ Voice', onClick:function(){ if (typeof __aeToggleVoiceRecording === 'function') __aeToggleVoiceRecording(); } },
        { id:'policy', label:'🧭 Base Policy', onClick:function(){ if (typeof __aeShowBasePolicyModal === 'function') __aeShowBasePolicyModal(); } },
        { id:'search', label:'🔍 Search', onClick:function(){ __aeOpenMenu('Search'); } },
        { id:'status', label:'⚙️ Status', onClick:function(){ if (typeof __aeShowStatus === 'function') __aeShowStatus(); } },
        { id:'commands', label:'⌨️ Commands', onClick:function(){ __aeOpenMenu('Commands'); } },
        { id:'cancel', label:'🛑 Cancel processing', onClick:function(){ if (typeof __aeAbortAllProcessing === 'function') __aeAbortAllProcessing('User cancelled current processing.'); } },
        { id:'full-menu', label:'🧩 Full menu window', onClick:function(){ __aeOpenMenu('Menu'); } }
      ]
    });
  }

  // ---------- override existing entry points ----------
  // The original __aeShowExtensionsMenu used a one-shot floating window with hard-coded
  // sub-actions calling prompt2 / new windows. Replace it with the view-stack version.
  let __aeMobileShowExtensionsMenu = function() { return __aeOpenMenu('Menu'); };
  try { __aeShowExtensionsMenu = __aeMobileShowExtensionsMenu; } catch(e) { window.__aeShowExtensionsMenu = __aeMobileShowExtensionsMenu; }
  window.__aeShowExtensionsMenu = __aeMobileShowExtensionsMenu;

  // File Explorer is intentionally NOT overridden here anymore: the global Explorer
  // module opens its own window headed "🗂️ Explorer" and is available outside chats.

  console.log('[ae] Mobile UI module loaded. View-stack menu enabled, prompt2 modal-stacking removed.');
})();
