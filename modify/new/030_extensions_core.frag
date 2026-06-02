
// ============================================
// AI CHARACTER CHAT — EXTENSIONS MODULE
// ============================================
// Provides: file upload, PDF/DOCX extract,
// image captioning, audio transcription,
// web search, toggle management.
// All via main-page APIs (db.*, embedTexts,
// addMessageToDb, addMessageToFeed, etc.)
// ============================================

// --- Constants ---
const __AE_STORAGE_KEY = '__ae';
const __AE_VERSION = '1.1.0';
const __AE_CHUNK_WORDS = 300;
const __AE_EXT = '__ae'; // marker for our shortcut buttons
const __AE_IMAGE_CAPTION_MODELS = ['Xenova/vit-gpt2-image-captioning']; // BLIP is gated/401 on HF, vit-gpt2 is public
const __AE_SEARCH_CACHE = new Map(); // per-page cache for automatic web-search contexts
const __AE_CONTEXT_PREVIEW_CHARS = 12000; // hidden-from-user, visible-to-AI upload context
const __AE_FILE_REGISTRY_KEY = '__aeFileRegistry';
const __AE_FILE_CONTEXT_BUFFER_CHARS = 60000;
const __AE_MAX_ARCHIVE_FILES = 30;
const __AE_MAX_ARCHIVE_FILE_BYTES = 8 * 1024 * 1024;
const __AE_MAX_EMBEDDED_IMAGES = 10;
const __AE_MAX_PDF_IMAGE_PAGES = 3;
const __AE_MAX_LORE_CHUNKS_PER_FILE = 40;
const __AE_MAX_VOICE_RECORDING_MS = 60 * 1000;
const __AE_BEFORE_BOT_REPLY_HOOKS = [];

const __AE_DEFAULTS = {
  fileUpload: true,
  pdfExtract: true,
  docxExtract: true,
  imageCaption: true,
  audioTranscribe: true,
  spreadsheetExtract: true,
  archiveExtract: true,
  deepWebSearch: false,
  advancedImageAnalysis: false,
  voiceProfile: true,
  webSearch: true
};

// --- Settings ---
function __aeLoadSettings() {
  try {
    var stored = localStorage.getItem(__AE_STORAGE_KEY);
    if (stored) return Object.assign({}, __AE_DEFAULTS, JSON.parse(stored));
  } catch(e) { console.error('[ae] settings load error:', e); }
  return Object.assign({}, __AE_DEFAULTS);
}

function __aeSaveSettings(s) {
  try { localStorage.setItem(__AE_STORAGE_KEY, JSON.stringify(s)); }
  catch(e) { console.error('[ae] settings save error:', e); }
}

// --- CDN Library Loaders ---
let __aePdfJsReady = false;
let __aeMammothReady = false;
let __aeTransformersReady = false;
let __aeXlsxReady = false;
let __aeJsZipReady = false;

function __aeLoadScript(url) {
  return new Promise(function(resolve, reject) {
    var s = document.createElement('script');
    s.src = url;
    s.onload = resolve;
    s.onerror = function() {
      s.remove();
      reject(new Error('Failed to load: ' + url));
    };
    document.head.appendChild(s);
  });
}

async function __aeLoadScriptFromAny(urls, label) {
  var errors = [];
  for (var i = 0; i < urls.length; i++) {
    try {
      await __aeLoadScript(urls[i]);
      return urls[i];
    } catch(e) {
      errors.push(e.message);
      console.warn('[ae] ' + (label || 'script') + ' CDN failed:', urls[i], e);
    }
  }
  throw new Error('Failed to load ' + (label || 'script') + ' from all mirrors:\n' + errors.join('\n'));
}

