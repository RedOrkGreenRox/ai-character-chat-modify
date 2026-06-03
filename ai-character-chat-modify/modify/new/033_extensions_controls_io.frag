// --- Toggle / Status ---

var __aeFeatureMap = {
  'file': 'fileUpload', 'files': 'fileUpload', 'upload': 'fileUpload',
  'pdf': 'pdfExtract',
  'docx': 'docxExtract',
  'xlsx': 'spreadsheetExtract', 'xls': 'spreadsheetExtract', 'excel': 'spreadsheetExtract', 'spreadsheet': 'spreadsheetExtract', 'sheet': 'spreadsheetExtract',
  'zip': 'archiveExtract', 'archive': 'archiveExtract', 'archives': 'archiveExtract',
  'deepsearch': 'deepWebSearch', 'deep': 'deepWebSearch',
  'advancedimage': 'advancedImageAnalysis', 'imageanalysis': 'advancedImageAnalysis', 'ocr': 'advancedImageAnalysis',
  'voiceprofile': 'voiceProfile', 'voice-tone': 'voiceProfile',
  'image': 'imageCaption', 'images': 'imageCaption',
  'audio': 'audioTranscribe',
  'search': 'webSearch', 'web': 'webSearch', 'websearch': 'webSearch'
};

async function __aeToggle(feature) {
  var settings = __aeLoadSettings();
  var key = __aeFeatureMap[(feature || '').toLowerCase()];

  if (!key) {
    await __aeAddSystemMessage(
      '⚠️ Unknown feature: **' + feature + '**\n' +
      'Available: ' + Object.keys(__aeFeatureMap).join(', '),
      'Extensions'
    );
    return;
  }

  settings[key] = !settings[key];
  __aeSaveSettings(settings);

  var label = key.replace(/([A-Z])/g, ' $1').trim();
  await __aeAddSystemMessage(
    '⚙️ **' + label + '** is now **' + (settings[key] ? 'ON ✅' : 'OFF ❌') + '**',
    'Extensions'
  );
  __aeToast('⚙️ ' + label + ': ' + (settings[key] ? 'ON ✅' : 'OFF ❌'), 3500);

  // Refresh shortcut buttons for active thread
  if (typeof activeThreadId === 'number' && Number.isFinite(activeThreadId)) {
    var thread = await db.threads.get(activeThreadId);
    if (thread) {
      await __aeEnsureShortcutButtons(thread);
      renderShortcutButtons(thread);
      setTimeout(__aeStyleShortcutButtons, 50);
    }
  }
}

async function __aeShowStatus() {
  var s = __aeLoadSettings();
  var lines = [
    '## ⚙️ Extension Status (v' + __AE_VERSION + ')',
    '',
    '| Feature | Status | Toggle |',
    '|---------|--------|--------|',
    '| 📎 File Upload | ' + (s.fileUpload ? '✅ ON' : '❌ OFF') + ' | `/toggle file` |',
    '| 📄 PDF Extract | ' + (s.pdfExtract ? '✅ ON' : '❌ OFF') + ' | `/toggle pdf` |',
    '| 📝 DOCX Extract | ' + (s.docxExtract ? '✅ ON' : '❌ OFF') + ' | `/toggle docx` |',
    '| 📊 Excel/Spreadsheet Extract | ' + (s.spreadsheetExtract ? '✅ ON' : '❌ OFF') + ' | `/toggle excel` |',
    '| 🗜️ ZIP Archive Extract | ' + (s.archiveExtract ? '✅ ON' : '❌ OFF') + ' | `/toggle zip` |',
    '| 🔎 Deep Web Search | ' + (s.deepWebSearch ? '✅ ON' : '❌ OFF') + ' | `/toggle deepsearch` |',
    '| 🧠 Advanced Image Analysis/OCR | ' + (s.advancedImageAnalysis ? '✅ ON' : '❌ OFF') + ' | `/toggle imageanalysis` |',
    '| 🗣️ Voice Profile | ' + (s.voiceProfile ? '✅ ON' : '❌ OFF') + ' | `/toggle voiceprofile` |',
    '| 🖼️ Image Caption | ' + (s.imageCaption ? '✅ ON' : '❌ OFF') + ' | `/toggle image` |',
    '| 🎤 Audio Transcribe | ' + (s.audioTranscribe ? '✅ ON' : '❌ OFF') + ' | `/toggle audio` |',
    '| 🌐 Web Search + auto-search | ' + (s.webSearch ? '✅ ON' : '❌ OFF') + ' | `/toggle search` |',
    '',
    '**Commands:** `/file`, `/voice`, `/files`, `/search <query>`, `/toggle <feature>`, `/policy`, `/language <code>`, `/extensions`',
    '',
    'When 🌐 Web Search is ON, the character can automatically search before answering web/current/practical factual questions.',
    '',
    '**Drag & drop** or **paste** files onto the chat to auto-process them.'
  ];
  await __aeAddSystemMessage(lines.join('\n'), 'Extensions');
  __aeToast('⚙️ Extension status added to chat.', 3000);
}

