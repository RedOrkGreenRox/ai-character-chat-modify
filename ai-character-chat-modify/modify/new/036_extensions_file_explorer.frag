
// ============================================
// AI CHARACTER CHAT — GLOBAL EXPLORER MODULE
// ============================================
// Provides /files and /explorer commands.
// Current scope:
//   - Files tab is global by default and can show files from all chats.
//   - Memory tab is a read-only browser for lore/memory records.
//   - Per-chat activation toggles for global lorebooks/skillbooks are planned.
// ============================================

async function __aeRenderFileExplorerBody(win, opts) {
  opts = opts || {};
  opts.mode = opts.mode || 'files';
  if (opts.includeAllThreads === undefined) opts.includeAllThreads = true;

  let hasActiveThread = typeof activeThreadId === 'number' && Number.isFinite(activeThreadId);

  async function renderFiles() {
    let files = await __aeGetUploadedFiles({ threadId: activeThreadId, includeAllThreads: !!opts.includeAllThreads });
    let activeFiles = files.filter(function(f) { return f.contextActive !== false; });
    let totalChars = activeFiles.reduce(function(sum, f) { return sum + (f.contextCharCount || 0); }, 0);

    let html = '';
    html += '<div style="padding:0.6rem; font-size:0.9rem;">';
    html += '<div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap; margin-bottom:0.5rem;">';
    html += '<b>🗂️ Files</b>';
    html += '<button class="__aeRefreshFiles">refresh</button>';
    if (hasActiveThread) html += '<button class="__aeToggleAllThreads">' + (opts.includeAllThreads ? 'current chat only' : 'all chats') + '</button>';
    else html += '<span style="opacity:.7;">all chats</span>';
    html += '</div>';
    html += '<div style="opacity:0.75; margin-bottom:0.5rem;">Global file browser. AI-visible active file context: ' + totalChars + ' / ' + __AE_FILE_CONTEXT_BUFFER_CHARS + ' chars. Cross-chat one-click activation for large files is planned.</div>';
    html += '<input class="__aeFileFilter" placeholder="Filter files..." style="box-sizing:border-box;width:100%;padding:0.35rem;margin-bottom:0.55rem;">';

    if (files.length === 0) {
      html += '<div style="opacity:0.7;">No uploaded files registered yet. Drop/paste files or use <code>/file</code>.</div>';
    } else {
      html += '<div style="display:flex; flex-direction:column; gap:0.45rem;">';
      files.forEach(function(f) {
        let statusColor = f.status === 'ok' ? '#238636' : f.status === 'buffered-out' ? '#b7791f' : f.status === 'partial' ? '#b7791f' : '#c53030';
        let sameThread = hasActiveThread && f.threadId === activeThreadId;
        html += '<div class="__aeFileRow" data-file-id="' + sanitizeHtml(f.id) + '" style="border:1px solid var(--border-color); border-radius:8px; padding:0.5rem; background:rgba(127,127,127,0.06);">';
        html += '<div style="display:flex; justify-content:space-between; gap:0.5rem; align-items:flex-start;">';
        html += '<div style="min-width:0;"><div style="font-weight:600; overflow-wrap:anywhere;">' + sanitizeHtml(f.name) + '</div>';
        html += '<div style="font-size:0.8rem; opacity:0.75;">' + sanitizeHtml(f.kind || f.ext || 'file') + ' · chat #' + sanitizeHtml(f.threadId == null ? '?' : f.threadId) + ' · ' + new Date(f.uploadedAt || Date.now()).toLocaleString() + ' · <span style="color:' + statusColor + '">' + sanitizeHtml(f.status || 'ok') + '</span>' + (f.contextActive === false ? ' · not in AI buffer' : '') + '</div></div>';
        html += '</div>';
        html += '<div style="font-size:0.82rem; opacity:0.85; max-height:3.5rem; overflow:hidden; white-space:pre-wrap; margin:0.35rem 0;">' + sanitizeHtml((f.preview || '').slice(0, 350)) + '</div>';
        html += '<div style="display:flex; gap:0.35rem; flex-wrap:wrap;">';
        html += '<button class="__aeMentionFile" ' + (!hasActiveThread ? 'disabled title="Open a chat first"' : '') + '>insert @[...]</button>';
        html += '<button class="__aeRecallFile" ' + (!hasActiveThread ? 'disabled title="Open a chat first"' : '') + '>' + (sameThread ? 'recall to AI' : 'recall here') + '</button>';
        html += '<button class="__aePreviewFile">preview</button>';
        html += '<button class="__aeForgetFile">forget</button>';
        html += '</div>';
        html += '</div>';
      });
      html += '</div>';
    }
    html += '</div>';
    return { html: html, files: files };
  }

  async function renderMemory() {
    let lore = [];
    let oldMemories = [];
    let structuredMemories = [];
    try { lore = await db.lore.limit(300).toArray(); } catch(e) {}
    try { oldMemories = await db.memories.limit(300).toArray(); } catch(e) {}

    try {
      let messages = await db.messages.filter(function(msg) {
        return msg.memoriesEndingHere && Object.keys(msg.memoriesEndingHere).length > 0;
      }).toArray();
      messages.sort(function(a, b) { return (a.threadId - b.threadId) || (a.order - b.order); });
      messages.forEach(function(msg) {
        let levels = msg.memoriesEndingHere || {};
        Object.keys(levels).sort(function(a,b){ return Number(a)-Number(b); }).forEach(function(level) {
          (levels[level] || []).forEach(function(mem, index) {
            structuredMemories.push({
              kind: 'generated-memory',
              id: msg.id + '|' + level + '|' + index,
              messageId: msg.id,
              threadId: msg.threadId,
              order: msg.order,
              level: Number(level),
              index: index,
              text: mem.text || '',
              disabled: mem.disabled === true
            });
          });
        });
      });
    } catch(e) { console.warn('[ae explorer] could not read generated memories:', e); }

    lore.sort(function(a, b) { return (b.id || 0) - (a.id || 0); });
    oldMemories.sort(function(a, b) { return (b.id || 0) - (a.id || 0); });

    let memoryItems = [];
    let html = '';
    html += '<div style="padding:0.6rem; font-size:0.9rem;">';
    html += '<div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-bottom:.5rem;"><b>🧠 Memory / Lore</b><button class="__aeRefreshFiles">refresh</button></div>';
    html += '<div style="opacity:.75;margin-bottom:.5rem;">Global memory browser. You can enable/disable or delete lore and generated memories. Disabled items are skipped by retrieval.</div>';
    html += '<input class="__aeFileFilter" placeholder="Filter memory/lore..." style="box-sizing:border-box;width:100%;padding:0.35rem;margin-bottom:0.55rem;">';

    html += '<h4>Lore entries (' + lore.length + ')</h4>';
    if (!lore.length) html += '<div style="opacity:.7;">No lore entries.</div>';
    lore.slice(0, 300).forEach(function(e) {
      let itemIndex = memoryItems.push({ type: 'lore', item: e }) - 1;
      html += '<div class="__aeFileRow __aeMemoryRow" data-memory-i="' + itemIndex + '" style="border:1px solid var(--border-color);border-radius:8px;padding:.5rem;margin-bottom:.45rem;background:rgba(127,127,127,0.06);' + (e.disabled ? 'opacity:.55;' : '') + '">';
      html += '<div style="display:flex;gap:.5rem;align-items:flex-start;"><div style="flex:1;min-width:0;">';
      html += '<div style="font-size:.78rem;opacity:.65;">' + (e.disabled ? '🔴 disabled · ' : '🟢 enabled · ') + 'lore #' + sanitizeHtml(e.id) + ' · book ' + sanitizeHtml(e.bookId) + '</div>';
      html += '<div style="white-space:pre-wrap;max-height:5rem;overflow:hidden;">' + sanitizeHtml((e.text || '').slice(0, 700)) + '</div>';
      html += '</div><div style="display:flex;gap:.45rem;flex-wrap:wrap;justify-content:flex-end;align-items:center;"><label style="display:flex;gap:.35rem;align-items:center;cursor:pointer;"><span>enabled</span><input class="__aeToggleMemoryInput" type="checkbox" ' + (e.disabled ? '' : 'checked') + ' style="transform:scale(1.25);"></label><button class="__aeDeleteMemory" style="background:#7a1e1e;color:#fff;border-color:#a94444;">delete</button></div></div>';
      html += '</div>';
    });

    html += '<h4>Generated memories (' + structuredMemories.length + ')</h4>';
    if (!structuredMemories.length) html += '<div style="opacity:.7;">No generated memories.</div>';
    let lastThread = null, lastMessage = null;
    structuredMemories.slice(0, 500).forEach(function(m) {
      if (m.threadId !== lastThread) {
        html += '<div class="__aeFileRow" style="margin:.55rem 0 .25rem;font-weight:700;opacity:.85;">Thread #' + sanitizeHtml(m.threadId) + '</div>';
        lastThread = m.threadId;
        lastMessage = null;
      }
      if (m.messageId !== lastMessage) {
        html += '<div class="__aeFileRow" style="margin:.35rem 0 .2rem;padding-left:.8rem;font-weight:600;opacity:.75;">Message #' + sanitizeHtml(m.messageId) + ' · order ' + sanitizeHtml(m.order) + '</div>';
        lastMessage = m.messageId;
      }
      let itemIndex = memoryItems.push({ type: 'generated-memory', item: m }) - 1;
      let indent = Math.min(4, Math.max(0, Number(m.level) || 0)) * 1.1 + 1.2;
      html += '<div class="__aeFileRow __aeMemoryRow" data-memory-i="' + itemIndex + '" style="border:1px solid var(--border-color);border-radius:8px;padding:.5rem;margin-bottom:.35rem;margin-left:' + indent + 'rem;background:rgba(127,127,127,0.06);' + (m.disabled ? 'opacity:.55;' : '') + '">';
      html += '<div style="display:flex;gap:.5rem;align-items:flex-start;"><div style="flex:1;min-width:0;">';
      html += '<div style="font-size:.78rem;opacity:.65;">' + (m.disabled ? '🔴 disabled · ' : '🟢 enabled · ') + 'memory ' + sanitizeHtml(m.id) + '</div>';
      html += '<div style="white-space:pre-wrap;max-height:5rem;overflow:hidden;">' + sanitizeHtml((m.text || '').slice(0, 700)) + '</div>';
      html += '</div><div style="display:flex;gap:.45rem;flex-wrap:wrap;justify-content:flex-end;align-items:center;"><label style="display:flex;gap:.35rem;align-items:center;cursor:pointer;"><span>enabled</span><input class="__aeToggleMemoryInput" type="checkbox" ' + (m.disabled ? '' : 'checked') + ' style="transform:scale(1.25);"></label><button class="__aeDeleteMemory" style="background:#7a1e1e;color:#fff;border-color:#a94444;">delete</button></div></div>';
      html += '</div>';
    });

    html += '<h4>Legacy memory records (' + oldMemories.length + ')</h4>';
    if (!oldMemories.length) html += '<div style="opacity:.7;">No legacy memory records.</div>';
    oldMemories.slice(0, 200).forEach(function(m) {
      let itemIndex = memoryItems.push({ type: 'legacy-memory', item: m }) - 1;
      html += '<div class="__aeFileRow __aeMemoryRow" data-memory-i="' + itemIndex + '" style="border:1px solid var(--border-color);border-radius:8px;padding:.5rem;margin-bottom:.45rem;background:rgba(127,127,127,0.06);' + (m.disabled ? 'opacity:.55;' : '') + '">';
      html += '<div style="display:flex;gap:.5rem;align-items:flex-start;"><div style="flex:1;min-width:0;">';
      html += '<div style="font-size:.78rem;opacity:.65;">' + (m.disabled ? '🔴 disabled · ' : '🟢 enabled · ') + 'legacy memory #' + sanitizeHtml(m.id) + ' · thread ' + sanitizeHtml(m.threadId) + ' · status ' + sanitizeHtml(m.status || '') + '</div>';
      html += '<div style="white-space:pre-wrap;max-height:5rem;overflow:hidden;">' + sanitizeHtml((m.text || m.summary || JSON.stringify(m).slice(0, 700) || '').slice(0, 700)) + '</div>';
      html += '</div><div style="display:flex;gap:.45rem;flex-wrap:wrap;justify-content:flex-end;align-items:center;"><label style="display:flex;gap:.35rem;align-items:center;cursor:pointer;"><span>enabled</span><input class="__aeToggleMemoryInput" type="checkbox" ' + (m.disabled ? '' : 'checked') + ' style="transform:scale(1.25);"></label><button class="__aeDeleteMemory" style="background:#7a1e1e;color:#fff;border-color:#a94444;">delete</button></div></div>';
      html += '</div>';
    });
    html += '</div>';
    return { html: html, files: [], memoryItems: memoryItems };
  }

  async function renderObjects() {
    let lib = window.__accm && window.__accm.library ? await window.__accm.library.load() : { items: [], activations: {} };
    let characters = [];
    try { characters = await db.characters.toArray(); } catch(e) {}
    characters.sort(function(a,b){ return (b.lastMessageTime || 0) - (a.lastMessageTime || 0); });
    let modules = (window.__accm && window.__accm.modules && window.__accm.modules.items) ? window.__accm.modules.items : [];
    let packs = (window.__accm && window.__accm.packs && window.__accm.packs.items) ? window.__accm.packs.items : [];
    let skillbooks = (window.__accm && window.__accm.skillbooks && window.__accm.skillbooks.items) ? window.__accm.skillbooks.items : [];
    let threadId = hasActiveThread ? String(activeThreadId) : null;
    let acts = threadId && lib.activations ? (lib.activations[threadId] || {}) : {};
    let objectItems = [];

    let html = '';
    html += '<div style="padding:0.6rem;font-size:.9rem;">';
    html += '<div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-bottom:.5rem;"><b>📦 Objects</b><button class="__aeRefreshFiles">refresh</button></div>';
    html += '<div style="opacity:.75;margin-bottom:.5rem;">Installed Workshop objects, characters, skillbooks, packs, and extension modules. Core modules that power this explorer cannot be disabled here.</div>';
    html += '<input class="__aeFileFilter" placeholder="Filter objects..." style="box-sizing:border-box;width:100%;padding:0.35rem;margin-bottom:0.55rem;">';

    html += '<h4>Installed library items (' + lib.items.length + ')</h4>';
    if (!lib.items.length) html += '<div style="opacity:.7;">No installed library items yet.</div>';
    lib.items.forEach(function(item) {
      let i = objectItems.push({ type: 'library', item: item }) - 1;
      let active = !!acts[item.id];
      html += '<div class="__aeFileRow __aeObjectRow" data-object-i="' + i + '" style="border:1px solid var(--border-color);border-radius:8px;padding:.5rem;margin-bottom:.45rem;background:rgba(127,127,127,.06);">';
      html += '<div style="display:flex;gap:.5rem;align-items:flex-start;"><div style="flex:1;min-width:0;"><b>' + sanitizeHtml(item.name || item.id) + '</b> <span style="opacity:.65;">' + sanitizeHtml(item.kind || 'item') + '</span>';
      html += '<div style="opacity:.65;font-size:.82rem;">' + sanitizeHtml((item.tags || []).join(', ')) + (hasActiveThread ? ' · ' + (active ? '🟢 active here' : '⚪ inactive here') : '') + '</div></div>';
      html += '<div style="display:flex;gap:.45rem;flex-wrap:wrap;justify-content:flex-end;align-items:center;">' + (hasActiveThread ? '<label style="display:flex;gap:.35rem;align-items:center;cursor:pointer;"><span>active here</span><input class="__aeToggleObjectInput" type="checkbox" ' + (active ? 'checked' : '') + ' style="transform:scale(1.25);"></label>' : '') + '<button class="__aeDeleteObject" style="background:#7a1e1e;color:#fff;border-color:#a94444;">delete</button></div></div>';
      html += '</div>';
    });

    html += '<h4>Characters (' + characters.length + ')</h4>';
    characters.slice(0, 300).forEach(function(c) {
      html += '<div class="__aeFileRow" style="border:1px solid var(--border-color);border-radius:8px;padding:.5rem;margin-bottom:.35rem;background:rgba(127,127,127,.06);display:flex;gap:.5rem;align-items:center;">';
      html += '<div class="avatar" style="width:32px;height:32px;min-width:32px;border-radius:8px;background-size:cover;background-position:center;' + (c.avatar && c.avatar.url ? 'background-image:url(' + sanitizeHtml(c.avatar.url) + ');' : '') + '"></div>';
      html += '<div><b>' + sanitizeHtml(c.name || 'Unnamed') + '</b> <span style="opacity:.65;">#' + sanitizeHtml(c.id) + '</span><div style="opacity:.65;font-size:.82rem;">' + sanitizeHtml(c.tagline || '') + '</div></div>';
      html += '</div>';
    });

    html += '<h4>Skillbook registry (' + skillbooks.length + ')</h4>';
    skillbooks.forEach(function(sk) {
      html += '<div class="__aeFileRow" style="border:1px solid var(--border-color);border-radius:8px;padding:.5rem;margin-bottom:.35rem;background:rgba(127,127,127,.06);"><b>' + sanitizeHtml(sk.label || sk.name || sk.id) + '</b><div style="opacity:.65;font-size:.82rem;">' + sanitizeHtml((sk.tags || []).join(', ')) + '</div></div>';
    });

    html += '<h4>Extension packs (' + packs.length + ')</h4>';
    packs.forEach(function(pk) {
      html += '<div class="__aeFileRow" style="border:1px solid var(--border-color);border-radius:8px;padding:.5rem;margin-bottom:.35rem;background:rgba(127,127,127,.06);"><b>' + sanitizeHtml(pk.label || pk.name || pk.id) + '</b> <span style="opacity:.65;">' + sanitizeHtml(pk.packType || pk.kind || 'pack') + '</span><div style="opacity:.65;font-size:.82rem;">' + sanitizeHtml((pk.tags || []).join(', ')) + '</div></div>';
    });

    html += '<h4>Extension modules (' + modules.length + ')</h4>';
    modules.forEach(function(m) {
      let essential = m.id === 'accm-runtime' || m.id === 'global-explorer';
      html += '<div class="__aeFileRow" style="border:1px solid var(--border-color);border-radius:8px;padding:.5rem;margin-bottom:.35rem;background:rgba(127,127,127,.06);"><b>' + sanitizeHtml(m.title || m.id) + '</b><div style="opacity:.65;font-size:.82rem;">' + sanitizeHtml(m.id) + (essential ? ' · core, cannot be disabled' : '') + '</div></div>';
    });
    html += '</div>';
    return { html: html, files: [], objectItems: objectItems };
  }

  let result = opts.mode === 'memory' ? await renderMemory() : opts.mode === 'objects' ? await renderObjects() : await renderFiles();
  let top = '';
  top += '<div style="display:flex;gap:.35rem;padding:.55rem .6rem;border-bottom:1px solid rgba(127,127,127,.25);position:sticky;top:0;background:inherit;z-index:2;">';
  top += '<button class="__aeExplorerTab" data-mode="files" ' + (opts.mode === 'files' ? 'disabled' : '') + '>Files</button>';
  top += '<button class="__aeExplorerTab" data-mode="memory" ' + (opts.mode === 'memory' ? 'disabled' : '') + '>Memory</button>';
  top += '<button class="__aeExplorerTab" data-mode="objects" ' + (opts.mode === 'objects' ? 'disabled' : '') + '>Objects</button>'; 
  top += '</div>';
  win.bodyEl.innerHTML = top + result.html;

  win.bodyEl.querySelectorAll('.__aeExplorerTab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      opts.mode = btn.dataset.mode || 'files';
      __aeRenderFileExplorerBody(win, opts);
    });
  });

  win.bodyEl.querySelector('.__aeRefreshFiles')?.addEventListener('click', function() {
    __aeRenderFileExplorerBody(win, opts);
  });
  win.bodyEl.querySelector('.__aeToggleAllThreads')?.addEventListener('click', function() {
    opts.includeAllThreads = !opts.includeAllThreads;
    __aeRenderFileExplorerBody(win, opts);
  });
  win.bodyEl.querySelector('.__aeFileFilter')?.addEventListener('input', function(e) {
    let q = (e.target.value || '').toLowerCase();
    win.bodyEl.querySelectorAll('.__aeFileRow').forEach(function(row) {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  if (opts.mode === 'objects') {
    let objectItems = result.objectItems || [];
    win.bodyEl.querySelectorAll('.__aeObjectRow').forEach(function(row) {
      let ref = objectItems[Number(row.dataset.objectI)];
      if (!ref || ref.type !== 'library') return;
      row.querySelector('.__aeToggleObjectInput')?.addEventListener('change', async function(e) {
        if (!hasActiveThread) return;
        let enabled = !!e.target.checked;
        await window.__accm.library.setActive(ref.item.id, activeThreadId, enabled);
        __aeToast((enabled ? 'Enabled here: ' : 'Disabled here: ') + (ref.item.name || ref.item.id), 3000);
        __aeRenderFileExplorerBody(win, opts);
      });
      row.querySelector('.__aeDeleteObject')?.addEventListener('click', async function() {
        if (!confirm('Delete this installed object globally?')) return;
        await window.__accm.library.remove(ref.item.id);
        __aeToast('Deleted installed object.', 2500);
        __aeRenderFileExplorerBody(win, opts);
      });
    });
    return;
  }

  if (opts.mode === 'memory') {
    let memoryItems = result.memoryItems || [];

    async function updateGeneratedMemory(item, patch, doDelete) {
      let msg = await db.messages.get(item.messageId);
      if (!msg || !msg.memoriesEndingHere || !msg.memoriesEndingHere[item.level]) return;
      let arr = msg.memoriesEndingHere[item.level];
      if (doDelete) arr.splice(item.index, 1);
      else Object.assign(arr[item.index], patch || {});
      await db.messages.update(item.messageId, { memoriesEndingHere: msg.memoriesEndingHere });
    }

    win.bodyEl.querySelectorAll('.__aeMemoryRow').forEach(function(row) {
      let ref = memoryItems[Number(row.dataset.memoryI)];
      if (!ref) return;
      row.querySelector('.__aeToggleMemoryInput')?.addEventListener('change', async function(e) {
        let disabled = !e.target.checked;
        if (ref.type === 'lore') await db.lore.update(ref.item.id, { disabled: disabled });
        else if (ref.type === 'legacy-memory') await db.memories.update(ref.item.id, { disabled: disabled });
        else if (ref.type === 'generated-memory') await updateGeneratedMemory(ref.item, { disabled: disabled }, false);
        __aeToast((disabled ? 'Disabled: ' : 'Enabled: ') + (ref.item.text || ref.item.id || '').slice(0, 60), 3000);
        __aeRenderFileExplorerBody(win, opts);
      });
      row.querySelector('.__aeDeleteMemory')?.addEventListener('click', async function() {
        if (!confirm('Delete this item? This cannot be undone.')) return;
        if (ref.type === 'lore') await db.lore.delete(ref.item.id);
        else if (ref.type === 'legacy-memory') await db.memories.delete(ref.item.id);
        else if (ref.type === 'generated-memory') await updateGeneratedMemory(ref.item, {}, true);
        __aeToast('Deleted.', 2500);
        __aeRenderFileExplorerBody(win, opts);
      });
    });
    return;
  }

  if (opts.mode !== 'files') return;
  let files = result.files;
  win.bodyEl.querySelectorAll('.__aeFileRow').forEach(function(row) {
    let fileId = row.dataset.fileId;
    let file = files.find(function(f) { return f.id === fileId; });
    if (!file) return;

    row.querySelector('.__aeMentionFile')?.addEventListener('click', function() {
      if (!hasActiveThread) return __aeToast('Open a chat first.', 3000);
      let mention = '@[' + file.name + ']';
      $.messageInput.value = ($.messageInput.value ? $.messageInput.value + ' ' : '') + mention;
      $.messageInput.focus();
      __aeToast('Inserted mention: ' + mention, 3000);
    });

    row.querySelector('.__aeRecallFile')?.addEventListener('click', async function() {
      if (!hasActiveThread) return __aeToast('Open a chat first.', 3000);
      if (file.threadId === activeThreadId) {
        await __aeReactivateFileContext(file);
      } else if (file.fullText) {
        let content = __aeBuildAiContextContent(file.kind || 'File', file.name, file.fullText, (file.metaText || '') + ' · recalled from global explorer');
        let messageId = await __aeAddAiContextMessage(content, 'Global File Recall', { __aeFileContext: true, fileId: file.id, source: 'global-explorer' });
        __aeToast('📎 Recalled file into current chat: ' + file.name, 4000);
      } else {
        __aeToast('Only a preview is stored for this file. Full cross-chat recall for large files is planned.', 6500);
      }
      __aeRenderFileExplorerBody(win, opts);
    });

    row.querySelector('.__aePreviewFile')?.addEventListener('click', function() {
      let preview = file.fullText || file.preview || '(No preview available.)';
      return createFloatingWindow({
        header: 'Preview: ' + sanitizeHtml(file.name),
        initialWidth: Math.min(800, window.innerWidth - 40),
        initialHeight: Math.min(600, window.innerHeight - 80),
        body: '<pre style="white-space:pre-wrap; overflow:auto; padding:0.75rem; margin:0;">' + sanitizeHtml(preview) + '</pre>'
      });
    });

    row.querySelector('.__aeForgetFile')?.addEventListener('click', async function() {
      if (!confirm('Forget file from explorer? This hides its direct AI context, but does not clean old lore chunks.\n\n' + file.name)) return;
      await __aeForgetUploadedFile(file.id);
      __aeToast('Forgot file: ' + file.name, 3000);
      __aeRenderFileExplorerBody(win, opts);
    });
  });
}

async function __aeShowFileExplorer(opts) {
  opts = opts || {};
  let win = createFloatingWindow({
    header: '🗂️ Explorer',
    initialWidth: Math.min(820, window.innerWidth - 40),
    initialHeight: Math.min(680, window.innerHeight - 80),
    body: '<div style="padding:1rem;">Loading explorer...</div>'
  });
  await __aeRenderFileExplorerBody(win, opts);
  return win;
}

if (window.__accm && window.__accm.commands) {
  window.__accm.commands.register({
    id: 'file-explorer.open',
    aliases: ['/files', '/explorer'],
    description: 'Open global file/memory explorer',
    priority: 120,
    handler: async function() {
      await __aeShowFileExplorer({ includeAllThreads: true });
      return true;
    }
  });
}

if (window.__accm && window.__accm.ui && window.__accm.ui.globalButtons) {
  window.__accm.ui.globalButtons.register({
    id: 'explorer',
    label: '🗂️ Explorer',
    title: 'Open global files/memory explorer',
    priority: 110,
    onClick: function() { __aeShowFileExplorer({ includeAllThreads: true }); }
  });
}

if (window.__accm && window.__accm.modules) {
  window.__accm.modules.register({ id: 'global-explorer', title: 'Global Explorer', provides: ['Files tab', 'Memory tab', 'Objects tab'] });
}

console.log('[ae] Global Explorer module loaded. Commands: /files, /explorer');