async function __aeLoadPdfJs() {
  if (__aePdfJsReady) return window.pdfjsLib;
  console.log('[ae] Loading pdf.js...');
  var loadedUrl = await __aeLoadScriptFromAny([
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
    'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js'
  ], 'pdf.js');
  if (loadedUrl.indexOf('jsdelivr') !== -1) window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  else if (loadedUrl.indexOf('unpkg') !== -1) window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  else window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  __aePdfJsReady = true;
  console.log('[ae] pdf.js loaded.');
  return window.pdfjsLib;
}

async function __aeLoadMammoth() {
  if (__aeMammothReady) return window.mammoth;
  console.log('[ae] Loading mammoth.js...');
  // mammoth.min.js does not exist in this package version; browser bundle is mammoth.browser.min.js
  await __aeLoadScriptFromAny([
    'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js',
    'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.js',
    'https://unpkg.com/mammoth@1.6.0/mammoth.browser.min.js',
    'https://unpkg.com/mammoth@1.6.0/mammoth.browser.js'
  ], 'mammoth.js');
  if (!window.mammoth) throw new Error('mammoth.js loaded but window.mammoth is missing.');
  __aeMammothReady = true;
  console.log('[ae] mammoth.js loaded.');
  return window.mammoth;
}


async function __aeLoadXlsx() {
  if (__aeXlsxReady) return window.XLSX;
  console.log('[ae] Loading SheetJS/xlsx...');
  await __aeLoadScriptFromAny([
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js'
  ], 'SheetJS/xlsx');
  if (!window.XLSX) throw new Error('xlsx loaded but window.XLSX is missing.');
  __aeXlsxReady = true;
  console.log('[ae] SheetJS/xlsx loaded.');
  return window.XLSX;
}

async function __aeLoadJsZip() {
  if (__aeJsZipReady) return window.JSZip;
  console.log('[ae] Loading JSZip...');
  await __aeLoadScriptFromAny([
    'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
    'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js'
  ], 'JSZip');
  if (!window.JSZip) throw new Error('JSZip loaded but window.JSZip is missing.');
  __aeJsZipReady = true;
  console.log('[ae] JSZip loaded.');
  return window.JSZip;
}

async function __aeLoadTransformers() {
  if (__aeTransformersReady) return window.__aeTransformers;
  console.log('[ae] Loading Transformers.js...');
  var mod = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
  try {
    if (mod.env) {
      mod.env.allowRemoteModels = true;
      mod.env.allowLocalModels = false;
    }
  } catch(e) { console.warn('[ae] Could not configure Transformers env:', e); }
  window.__aeTransformers = mod;
  __aeTransformersReady = true;
  console.log('[ae] Transformers.js loaded.');
  return mod;
}

// --- Utility: Text Chunking ---
function __aeChunkText(text, wordsPerChunk) {
  wordsPerChunk = wordsPerChunk || __AE_CHUNK_WORDS;
  var words = text.split(/\s+/).filter(function(w) { return w.length > 0; });
  if (words.length === 0) return [];
  var chunks = [];
  for (var i = 0; i < words.length; i += wordsPerChunk) {
    var chunk = words.slice(i, i + wordsPerChunk).join(' ');
    if (chunk.length > 0) chunks.push(chunk);
  }
  return chunks;
}