// --- File Input UI ---

var __aeFileInput = null;

function __aeCreateFileInput() {
  if (__aeFileInput) return;
  __aeFileInput = document.createElement('input');
  __aeFileInput.type = 'file';
  __aeFileInput.style.display = 'none';
  __aeFileInput.multiple = true;
  __aeFileInput.accept = '.txt,.md,.csv,.json,.html,.xml,.log,.js,.py,.c,.cpp,.h,.ts,.css,.yaml,.yml,.ini,.cfg,.srt,.vtt,.pdf,.docx,.xlsx,.xls,.ods,.zip,.mp3,.wav,.ogg,.m4a,.webm,.flac,.aac,.png,.jpg,.jpeg,.gif,.webp,.bmp';
  document.body.appendChild(__aeFileInput);

  __aeFileInput.addEventListener('change', async function() {
    var files = __aeFileInput.files;
    if (!files || files.length === 0) return;
    __aeResetProcessingCancel();
    for (var i = 0; i < files.length; i++) {
      if (__aeProcessingCancelled) break;
      await __aeProcessFile(files[i]);
    }
    __aeFileInput.value = '';
  });
}

// --- Drag & Drop ---

var __aeDragDropInstalled = false;

function __aeSetupDragDrop() {
  if (__aeDragDropInstalled) return;
  __aeDragDropInstalled = true;

  var dragCounter = 0;
  var dropOverlay = null;

  window.addEventListener('dragenter', function(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    if (!dropOverlay) {
      dropOverlay = document.createElement('div');
      dropOverlay.id = '__aeDropOverlay';
      dropOverlay.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:1.5em;color:white;background:rgba(0,0,0,0.5);border:3px dashed rgba(255,255,255,0.6);border-radius:12px;">📎 Drop files here</div>';
      dropOverlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;pointer-events:none;';
      document.body.appendChild(dropOverlay);
    }
    dropOverlay.style.display = 'block';
  });

  window.addEventListener('dragleave', function(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      if (dropOverlay) dropOverlay.style.display = 'none';
    }
  });

  window.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.stopPropagation();
  });

  window.addEventListener('drop', async function(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    if (dropOverlay) dropOverlay.style.display = 'none';

    if (!activeThreadId) {
      console.warn('[ae] No active thread — ignoring drop.');
      return;
    }

    if (!e.dataTransfer || !e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    var files = e.dataTransfer.files;
    __aeResetProcessingCancel();
    for (var i = 0; i < files.length; i++) {
      if (__aeProcessingCancelled) break;
      await __aeProcessFile(files[i]);
    }
  });
}


// --- Paste files from clipboard ---

var __aePasteInstalled = false;

function __aeSetupPasteUpload() {
  if (__aePasteInstalled) return;
  __aePasteInstalled = true;

  $.messageInput.addEventListener('paste', async function(e) {
    var files = [];
    if (e.clipboardData) {
      if (e.clipboardData.files && e.clipboardData.files.length > 0) {
        for (var i = 0; i < e.clipboardData.files.length; i++) files.push(e.clipboardData.files[i]);
      }
      if (e.clipboardData.items && e.clipboardData.items.length > 0) {
        for (var j = 0; j < e.clipboardData.items.length; j++) {
          var item = e.clipboardData.items[j];
          if (item.kind === 'file') {
            var f = item.getAsFile();
            if (f && files.indexOf(f) === -1) files.push(f);
          }
        }
      }
    }

    if (files.length === 0) return; // normal text paste should behave normally
    e.preventDefault();

    if (!activeThreadId) {
      __aeToast('⚠️ Open a chat thread first.', 4000);
      return;
    }

    __aeToast('📋 Processing pasted file(s): ' + files.length, 4000);
    __aeResetProcessingCancel();
    for (var k = 0; k < files.length; k++) {
      if (__aeProcessingCancelled) break;
      await __aeProcessFile(files[k]);
    }
  });
}

