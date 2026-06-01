
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
const __AE_VERSION = '1.0.0';
const __AE_CHUNK_WORDS = 300;
const __AE_EXT = '__ae'; // marker for our shortcut buttons

const __AE_DEFAULTS = {
  fileUpload: true,
  pdfExtract: true,
  docxExtract: true,
  imageCaption: true,
  audioTranscribe: true,
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

function __aeLoadScript(url) {
  return new Promise(function(resolve, reject) {
    var s = document.createElement('script');
    s.src = url;
    s.onload = resolve;
    s.onerror = function() { reject(new Error('Failed to load: ' + url)); };
    document.head.appendChild(s);
  });
}

async function __aeLoadPdfJs() {
  if (__aePdfJsReady) return window.pdfjsLib;
  console.log('[ae] Loading pdf.js...');
  await __aeLoadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  __aePdfJsReady = true;
  console.log('[ae] pdf.js loaded.');
  return window.pdfjsLib;
}

async function __aeLoadMammoth() {
  if (__aeMammothReady) return window.mammoth;
  console.log('[ae] Loading mammoth.js...');
  await __aeLoadScript('https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.min.js');
  __aeMammothReady = true;
  console.log('[ae] mammoth.js loaded.');
  return window.mammoth;
}

async function __aeLoadTransformers() {
  if (__aeTransformersReady) return window.__aeTransformers;
  console.log('[ae] Loading Transformers.js...');
  var mod = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
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
  if (!tid) {
    console.warn('[ae] No active thread for lore entry.');
    return 0;
  }
  var thread = await db.threads.get(tid);
  if (!thread) {
    console.warn('[ae] Thread not found:', tid);
    return 0;
  }
  var loreBookId = thread.loreBookId != null ? thread.loreBookId : tid;
  var modelName = thread.textEmbeddingModelName || window.currentDefaultTextEmbeddingModelName || 'Xenova/bge-base-en-v1.5';

  // Check for duplicate text in this lore book (compare by text content)
  var existingEntries = await db.lore.where({ bookId: loreBookId }).toArray();
  for (var ei = 0; ei < existingEntries.length; ei++) {
    if (existingEntries[ei].text === text) {
      console.log('[ae] Lore entry already exists:', sourceLabel);
      return 0;
    }
  }

  // Compute embedding via the built-in embedTexts (handles caching internally)
  var embedding = null;
  try {
    var embeddings = await embedTexts({ textArr: [text], modelName: modelName, shouldCache: true });
    if (embeddings && embeddings[0]) {
      embedding = embeddings[0];
    }
  } catch(e) {
    console.warn('[ae] Embedding failed (will fail on retrieval too):', e.message);
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
  var added = 0;
  for (var i = 0; i < chunks.length; i++) {
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
  if (!tid) {
    console.warn('[ae] No active thread for system message.');
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

async function __aeProcessTextFile(file) {
  var text = await file.text();
  if (!text.trim()) {
    await __aeAddSystemMessage('⚠️ File **' + file.name + '** is empty.', 'File Upload');
    return;
  }
  var wordCount = text.split(/\s+/).length;
  var added = await __aeAddTextAsLore(text, 'File: ' + file.name);
  await __aeAddSystemMessage(
    '📎 Loaded **' + file.name + '**\n' +
    wordCount + ' words → ' + added + ' lore entries added.',
    'File Upload'
  );
}

async function __aeProcessPdfFile(file) {
  var pdfjsLib = await __aeLoadPdfJs();
  var arrayBuffer = await file.arrayBuffer();
  var pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  var allText = '';

  for (var i = 1; i <= pdf.numPages; i++) {
    var page = await pdf.getPage(i);
    var content = await page.getTextContent();
    var strings = [];
    for (var j = 0; j < content.items.length; j++) {
      strings.push(content.items[j].str);
    }
    allText += strings.join(' ') + '\n\n';
  }

  if (!allText.trim()) {
    await __aeAddSystemMessage('⚠️ PDF **' + file.name + '** contains no extractable text.', 'PDF Extract');
    return;
  }

  var added = await __aeAddTextAsLore(allText, 'PDF: ' + file.name);
  await __aeAddSystemMessage(
    '📄 Extracted **' + file.name + '**\n' +
    pdf.numPages + ' pages → ' + added + ' lore entries added.',
    'PDF Extract'
  );
}

async function __aeProcessDocxFile(file) {
  var mammoth = await __aeLoadMammoth();
  var arrayBuffer = await file.arrayBuffer();
  var result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
  var text = result.value || '';

  if (!text.trim()) {
    await __aeAddSystemMessage('⚠️ DOCX **' + file.name + '** contains no extractable text.', 'DOCX Extract');
    return;
  }

  var added = await __aeAddTextAsLore(text, 'DOCX: ' + file.name);
  await __aeAddSystemMessage(
    '📝 Extracted **' + file.name + '**\n' +
    text.split(/\s+/).length + ' words → ' + added + ' lore entries added.',
    'DOCX Extract'
  );
}

async function __aeProcessImageFile(file) {
  var transformers = await __aeLoadTransformers();

  __aeToast('🖼️ Loading BLIP model... (~30-60s first time)', 30000);

  var dataUrl = await new Promise(function(resolve) {
    var reader = new FileReader();
    reader.onload = function() { resolve(reader.result); };
    reader.readAsDataURL(file);
  });

  __aeToast('🖼️ Captioning ' + file.name + '...', 15000);

  // BLIP base model — significantly better captions than vit-gpt2
  // Uses beam search for more descriptive output
  var captioner = await transformers.pipeline('image-to-text', 'Xenova/blip-image-captioning-base');
  var outputs = await captioner(dataUrl, { num_beams: 4, max_length: 64 });
  var caption = '';
  if (outputs && outputs[0]) {
    caption = outputs[0].generated_text || '';
  }

  if (!caption) caption = 'Could not generate caption.';

  await __aeAddLoreEntry('[Image: ' + file.name + '] ' + caption, 'Image: ' + file.name);
  __aeToast('🖼️ ' + file.name + ': "' + caption + '"', 5000);
}

async function __aeProcessAudioFile(file) {
  var transformers = await __aeLoadTransformers();

  __aeToast('🎤 Loading whisper model... (~5-10s first time)', 15000);

  var arrayBuffer = await file.arrayBuffer();

  __aeToast('🎤 Transcribing ' + file.name + '...', 15000);

  var transcriber = await transformers.pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
  var result = await transcriber(arrayBuffer, { chunk_length_s: 30 });
  var transcript = (result && result.text) ? result.text : '';

  if (!transcript.trim()) {
    __aeToast('⚠️ Audio ' + file.name + ': no speech detected.', 4000);
    return;
  }

  var added = await __aeAddTextAsLore(transcript, 'Audio: ' + file.name);
  __aeToast('🎤 ' + file.name + ': ' + transcript.split(/\s+/).length + ' words → ' + added + ' lore entries', 5000);
}

async function __aeProcessFile(file) {
  var settings = __aeLoadSettings();
  var ext = file.name.split('.').pop().toLowerCase();
  var type = file.type || '';

  // Check extension/type mapping
  var isImage = type.startsWith('image/') || ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif' || ext === 'webp' || ext === 'bmp' || ext === 'svg';
  var isAudio = type.startsWith('audio/') || ext === 'mp3' || ext === 'wav' || ext === 'ogg' || ext === 'm4a' || ext === 'webm' || ext === 'flac' || ext === 'aac';
  var isPdf = ext === 'pdf';
  var isDocx = ext === 'docx' || ext === 'doc';
  var isText = type.startsWith('text/') || ext === 'txt' || ext === 'md' || ext === 'csv' || ext === 'json' || ext === 'html' || ext === 'xml' || ext === 'log' || ext === 'js' || ext === 'py' || ext === 'c' || ext === 'cpp' || ext === 'h' || ext === 'ts' || ext === 'css' || ext === 'yaml' || ext === 'yml' || ext === 'ini' || ext === 'cfg' || ext === 'rtf' || ext === 'srt' || ext === 'vtt';

  try {
    if (isImage && settings.imageCaption) {
      await __aeProcessImageFile(file);
    } else if (isAudio && settings.audioTranscribe) {
      await __aeProcessAudioFile(file);
    } else if (isPdf && settings.pdfExtract) {
      await __aeProcessPdfFile(file);
    } else if (isDocx && settings.docxExtract) {
      await __aeProcessDocxFile(file);
    } else if (isText && settings.fileUpload) {
      await __aeProcessTextFile(file);
    } else if (isImage || isAudio || isPdf || isDocx || isText) {
      var feature = isImage ? 'image' : isAudio ? 'audio' : isPdf ? 'pdf' : isDocx ? 'docx' : 'file';
      await __aeAddSystemMessage(
        '⚠️ **' + feature + '** processing is disabled. Use `/toggle ' + feature + '` to enable.',
        'Extensions'
      );
    } else {
      await __aeAddSystemMessage(
        '⚠️ Unsupported file type: **' + file.name + '** (' + (type || 'unknown') + ')',
        'Extensions'
      );
    }
  } catch(e) {
    console.error('[ae] File processing error:', e);
    await __aeAddSystemMessage('❌ Error processing **' + file.name + '**:\n' + e.message, 'Extensions');
  }
}

// --- Web Search ---

async function __aePerformSearch(userQuery) {
  var settings = __aeLoadSettings();
  if (!settings.webSearch) {
    await __aeAddSystemMessage('⚠️ Web search is disabled. Use `/toggle search` to enable.', 'Extensions');
    return;
  }

  if (!activeThreadId) {
    await __aeAddSystemMessage('⚠️ Open a chat thread first.', 'Extensions');
    return;
  }

  __aeToast('🔍 Searching: ' + userQuery, 30000);

  try {
    // --- Pass 1: AI generates search queries ---
    var queryGenResult = await root.aiTextPlugin({
      instruction: 'Generate 2-3 concise web search queries for this question. Reply ONLY with a JSON array of strings, no explanation.\n\nQuestion: ' + userQuery,
      startWith: '["',
      stopSequences: [']']
    });

    var queryText = (queryGenResult.text || '').trim();
    // Fix partial JSON
    if (!queryText.startsWith('[')) queryText = '[' + queryText;
    if (!queryText.endsWith(']')) queryText += ']';

    var queries;
    try { queries = JSON.parse(queryText); }
    catch(e) { queries = [userQuery]; }

    if (!Array.isArray(queries) || queries.length === 0) queries = [userQuery];

    // --- Pass 2: Search via DuckDuckGo using superFetch to bypass CORS ---
    var allResults = [];

    for (var qi = 0; qi < queries.length; qi++) {
      try {
        // DuckDuckGo Instant Answer API
        var ddgUrl = 'https://api.duckduckgo.com/?q=' + encodeURIComponent(queries[qi]) + '&format=json&no_html=1&skip_disambig=1&t=aiextensions';
        var resp = await root.superFetch(ddgUrl);
        var data = await resp.json();

        if (data.Abstract && data.Abstract.trim()) {
          allResults.push('**' + (data.Heading || queries[qi]) + '** (' + (data.AbstractSource || 'DuckDuckGo') + '):\n' + data.Abstract.trim());
        }

        if (data.Results && data.Results.length > 0) {
          for (var ri = 0; ri < data.Results.length; ri++) {
            if (data.Results[ri].Text) {
              allResults.push('- ' + data.Results[ri].Text);
            }
          }
        }

        if (data.RelatedTopics && data.RelatedTopics.length > 0) {
          for (var ti = 0; ti < data.RelatedTopics.length && ti < 5; ti++) {
            var topic = data.RelatedTopics[ti];
            if (topic && topic.Text) {
              allResults.push('- ' + topic.Text);
            }
          }
        }

        // Also try HTML search via superFetch for richer results
        try {
          var htmlResp = await root.superFetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(queries[qi]));
          if (htmlResp.ok) {
            var html = await htmlResp.text();
            var resultRegex = /class="result__snippet"[^>]*>(.*?)<\/a>/g;
            var match;
            var snippetCount = 0;
            while ((match = resultRegex.exec(html)) !== null && snippetCount < 5) {
              var snippet = match[1].replace(/<[^>]+>/g, '').trim();
              if (snippet.length > 20) {
                allResults.push('- ' + snippet);
                snippetCount++;
              }
            }
          }
        } catch(htmlErr) {
          // superFetch should handle CORS, but just in case
        }

      } catch(e) {
        console.warn('[ae] Search query failed:', queries[qi], e);
      }
    }

    if (allResults.length === 0) {
      await __aeAddSystemMessage('🔍 No results found for: **' + userQuery + '**', 'Internet');
      return;
    }

    // --- Pass 3: AI synthesizes answer ---
    var synthesisPrompt = 'Based on the following search results, provide a comprehensive and helpful answer to the question. Cite sources where possible. Use markdown formatting.\n\nQuestion: ' + userQuery + '\n\nSearch Results:\n' + allResults.join('\n\n');

    var synthesisResult = await root.aiTextPlugin({
      instruction: synthesisPrompt,
      startWith: 'Based on the search results, '
    });

    var answer = (synthesisResult.text || '').trim();

    if (answer) {
      // Save search results to lore for future context
      var loreText = '[Web Search: ' + userQuery + '] ' + allResults.join(' ').substring(0, 2000);
      await __aeAddLoreEntry(loreText, 'Search: ' + userQuery);

      await __aeAddSystemMessage('🌐 **' + userQuery + '**\n\n' + answer, 'Internet');
    } else {
      // Fallback: show raw results
      await __aeAddSystemMessage('🌐 **' + userQuery + '** (raw results)\n\n' + allResults.join('\n\n'), 'Internet');
    }

  } catch(e) {
    console.error('[ae] Search error:', e);
    await __aeAddSystemMessage('❌ Search failed: ' + e.message, 'Internet');
  }
}

// --- Toggle / Status ---

var __aeFeatureMap = {
  'file': 'fileUpload', 'files': 'fileUpload', 'upload': 'fileUpload',
  'pdf': 'pdfExtract',
  'docx': 'docxExtract',
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
      'Available: ' + Object.keys(__aeFeatureMap).filter(function(k) { return __aeFeatureMap[k] === k || true; }).join(', '),
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

  // Refresh shortcut buttons for active thread
  if (activeThreadId) {
    var thread = await db.threads.get(activeThreadId);
    if (thread) {
      await __aeEnsureShortcutButtons(thread);
      renderShortcutButtons(thread);
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
    '| 🖼️ Image Caption | ' + (s.imageCaption ? '✅ ON' : '❌ OFF') + ' | `/toggle image` |',
    '| 🎤 Audio Transcribe | ' + (s.audioTranscribe ? '✅ ON' : '❌ OFF') + ' | `/toggle audio` |',
    '| 🌐 Web Search | ' + (s.webSearch ? '✅ ON' : '❌ OFF') + ' | `/toggle search` |',
    '',
    '**Commands:** `/file`, `/search <query>`, `/toggle <feature>`, `/extensions`',
    '',
    '**Drag & drop** files onto the chat to auto-process them.'
  ];
  await __aeAddSystemMessage(lines.join('\n'), 'Extensions');
}

// --- File Input UI ---

var __aeFileInput = null;

function __aeCreateFileInput() {
  if (__aeFileInput) return;
  __aeFileInput = document.createElement('input');
  __aeFileInput.type = 'file';
  __aeFileInput.style.display = 'none';
  __aeFileInput.multiple = true;
  __aeFileInput.accept = '.txt,.md,.csv,.json,.html,.xml,.log,.js,.py,.c,.cpp,.h,.ts,.css,.yaml,.yml,.ini,.cfg,.srt,.vtt,.pdf,.doc,.docx,.mp3,.wav,.ogg,.m4a,.webm,.flac,.aac,.png,.jpg,.jpeg,.gif,.webp,.bmp';
  document.body.appendChild(__aeFileInput);

  __aeFileInput.addEventListener('change', async function() {
    var files = __aeFileInput.files;
    if (!files || files.length === 0) return;
    for (var i = 0; i < files.length; i++) {
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
    for (var i = 0; i < files.length; i++) {
      await __aeProcessFile(files[i]);
    }
  });
}

// --- Shortcut Buttons ---

async function __aeEnsureShortcutButtons(thread) {
  if (!thread || !thread.shortcutButtons) return;

  // Remove existing extension buttons
  thread.shortcutButtons = thread.shortcutButtons.filter(function(b) {
    return !b[__AE_EXT];
  });

  var settings = __aeLoadSettings();

  if (settings.fileUpload || settings.pdfExtract || settings.docxExtract) {
    thread.shortcutButtons.push({
      name: '📎 File',
      message: '/file',
      insertionType: 'replace',
      autoSend: true,
      clearAfterSend: true
    });
    // Mark as ours
    thread.shortcutButtons[thread.shortcutButtons.length - 1][__AE_EXT] = true;
  }

  if (settings.webSearch) {
    thread.shortcutButtons.push({
      name: '🔍 Search',
      message: '/search ',
      insertionType: 'replace',
      autoSend: false,
      clearAfterSend: false
    });
    thread.shortcutButtons[thread.shortcutButtons.length - 1][__AE_EXT] = true;
  }

  thread.shortcutButtons.push({
    name: '⚙️ Status',
    message: '/extensions',
    insertionType: 'replace',
    autoSend: true,
    clearAfterSend: true
  });
  thread.shortcutButtons[thread.shortcutButtons.length - 1][__AE_EXT] = true;

  await db.threads.put(thread);
}

// --- Command Interception ---

function __aeSetupCommandHandler() {
  // Capture-phase listener runs before the main sendButtonClickHandler
  $.sendButton.addEventListener('click', function(e) {
    var text = ($.messageInput.value || '').trim();
    var handled = false;

    if (text === '/file') {
      handled = true;
      if (activeThreadId) {
        __aeFileInput.click();
      } else {
        __aeAddSystemMessage('⚠️ Open a chat thread first.', 'Extensions');
      }
    } else if (text.startsWith('/search ')) {
      var query = text.slice(8).trim();
      if (query) {
        handled = true;
        __aePerformSearch(query);
      }
    } else if (text.startsWith('/toggle ')) {
      var feature = text.slice(8).trim();
      if (feature) {
        handled = true;
        __aeToggle(feature);
      }
    } else if (text === '/extensions' || text === '/ext') {
      handled = true;
      __aeShowStatus();
    }

    if (handled) {
      e.stopImmediatePropagation();
      e.preventDefault();
      $.messageInput.value = '';
    }
  }, true); // capture phase
}

// --- Wrap showThread to inject shortcut buttons ---
// Original signature: showThread(threadId)
// We wrap it so after it runs, we ensure our shortcut buttons are present.
var __aeOriginalShowThread = showThread;
showThread = async function(threadId) {
  await __aeOriginalShowThread.call(this, threadId);
  // After thread is shown, ensure our shortcut buttons are present
  if (activeThreadId) {
    try {
      var thread = await db.threads.get(activeThreadId);
      if (thread) {
        // Check if we need to add buttons
        var hasAeButtons = thread.shortcutButtons && thread.shortcutButtons.some(function(b) { return b[__AE_EXT]; });
        if (!hasAeButtons) {
          await __aeEnsureShortcutButtons(thread);
        }
        renderShortcutButtons(thread);
      }
    } catch(e) {
      console.error('[ae] showThread wrap error:', e);
    }
  }
};

// --- Initialize ---

__aeCreateFileInput();
__aeSetupDragDrop();
__aeSetupCommandHandler();

console.log('[ae] Extensions module v' + __AE_VERSION + ' loaded. Commands: /file, /search, /toggle, /extensions');

