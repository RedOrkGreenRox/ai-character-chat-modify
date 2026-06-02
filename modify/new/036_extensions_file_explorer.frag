
// ============================================
// AI CHARACTER CHAT — FILE EXPLORER MODULE
// ============================================
// Provides /files and /explorer commands; accessible from unified 🧩 Menu.
// Shows uploaded/processed file registry stored in db.misc.
// ============================================

async function __aeRenderFileExplorerBody(win, opts) {
  opts = opts || {};
  var files = await __aeGetUploadedFiles({ threadId: activeThreadId, includeAllThreads: !!opts.includeAllThreads });
  var activeFiles = files.filter(function(f) { return f.contextActive !== false; });
  var totalChars = activeFiles.reduce(function(sum, f) { return sum + (f.contextCharCount || 0); }, 0);

  var html = '';
  html += '<div style="padding:0.6rem; font-size:0.9rem;">';
  html += '<div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap; margin-bottom:0.5rem;">';
  html += '<b>🗂️ Uploaded files</b>';
  html += '<button class="__aeRefreshFiles">refresh</button>';
  html += '<button class="__aeToggleAllThreads">' + (opts.includeAllThreads ? 'current thread only' : 'all threads') + '</button>';
  html += '</div>';
  html += '<div style="opacity:0.75; margin-bottom:0.5rem;">AI-visible file context buffer: ' + totalChars + ' / ' + __AE_FILE_CONTEXT_BUFFER_CHARS + ' chars. Oldest contexts are hidden from AI when the buffer is exceeded; @mentions can reactivate a file.</div>';
  html += '<input class="__aeFileFilter" placeholder="Filter files..." style="box-sizing:border-box;width:100%;padding:0.35rem;margin-bottom:0.55rem;">';

  if (files.length === 0) {
    html += '<div style="opacity:0.7;">No uploaded files registered yet. Drop/paste files or use <code>/file</code>.</div>';
  } else {
    html += '<div style="display:flex; flex-direction:column; gap:0.45rem;">';
    files.forEach(function(f) {
      var statusColor = f.status === 'ok' ? '#238636' : f.status === 'buffered-out' ? '#b7791f' : f.status === 'partial' ? '#b7791f' : '#c53030';
      html += '<div class="__aeFileRow" data-file-id="' + sanitizeHtml(f.id) + '" style="border:1px solid var(--border-color); border-radius:8px; padding:0.5rem; background:rgba(127,127,127,0.06);">';
      html += '<div style="display:flex; justify-content:space-between; gap:0.5rem; align-items:flex-start;">';
      html += '<div style="min-width:0;"><div style="font-weight:600; overflow-wrap:anywhere;">' + sanitizeHtml(f.name) + '</div>';
      html += '<div style="font-size:0.8rem; opacity:0.75;">' + sanitizeHtml(f.kind || f.ext || 'file') + ' · ' + new Date(f.uploadedAt || Date.now()).toLocaleString() + ' · <span style="color:' + statusColor + '">' + sanitizeHtml(f.status || 'ok') + '</span>' + (f.contextActive === false ? ' · not in AI buffer' : '') + '</div></div>';
      html += '</div>';
      html += '<div style="font-size:0.82rem; opacity:0.85; max-height:3.5rem; overflow:hidden; white-space:pre-wrap; margin:0.35rem 0;">' + sanitizeHtml((f.preview || '').slice(0, 350)) + '</div>';
      html += '<div style="display:flex; gap:0.35rem; flex-wrap:wrap;">';
      html += '<button class="__aeMentionFile">insert @[...]</button>';
      html += '<button class="__aeRecallFile">recall to AI</button>';
      html += '<button class="__aePreviewFile">preview</button>';
      html += '<button class="__aeForgetFile">forget</button>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
  }
  html += '</div>';

  win.bodyEl.innerHTML = html;

  win.bodyEl.querySelector('.__aeRefreshFiles')?.addEventListener('click', function() {
    __aeRenderFileExplorerBody(win, opts);
  });
  win.bodyEl.querySelector('.__aeToggleAllThreads')?.addEventListener('click', function() {
    opts.includeAllThreads = !opts.includeAllThreads;
    __aeRenderFileExplorerBody(win, opts);
  });

  win.bodyEl.querySelector('.__aeFileFilter')?.addEventListener('input', function(e) {
    var q = (e.target.value || '').toLowerCase();
    win.bodyEl.querySelectorAll('.__aeFileRow').forEach(function(row) {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  win.bodyEl.querySelectorAll('.__aeFileRow').forEach(function(row) {
    var fileId = row.dataset.fileId;
    var file = files.find(function(f) { return f.id === fileId; });
    if (!file) return;

    row.querySelector('.__aeMentionFile')?.addEventListener('click', function() {
      var mention = '@[' + file.name + ']';
      $.messageInput.value = ($.messageInput.value ? $.messageInput.value + ' ' : '') + mention;
      $.messageInput.focus();
      __aeToast('Inserted mention: ' + mention, 3000);
    });

    row.querySelector('.__aeRecallFile')?.addEventListener('click', async function() {
      await __aeReactivateFileContext(file);
      __aeToast('📎 Recalled file context: ' + file.name, 4000);
      __aeRenderFileExplorerBody(win, opts);
    });

    row.querySelector('.__aePreviewFile')?.addEventListener('click', function() {
      var preview = file.fullText || file.preview || '(No preview available.)';
      var pwin = createFloatingWindow({
        header: 'Preview: ' + sanitizeHtml(file.name),
        initialWidth: Math.min(800, window.innerWidth - 40),
        initialHeight: Math.min(600, window.innerHeight - 80),
        body: '<pre style="white-space:pre-wrap; overflow:auto; padding:0.75rem; margin:0;">' + sanitizeHtml(preview) + '</pre>'
      });
      return pwin;
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
  if (typeof activeThreadId !== 'number' || !Number.isFinite(activeThreadId)) {
    __aeToast('⚠️ Open a chat thread first.', 4000);
    return;
  }
  var win = createFloatingWindow({
    header: '🗂️ File Explorer',
    initialWidth: Math.min(760, window.innerWidth - 40),
    initialHeight: Math.min(600, window.innerHeight - 80),
    body: '<div style="padding:1rem;">Loading files...</div>'
  });
  await __aeRenderFileExplorerBody(win, opts);
  return win;
}

// Patch command dispatcher from shortcuts/init module.
var __aeFileExplorerOriginalHandleCommandText = __aeHandleCommandText;
__aeHandleCommandText = async function(text) {
  text = (text || '').trim();
  if (text === '/files' || text === '/explorer') {
    await __aeShowFileExplorer();
    return true;
  }
  return __aeFileExplorerOriginalHandleCommandText.apply(this, arguments);
};

console.log('[ae] File Explorer module loaded. Commands: /files, /explorer');
