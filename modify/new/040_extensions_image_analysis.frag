
// ============================================
// AI CHARACTER CHAT — ADVANCED IMAGE ANALYSIS MODULE
// ============================================
// Optional multi-pass image analysis: caption + object detection + OCR attempt.
// Enabled with /toggle imageanalysis.
// ============================================

async function __aeAdvancedAnalyzeImage(file) {
  __aeAssertNotCancelled();
  var dataUrl = await __aeReadAndNormalizeImageDataUrl(file);
  var transformers = await __aeLoadTransformers();
  var lines = ['[Image: ' + file.name + ']'];

  try {
    __aeToast('🧠 Advanced image caption...', 6000);
    var captioner = await transformers.pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning');
    var cap = await captioner(dataUrl, { max_new_tokens: 64, max_length: 64 });
    if (cap && cap[0]) lines.push('Caption: ' + (cap[0].generated_text || cap[0].caption || '').trim());
  } catch(e) {
    console.warn('[ae] advanced caption failed:', e);
    lines.push('Caption: unavailable.');
  }

  try {
    __aeAssertNotCancelled();
    __aeToast('🧠 Detecting objects...', 6000);
    var detector = await transformers.pipeline('object-detection', 'Xenova/detr-resnet-50');
    var objects = await detector(dataUrl, { threshold: 0.75, percentage: true });
    if (objects && objects.length) {
      lines.push('Objects: ' + objects.slice(0, 12).map(function(o) {
        return (o.label || o.class || 'object') + (o.score ? ' (' + Math.round(o.score * 100) + '%)' : '');
      }).join(', '));
    }
  } catch(e) {
    console.warn('[ae] object detection failed:', e);
  }

  try {
    __aeAssertNotCancelled();
    __aeToast('🧠 Checking visual hypotheses...', 6000);
    var zeroShot = await transformers.pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32');
    var labels = [
      'damaged car', 'broken car', 'car accident', 'traffic accident', 'vehicle collision',
      'car crash scene', 'broken bumper', 'dented vehicle', 'emergency road scene',
      'normal parked car', 'undamaged car', 'person portrait', 'document screenshot',
      'table or spreadsheet', 'handwritten text', 'printed text'
    ];
    var zs = await zeroShot(dataUrl, labels);
    if (zs && zs.length) {
      zs.sort(function(a,b) { return (b.score || 0) - (a.score || 0); });
      lines.push('Visual hypothesis scores: ' + zs.slice(0, 8).map(function(x) {
        return (x.label || 'label') + ' (' + Math.round((x.score || 0) * 100) + '%)';
      }).join(', '));
      var accidentScore = zs.filter(function(x) { return /damaged|broken|accident|collision|crash|bumper|dented/i.test(x.label || ''); })
        .reduce(function(max, x) { return Math.max(max, x.score || 0); }, 0);
      if (accidentScore > 0.18) lines.push('Damage/accident hint: possible vehicle damage or accident context detected; treat as uncertain and verify with user if important.');
    }
  } catch(e) {
    console.warn('[ae] zero-shot image classification failed:', e);
  }

  try {
    __aeAssertNotCancelled();
    __aeToast('🧠 OCR attempt...', 6000);
    var ocr = await transformers.pipeline('image-to-text', 'Xenova/trocr-small-printed');
    var out = await ocr(dataUrl, { max_new_tokens: 128 });
    var text = out && out[0] ? (out[0].generated_text || '').trim() : '';
    if (text && text.length > 2) lines.push('OCR text: ' + text);
  } catch(e) {
    console.warn('[ae] OCR failed:', e);
  }

  var analysis = lines.filter(Boolean).join('\n');
  await __aeRememberExtractedContent('Image Analysis', file.name, analysis, 'advanced image analysis');
  __aeToast('🧠 Image analysis saved: ' + file.name, 4000);
}

var __aeOriginalProcessImageFileForAdvanced = __aeProcessImageFile;
__aeProcessImageFile = async function(file) {
  var settings = __aeLoadSettings();
  if (!settings.advancedImageAnalysis) return __aeOriginalProcessImageFileForAdvanced.apply(this, arguments);
  try {
    return await __aeAdvancedAnalyzeImage(file);
  } catch(e) {
    console.warn('[ae] advanced image analysis failed, falling back to basic:', e);
    return __aeOriginalProcessImageFileForAdvanced.apply(this, arguments);
  }
};

console.log('[ae] Advanced Image Analysis module loaded. Use /toggle imageanalysis.');
