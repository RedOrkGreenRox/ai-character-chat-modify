
function __aeIsImageFileName(name) {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name || '');
}

async function __aeProcessEmbeddedImagesFromZipArrayBuffer(parentName, arrayBuffer) {
  var settings = __aeLoadSettings();
  if (!settings.imageCaption) return 0;
  var processed = 0;
  try {
    var JSZip = await __aeLoadJsZip();
    var zip = await JSZip.loadAsync(arrayBuffer.slice ? arrayBuffer.slice(0) : arrayBuffer);
    var imageNames = Object.keys(zip.files).filter(function(name) {
      return !zip.files[name].dir && __aeIsImageFileName(name);
    });
    for (var i = 0; i < imageNames.length && processed < __AE_MAX_EMBEDDED_IMAGES; i++) {
      __aeAssertNotCancelled();
      var currentChars = await __aeGetActiveFileContextCharCount(activeThreadId);
      if (currentChars >= __AE_FILE_CONTEXT_BUFFER_CHARS) {
        __aeToast('🖼️ Embedded image buffer limit reached; skipping remaining images.', 5000);
        break;
      }
      var name = imageNames[i];
      var blob = await zip.files[name].async('blob');
      if (!blob || blob.size === 0 || blob.size > __AE_MAX_ARCHIVE_FILE_BYTES) continue;
      var ext = name.split('.').pop().toLowerCase();
      var file = new File([blob], parentName + ' @ ' + (name.split('/').pop() || ('image.' + ext)), { type: blob.type || ('image/' + (ext === 'jpg' ? 'jpeg' : ext)) });
      await __aeProcessImageFile(file);
      processed++;
    }
  } catch(e) {
    console.warn('[ae] Embedded image extraction failed for', parentName, e);
  }
  return processed;
}

async function __aeProcessPdfPageImages(pdf, parentName) {
  var settings = __aeLoadSettings();
  if (!settings.imageCaption) return 0;
  var processed = 0;
  try {
    var pages = Math.min(pdf.numPages || 0, __AE_MAX_PDF_IMAGE_PAGES);
    for (var i = 1; i <= pages; i++) {
      __aeAssertNotCancelled();
      var currentChars = await __aeGetActiveFileContextCharCount(activeThreadId);
      if (currentChars >= __AE_FILE_CONTEXT_BUFFER_CHARS) break;
      var page = await pdf.getPage(i);
      var viewport = page.getViewport({ scale: 1.0 });
      var canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      var ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      var blob = await new Promise(function(resolve) { canvas.toBlob(resolve, 'image/png'); });
      if (blob && blob.size > 0) {
        var file = new File([blob], parentName + ' @ page-' + i + '.png', { type: 'image/png' });
        await __aeProcessImageFile(file);
        processed++;
      }
      canvas.width = canvas.height = 0;
    }
  } catch(e) {
    console.warn('[ae] PDF page image extraction failed for', parentName, e);
  }
  return processed;
}

async function __aeProcessTextFile(file) {
  __aeAssertNotCancelled();
  var text = await file.text();
  if (!text.trim()) {
    await __aeAddSystemMessage('⚠️ File **' + file.name + '** is empty.', 'File Upload');
    return;
  }
  var wordCount = text.split(/\s+/).length;
  var added = await __aeRememberExtractedContent('File', file.name, text, wordCount + ' words');
  await __aeAddSystemMessage(
    '📎 Loaded **' + file.name + '**\n' +
    wordCount + ' words → ' + added + ' lore entries added + AI-visible context message saved.',
    'File Upload'
  );
}

async function __aeProcessPdfFile(file) {
  __aeAssertNotCancelled();
  // Snapshot file bytes immediately. Some browsers/OSes can invalidate dragged files
  // while we are waiting for CDN libraries to load.
  var arrayBuffer = await file.arrayBuffer();
  var pdfjsLib = await __aeLoadPdfJs();
  var pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer), disableWorker: true }).promise;
  var allText = '';

  for (var i = 1; i <= pdf.numPages; i++) {
    __aeAssertNotCancelled();
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

  var added = await __aeRememberExtractedContent('PDF', file.name, allText, pdf.numPages + ' pages');
  var embeddedImages = await __aeProcessPdfPageImages(pdf, file.name);
  await __aeAddSystemMessage(
    '📄 Extracted **' + file.name + '**\n' +
    pdf.numPages + ' pages → ' + added + ' lore entries added + AI-visible context message saved.' + (embeddedImages ? '\n🖼️ Also processed ' + embeddedImages + ' page image(s).' : ''),
    'PDF Extract'
  );
}

