
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

  var ae = window.__accm = window.__accm || {};
  ae.runtimeInstalled = true;
  ae.version = ae.version || '0.1.0';

  // ---------- module metadata ----------
  ae.modules = ae.modules || { items: [] };
  ae.modules.register = ae.modules.register || function(meta) {
    meta = meta || {};
    if (!meta.id) meta.id = 'module-' + ae.modules.items.length;
    var idx = ae.modules.items.findIndex(function(m) { return m.id === meta.id; });
    if (idx >= 0) ae.modules.items[idx] = Object.assign({}, ae.modules.items[idx], meta);
    else ae.modules.items.push(meta);
    return meta;
  };

  // ---------- command registry ----------
  ae.commands = ae.commands || { items: [] };
  ae.commands.register = ae.commands.register || function(command) {
    if (!command || !command.id) throw new Error('__accm.commands.register requires {id}');
    command.aliases = (command.aliases || []).map(function(x) { return String(x).trim(); }).filter(Boolean);
    if (typeof command.handler !== 'function') throw new Error('__accm.commands.register requires handler');
    var existing = ae.commands.items.findIndex(function(c) { return c.id === command.id; });
    if (existing >= 0) ae.commands.items[existing] = Object.assign({}, ae.commands.items[existing], command);
    else ae.commands.items.push(command);
    ae.commands.items.sort(function(a, b) { return Number(a.priority || 500) - Number(b.priority || 500); });
    return command;
  };
  ae.commands.dispatch = ae.commands.dispatch || async function(text, ctx) {
    var raw = String(text || '');
    var trimmed = raw.trim();
    if (!trimmed) return false;
    for (var i = 0; i < ae.commands.items.length; i++) {
      var cmd = ae.commands.items[i];
      try {
        var matched = false;
        if (typeof cmd.match === 'function') matched = !!cmd.match(trimmed, ctx || {});
        else matched = (cmd.aliases || []).indexOf(trimmed) !== -1;
        if (!matched) continue;
        var result = await cmd.handler(trimmed, ctx || {});
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
    var __accmOriginalHandleCommandText = __aeHandleCommandText;
    __aeHandleCommandText = async function(text) {
      var handled = await ae.commands.dispatch(text, { source: 'sendButton' });
      if (handled) return true;
      return __accmOriginalHandleCommandText.apply(this, arguments);
    };
  }

  // ---------- shortcut registry ----------
  ae.shortcuts = ae.shortcuts || { items: [] };
  ae.shortcuts.register = ae.shortcuts.register || function(shortcut) {
    if (!shortcut || !shortcut.id) throw new Error('__accm.shortcuts.register requires {id}');
    var existing = ae.shortcuts.items.findIndex(function(s) { return s.id === shortcut.id; });
    if (existing >= 0) ae.shortcuts.items[existing] = Object.assign({}, ae.shortcuts.items[existing], shortcut);
    else ae.shortcuts.items.push(shortcut);
    ae.shortcuts.items.sort(function(a, b) { return Number(a.priority || 500) - Number(b.priority || 500); });
    return shortcut;
  };
  ae.shortcuts.applyToThread = ae.shortcuts.applyToThread || async function(thread) {
    if (!thread) return false;
    if (!Array.isArray(thread.shortcutButtons)) thread.shortcutButtons = [];
    var changed = false;
    ae.shortcuts.items.forEach(function(def) {
      var exists = thread.shortcutButtons.some(function(b) {
        return b && (b.__accmShortcutId === def.id || (def.message && b.message === def.message && b.name === def.name));
      });
      if (exists) return;
      var btn = {
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
    var __accmOriginalEnsureShortcutButtons = __aeEnsureShortcutButtons;
    __aeEnsureShortcutButtons = async function(thread) {
      await __accmOriginalEnsureShortcutButtons.apply(this, arguments);
      var changed = await ae.shortcuts.applyToThread(thread);
      if (changed && thread && typeof db !== 'undefined' && db.threads) await db.threads.put(thread);
    };
  }

  // ---------- extension/data pack registry ----------
  ae.packs = ae.packs || { items: [] };
  ae.packs.register = ae.packs.register || function(pack) {
    if (!pack || !pack.id) throw new Error('__accm.packs.register requires {id}');
    pack.kind = pack.kind || 'extension-pack';
    pack.tags = Array.isArray(pack.tags) ? pack.tags : [];
    var existing = ae.packs.items.findIndex(function(p) { return p.id === pack.id; });
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
    var existing = ae.skillbooks.items.findIndex(function(s) { return s.id === skillbook.id; });
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
    var existing = ae.skillbooks.installers.findIndex(function(i) { return i.id === installer.id; });
    if (existing >= 0) ae.skillbooks.installers[existing] = Object.assign({}, ae.skillbooks.installers[existing], installer);
    else ae.skillbooks.installers.push(installer);
    ae.skillbooks.installers.sort(function(a, b) { return Number(a.priority || 500) - Number(b.priority || 500); });
    return installer;
  };
  ae.skillbooks.install = ae.skillbooks.install || async function(payload) {
    payload = payload || {};
    for (var i = 0; i < ae.skillbooks.installers.length; i++) {
      var installer = ae.skillbooks.installers[i];
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
    var existing = ae.importers.items.findIndex(function(i) { return i.id === importer.id; });
    if (existing >= 0) ae.importers.items[existing] = Object.assign({}, ae.importers.items[existing], importer);
    else ae.importers.items.push(importer);
    ae.importers.items.sort(function(a, b) { return Number(a.priority || 500) - Number(b.priority || 500); });
    return importer;
  };
  ae.importers.install = ae.importers.install || async function(payload) {
    payload = payload || {};
    for (var i = 0; i < ae.importers.items.length; i++) {
      var importer = ae.importers.items[i];
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
    var existing = ae.ui.globalButtons.items.findIndex(function(b) { return b.id === button.id; });
    if (existing >= 0) ae.ui.globalButtons.items[existing] = Object.assign({}, ae.ui.globalButtons.items[existing], button);
    else ae.ui.globalButtons.items.push(button);
    ae.ui.globalButtons.items.sort(function(a, b) { return Number(a.priority || 500) - Number(b.priority || 500); });
    ae.ui.globalButtons.render();
    return button;
  };
  ae.ui.globalButtons.render = ae.ui.globalButtons.render || function() {
    var leftColumn = document.querySelector('#leftColumn');
    var mount = null;
    var sidebarMode = false;
    if (leftColumn) {
      mount = document.querySelector('#__accmSidebar');
      if (!mount) {
        mount = document.createElement('div');
        mount.id = '__accmSidebar';
        mount.style.cssText = 'margin-top:.5rem;border:1px solid rgba(127,127,127,.25);border-radius:10px;background:rgba(127,127,127,.06);overflow:auto;max-height:calc(100vh - 1rem);overscroll-behavior:contain;flex:0 0 auto;';
        var firstRow = leftColumn.firstElementChild;
        if (firstRow && firstRow.nextSibling) leftColumn.insertBefore(mount, firstRow.nextSibling);
        else leftColumn.prepend(mount);
      }
      sidebarMode = true;
    } else {
      mount = document.querySelector('#__accmGlobalButtons');
      if (!mount) {
        mount = document.createElement('div');
        mount.id = '__accmGlobalButtons';
        mount.style.cssText = 'position:fixed;right:12px;top:72px;z-index:999998;display:flex;flex-direction:column;gap:6px;pointer-events:none;';
        document.body.appendChild(mount);
      }
    }

    mount.innerHTML = '';
    if (sidebarMode) {
      var header = document.createElement('button');
      header.innerHTML = '<span class="__accmSidebarArrow" style="display:inline-block;transition:transform .18s ease;transform:' + (ae.ui.globalButtons.expanded ? 'rotate(90deg)' : 'rotate(0deg)') + ';">▶</span> <span>ACCM</span>';
      header.style.cssText = 'width:100%;min-height:2.2rem;text-align:left;padding:.35rem .55rem;border:0;background:transparent;color:inherit;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:.35rem;';
      header.onclick = function() { ae.ui.globalButtons.expanded = !ae.ui.globalButtons.expanded; ae.ui.globalButtons.render(); };
      mount.appendChild(header);
      if (!ae.ui.globalButtons.expanded) return;


      var list = document.createElement('div');
      list.style.cssText = 'display:grid;gap:.35rem;padding:.45rem;max-height:calc(100vh - 8rem);overflow-y:auto;overscroll-behavior:contain;min-height:0;';
      list.addEventListener('wheel', function(e) { e.stopPropagation(); }, { passive: true });
      mount.appendChild(list);
      ae.ui.globalButtons.items.forEach(function(btn) {
        var el = document.createElement('button');
        el.textContent = btn.label || btn.id;
        el.title = btn.title || btn.label || btn.id;
        el.style.cssText = 'min-height:2.2rem;text-align:left;padding:.35rem .55rem;border-radius:8px;border:1px solid rgba(127,127,127,.25);background:var(--button-bg);color:inherit;cursor:pointer;';
        el.addEventListener('click', function(e) {
          e.preventDefault(); e.stopPropagation();
          try {
            if (Array.isArray(btn.panelItems) && btn.panelItems.length) {
              ae.ui.globalButtons.openPanelId = ae.ui.globalButtons.openPanelId === btn.id ? null : btn.id;
              ae.ui.globalButtons.render();
            } else {
              btn.onClick(e);
            }
          } catch(err) { console.error('[accm] global sidebar button failed:', btn.id, err); if (typeof __aeToast === 'function') __aeToast('Button failed: ' + btn.id + ': ' + err.message, 5000); }
        });
        list.appendChild(el);
        if (ae.ui.globalButtons.openPanelId === btn.id && Array.isArray(btn.panelItems)) {
          var panel = document.createElement('div');
          panel.style.cssText = 'display:grid;gap:.3rem;margin-left:.8rem;margin-top:-.15rem;margin-bottom:.35rem;padding-left:.45rem;border-left:2px solid rgba(127,127,127,.25);max-height:min(42vh,360px);overflow-y:auto;overscroll-behavior:contain;min-height:0;';
          panel.addEventListener('wheel', function(e) { e.stopPropagation(); }, { passive: true });
          btn.panelItems.forEach(function(item) {
            if (item.type === 'toggle') {
              var label = document.createElement('label');
              label.style.cssText = 'min-height:2rem;display:flex;align-items:center;justify-content:space-between;gap:.6rem;padding:.3rem .5rem;border-radius:7px;border:1px solid rgba(127,127,127,.2);background:rgba(127,127,127,.08);color:inherit;cursor:pointer;';
              var span = document.createElement('span');
              span.textContent = item.label || item.id;
              var input = document.createElement('input');
              input.type = 'checkbox';
              input.style.cssText = 'transform:scale(1.25);';
              try { input.checked = !!item.getValue(); } catch(e) { input.checked = false; }
              input.onchange = function(ev) {
                ev.stopPropagation();
                try { item.setValue(input.checked); } catch(err) { console.error('[accm] sidebar toggle failed:', item.id, err); if (typeof __aeToast === 'function') __aeToast('Toggle failed: ' + (item.label || item.id) + ': ' + err.message, 5000); }
              };
              label.appendChild(span);
              label.appendChild(input);
              panel.appendChild(label);
            } else {
              var sub = document.createElement('button');
              sub.textContent = item.label || item.id;
              sub.title = item.title || item.label || item.id;
              sub.style.cssText = 'min-height:2rem;text-align:left;padding:.3rem .5rem;border-radius:7px;border:1px solid rgba(127,127,127,.2);background:rgba(127,127,127,.08);color:inherit;cursor:pointer;';
              sub.onclick = function(ev) {
                ev.preventDefault(); ev.stopPropagation();
                try { item.onClick(ev); } catch(err) { console.error('[accm] sidebar panel item failed:', item.id, err); if (typeof __aeToast === 'function') __aeToast('Menu item failed: ' + (item.label || item.id) + ': ' + err.message, 5000); }
              };
              panel.appendChild(sub);
            }
          });
          list.appendChild(panel);
        }
      });
    } else {
      ae.ui.globalButtons.items.forEach(function(btn) {
        var el = document.createElement('button');
        el.textContent = btn.label || btn.id;
        el.title = btn.title || btn.label || btn.id;
        el.style.cssText = 'pointer-events:auto;min-height:34px;padding:6px 10px;border-radius:999px;border:1px solid rgba(127,127,127,.35);background:rgba(25,25,25,.88);color:#fff;box-shadow:0 4px 18px rgba(0,0,0,.28);font-weight:600;backdrop-filter:blur(8px);';
        el.addEventListener('click', function(e) {
          e.preventDefault(); e.stopPropagation();
          try { btn.onClick(e); } catch(err) { console.error('[accm] global button failed:', btn.id, err); if (typeof __aeToast === 'function') __aeToast('Button failed: ' + btn.id + ': ' + err.message, 5000); }
        });
        mount.appendChild(el);
      });
    }
  };

  // ---------- installed library + per-thread activations ----------
  ae.library = ae.library || {};
  ae.library.key = ae.library.key || '__accmLibrary';
  ae.library.load = ae.library.load || async function() {
    var row = await db.misc.get(ae.library.key).catch(function() { return null; });
    var value = row && row.value ? row.value : { version: 1, items: [], activations: {} };
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
    var lib = await ae.library.load();
    item = Object.assign({ installedAt: Date.now() }, item || {});
    if (!item.id) item.id = 'local-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    var idx = lib.items.findIndex(function(x) { return x.id === item.id; });
    if (idx >= 0) lib.items[idx] = Object.assign({}, lib.items[idx], item, { updatedAt: Date.now() });
    else lib.items.push(item);
    await ae.library.save(lib);
    return item;
  };
  ae.library.remove = ae.library.remove || async function(itemId) {
    var lib = await ae.library.load();
    lib.items = lib.items.filter(function(x) { return x.id !== itemId; });
    Object.keys(lib.activations).forEach(function(threadId) { delete lib.activations[threadId][itemId]; });
    await ae.library.save(lib);
  };
  ae.library.setActive = ae.library.setActive || async function(itemId, threadId, enabled) {
    var lib = await ae.library.load();
    threadId = String(threadId);
    if (!lib.activations[threadId]) lib.activations[threadId] = {};
    lib.activations[threadId][itemId] = enabled !== false;
    await ae.library.save(lib);
  };
  ae.library.isActive = ae.library.isActive || function(lib, itemId, threadId) {
    var threadActs = lib.activations && lib.activations[String(threadId)];
    return !!(threadActs && threadActs[itemId] === true);
  };
  ae.library.getActiveItems = ae.library.getActiveItems || async function(threadId, filter) {
    var lib = await ae.library.load();
    var items = lib.items.filter(function(item) { return ae.library.isActive(lib, item.id, threadId); });
    if (filter) items = items.filter(filter);
    return items;
  };

  if (typeof __aeRegisterBeforeBotReplyHook === 'function' && !ae.library.skillbookHookRegistered) {
    ae.library.skillbookHookRegistered = true;
    __aeRegisterBeforeBotReplyHook('accmLibrarySkillbooks', async function(opts) {
      if (!opts || !Array.isArray(opts.messages) || typeof opts.threadId !== 'number') return opts;
      var skillbooks = await ae.library.getActiveItems(opts.threadId, function(item) { return item.kind === 'skillbook'; });
      if (!skillbooks.length) return opts;
      var block = skillbooks.map(function(item, i) {
        return 'SKILLBOOK #' + (i + 1) + ': ' + (item.name || item.id) + '\n' + String(item.content || '').slice(0, 8000);
      }).join('\n\n---\n\n');
      var msg = __aeCreateTransientMessageObj({
        threadId: opts.threadId,
        message: 'ACTIVE SKILLBOOKS FOR THIS CHAT\nUse these as specialized guidance when relevant.\n\n' + block,
        characterId: -2,
        name: 'Skillbooks',
        expectsReply: false
      });
      var newMessages = opts.messages.slice();
      var insertAt = newMessages.length;
      for (var i = newMessages.length - 1; i >= 0; i--) { if (newMessages[i].characterId === -1) { insertAt = i + 1; break; } }
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