// --- Lore Helper ---
// Original lore entry format (from /lore command, line ~10251):
//   {bookId, bookUrl:null, text, embeddings:{[modelName]:vector}, triggers:[]}
// The embeddings dict is ON the lore entry itself, keyed by model name.
// textEmbeddingCache is handled internally by embedTexts({shouldCache:true}).
async function __aeAddLoreEntry(text, sourceLabel) {
  var tid = activeThreadId;
  if (typeof tid !== 'number' || !Number.isFinite(tid)) {
    console.warn('[ae] No valid active thread for lore entry:', tid);
    return 0;
  }
  var thread = await db.threads.get(tid);
  if (!thread) {
    console.warn('[ae] Thread not found:', tid);
    return 0;
  }
  var loreBookId = thread.loreBookId != null ? thread.loreBookId : tid;
  var modelName = thread.textEmbeddingModelName || 'Xenova/bge-base-en-v1.5';

  // Check for duplicate text in this lore book (compare by text content)
  var existingEntries = await db.lore.where({ bookId: loreBookId }).toArray();
  for (var ei = 0; ei < existingEntries.length; ei++) {
    if (existingEntries[ei].text === text) {
      console.log('[ae] Lore entry already exists:', sourceLabel);
      return 0;
    }
  }

  // Compute embedding via the built-in embedTexts (handles caching internally).
  // IMPORTANT: do not store lore without embeddings — the original retrieval pipeline
  // expects entry.embeddings[modelName] and can fail later if it is missing.
  var embedding = null;
  try {
    var embeddings = await embedTexts({ textArr: [text], modelName: modelName, shouldCache: true });
    if (embeddings && embeddings[0]) {
      embedding = embeddings[0];
    }
  } catch(e) {
    console.warn('[ae] Embedding failed; lore entry will NOT be saved:', e);
    throw new Error('Could not compute lore embedding. Entry was not saved. ' + (e && e.message ? e.message : e));
  }
  if (!embedding) {
    throw new Error('Could not compute lore embedding. Entry was not saved.');
  }

  // Build lore entry matching the original format exactly
  var loreObj = {
    bookId: loreBookId,
    bookUrl: null,
    text: text,
    triggers: []
  };
  if (embedding) {
    loreObj.embeddings = {};
    loreObj.embeddings[modelName] = embedding;
  }

  await db.lore.add(loreObj);

  console.log('[ae] Lore entry added:', sourceLabel);
  return 1;
}

async function __aeAddTextAsLore(text, sourceLabel) {
  var chunks = __aeChunkText(text);
  if (chunks.length === 0) return 0;
  if (chunks.length > __AE_MAX_LORE_CHUNKS_PER_FILE) {
    __aeToast('⚠️ File is very large; indexing only first ' + __AE_MAX_LORE_CHUNKS_PER_FILE + ' lore chunks to protect the page.', 8000);
    chunks = chunks.slice(0, __AE_MAX_LORE_CHUNKS_PER_FILE);
  }
  var added = 0;
  for (var i = 0; i < chunks.length; i++) {
    __aeAssertNotCancelled();
    added += await __aeAddLoreEntry(
      chunks[i],
      sourceLabel + ' (chunk ' + (i + 1) + '/' + chunks.length + ')'
    );
  }
  return added;
}

// --- System Message Helper ---
// createMessageObj requires: {threadId: number, message: string, characterId: number}
//   threadId = active thread id
//   message = the text content string
//   characterId = -1 for user, -2 for system
// addMessageToDb takes a single messageObj argument (threadId is inside the obj)
// --- Toast Notification (no message in chat) ---
function __aeToast(text, durationMs) {
  durationMs = durationMs || 4000;
  var el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
    'background:rgba(30,30,30,0.92);color:#fff;padding:10px 20px;border-radius:10px;' +
    'font-size:14px;z-index:99999;pointer-events:none;max-width:80vw;text-align:center;' +
    'box-shadow:0 4px 20px rgba(0,0,0,0.4);transition:opacity 0.3s;';
  document.body.appendChild(el);
  setTimeout(function() {
    el.style.opacity = '0';
    setTimeout(function() { el.remove(); }, 350);
  }, durationMs);
}

// --- System message (hidden from AI so NPC doesn't see it) ---
async function __aeAddSystemMessage(content, name) {
  var tid = activeThreadId;
  if (typeof tid !== 'number' || !Number.isFinite(tid)) {
    console.warn('[ae] No valid active thread for system message:', tid);
    return;
  }
  var thread = await db.threads.get(tid);
  if (!thread) {
    console.warn('[ae] Thread not found:', tid);
    return;
  }
  var msgObj = createMessageObj({
    threadId: tid,
    message: content,
    characterId: -2, // -2 = system message
    name: name || 'Extensions',
    hiddenFrom: ["ai"], // NPC does NOT see this
    expectsReply: false
  });
  await addMessageToDb(msgObj);
  if (tid === activeThreadId) {
    await addMessageToFeed(msgObj);
  }
}