async function __aeProcessDocxFile(file) {
  __aeAssertNotCancelled();
  // Snapshot file bytes before loading mammoth for the same reason as PDFs.
  var arrayBuffer = await file.arrayBuffer();
  var mammoth = await __aeLoadMammoth();
  var result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
  var text = result.value || '';

  if (!text.trim()) {
    await __aeAddSystemMessage('⚠️ DOCX **' + file.name + '** contains no extractable text.', 'DOCX Extract');
    return;
  }

  var wordCount = text.split(/\s+/).filter(function(w) { return w; }).length;
  var added = await __aeRememberExtractedContent('DOCX', file.name, text, wordCount + ' words');
  var embeddedImages = await __aeProcessEmbeddedImagesFromZipArrayBuffer(file.name, arrayBuffer);
  await __aeAddSystemMessage(
    '📝 Extracted **' + file.name + '**\n' +
    wordCount + ' words → ' + added + ' lore entries added + AI-visible context message saved.' + (embeddedImages ? '\n🖼️ Also processed ' + embeddedImages + ' embedded image(s).' : ''),
    'DOCX Extract'
  );
}


async function __aeReadAndNormalizeImageDataUrl(file) {
  var originalDataUrl = await new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function() { resolve(reader.result); };
    reader.onerror = function() { reject(reader.error || new Error('Failed to read image file.')); };
    reader.readAsDataURL(file);
  });
  // Some browser-side image models fail on unusual WEBP/PNG encodings. Convert to a
  // modest PNG via canvas when possible. If browser decoding fails, return original.
  try {
    var img = await new Promise(function(resolve, reject) {
      var el = new Image();
      el.onload = function() { resolve(el); };
      el.onerror = function() { reject(new Error('Browser could not decode image for normalization.')); };
      el.src = originalDataUrl;
    });
    var maxSide = 768;
    var scale = Math.min(1, maxSide / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    var canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
    canvas.height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    var png = canvas.toDataURL('image/png');
    canvas.width = canvas.height = 0;
    return png;
  } catch(e) {
    console.warn('[ae] Image normalization failed; using original data URL:', e);
    return originalDataUrl;
  }
}

async function __aeProcessImageFile(file) {
  __aeAssertNotCancelled();
  // Snapshot and normalize file data before model/CDN loading.
  var dataUrl = await __aeReadAndNormalizeImageDataUrl(file);

  var transformers = await __aeLoadTransformers();

  __aeToast('🖼️ Loading image caption model... (~30-60s first time)', 30000);

  __aeToast('🖼️ Captioning ' + file.name + '...', 15000);

  var caption = '';
  var lastCaptionError = null;
  for (var mi = 0; mi < __AE_IMAGE_CAPTION_MODELS.length; mi++) {
    var modelId = __AE_IMAGE_CAPTION_MODELS[mi];
    try {
      __aeToast('🖼️ Captioning with ' + modelId + '...', 15000);
      var captioner = await transformers.pipeline('image-to-text', modelId);
      var outputs = await captioner(dataUrl, { max_new_tokens: 64, max_length: 64 });
      if (outputs && outputs[0]) {
        caption = outputs[0].generated_text || outputs[0].caption || '';
      }
      if (caption) break;
    } catch(e) {
      lastCaptionError = e;
      console.warn('[ae] Image caption model failed:', modelId, e);
    }
  }

  if (!caption) {
    caption = 'Image uploaded: ' + file.name + ' (' + (file.type || 'unknown type') + ', ' + file.size + ' bytes). Automatic captioning was unavailable.';
  }

  var imageText = '[Image: ' + file.name + '] ' + caption;
  await __aeRememberExtractedContent('Image', file.name, imageText, 'automatic image caption');
  __aeToast('🖼️ ' + file.name + ': "' + caption + '"', 5000);
}


