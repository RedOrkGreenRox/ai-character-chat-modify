
// ============================================
// AI CHARACTER CHAT — VOICE RECORDING WIDGET
// ============================================
// Big, visible recording UI with timer, waveform and large stop/cancel
// buttons. Replaces the small toast-only feedback used by the original
// __aeToggleVoiceRecording.
//
// We override window.__aeToggleVoiceRecording from 034_extensions_voice.frag.
// The transcription path (__aeProcessAudioFile) is reused unchanged.
//
// Important: the audio bubble in the chat history (real <audio> player
// embedded in the message) requires changes to the original message
// sanitizer in 013_module_sanitization_markdown_scaffolding.frag. That
// is intentionally NOT done here; see docs/DESIGN_NOTES.md §6.
// ============================================

(function() {
  if (window.__aeVoiceWidgetInstalled) return;
  window.__aeVoiceWidgetInstalled = true;

  let __aeWidget = null;          // DOM root
  let __aeWidgetState = null;     // { recorder, stream, chunks, startedAt, timerId, rafId, analyser, ctx }

  function __aeFormatMs(ms) {
    let s = Math.max(0, Math.floor(ms / 1000));
    let mm = Math.floor(s / 60), ss = s % 60;
    return (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss;
  }

  function __aeBuildWidgetDom() {
    let root = document.createElement('div');
    root.className = '__aeVoiceWidget';
    root.style.cssText = [
      'position:fixed', 'z-index:9999999', 'right:16px', 'bottom:16px',
      'min-width:280px', 'max-width:calc(100vw - 32px)',
      'background:#1f1f1f', 'color:#fff', 'border-radius:14px',
      'box-shadow:0 8px 32px rgba(0,0,0,.45)',
      'padding:.7rem .8rem',
      'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
      'user-select:none', '-webkit-user-select:none'
    ].join(';');

    root.innerHTML = [
      '<div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.45rem;">',
        '<div class="__aeVwDot"   style="width:14px;height:14px;border-radius:50%;background:#e74c3c;animation:__aeVwPulse 1.2s infinite;"></div>',
        '<div class="__aeVwTimer" style="font-variant-numeric:tabular-nums;font-size:1.1rem;font-weight:600;">00:00</div>',
        '<div class="__aeVwLimit" style="font-size:.78rem;opacity:.65;margin-left:auto;">max 60s</div>',
      '</div>',
      '<canvas class="__aeVwCanvas" width="520" height="44" style="width:100%;height:44px;background:#111;border-radius:8px;display:block;"></canvas>',
      '<div style="display:flex;gap:.45rem;margin-top:.55rem;">',
        '<button class="__aeVwStop"   style="flex:2;min-height:2.8rem;border:none;border-radius:10px;background:#e74c3c;color:#fff;font-size:1rem;font-weight:600;">■ Stop & send</button>',
        '<button class="__aeVwCancel" style="flex:1;min-height:2.8rem;border:none;border-radius:10px;background:#444;color:#fff;font-size:1rem;">✕ Cancel</button>',
      '</div>',
      '<style>',
        '@keyframes __aeVwPulse { 0%,100% { transform:scale(1); opacity:1 } 50% { transform:scale(1.25); opacity:.55 } }',
      '</style>'
    ].join('');
    document.body.appendChild(root);
    return root;
  }

  function __aeStopWidgetVisuals() {
    if (!__aeWidgetState) return;
    if (__aeWidgetState.timerId)  { clearInterval(__aeWidgetState.timerId);  __aeWidgetState.timerId = null; }
    if (__aeWidgetState.rafId)    { cancelAnimationFrame(__aeWidgetState.rafId); __aeWidgetState.rafId = null; }
    try { if (__aeWidgetState.ctx)  __aeWidgetState.ctx.close(); } catch(_) {}
    __aeWidgetState.ctx = null;
    __aeWidgetState.analyser = null;
  }

  function __aeRemoveWidget() {
    __aeStopWidgetVisuals();
    if (__aeWidget && __aeWidget.parentNode) __aeWidget.parentNode.removeChild(__aeWidget);
    __aeWidget = null;
  }

  function __aeStartTimerAndWaveform() {
    let timerEl = __aeWidget.querySelector('.__aeVwTimer');
    let dotEl   = __aeWidget.querySelector('.__aeVwDot');
    let limitEl = __aeWidget.querySelector('.__aeVwLimit');
    let canvas  = __aeWidget.querySelector('.__aeVwCanvas');
    let g = canvas.getContext('2d');
    let maxMs = (typeof __AE_MAX_VOICE_RECORDING_MS === 'number') ? __AE_MAX_VOICE_RECORDING_MS : 60000;
    limitEl.textContent = 'max ' + Math.round(maxMs / 1000) + 's';

    // Timer
    __aeWidgetState.timerId = setInterval(function() {
      if (!__aeWidgetState || !__aeWidgetState.startedAt) return;
      let ms = Date.now() - __aeWidgetState.startedAt;
      timerEl.textContent = __aeFormatMs(ms);
      let ratio = ms / maxMs;
      if (ratio > 0.9) {
        dotEl.style.background = '#ffb020';
      }
      if (ratio > 0.97) {
        dotEl.style.background = '#ff2222';
        limitEl.style.color = '#ff8888';
        limitEl.textContent = 'stopping…';
      }
    }, 200);

    // Waveform via AnalyserNode
    let tempCtx = null;
    try {
      let AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx && __aeWidgetState.stream) {
        tempCtx = new AudioCtx();
        let src = tempCtx.createMediaStreamSource(__aeWidgetState.stream);
        let analyser = tempCtx.createAnalyser();
        analyser.fftSize = 1024;
        src.connect(analyser);
        __aeWidgetState.ctx = tempCtx;
        __aeWidgetState.analyser = analyser;
        let buf = new Uint8Array(analyser.fftSize);

        let draw = function() {
          if (!__aeWidgetState || !__aeWidgetState.analyser) return;
          analyser.getByteTimeDomainData(buf);
          let w = canvas.width, h = canvas.height;
          g.fillStyle = '#111'; g.fillRect(0, 0, w, h);
          g.lineWidth = 2; g.strokeStyle = '#7ee787'; g.beginPath();
          let step = Math.max(1, Math.floor(buf.length / w));
          for (let x = 0; x < w; x++) {
            let v = buf[x * step] / 128.0 - 1.0;
            let y = h / 2 + v * (h / 2 - 2);
            if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
          }
          g.stroke();
          __aeWidgetState.rafId = requestAnimationFrame(draw);
        };
        __aeWidgetState.rafId = requestAnimationFrame(draw);
      }
    } catch(e) {
      console.warn('[ae] waveform failed:', e);
      if (tempCtx) {
        try { tempCtx.close(); } catch(_) {}
      }
      if (__aeWidgetState) {
        __aeWidgetState.ctx = null;
        __aeWidgetState.analyser = null;
      }
    }
  }

  async function __aeStartRecording() {
    if (__aeWidget || (__aeWidgetState && __aeWidgetState.recorder && __aeWidgetState.recorder.state === 'recording')) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (typeof __aeAddSystemMessage === 'function') {
        await __aeAddSystemMessage('⚠️ Voice recording is not supported in this browser.', 'Voice');
      }
      if (typeof __aeToast === 'function') __aeToast('⚠️ Voice recording not supported.', 4500);
      return;
    }
    if (typeof activeThreadId !== 'number' || !Number.isFinite(activeThreadId)) {
      if (typeof __aeToast === 'function') __aeToast('⚠️ Open a chat thread first.', 4000);
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch(e) {
      if (typeof __aeAddSystemMessage === 'function') {
        await __aeAddSystemMessage('❌ Microphone access denied.\n\nError: ' + (e && e.message ? e.message : e), 'Voice');
      }
      if (typeof __aeToast === 'function') __aeToast('❌ Microphone access denied.', 5000);
      return;
    }

    let mimeType = '';
    try {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
      else if (window.MediaRecorder && MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
      else if (window.MediaRecorder && MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';

      let recorder = new MediaRecorder(stream, mimeType ? { mimeType: mimeType } : undefined);
      __aeWidgetState = {
        recorder: recorder, stream: stream, chunks: [],
        startedAt: Date.now(), timerId: null, rafId: null, ctx: null, analyser: null,
        cancelled: false
      };
      recorder.ondataavailable = function(e) { if (e.data && e.data.size > 0) __aeWidgetState.chunks.push(e.data); };
      recorder.onstop = async function() {
        let was = __aeWidgetState;
        __aeStopWidgetVisuals();
        try {
          if (was && was.stream) was.stream.getTracks().forEach(function(t){ t.stop(); });
          if (was && was.cancelled) {
            if (typeof __aeToast === 'function') __aeToast('🎙️ Recording cancelled.', 3000);
            return;
          }
          let blob = new Blob(was.chunks, { type: mimeType || 'audio/webm' });
          if (!blob.size) {
            if (typeof __aeToast === 'function') __aeToast('⚠️ Empty voice recording.', 4000);
            return;
          }
          let file = new File([blob], 'voice-message-' + Date.now() + '.webm', { type: blob.type });
          if (typeof __aeToast === 'function') __aeToast('🎙️ Transcribing…', 5000);
          if (typeof __aeProcessAudioFile === 'function') {
            await __aeProcessAudioFile(file);
          }
        } catch(e) {
          console.error('[ae] Voice processing failed:', e);
          if (typeof __aeAddSystemMessage === 'function') {
            await __aeAddSystemMessage('❌ Voice processing failed: ' + (e && e.message ? e.message : e), 'Voice');
          }
        } finally {
          __aeRemoveWidget();
          __aeWidgetState = null;
        }
      };

      recorder.start();

      __aeWidget = __aeBuildWidgetDom();
      __aeStartTimerAndWaveform();

      __aeWidget.querySelector('.__aeVwStop').addEventListener('click', function() {
        try { if (recorder.state === 'recording') recorder.stop(); } catch(_) {}
      });
      __aeWidget.querySelector('.__aeVwCancel').addEventListener('click', function() {
        if (__aeWidgetState) __aeWidgetState.cancelled = true;
        try { if (recorder.state === 'recording') recorder.stop(); } catch(_) {}
      });

      // Hard cap.
      let maxMs = (typeof __AE_MAX_VOICE_RECORDING_MS === 'number') ? __AE_MAX_VOICE_RECORDING_MS : 60000;
      setTimeout(function() {
        try {
          if (recorder.state === 'recording') {
            recorder.stop();
            if (typeof __aeToast === 'function') __aeToast('🎙️ Auto-stopped at ' + Math.round(maxMs/1000) + 's.', 4500);
          }
        } catch(_) {}
      }, maxMs);

      if (typeof __aeToast === 'function') __aeToast('🎙️ Recording…', 2500);
    } catch(e) {
      console.error('[ae] Failed to start widget recording:', e);
      if (typeof __aeToast === 'function') __aeToast('⚠️ Failed to start recording: ' + e.message, 5000);
      if (stream) {
        stream.getTracks().forEach(function(t) { t.stop(); });
      }
      __aeStopWidgetVisuals();
      __aeRemoveWidget();
      __aeWidgetState = null;
    }
  }

  function __aeStopRecording() {
    if (__aeWidgetState && __aeWidgetState.recorder && __aeWidgetState.recorder.state === 'recording') {
      try { __aeWidgetState.recorder.stop(); } catch(_) {}
    }
  }

  // Override the original toggle from 034_extensions_voice.frag.
  let __aeVoiceWidgetToggleVoiceRecording = async function() {
    if (__aeWidgetState && __aeWidgetState.recorder && __aeWidgetState.recorder.state === 'recording') {
      __aeStopRecording();
      return;
    }
    await __aeStartRecording();
  };
  try { __aeToggleVoiceRecording = __aeVoiceWidgetToggleVoiceRecording; } catch(e) { window.__aeToggleVoiceRecording = __aeVoiceWidgetToggleVoiceRecording; }
  window.__aeToggleVoiceRecording = __aeVoiceWidgetToggleVoiceRecording;

  console.log('[ae] Voice widget loaded: large UI with timer + waveform.');
})();
