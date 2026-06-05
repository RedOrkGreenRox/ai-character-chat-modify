
// ============================================
// ACCM EXTENSION RUNTIME / SDK FOUNDATION
// ============================================
// A small registry layer used by later modules so they don't need to keep
// wrapping global functions directly. This is intentionally conservative:
// existing __ae* functions remain intact, and the registries are additive.
//
// Provides:
//   window.__accm
//   __accm.commands.register / dispatch
//   __accm.shortcuts.register / applyToThread
//   __accm.importers.register / install
//   __accm.skillbooks.register / install
//   __accm.ui.registerView
//   __accm.modules.register
//
// Wraps once:
//   __aeHandleCommandText
//   __aeEnsureShortcutButtons
// ============================================

(function() {
  if (window.__accm && window.__accm.runtimeInstalled) return;

  let ae = window.__accm = window.__accm || {};
  ae.runtimeInstalled = true;
  ae.version = ae.version || '0.1.0';

  // ---------- module metadata ----------
  ae.modules = ae.modules || { items: [] };
  ae.modules.register = ae.modules.register || function(meta) {
    meta = meta || {};
    if (!meta.id) meta.id = 'module-' + ae.modules.items.length;
    let idx = ae.modules.items.findIndex(function(m) { return m.id === meta.id; });
    if (idx >= 0) {
      let old = ae.modules.items[idx];
      if (old && typeof old.teardown === 'function') {
        try { old.teardown(); } catch(e) { console.error('[accm] old module teardown failed:', meta.id, e); }
      }
      ae.modules.items[idx] = Object.assign({}, ae.modules.items[idx], meta);
    } else {
      ae.modules.items.push(meta);
    }
    return meta;
  };

  ae.modules.unregister = ae.modules.unregister || function(id) {
    let idx = ae.modules.items.findIndex(function(m) { return m.id === id; });
    if (idx >= 0) {
      let mod = ae.modules.items[idx];
      if (mod && typeof mod.teardown === 'function') {
        try { mod.teardown(); } catch(e) { console.error('[accm] module teardown failed:', id, e); }
      }
      ae.modules.items.splice(idx, 1);
    }
  };

  // ---------- command registry ----------
  ae.commands = ae.commands || { items: [] };
  ae.commands.register = ae.commands.register || function(command) {
    if (!command || !command.id) throw new Error('__accm.commands.register requires {id}');
    command.aliases = (command.aliases || []).map(function(x) { return String(x).trim(); }).filter(Boolean);
    if (typeof command.handler !== 'function') throw new Error('__accm.commands.register requires handler');
    let existing = ae.commands.items.findIndex(function(c) { return c.id === command.id; });
    if (existing >= 0) ae.commands.items[existing] = Object.assign({}, ae.commands.items[existing], command);
    else ae.commands.items.push(command);
    ae.commands.items.sort(function(a, b) { return Number(a.priority || 500) - Number(b.priority || 500); });
    return command;
  };
  ae.commands.dispatch = ae.commands.dispatch || async function(text, ctx) {
    let raw = String(text || '');
    let trimmed = raw.trim();
    if (!trimmed) return false;
    for (let i = 0; i < ae.commands.items.length; i++) {
      let cmd = ae.commands.items[i];
      try {
        let matched = false;
        if (typeof cmd.match === 'function') matched = !!cmd.match(trimmed, ctx || {});
        else matched = (cmd.aliases || []).indexOf(trimmed) !== -1;
        if (!matched) continue;
        let result = await cmd.handler(trimmed, ctx || {});
        return result !== false;
      } catch(e) {
        console.error('[accm] command failed:', cmd.id, e);
        if (typeof __aeToast === 'function') __aeToast('Command failed: ' + cmd.id + ': ' + e.message, 6000);
        return true;
      }
    }
    return false;
  };

  // Patch the current command chain once. Modules should register commands
  // instead of wrapping __aeHandleCommandText directly.
  if (typeof __aeHandleCommandText === 'function' && !ae.commands.dispatcherPatched) {
    ae.commands.dispatcherPatched = true;
    let __accmOriginalHandleCommandText = __aeHandleCommandText;
    __aeHandleCommandText = async function(text) {
      let handled = await ae.commands.dispatch(text, { source: 'sendButton' });
      if (handled) return true;
      return __accmOriginalHandleCommandText.apply(this, arguments);
    };
  }

  // ---------- shortcut registry ----------
  ae.shortcuts = ae.shortcuts || { items: [] };
  ae.shortcuts.register = ae.shortcuts.register || function(shortcut) {
    if (!shortcut || !shortcut.id) throw new Error('__accm.shortcuts.register requires {id}');
    let existing = ae.shortcuts.items.findIndex(function(s) { return s.id === shortcut.id; });
    if (existing >= 0) ae.shortcuts.items[existing] = Object.assign({}, ae.shortcuts.items[existing], shortcut);
    else ae.shortcuts.items.push(shortcut);
    ae.shortcuts.items.sort(function(a, b) { return Number(a.priority || 500) - Number(b.priority || 500); });
    return shortcut;
  };
  ae.shortcuts.applyToThread = ae.shortcuts.applyToThread || async function(thread) {
    if (!thread) return false;
    if (!Array.isArray(thread.shortcutButtons)) thread.shortcutButtons = [];
    let changed = false;
    ae.shortcuts.items.forEach(function(def) {
      let exists = thread.shortcutButtons.some(function(b) {
        return b && (b.__accmShortcutId === def.id || (def.message && b.message === def.message && b.name === def.name));
      });
      if (exists) return;
      let btn = {
        name: def.name || def.id,
        message: def.message || '',
        insertionType: def.insertionType || 'replace',
        autoSend: def.autoSend !== false,
        clearAfterSend: def.clearAfterSend !== false,
        type: def.type || 'message',
        __accmShortcutId: def.id
      };
      try { if (typeof __AE_EXT !== 'undefined') btn[__AE_EXT] = true; } catch(e) {}
      thread.shortcutButtons.push(btn);
      changed = true;
    });
    return changed;
  };

  if (typeof __aeEnsureShortcutButtons === 'function' && !ae.shortcuts.ensurePatched) {
    ae.shortcuts.ensurePatched = true;
    let __accmOriginalEnsureShortcutButtons = __aeEnsureShortcutButtons;
    __aeEnsureShortcutButtons = async function(thread) {
      await __accmOriginalEnsureShortcutButtons.apply(this, arguments);
      let changed = await ae.shortcuts.applyToThread(thread);
      if (changed && thread && typeof db !== 'undefined' && db.threads) await db.threads.put(thread);
    };
  }

  // ---------- extension/data pack registry ----------
  ae.packs = ae.packs || { items: [] };
  ae.packs.register = ae.packs.register || function(pack) {
    if (!pack || !pack.id) throw new Error('__accm.packs.register requires {id}');
    pack.kind = pack.kind || 'extension-pack';
    pack.tags = Array.isArray(pack.tags) ? pack.tags : [];
    let existing = ae.packs.items.findIndex(function(p) { return p.id === pack.id; });
    if (existing >= 0) ae.packs.items[existing] = Object.assign({}, ae.packs.items[existing], pack);
    else ae.packs.items.push(pack);
    ae.packs.items.sort(function(a, b) { return String(a.label || a.id).localeCompare(String(b.label || b.id)); });
    return pack;
  };
  ae.packs.find = ae.packs.find || function(predicate) {
    return ae.packs.items.filter(predicate || function() { return true; });
  };
  ae.packs.byTarget = ae.packs.byTarget || function(extensionTarget, packType) {
    return ae.packs.items.filter(function(p) {
      return (!extensionTarget || p.extensionTarget === extensionTarget) && (!packType || p.packType === packType);
    });
  };

  // ---------- skillbook registry ----------
  // Skillbooks are semantic/knowledge packs. They are separate from low-level
  // extension-packs: a language preset can be an extension-pack, while a full
  // grammar/style/domain guide is a skillbook.
  ae.skillbooks = ae.skillbooks || { items: [], installers: [] };
  ae.skillbooks.register = ae.skillbooks.register || function(skillbook) {
    if (!skillbook || !skillbook.id) throw new Error('__accm.skillbooks.register requires {id}');
    skillbook.kind = skillbook.kind || 'skillbook';
    skillbook.tags = Array.isArray(skillbook.tags) ? skillbook.tags : [];
    let existing = ae.skillbooks.items.findIndex(function(s) { return s.id === skillbook.id; });
    if (existing >= 0) ae.skillbooks.items[existing] = Object.assign({}, ae.skillbooks.items[existing], skillbook);
    else ae.skillbooks.items.push(skillbook);
    ae.skillbooks.items.sort(function(a, b) { return String(a.label || a.name || a.id).localeCompare(String(b.label || b.name || b.id)); });
    return skillbook;
  };
  ae.skillbooks.find = ae.skillbooks.find || function(predicate) {
    return ae.skillbooks.items.filter(predicate || function() { return true; });
  };
  ae.skillbooks.registerInstaller = ae.skillbooks.registerInstaller || function(installer) {
    if (!installer || !installer.id) throw new Error('__accm.skillbooks.registerInstaller requires {id}');
    if (typeof installer.test !== 'function') throw new Error('__accm.skillbooks installer requires test');
    if (typeof installer.install !== 'function') throw new Error('__accm.skillbooks installer requires install');
    let existing = ae.skillbooks.installers.findIndex(function(i) { return i.id === installer.id; });
    if (existing >= 0) ae.skillbooks.installers[existing] = Object.assign({}, ae.skillbooks.installers[existing], installer);
    else ae.skillbooks.installers.push(installer);
    ae.skillbooks.installers.sort(function(a, b) { return Number(a.priority || 500) - Number(b.priority || 500); });
    return installer;
  };
  ae.skillbooks.install = ae.skillbooks.install || async function(payload) {
    payload = payload || {};
    for (let i = 0; i < ae.skillbooks.installers.length; i++) {
      let installer = ae.skillbooks.installers[i];
      if (await installer.test(payload)) return await installer.install(payload);
    }
    return false;
  };

  // ---------- importer registry ----------
  ae.importers = ae.importers || { items: [] };
  ae.importers.register = ae.importers.register || function(importer) {
    if (!importer || !importer.id) throw new Error('__accm.importers.register requires {id}');
    if (typeof importer.test !== 'function') throw new Error('__accm.importers.register requires test');
    if (typeof importer.install !== 'function') throw new Error('__accm.importers.register requires install');
    let existing = ae.importers.items.findIndex(function(i) { return i.id === importer.id; });
    if (existing >= 0) ae.importers.items[existing] = Object.assign({}, ae.importers.items[existing], importer);
    else ae.importers.items.push(importer);
    ae.importers.items.sort(function(a, b) { return Number(a.priority || 500) - Number(b.priority || 500); });
    return importer;
  };
  ae.importers.install = ae.importers.install || async function(payload) {
    payload = payload || {};
    for (let i = 0; i < ae.importers.items.length; i++) {
      let importer = ae.importers.items[i];
      try {
        if (await importer.test(payload)) {
          return await importer.install(payload);
        }
      } catch(e) {
        console.error('[accm] importer failed:', importer.id, e);
        throw e;
      }
    }
    return false;
  };

  // ---------- global launcher buttons ----------
  ae.ui = ae.ui || { views: {} };
  ae.ui.globalButtons = ae.ui.globalButtons || { items: [], rendered: false, expanded: false };
  ae.ui.globalButtons.register = ae.ui.globalButtons.register || function(button) {
    if (!button || !button.id) throw new Error('__accm.ui.globalButtons.register requires {id}');
    if (typeof button.onClick !== 'function') throw new Error('__accm.ui.globalButtons.register requires onClick');
    let existing = ae.ui.globalButtons.items.findIndex(function(b) { return b.id === button.id; });
    if (existing >= 0) ae.ui.globalButtons.items[existing] = Object.assign({}, ae.ui.globalButtons.items[existing], button);
    else ae.ui.globalButtons.items.push(button);
    ae.ui.globalButtons.items.sort(function(a, b) { return Number(a.priority || 500) - Number(b.priority || 500); });
    ae.ui.globalButtons.render();
    return button;
  };
  ae.ui.globalButtons.render = ae.ui.globalButtons.render || function() {
    // Global fixed launcher: always available, even when the original left
    // column/sidebar is hidden, not yet rendered, or the user is on a non-chat
    // page. It is placed at mid-left instead of bottom-left so it does not
    // cover Perchance/original bottom toolbar buttons.
    let mount = document.querySelector('#__accmGlobalButtons');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = '__accmGlobalButtons';
      document.body.appendChild(mount);
    }
    mount.style.cssText = [
      'position:fixed',
      'left:max(10px, env(safe-area-inset-left))',
      'top:50%',
      'transform:translateY(-50%)',
      'z-index:999998',
      'display:flex',
      'flex-direction:column-reverse',
      'align-items:flex-start',
      'gap:8px',
      'pointer-events:none',
      'font:13px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif'
    ].join(';') + ';';

    mount.innerHTML = '';

    let header = document.createElement('button');
    header.innerHTML = '<span class="__accmSidebarArrow" style="display:inline-block;transition:transform .18s ease;transform:' + (ae.ui.globalButtons.expanded ? 'rotate(90deg)' : 'rotate(0deg)') + ';">▶</span> <span>ACCM</span>';
    header.title = 'Open ACCM tools';
    header.setAttribute('aria-expanded', ae.ui.globalButtons.expanded ? 'true' : 'false');
    header.style.cssText = [
      'pointer-events:auto',
      'min-height:42px',
      'min-width:96px',
      'padding:8px 13px',
      'border-radius:999px',
      'border:1px solid rgba(255,255,255,.22)',
      'background:linear-gradient(135deg, rgba(41,45,62,.96), rgba(18,20,28,.96))',
      'color:#fff',
      'box-shadow:0 8px 28px rgba(0,0,0,.38)',
      'font-weight:800',
      'letter-spacing:.02em',
      'cursor:pointer',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'gap:.45rem',
      'backdrop-filter:blur(10px)',
      '-webkit-backdrop-filter:blur(10px)'
    ].join(';') + ';';
    header.onclick = function(e) {
      e.preventDefault(); e.stopPropagation();
      ae.ui.globalButtons.expanded = !ae.ui.globalButtons.expanded;
      ae.ui.globalButtons.render();
    };
    mount.appendChild(header);

    if (!ae.ui.globalButtons.expanded) return;

    let panel = document.createElement('div');
    panel.style.cssText = [
      'pointer-events:auto',
      'width:min(280px, calc(100vw - 24px))',
      'max-height:min(70vh, 560px)',
      'overflow-y:auto',
      'overscroll-behavior:contain',
      'padding:9px',
      'border-radius:14px',
      'border:1px solid rgba(255,255,255,.18)',
      'background:rgba(22,24,32,.96)',
      'color:#fff',
      'box-shadow:0 14px 44px rgba(0,0,0,.45)',
      'backdrop-filter:blur(12px)',
      '-webkit-backdrop-filter:blur(12px)'
    ].join(';') + ';';
    panel.addEventListener('wheel', function(e) { e.stopPropagation(); }, { passive: true });
    mount.appendChild(panel);

    let title = document.createElement('div');
    title.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin:0 0 .45rem 0;padding:.1rem .1rem .35rem .1rem;border-bottom:1px solid rgba(255,255,255,.12);';
    let titleText = document.createElement('div');
    titleText.textContent = 'ACCM tools';
    titleText.style.cssText = 'font-weight:800;opacity:.95;';
    let close = document.createElement('button');
    close.textContent = '×';
    close.title = 'Close ACCM tools';
    close.style.cssText = 'border:0;background:rgba(255,255,255,.08);color:inherit;border-radius:999px;min-width:28px;min-height:28px;cursor:pointer;font-size:18px;line-height:1;';
    close.onclick = function(e) { e.preventDefault(); e.stopPropagation(); ae.ui.globalButtons.expanded = false; ae.ui.globalButtons.openPanelId = null; ae.ui.globalButtons.render(); };
    title.appendChild(titleText);
    title.appendChild(close);
    panel.appendChild(title);

    let list = document.createElement('div');
    list.style.cssText = 'display:grid;gap:.4rem;';
    panel.appendChild(list);

    ae.ui.globalButtons.items.forEach(function(btn) {
      let el = document.createElement('button');
      el.textContent = btn.label || btn.id;
      el.title = btn.title || btn.label || btn.id;
      el.style.cssText = 'min-height:38px;text-align:left;padding:.45rem .6rem;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);color:inherit;cursor:pointer;font-weight:650;';
      el.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        try {
          if (Array.isArray(btn.panelItems) && btn.panelItems.length) {
            ae.ui.globalButtons.openPanelId = ae.ui.globalButtons.openPanelId === btn.id ? null : btn.id;
            ae.ui.globalButtons.render();
          } else {
            btn.onClick(e);
          }
        } catch(err) { console.error('[accm] global button failed:', btn.id, err); if (typeof __aeToast === 'function') __aeToast('Button failed: ' + btn.id + ': ' + err.message, 5000); }
      });
      list.appendChild(el);
      if (ae.ui.globalButtons.openPanelId === btn.id && Array.isArray(btn.panelItems)) {
        let subPanel = document.createElement('div');
        subPanel.style.cssText = 'display:grid;gap:.32rem;margin:-.15rem 0 .35rem .65rem;padding-left:.55rem;border-left:2px solid rgba(255,255,255,.16);max-height:min(44vh,360px);overflow-y:auto;overscroll-behavior:contain;';
        subPanel.addEventListener('wheel', function(e) { e.stopPropagation(); }, { passive: true });
        btn.panelItems.forEach(function(item) {
          if (item.type === 'toggle') {
            let label = document.createElement('label');
            label.style.cssText = 'min-height:34px;display:flex;align-items:center;justify-content:space-between;gap:.6rem;padding:.38rem .55rem;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:inherit;cursor:pointer;';
            let span = document.createElement('span');
            span.textContent = item.label || item.id;
            let input = document.createElement('input');
            input.type = 'checkbox';
            input.style.cssText = 'transform:scale(1.2);';
            try { input.checked = !!item.getValue(); } catch(e) { input.checked = false; }
            input.onchange = function(ev) {
              ev.stopPropagation();
              try { item.setValue(input.checked); } catch(err) { console.error('[accm] launcher toggle failed:', item.id, err); if (typeof __aeToast === 'function') __aeToast('Toggle failed: ' + (item.label || item.id) + ': ' + err.message, 5000); }
            };
            label.appendChild(span);
            label.appendChild(input);
            subPanel.appendChild(label);
          } else {
            let sub = document.createElement('button');
            sub.textContent = item.label || item.id;
            sub.title = item.title || item.label || item.id;
            sub.style.cssText = 'min-height:34px;text-align:left;padding:.38rem .55rem;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:inherit;cursor:pointer;';
            sub.onclick = function(ev) {
              ev.preventDefault(); ev.stopPropagation();
              try { item.onClick(ev); } catch(err) { console.error('[accm] launcher panel item failed:', item.id, err); if (typeof __aeToast === 'function') __aeToast('Menu item failed: ' + (item.label || item.id) + ': ' + err.message, 5000); }
            };
            subPanel.appendChild(sub);
          }
        });
        list.appendChild(subPanel);
      }
    });
  };

  // ---------- installed library + per-thread activations ----------
  ae.library = ae.library || {};
  ae.library.key = ae.library.key || '__accmLibrary';
  ae.library.load = ae.library.load || async function() {
    let row = await db.misc.get(ae.library.key).catch(function() { return null; });
    let value = row && row.value ? row.value : { version: 1, items: [], activations: {} };
    if (!Array.isArray(value.items)) value.items = [];
    if (!value.activations || typeof value.activations !== 'object') value.activations = {};
    return value;
  };
  ae.library.save = ae.library.save || async function(value) {
    value.version = value.version || 1;
    if (!Array.isArray(value.items)) value.items = [];
    if (!value.activations || typeof value.activations !== 'object') value.activations = {};
    await db.misc.put({ key: ae.library.key, value: value });
  };
  ae.library.install = ae.library.install || async function(item) {
    let lib = await ae.library.load();
    item = Object.assign({ installedAt: Date.now() }, item || {});
    if (!item.id) item.id = 'local-' + ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36));
    let idx = lib.items.findIndex(function(x) { return x.id === item.id; });
    if (idx >= 0) lib.items[idx] = Object.assign({}, lib.items[idx], item, { updatedAt: Date.now() });
    else lib.items.push(item);
    await ae.library.save(lib);
    return item;
  };
  ae.library.remove = ae.library.remove || async function(itemId) {
    let lib = await ae.library.load();
    lib.items = lib.items.filter(function(x) { return x.id !== itemId; });
    Object.keys(lib.activations).forEach(function(threadId) { delete lib.activations[threadId][itemId]; });
    await ae.library.save(lib);
  };
  ae.library.setActive = ae.library.setActive || async function(itemId, threadId, enabled) {
    let lib = await ae.library.load();
    threadId = String(threadId);
    if (!lib.activations[threadId]) lib.activations[threadId] = {};
    lib.activations[threadId][itemId] = enabled !== false;
    await ae.library.save(lib);
  };
  ae.library.isActive = ae.library.isActive || function(lib, itemId, threadId) {
    let threadActs = lib.activations && lib.activations[String(threadId)];
    return !!(threadActs && threadActs[itemId] === true);
  };
  ae.library.getActiveItems = ae.library.getActiveItems || async function(threadId, filter) {
    let lib = await ae.library.load();
    let items = lib.items.filter(function(item) { return ae.library.isActive(lib, item.id, threadId); });
    if (filter) items = items.filter(filter);
    return items;
  };

  if (typeof __aeRegisterBeforeBotReplyHook === 'function' && !ae.library.skillbookHookRegistered) {
    ae.library.skillbookHookRegistered = true;
    __aeRegisterBeforeBotReplyHook('accmLibrarySkillbooks', async function(opts) {
      if (!opts || !Array.isArray(opts.messages) || typeof opts.threadId !== 'number') return opts;
      let skillbooks = await ae.library.getActiveItems(opts.threadId, function(item) { return item.kind === 'skillbook'; });
      if (!skillbooks.length) return opts;
      let block = skillbooks.map(function(item, i) {
        return 'SKILLBOOK #' + (i + 1) + ': ' + (item.name || item.id) + '\n' + String(item.content || '').slice(0, 8000);
      }).join('\n\n---\n\n');
      let msg = __aeCreateTransientMessageObj({
        threadId: opts.threadId,
        message: 'ACTIVE SKILLBOOKS FOR THIS CHAT\nUse these as specialized guidance when relevant.\n\n' + block,
        characterId: -2,
        name: 'Skillbooks',
        expectsReply: false
      });
      let newMessages = opts.messages.slice();
      let insertAt = newMessages.length;
      for (let i = newMessages.length - 1; i >= 0; i--) { if (newMessages[i].characterId === -1) { insertAt = i + 1; break; } }
      newMessages.splice(insertAt, 0, msg);
      return Object.assign({}, opts, { messages: newMessages });
    }, { priority: 850 });
  }

  // ---------- UI registry bridge ----------
  ae.ui.registerView = ae.ui.registerView || function(name, renderer) {
    ae.ui.views[name] = renderer;
    if (typeof window.__aeRegisterMenuView === 'function') window.__aeRegisterMenuView(name, renderer);
  };

  ae.modules.register({
    id: 'accm-runtime',
    title: 'ACCM runtime registries',
    provides: ['__accm.commands', '__accm.shortcuts', '__accm.importers', '__accm.skillbooks', '__accm.packs', '__accm.ui']
  });

  console.log('[accm] runtime registries loaded.');
})();