async function __aeDecodeAudioToFloat32(arrayBuffer) {
  try {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return arrayBuffer;
    var ctx = new AudioCtx({ sampleRate: 16000 });
    var decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    var length = decoded.length;
    var channels = decoded.numberOfChannels;
    var mono = new Float32Array(length);
    for (var ch = 0; ch < channels; ch++) {
      var data = decoded.getChannelData(ch);
      for (var i = 0; i < length; i++) mono[i] += data[i] / channels;
    }
    try { await ctx.close(); } catch(e) {}
    return mono;
  } catch(e) {
    console.warn('[ae] Audio decode failed, falling back to raw ArrayBuffer:', e);
    return arrayBuffer;
  }
}

async function __aeProcessAudioFile(file) {
  __aeAssertNotCancelled();
  var arrayBuffer = await file.arrayBuffer();
  var transformers = await __aeLoadTransformers();

  __aeToast('🎤 Loading whisper model... (~5-10s first time)', 15000);

  __aeToast('🎤 Transcribing ' + file.name + '...', 15000);

  var transcriber = await transformers.pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
  var audioInput = await __aeDecodeAudioToFloat32(arrayBuffer);
  var result = await transcriber(audioInput, { chunk_length_s: 30, stride_length_s: 5 });
  var transcript = (result && result.text) ? result.text : '';
  var voiceProfile = '';
  try {
    if (__aeLoadSettings().voiceProfile && typeof __aeAnalyzeAudioProfile === 'function') {
      voiceProfile = await __aeAnalyzeAudioProfile(arrayBuffer, transcript);
    }
  } catch(e) { console.warn('[ae] voice profile failed:', e); }

  if (!transcript.trim()) {
    __aeToast('⚠️ Audio ' + file.name + ': no speech detected.', 4000);
    return;
  }

  var audioContextText = transcript + (voiceProfile ? '\n\n' + voiceProfile : '');
  var added = await __aeRememberExtractedContent('Audio', file.name, audioContextText, transcript.split(/\s+/).length + ' words transcript' + (voiceProfile ? ' + voice profile' : ''));
  __aeToast('🎤 ' + file.name + ': ' + transcript.split(/\s+/).length + ' words → ' + added + ' lore entries + AI context', 5000);
}


async function __aeProcessSpreadsheetFile(file) {
  __aeAssertNotCancelled();
  var arrayBuffer = await file.arrayBuffer();
  var XLSX = await __aeLoadXlsx();
  var workbook = XLSX.read(arrayBuffer, { type: 'array' });
  var parts = [];
  for (var si = 0; si < workbook.SheetNames.length; si++) {
    __aeAssertNotCancelled();
    var sheetName = workbook.SheetNames[si];
    var sheet = workbook.Sheets[sheetName];
    var csv = XLSX.utils.sheet_to_csv(sheet, { FS: ',', RS: '\n' }).trim();
    if (csv) {
      parts.push('--- SHEET: ' + sheetName + ' ---\n' + csv);
    }
  }
  var text = parts.join('\n\n');
  if (!text.trim()) {
    await __aeAddSystemMessage('⚠️ Spreadsheet **' + file.name + '** contains no extractable cells.', 'Spreadsheet Extract');
    return;
  }
  var added = await __aeRememberExtractedContent('Spreadsheet', file.name, text, workbook.SheetNames.length + ' sheets');
  var embeddedImages = await __aeProcessEmbeddedImagesFromZipArrayBuffer(file.name, arrayBuffer);
  await __aeAddSystemMessage(
    '📊 Extracted **' + file.name + '**\n' +
    workbook.SheetNames.length + ' sheet(s) → ' + added + ' lore entries added + AI-visible context message saved.' + (embeddedImages ? '\n🖼️ Also processed ' + embeddedImages + ' embedded image(s).' : ''),
    'Spreadsheet Extract'
  );
}