// --- File Processors ---


function __aeBuildAiContextContent(kind, fileName, text, meta) {
  text = (text || '').trim();
  meta = meta || '';
  var truncated = text.length > __AE_CONTEXT_PREVIEW_CHARS;
  var preview = truncated ? text.slice(0, __AE_CONTEXT_PREVIEW_CHARS) + '\n\n[... content truncated; full text was stored in lore chunks when possible ...]' : text;
  return [
    'USER-UPLOADED ' + kind.toUpperCase() + ' CONTEXT',
    'Filename: ' + fileName,
    meta ? 'Metadata: ' + meta : null,
    '',
    'The user uploaded this file/image/audio for the current chat. Treat it as context. If the user asks about it, answer using this content.',
    '',
    'Extracted/recognized content:',
    preview || '(No text content was extracted.)'
  ].filter(function(x) { return x !== null; }).join('\n');
}

async function __aeAddAiContextMessage(content, name, customData) {
  var tid = activeThreadId;
  if (typeof tid !== 'number' || !Number.isFinite(tid)) {
    console.warn('[ae] No valid active thread for AI context message:', tid);
    return;
  }
  var msgObj = createMessageObj({
    threadId: tid,
    message: content,
    characterId: -2,
    name: name || 'Uploaded Context',
    hiddenFrom: ['user'], // AI sees it; user feed stays clean/collapsed
    expectsReply: false,
    customData: customData || {}
  });
  var id = await addMessageToDb(msgObj, {doNotReRenderThreadList:true});
  return id;
}

