// --- Voice messages (Telegram-style hold/toggle recording) ---

let __aeVoiceRecorder = null;
let __aeVoiceChunks = [];
let __aeVoiceStream = null;

async function __aeToggleVoiceRecording() {
  if (__aeVoiceRecorder && __aeVoiceRecorder.state === 'recording') {
    __aeVoiceRecorder.stop();
    __aeToast('🎙️ Voice recording stopped. Transcribing...', 6000);
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    await __aeAddSystemMessage('⚠️ Voice recording is not supported in this browser.', 'Voice');
    __aeToast('⚠️ Voice recording is not supported.', 5000);
    return;
  }

  if (!activeThreadId) {
    __aeToast('⚠️ Open a chat thread first.', 4000);
    return;
  }

  let stream = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    __aeVoiceStream = stream;

    let mimeType = '';
    if (window.MediaRecorder && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
    else if (window.MediaRecorder && MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';

    __aeVoiceChunks = [];
    __aeVoiceRecorder = new MediaRecorder(__aeVoiceStream, mimeType ? { mimeType: mimeType } : undefined);
    __aeVoiceRecorder.ondataavailable = function(e) {
      if (e.data && e.data.size > 0) __aeVoiceChunks.push(e.data);
    };
    __aeVoiceRecorder.onstop = async function() {
      let currentStream = __aeVoiceStream;
      __aeVoiceStream = null;
      try {
        if (currentStream) currentStream.getTracks().forEach(function(t) { t.stop(); });
        let blob = new Blob(__aeVoiceChunks, { type: mimeType || 'audio/webm' });
        if (!blob.size) {
          __aeToast('⚠️ Empty voice recording.', 4000);
          return;
        }
        let file = new File([blob], 'voice-message-' + Date.now() + '.webm', { type: blob.type });
        await __aeProcessAudioFile(file);
      } catch(e) {
        console.error('[ae] Voice processing failed:', e);
        await __aeAddSystemMessage('❌ Voice message failed: ' + e.message, 'Voice');
      } finally {
        __aeVoiceRecorder = null;
        __aeVoiceChunks = [];
        __aeVoiceStream = null;
      }
    };
    __aeVoiceRecorder.start();
    setTimeout(function() {
      try {
        if (__aeVoiceRecorder && __aeVoiceRecorder.state === 'recording') {
          __aeVoiceRecorder.stop();
          __aeToast('🎙️ Voice recording auto-stopped at ' + Math.round(__AE_MAX_VOICE_RECORDING_MS/1000) + 's.', 5000);
        }
      } catch(e) {}
    }, __AE_MAX_VOICE_RECORDING_MS);
    __aeToast('🎙️ Recording voice message... click 🎙️ Voice or type /voice again to stop. Max ' + Math.round(__AE_MAX_VOICE_RECORDING_MS/1000) + 's.', 10000);
  } catch(e) {
    console.error('[ae] Failed to start voice recording:', e);
    __aeToast('⚠️ Failed to start recording: ' + e.message, 5000);
    if (stream) {
      stream.getTracks().forEach(function(t) { t.stop(); });
    }
    __aeVoiceRecorder = null;
    __aeVoiceChunks = [];
    __aeVoiceStream = null;
  }
}