async function __aeProcessArchiveFile(file, depth) {
  __aeAssertNotCancelled();
  depth = depth || 0;
  if (depth > 1) {
    await __aeAddSystemMessage('⚠️ Nested archive skipped: **' + file.name + '**', 'Archive Extract');
    return;
  }
  var arrayBuffer = await file.arrayBuffer();
  var JSZip = await __aeLoadJsZip();
  var zip = await JSZip.loadAsync(arrayBuffer);
  var entries = Object.keys(zip.files).filter(function(name) { return !zip.files[name].dir; });
  if (entries.length === 0) {
    await __aeAddSystemMessage('⚠️ Archive **' + file.name + '** contains no files.', 'Archive Extract');
    return;
  }

  var processed = 0;
  var skipped = [];
  for (var i = 0; i < entries.length && processed < __AE_MAX_ARCHIVE_FILES; i++) {
    __aeAssertNotCancelled();
    var name = entries[i];
    var entry = zip.files[name];
    try {
      var blob = await entry.async('blob');
      if (blob.size > __AE_MAX_ARCHIVE_FILE_BYTES) {
        skipped.push(name + ' (too large)');
        continue;
      }
      var childFile = new File([blob], name.split('/').pop() || name, { type: blob.type || '' });
      await __aeProcessFile(childFile, { depth: depth + 1, sourceArchive: file.name });
      processed++;
    } catch(e) {
      console.warn('[ae] Archive entry failed:', name, e);
      skipped.push(name + ' (' + e.message + ')');
    }
  }

  if (entries.length > processed) skipped.push((entries.length - processed) + ' file(s) not processed due to limits');
  await __aeAddSystemMessage(
    '🗜️ Processed archive **' + file.name + '**\n' +
    processed + ' file(s) processed.' + (skipped.length ? '\nSkipped: ' + skipped.slice(0, 10).join('; ') : ''),
    'Archive Extract'
  );
}

async function __aeProcessFile(file, opts) {
  opts = opts || {};
  __aeAssertNotCancelled();
  var taskId = __aeBeginTask(file.name || 'file', 'starting...');
  var settings = __aeLoadSettings();
  var ext = file.name.split('.').pop().toLowerCase();
  var type = file.type || '';

  // Check extension/type mapping
  var isImage = type.startsWith('image/') || ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif' || ext === 'webp' || ext === 'bmp' || ext === 'svg';
  var isAudio = type.startsWith('audio/') || ext === 'mp3' || ext === 'wav' || ext === 'ogg' || ext === 'm4a' || ext === 'webm' || ext === 'flac' || ext === 'aac';
  var isPdf = ext === 'pdf';
  var isDocx = ext === 'docx';
  var isSpreadsheet = ext === 'xlsx' || ext === 'xls' || ext === 'ods';
  var isArchive = ext === 'zip';
  var isText = type.startsWith('text/') || ext === 'txt' || ext === 'md' || ext === 'csv' || ext === 'json' || ext === 'html' || ext === 'xml' || ext === 'log' || ext === 'js' || ext === 'py' || ext === 'c' || ext === 'cpp' || ext === 'h' || ext === 'ts' || ext === 'css' || ext === 'yaml' || ext === 'yml' || ext === 'ini' || ext === 'cfg' || ext === 'rtf' || ext === 'srt' || ext === 'vtt';

  try {
    __aeUpdateTask(taskId, 'reading ' + (ext || 'file') + '...');
    if (ext === 'doc') {
      await __aeAddSystemMessage('⚠️ Old binary **.doc** files are not supported by the browser extractor. Please convert **' + file.name + '** to **.docx** and try again.', 'DOC Extract');
    } else if (isImage && settings.imageCaption) {
      await __aeProcessImageFile(file);
    } else if (isAudio && settings.audioTranscribe) {
      await __aeProcessAudioFile(file);
    } else if (isPdf && settings.pdfExtract) {
      await __aeProcessPdfFile(file);
    } else if (isDocx && settings.docxExtract) {
      await __aeProcessDocxFile(file);
    } else if (isSpreadsheet && settings.spreadsheetExtract) {
      await __aeProcessSpreadsheetFile(file);
    } else if (isArchive && settings.archiveExtract) {
      await __aeProcessArchiveFile(file, opts.depth || 0);
    } else if (isText && settings.fileUpload) {
      await __aeProcessTextFile(file);
    } else if (isImage || isAudio || isPdf || isDocx || isSpreadsheet || isArchive || isText) {
      var feature = isImage ? 'image' : isAudio ? 'audio' : isPdf ? 'pdf' : isDocx ? 'docx' : isSpreadsheet ? 'spreadsheet' : isArchive ? 'archive' : 'file';
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
    __aeEndTask(taskId, 'done', 'processed');
  } catch(e) {
    console.error('[ae] File processing error:', e);
    var cancelled = /cancel/i.test(e.message || '') || __aeProcessingCancelled;
    __aeEndTask(taskId, cancelled ? 'cancelled' : 'error', e.message);
    if (!cancelled) await __aeAddSystemMessage('❌ Error processing **' + file.name + '**:\n' + e.message, 'Extensions');
  }
}