function __aeCreateId(prefix) {
  return (prefix || 'ae') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

function __aeNormalizeFileName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function __aeLoadFileRegistry() {
  var obj = await db.misc.get(__AE_FILE_REGISTRY_KEY).catch(function() { return null; });
  if (!obj || !obj.value || !Array.isArray(obj.value.files)) return { version: 1, files: [] };
  return obj.value;
}

async function __aeSaveFileRegistry(registry) {
  registry.version = registry.version || 1;
  if (!Array.isArray(registry.files)) registry.files = [];
  await db.misc.put({ key: __AE_FILE_REGISTRY_KEY, value: registry });
}

async function __aeRegisterUploadedFile(meta) {
  var registry = await __aeLoadFileRegistry();
  var file = Object.assign({
    id: __aeCreateId('ae_file'),
    threadId: activeThreadId,
    name: 'unnamed',
    normalizedName: '',
    uploadedAt: Date.now(),
    status: 'ok',
    error: null,
    contextMessageId: null,
    contextActive: true,
    contextCharCount: 0,
    preview: ''
  }, meta || {});
  file.normalizedName = __aeNormalizeFileName(file.normalizedName || file.name);
  registry.files.push(file);
  await __aeSaveFileRegistry(registry);
  return file;
}

async function __aeUpdateUploadedFile(id, patch) {
  var registry = await __aeLoadFileRegistry();
  var file = registry.files.find(function(f) { return f.id === id; });
  if (!file) return null;
  Object.assign(file, patch || {});
  if (patch && patch.name) file.normalizedName = __aeNormalizeFileName(file.name);
  await __aeSaveFileRegistry(registry);
  return file;
}

async function __aeGetUploadedFiles(opts) {
  opts = opts || {};
  var registry = await __aeLoadFileRegistry();
  var files = registry.files.slice();
  if (opts.threadId !== undefined && !opts.includeAllThreads) {
    files = files.filter(function(f) { return f.threadId === opts.threadId; });
  }
  files.sort(function(a, b) { return (b.uploadedAt || 0) - (a.uploadedAt || 0); });
  return files;
}

async function __aeFindUploadedFileByMention(name, threadId) {
  var wanted = __aeNormalizeFileName(name);
  var files = await __aeGetUploadedFiles({threadId: threadId});
  var exact = files.filter(function(f) { return f.normalizedName === wanted || __aeNormalizeFileName(f.name) === wanted; });
  if (exact.length === 1) return { file: exact[0], matches: exact };
  if (exact.length > 1) return { file: null, matches: exact };
  var fuzzy = files.filter(function(f) {
    var n = f.normalizedName || __aeNormalizeFileName(f.name);
    return n.includes(wanted) || wanted.includes(n);
  }).slice(0, 10);
  return { file: fuzzy.length === 1 ? fuzzy[0] : null, matches: fuzzy };
}

async function __aeSetContextMessageActive(messageId, active) {
  if (typeof messageId !== 'number' || !Number.isFinite(messageId)) return;
  var msg = await db.messages.get(messageId).catch(function() { return null; });
  if (!msg) return;
  var hiddenFrom = Array.isArray(msg.hiddenFrom) ? msg.hiddenFrom.slice() : [];
  if (active) hiddenFrom = hiddenFrom.filter(function(x) { return x !== 'ai'; });
  else if (!hiddenFrom.includes('ai')) hiddenFrom.push('ai');
  if (!hiddenFrom.includes('user')) hiddenFrom.push('user');
  await db.messages.update(messageId, { hiddenFrom: hiddenFrom });
}


async function __aeGetActiveFileContextCharCount(threadId) {
  var registry = await __aeLoadFileRegistry();
  return registry.files.filter(function(f) {
    return f.threadId === threadId && f.contextActive !== false && typeof f.contextMessageId === 'number';
  }).reduce(function(sum, f) { return sum + (f.contextCharCount || 0); }, 0);
}

async function __aeEnforceFileContextBuffer(threadId) {
  var registry = await __aeLoadFileRegistry();
  var files = registry.files.filter(function(f) {
    return f.threadId === threadId && f.contextActive !== false && typeof f.contextMessageId === 'number';
  }).sort(function(a, b) { return (a.uploadedAt || 0) - (b.uploadedAt || 0); });
  var total = files.reduce(function(sum, f) { return sum + (f.contextCharCount || 0); }, 0);
  var changed = false;
  while (total > __AE_FILE_CONTEXT_BUFFER_CHARS && files.length > 1) {
    var f = files.shift();
    await __aeSetContextMessageActive(f.contextMessageId, false);
    f.contextActive = false;
    f.status = f.status === 'ok' ? 'buffered-out' : f.status;
    total -= (f.contextCharCount || 0);
    changed = true;
  }
  if (changed) await __aeSaveFileRegistry(registry);
}

async function __aeReactivateFileContext(file) {
  if (!file) return null;
  if (typeof file.contextMessageId === 'number') {
    await __aeSetContextMessageActive(file.contextMessageId, true);
    await __aeUpdateUploadedFile(file.id, { contextActive: true, status: file.status === 'buffered-out' ? 'ok' : file.status });
    await __aeEnforceFileContextBuffer(file.threadId);
    return file.contextMessageId;
  }
  if (file.fullText) {
    var content = __aeBuildAiContextContent(file.kind || 'File', file.name, file.fullText, file.metaText || 'reactivated mention');
    var messageId = await __aeAddAiContextMessage(content, 'File Mention', { __aeFileContext: true, fileId: file.id, source: 'mention' });
    await __aeUpdateUploadedFile(file.id, { contextMessageId: messageId, contextActive: true, contextCharCount: content.length });
    await __aeEnforceFileContextBuffer(file.threadId);
    return messageId;
  }
  return null;
}

async function __aeForgetUploadedFile(id) {
  var registry = await __aeLoadFileRegistry();
  var file = registry.files.find(function(f) { return f.id === id; });
  if (!file) return false;
  if (typeof file.contextMessageId === 'number') await __aeSetContextMessageActive(file.contextMessageId, false);
  registry.files = registry.files.filter(function(f) { return f.id !== id; });
  await __aeSaveFileRegistry(registry);
  return true;
}

async function __aeRememberExtractedContent(kind, fileName, text, meta) {
  var added = 0;
  if (text && text.trim()) {
    __aeAssertNotCancelled();
    var currentContextChars = await __aeGetActiveFileContextCharCount(activeThreadId);
    if (currentContextChars >= __AE_FILE_CONTEXT_BUFFER_CHARS * 1.25) {
      __aeAbortAllProcessing('File context buffer overloaded. Current uploads were interrupted.');
      throw new Error('File context buffer overloaded. Processing interrupted.');
    }
    var content = __aeBuildAiContextContent(kind, fileName, text, meta);
    var fileRecord = await __aeRegisterUploadedFile({
      threadId: activeThreadId,
      name: fileName,
      kind: kind,
      metaText: meta || '',
      contextCharCount: content.length,
      preview: text.slice(0, 1200),
      fullText: text.length <= __AE_CONTEXT_PREVIEW_CHARS ? text : '',
      status: 'ok'
    });
    var messageId = await __aeAddAiContextMessage(content, kind + ' Upload', { __aeFileContext: true, fileId: fileRecord.id, fileName: fileName, kind: kind });
    await __aeUpdateUploadedFile(fileRecord.id, { contextMessageId: messageId, contextActive: true });
    await __aeEnforceFileContextBuffer(activeThreadId);
    try {
      added = await __aeAddTextAsLore(text, kind + ': ' + fileName);
    } catch(e) {
      console.warn('[ae] Lore indexing failed, but AI context message was saved:', e);
      await __aeUpdateUploadedFile(fileRecord.id, { status: 'partial', error: 'Lore indexing failed: ' + e.message });
      __aeToast('⚠️ Saved upload as direct AI context, but lore indexing failed.', 6000);
    }
  }
  return added;
}



// --- Processing task UI and cancellation ---
const __AE_PROCESSING_TASKS = new Map();
let __aeProcessingTaskSeq = 0;
let __aeProcessingCancelled = false;
let __aeTaskPanelEl = null;

function __aeResetProcessingCancel() {
  __aeProcessingCancelled = false;
}

function __aeAbortAllProcessing(reason) {
  __aeProcessingCancelled = true;
  reason = reason || 'Processing cancelled.';
  __AE_PROCESSING_TASKS.forEach(function(task) {
    task.status = 'cancelled';
    task.detail = reason;
  });
  __aeRenderTaskPanel();
  __aeToast('🛑 ' + reason, 6000);
}

function __aeAssertNotCancelled() {
  if (__aeProcessingCancelled) throw new Error('Processing cancelled.');
}

function __aeRenderTaskPanel() {
  if (!__aeTaskPanelEl) {
    __aeTaskPanelEl = document.createElement('div');
    __aeTaskPanelEl.id = '__aeTaskPanel';
    __aeTaskPanelEl.style.cssText = 'position:fixed;right:12px;bottom:12px;max-width:min(420px,92vw);max-height:45vh;overflow:auto;z-index:999999;background:rgba(25,25,25,0.94);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:10px;font-size:13px;box-shadow:0 6px 28px rgba(0,0,0,0.45);';
    document.body.appendChild(__aeTaskPanelEl);
  }
  var tasks = Array.from(__AE_PROCESSING_TASKS.values());
  if (tasks.length === 0) {
    __aeTaskPanelEl.remove();
    __aeTaskPanelEl = null;
    return;
  }
  var html = '<div style="display:flex;justify-content:space-between;gap:0.75rem;align-items:center;margin-bottom:0.35rem;"><b>📎 Processing files</b><button id="__aeCancelTasksBtn" style="font-size:12px;">cancel all</button></div>';
  html += tasks.map(function(t) {
    var icon = t.status === 'done' ? '✅' : t.status === 'error' ? '❌' : t.status === 'cancelled' ? '🛑' : '⏳';
    return '<div style="border-top:1px solid rgba(255,255,255,0.12);padding-top:0.3rem;margin-top:0.3rem;">' + icon + ' <span style="overflow-wrap:anywhere;">' + sanitizeHtml(t.label) + '</span>' + (t.detail ? '<div style="opacity:0.78;margin-left:1.25rem;">' + sanitizeHtml(t.detail) + '</div>' : '') + '</div>';
  }).join('');
  __aeTaskPanelEl.innerHTML = html;
  __aeTaskPanelEl.querySelector('#__aeCancelTasksBtn')?.addEventListener('click', function() {
    __aeAbortAllProcessing('User cancelled current file processing.');
  });
}

function __aeBeginTask(label, detail) {
  var id = ++__aeProcessingTaskSeq;
  __AE_PROCESSING_TASKS.set(id, { id: id, label: label || 'task', detail: detail || '', status: 'running' });
  __aeRenderTaskPanel();
  return id;
}

function __aeUpdateTask(id, detail, status) {
  var task = __AE_PROCESSING_TASKS.get(id);
  if (!task) return;
  if (detail !== undefined) task.detail = detail;
  if (status) task.status = status;
  __aeRenderTaskPanel();
}

function __aeEndTask(id, status, detail) {
  var task = __AE_PROCESSING_TASKS.get(id);
  if (!task) return;
  task.status = status || 'done';
  if (detail !== undefined) task.detail = detail;
  __aeRenderTaskPanel();
  setTimeout(function() {
    var t = __AE_PROCESSING_TASKS.get(id);
    if (t && (t.status === 'done' || t.status === 'error' || t.status === 'cancelled')) {
      __AE_PROCESSING_TASKS.delete(id);
      __aeRenderTaskPanel();
    }
  }, status === 'error' ? 9000 : 2500);
}

// --- Transient prompt message helper ---
// Messages injected only into getBotReply(opts) still need IDs because the
// original reply pipeline records messageIdsUsed and throws if any id is undefined.
let __aeTransientMessageIdCounter = -1000000000;
function __aeCreateTransientMessageObj(args) {
  var msg = createMessageObj(args);
  msg.id = __aeTransientMessageIdCounter--;
  if (msg.order === undefined) msg.order = msg.id;
  return msg;
}

// --- Extension hook bus ---
// Later modules should register hooks instead of wrapping getBotReply directly.
// A hook receives the current getBotReply opts and may return a modified opts object.
function __aeRegisterBeforeBotReplyHook(name, fn, opts) {
  if (typeof fn !== 'function') throw new Error('__aeRegisterBeforeBotReplyHook requires a function');
  opts = opts || {};
  __AE_BEFORE_BOT_REPLY_HOOKS.push({ name: name || 'unnamed', fn: fn, priority: Number(opts.priority || 500) });
  __AE_BEFORE_BOT_REPLY_HOOKS.sort(function(a, b) { return a.priority - b.priority; });
}

var __aeOriginalGetBotReply = getBotReply;
getBotReply = async function(opts) {
  var nextOpts = opts;
  for (var i = 0; i < __AE_BEFORE_BOT_REPLY_HOOKS.length; i++) {
    var hook = __AE_BEFORE_BOT_REPLY_HOOKS[i];
    try {
      var result = await hook.fn(nextOpts);
      if (result) nextOpts = result;
    } catch(e) {
      console.error('[ae] beforeBotReply hook failed:', hook.name, e);
      __aeToast('⚠️ Extension hook failed: ' + hook.name + ': ' + e.message, 6000);
    }
  }
  return __aeOriginalGetBotReply.call(this, nextOpts);
};

