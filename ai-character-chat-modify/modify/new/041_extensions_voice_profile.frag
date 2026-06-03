
// ============================================
// AI CHARACTER CHAT — VOICE PROFILE MODULE
// ============================================
// Lightweight acoustic profile for uploaded/recorded audio.
// Does NOT identify a person; only describes audible qualities with uncertainty.
// ============================================

function __aeEstimatePitchAutocorrelation(samples, sampleRate) {
  if (!samples || samples.length < sampleRate * 0.1) return null;
  var size = Math.min(samples.length, sampleRate * 2);
  var start = Math.max(0, Math.floor((samples.length - size) / 2));
  var x = samples.slice(start, start + size);
  var rms = Math.sqrt(x.reduce(function(sum, v) { return sum + v * v; }, 0) / x.length);
  if (rms < 0.01) return null;
  var minLag = Math.floor(sampleRate / 350);
  var maxLag = Math.floor(sampleRate / 70);
  var bestLag = 0, best = -Infinity;
  for (var lag = minLag; lag <= maxLag; lag++) {
    var corr = 0;
    for (var i = 0; i < x.length - lag; i += 3) corr += x[i] * x[i + lag];
    if (corr > best) { best = corr; bestLag = lag; }
  }
  return bestLag ? sampleRate / bestLag : null;
}

async function __aeAnalyzeAudioProfile(arrayBuffer, transcript) {
  var AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return '';
  try {
    var ctx = new AudioCtx({ sampleRate: 16000 });
    var decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    var sr = decoded.sampleRate;
    var ch = decoded.numberOfChannels;
    var len = decoded.length;
    var mono = new Float32Array(len);
    for (var c = 0; c < ch; c++) {
      var data = decoded.getChannelData(c);
      for (var i = 0; i < len; i++) mono[i] += data[i] / ch;
    }
    try { await ctx.close(); } catch(e) {}

    var duration = len / sr;
    var rms = Math.sqrt(mono.reduce(function(sum, v) { return sum + v * v; }, 0) / Math.max(1, mono.length));
    var zc = 0;
    for (var zi = 1; zi < mono.length; zi += 4) if ((mono[zi - 1] < 0 && mono[zi] >= 0) || (mono[zi - 1] >= 0 && mono[zi] < 0)) zc++;
    var zcr = zc / Math.max(1, mono.length / 4);
    var pitch = __aeEstimatePitchAutocorrelation(mono, sr);
    var words = (transcript || '').split(/\s+/).filter(Boolean).length;
    var wpm = duration > 0 ? Math.round(words / duration * 60) : 0;

    var pitchLabel = !pitch ? 'uncertain' : pitch < 120 ? 'low' : pitch < 190 ? 'medium' : 'high';
    var volumeLabel = rms < 0.025 ? 'quiet' : rms < 0.09 ? 'moderate' : 'loud';
    var paceLabel = !wpm ? 'uncertain' : wpm < 100 ? 'slow' : wpm < 170 ? 'normal' : 'fast';
    var toneHints = [];
    if (rms > 0.11 || zcr > 0.12) toneHints.push('energetic/tense possible');
    if (rms < 0.03) toneHints.push('soft/quiet');
    if (wpm > 180) toneHints.push('hurried');
    if (wpm > 0 && wpm < 90) toneHints.push('calm/slow');

    return [
      'VOICE ACOUSTIC PROFILE (approximate, not identity):',
      '- duration: ' + duration.toFixed(1) + 's',
      '- loudness: ' + volumeLabel,
      '- pitch impression: ' + pitchLabel + (pitch ? ' (~' + Math.round(pitch) + ' Hz)' : ''),
      '- speaking pace: ' + paceLabel + (wpm ? ' (~' + wpm + ' wpm)' : ''),
      '- tone hints: ' + (toneHints.length ? toneHints.join(', ') : 'neutral/uncertain'),
      '- perceived age/gender: not reliably inferred; avoid treating this as fact.'
    ].join('\n');
  } catch(e) {
    console.warn('[ae] voice acoustic profile failed:', e);
    return '';
  }
}

console.log('[ae] Voice Profile module loaded. Use /toggle voiceprofile.');
