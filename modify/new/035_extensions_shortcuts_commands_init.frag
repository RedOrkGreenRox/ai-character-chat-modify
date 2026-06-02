
// --- Unified Extensions Menu ---

async function __aeShowExtensionsMenu() {
  var win = createFloatingWindow({
    header: '🧩 Extensions Menu',
    initialWidth: Math.min(620, window.innerWidth - 40),
    initialHeight: Math.min(640, window.innerHeight - 80),
    body: '<div style="padding:1rem;">Loading...</div>'
  });

  async function render() {
    var s = __aeLoadSettings();
    var activeFiles = [];
    var totalChars = 0;
    try {
      activeFiles = await __aeGetUploadedFiles({ threadId: activeThreadId });
      totalChars = activeFiles.filter(function(f) { return f.contextActive !== false; }).reduce(function(sum, f) { return sum + (f.contextCharCount || 0); }, 0);
    } catch(e) {}

    var featureRows = [
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

    var html = '';
    html += '<div style="padding:0.75rem; font-size:0.92rem;">';
    html += '<div style="margin-bottom:0.75rem; opacity:0.8;">File context buffer: <b>' + totalChars + '</b> / ' + __AE_FILE_CONTEXT_BUFFER_CHARS + ' chars · files in thread: <b>' + activeFiles.length + '</b></div>';
    html += '<div style="display:grid; grid-template-columns:1fr auto; gap:0.45rem 0.75rem; align-items:center; margin-bottom:1rem;">';
    featureRows.forEach(function(row) {
      var key = row[0], label = row[1], alias = row[2];
      html += '<label for="__aeToggle_' + key + '">' + label + '<div style="font-size:0.78rem; opacity:0.65;">/toggle ' + alias + '</div></label>';
      html += '<input id="__aeToggle_' + key + '" class="__aeMenuToggle" data-key="' + key + '" type="checkbox" ' + (s[key] ? 'checked' : '') + ' style="transform:scale(1.25);">';
    });
    html += '</div>';

    html += '<div style="display:flex; flex-wrap:wrap; gap:0.45rem; margin-bottom:1rem;">';
    html += '<button class="__aeMenuFile">📎 Choose files</button>';
    html += '<button class="__aeMenuFiles">🗂️ File Explorer</button>';
    html += '<button class="__aeMenuVoice">🎙️ Voice</button>';
    html += '<button class="__aeMenuPolicy">🧭 Policy</button>';
    html += '<button class="__aeMenuStatus">⚙️ Status</button>';
    html += '<button class="__aeMenuCancel">🛑 Cancel processing</button>';
    html += '</div>';

    html += '<div style="display:flex; gap:0.4rem; align-items:center; margin-bottom:0.6rem;">';
    html += '<input class="__aeMenuSearchInput" placeholder="Search query..." style="flex:1; min-width:0; padding:0.35rem;">';
    html += '<button class="__aeMenuSearch">🔍 Search</button>';
    html += '</div>';

    html += '<details style="opacity:0.9;"><summary>Commands</summary><pre style="white-space:pre-wrap; font-size:0.82rem;">/file\n/files or /explorer\n/voice\n/search &lt;query&gt;\n/toggle &lt;feature&gt;\n/policy\n/language &lt;code&gt;\n/extensions</pre></details>';
    html += '</div>';
    win.bodyEl.innerHTML = html;

    win.bodyEl.querySelectorAll('.__aeMenuToggle').forEach(function(input) {
      input.addEventListener('change', async function() {
        var settings = __aeLoadSettings();
        settings[input.dataset.key] = input.checked;
        __aeSaveSettings(settings);
        __aeToast('⚙️ ' + input.dataset.key + ': ' + (input.checked ? 'ON ✅' : 'OFF ❌'), 2500);
        if (typeof activeThreadId === 'number' && Number.isFinite(activeThreadId)) {
          var thread = await db.threads.get(activeThreadId);
          if (thread) { await __aeEnsureShortcutButtons(thread); renderShortcutButtons(thread); setTimeout(__aeStyleShortcutButtons, 50); }
        }
        render();
      });
    });

    win.bodyEl.querySelector('.__aeMenuFile')?.addEventListener('click', function() { __aeFileInput.click(); });
    win.bodyEl.querySelector('.__aeMenuFiles')?.addEventListener('click', function() { __aeShowFileExplorer(); });
    win.bodyEl.querySelector('.__aeMenuVoice')?.addEventListener('click', function() { __aeToggleVoiceRecording(); });
    win.bodyEl.querySelector('.__aeMenuPolicy')?.addEventListener('click', function() { __aeShowBasePolicyModal(); });
    win.bodyEl.querySelector('.__aeMenuStatus')?.addEventListener('click', function() { __aeShowStatus(); });
    win.bodyEl.querySelector('.__aeMenuCancel')?.addEventListener('click', function() { __aeAbortAllProcessing('User cancelled current file processing.'); });
    win.bodyEl.querySelector('.__aeMenuSearch')?.addEventListener('click', function() {
      var q = win.bodyEl.querySelector('.__aeMenuSearchInput').value.trim();
      if (q) __aePerformSearch(q);
    });
  }

  await render();
  return win;
}

// --- Shortcut Buttons ---

async function __aeEnsureShortcutButtons(thread) {
  if (!thread) return;
  if (!Array.isArray(thread.shortcutButtons)) thread.shortcutButtons = [];

  // Remove existing extension buttons from previous versions/modules.
  thread.shortcutButtons = thread.shortcutButtons.filter(function(b) {
    return !b[__AE_EXT];
  });

  thread.shortcutButtons.push({
    name: '🧩 Menu',
    message: '/menu',
    insertionType: 'replace',
    autoSend: true,
    clearAfterSend: true,
    type: 'message'
  });
  thread.shortcutButtons[thread.shortcutButtons.length - 1][__AE_EXT] = true;

  await db.threads.put(thread);
}

// --- Command Interception ---

async function __aeHandleCommandText(text) {
  text = (text || '').trim();
  if (!text) return false;

  if (text === '/menu' || text === '/extmenu') {
    await __aeShowExtensionsMenu();
    return true;
  }

  if (text === '/file') {
    if (activeThreadId) {
      __aeToast('📎 Choose file(s) to process...', 3500);
      __aeFileInput.click();
    } else {
      await __aeAddSystemMessage('⚠️ Open a chat thread first.', 'Extensions');
      __aeToast('⚠️ Open a chat thread first.', 4000);
    }
    return true;
  }

  if (text === '/voice') {
    await __aeToggleVoiceRecording();
    return true;
  }

  if (text.startsWith('/search ')) {
    var query = text.slice(8).trim();
    if (!query) return false;
    __aeToast('🔍 Manual search started...', 3000);
    __aePerformSearch(query).catch(function(e) {
      console.error('[ae] manual search failed:', e);
      __aeToast('❌ Search failed: ' + e.message, 6000);
    });
    return true;
  }

  if (text.startsWith('/toggle ')) {
    var feature = text.slice(8).trim();
    if (!feature) return false;
    await __aeToggle(feature);
    return true;
  }

  if (text === '/extensions' || text === '/ext') {
    await __aeShowStatus();
    return true;
  }

  return false;
}

function __aeSetupCommandHandler() {
  // Capture-phase listener runs before the original click listener. This handles real
  // clicks/Enter. Shortcut buttons are different: the original renderer calls the
  // lexical sendButtonClickHandler() directly, so we also wrap that function below.
  $.sendButton.addEventListener('click', function(e) {
    var text = ($.messageInput.value || '').trim();
    if (!text || text[0] !== '/') return;

    e.stopImmediatePropagation();
    e.preventDefault();

    __aeHandleCommandText(text).then(function(handled) {
      if (handled) $.messageInput.value = '';
      else {
        // Not our command — pass it to the original command system.
        return __aeOriginalSendButtonClickHandler();
      }
    }).catch(function(err) {
      console.error('[ae] command handler error:', err);
      __aeToast('❌ Command failed: ' + err.message, 6000);
    });
  }, true);
}

// Wrap the function itself so shortcut buttons do actions instead of sending
// literal command text as a chat message.
var __aeOriginalSendButtonClickHandler = sendButtonClickHandler;
sendButtonClickHandler = async function() {
  var text = ($.messageInput.value || '').trim();
  if (text && text[0] === '/') {
    try {
      var handled = await __aeHandleCommandText(text);
      if (handled) {
        $.messageInput.value = '';
        return;
      }
    } catch(err) {
      console.error('[ae] command wrapper error:', err);
      __aeToast('❌ Command failed: ' + err.message, 6000);
      return;
    }
  }
  return __aeOriginalSendButtonClickHandler.apply(this, arguments);
};

// --- Wrap showThread to inject shortcut buttons ---
// Original signature: showThread(threadId)
// We wrap it so after it runs, we ensure our shortcut buttons are present.
var __aeOriginalShowThread = showThread;
showThread = async function(threadId) {
  await __aeOriginalShowThread.call(this, threadId);
  // After thread is shown, ensure our shortcut buttons are present
  if (typeof activeThreadId === 'number' && Number.isFinite(activeThreadId)) {
    try {
      var thread = await db.threads.get(activeThreadId);
      if (thread) {
        // Always normalize extension buttons. Older versions stored several
        // extension shortcut buttons in thread.shortcutButtons, so checking merely
        // for the existence of any __AE_EXT button keeps stale buttons forever.
        await __aeEnsureShortcutButtons(thread);
        renderShortcutButtons(thread);
        setTimeout(__aeStyleShortcutButtons, 50);
      }
    } catch(e) {
      console.error('[ae] showThread wrap error:', e);
    }
  }
};


// --- Input tooltip and visual feedback ---

function __aeUpdateInputTooltip() {
  var text = [
    'Extension commands:',
    '/menu — open the unified extensions menu',
    '/file — choose files to add to lore',
    '/search <query> — manual internet search',
    '/voice — start/stop voice message recording',
    '/files — open uploaded file explorer',
    '/policy — set persistent chat policy; /language <code> — fixed language preset',
    '/toggle file|pdf|docx|excel|zip|deepsearch|imageanalysis|voiceprofile|image|audio|search — enable/disable features',
    '/extensions or /ext — show extension status',
    '',
    'Also supported: drag & drop files here, or paste files/images from clipboard.',
    'If Web Search is ON, the character can automatically search the internet when the user asks for web/current/practical factual info.'
  ].join('\n');
  var existing = $.messageInput.getAttribute('title') || '';
  if (!existing.includes('Extension commands:')) {
    $.messageInput.setAttribute('title', existing ? existing + '\n\n' + text : text);
  }
}

function __aeStyleShortcutButtons() {
  try {
    var buttons = $.shortcutButtonsCtn ? $.shortcutButtonsCtn.querySelectorAll('button') : [];
    buttons.forEach(function(btn) {
      var t = (btn.textContent || '').trim();
      if (t.indexOf('📎 File') === 0 || t.indexOf('🔍 Search') === 0 || t.indexOf('⚙️ Status') === 0 || t.indexOf('🎙️ Voice') === 0 || t.indexOf('🧩 Menu') === 0 || t.indexOf('🗂️ Files') === 0 || t.indexOf('🧭 Policy') === 0) {
        btn.style.background = 'linear-gradient(180deg, #245b8f, #173b61)';
        btn.style.color = '#fff';
        btn.style.borderColor = '#6bb7ff';
        btn.style.fontWeight = '600';
        btn.title = (btn.title ? btn.title + ' ' : '') + 'Extension button: ' + t;
      }
    });
  } catch(e) { console.warn('[ae] Could not style shortcut buttons:', e); }
}


// --- Command autocomplete / suggestions ---

const __AE_COMMAND_SUGGESTIONS = [
  {cmd:'/menu', desc:'open extensions menu'},
  {cmd:'/file', desc:'choose files'},
  {cmd:'/files', desc:'open file explorer'},
  {cmd:'/explorer', desc:'open file explorer'},
  {cmd:'/voice', desc:'start/stop voice message'},
  {cmd:'/search ', desc:'manual web search'},
  {cmd:'/search deep ', desc:'deep web search'},
  {cmd:'/toggle search', desc:'toggle web search'},
  {cmd:'/toggle deepsearch', desc:'toggle deep web search'},
  {cmd:'/toggle imageanalysis', desc:'toggle advanced image/OCR'},
  {cmd:'/toggle voiceprofile', desc:'toggle voice profile'},
  {cmd:'/toggle file', desc:'toggle file upload'},
  {cmd:'/toggle pdf', desc:'toggle PDF extraction'},
  {cmd:'/toggle docx', desc:'toggle DOCX extraction'},
  {cmd:'/toggle excel', desc:'toggle spreadsheets'},
  {cmd:'/toggle zip', desc:'toggle ZIP archives'},
  {cmd:'/toggle image', desc:'toggle basic image captions'},
  {cmd:'/toggle audio', desc:'toggle audio transcription'},
  {cmd:'/policy', desc:'open base policy'},
  {cmd:'/policy status', desc:'show base policy'},
  {cmd:'/language ru', desc:'set Russian language policy'},
  {cmd:'/language en', desc:'set English language policy'},
  {cmd:'/language off', desc:'disable language policy'},
  {cmd:'/extensions', desc:'show extension status'}
];

var __aeCommandSuggestEl = null;
var __aeCommandSuggestItems = [];
var __aeCommandSuggestIndex = 0;

function __aeEnsureCommandSuggestEl() {
  if (__aeCommandSuggestEl) return __aeCommandSuggestEl;
  __aeCommandSuggestEl = document.createElement('div');
  __aeCommandSuggestEl.id = '__aeCommandSuggestEl';
  __aeCommandSuggestEl.style.cssText = 'position:fixed;z-index:999999;background:rgba(25,25,25,0.96);color:#fff;border:1px solid rgba(255,255,255,0.18);border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,0.38);padding:0.35rem;max-width:min(560px,92vw);font-size:13px;display:none;';
  document.body.appendChild(__aeCommandSuggestEl);
  return __aeCommandSuggestEl;
}

function __aeHideCommandSuggestions() {
  if (__aeCommandSuggestEl) __aeCommandSuggestEl.style.display = 'none';
  __aeCommandSuggestItems = [];
}

function __aeApplyCommandSuggestion(item) {
  if (!item) return;
  $.messageInput.value = item.cmd;
  $.messageInput.focus();
  var pos = item.cmd.length;
  $.messageInput.setSelectionRange(pos, pos);
  __aeHideCommandSuggestions();
}

function __aeRankCommandSuggestion(input, item) {
  var q = input.toLowerCase();
  var c = item.cmd.toLowerCase();
  if (c === q) return 1000;
  if (c.startsWith(q)) return 900 - c.length;
  if (c.includes(q)) return 500 - c.indexOf(q);
  var words = q.replace(/^\//,'').split(/\s+/).filter(Boolean);
  var score = 0;
  words.forEach(function(w) { if (c.includes(w) || item.desc.toLowerCase().includes(w)) score += 50; });
  return score;
}

function __aeUpdateCommandSuggestions() {
  var input = $.messageInput.value || '';
  if (!input.startsWith('/') || input.length > 80 || input.includes('\n')) return __aeHideCommandSuggestions();
  var scored = __AE_COMMAND_SUGGESTIONS.map(function(item) {
    return { item: item, score: __aeRankCommandSuggestion(input, item) };
  }).filter(function(x) { return x.score > 0; }).sort(function(a,b) { return b.score - a.score; }).slice(0, 7).map(function(x) { return x.item; });
  if (scored.length === 0) return __aeHideCommandSuggestions();
  __aeCommandSuggestItems = scored;
  __aeCommandSuggestIndex = Math.min(__aeCommandSuggestIndex, scored.length - 1);
  var el = __aeEnsureCommandSuggestEl();
  var rect = $.messageInput.getBoundingClientRect();
  el.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 570)) + 'px';
  el.style.bottom = Math.max(8, window.innerHeight - rect.top + 6) + 'px';
  el.innerHTML = scored.map(function(item, i) {
    return '<div class="__aeCmdSug" data-i="'+i+'" style="padding:0.38rem 0.5rem;border-radius:7px;cursor:pointer;'+(i===__aeCommandSuggestIndex?'background:#245b8f;':'')+'"><b>'+sanitizeHtml(item.cmd)+'</b><span style="opacity:0.72;"> — '+sanitizeHtml(item.desc)+'</span></div>';
  }).join('') + '<div style="opacity:0.55;font-size:11px;padding:0.2rem 0.5rem 0;">Tab = complete, Esc = close</div>';
  el.querySelectorAll('.__aeCmdSug').forEach(function(row) {
    row.addEventListener('mousedown', function(e) {
      e.preventDefault();
      __aeApplyCommandSuggestion(scored[Number(row.dataset.i)]);
    });
  });
  el.style.display = 'block';
}

function __aeSetupCommandAutocomplete() {
  $.messageInput.addEventListener('input', __aeUpdateCommandSuggestions);
  $.messageInput.addEventListener('focus', __aeUpdateCommandSuggestions);
  $.messageInput.addEventListener('blur', function() { setTimeout(__aeHideCommandSuggestions, 200); });
  $.messageInput.addEventListener('keydown', function(e) {
    if (!__aeCommandSuggestItems.length || !__aeCommandSuggestEl || __aeCommandSuggestEl.style.display === 'none') return;
    if (e.key === 'Escape') { e.preventDefault(); __aeHideCommandSuggestions(); }
    else if (e.key === 'Tab') { e.preventDefault(); __aeApplyCommandSuggestion(__aeCommandSuggestItems[__aeCommandSuggestIndex]); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); __aeCommandSuggestIndex = (__aeCommandSuggestIndex + 1) % __aeCommandSuggestItems.length; __aeUpdateCommandSuggestions(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); __aeCommandSuggestIndex = (__aeCommandSuggestIndex - 1 + __aeCommandSuggestItems.length) % __aeCommandSuggestItems.length; __aeUpdateCommandSuggestions(); }
  }, true);
}

// --- Initialize ---

__aeCreateFileInput();
__aeSetupDragDrop();
__aeSetupPasteUpload();
__aeSetupCommandHandler();
__aeSetupCommandAutocomplete();
__aeUpdateInputTooltip();
setTimeout(async function() {
  try {
    if (typeof activeThreadId === 'number' && Number.isFinite(activeThreadId)) {
      var thread = await db.threads.get(activeThreadId);
      if (thread) { await __aeEnsureShortcutButtons(thread); renderShortcutButtons(thread); }
    }
  } catch(e) { console.warn('[ae] startup menu normalization failed:', e); }
  __aeStyleShortcutButtons();
}, 250);

console.log('[ae] Extensions module v' + __AE_VERSION + ' loaded. Commands: /menu, /file, /voice, /search, /toggle, /extensions');

