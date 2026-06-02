
// ============================================
// AI CHARACTER CHAT — BASE POLICY MODULE
// ============================================
// Persistent per-chat hard directives. Currently: fixed language preset.
// No auto-language mode by design.
// ============================================

const __AE_POLICY_LANGUAGES = [
  { code: 'off', label: 'Off / no language policy', name: '' },
  { code: 'en', label: 'English', name: 'English' },
  { code: 'ru', label: 'Русский / Russian', name: 'Russian' },
  { code: 'es', label: 'Español / Spanish', name: 'Spanish' },
  { code: 'pt', label: 'Português / Portuguese', name: 'Portuguese' },
  { code: 'fr', label: 'Français / French', name: 'French' },
  { code: 'de', label: 'Deutsch / German', name: 'German' },
  { code: 'id', label: 'Bahasa Indonesia / Indonesian', name: 'Indonesian' },
  { code: 'pl', label: 'Polski / Polish', name: 'Polish' },
  { code: 'ja', label: '日本語 / Japanese', name: 'Japanese' },
  { code: 'zh', label: '中文 / Chinese', name: 'Chinese' }
];

function __aeGetLanguagePreset(code) {
  return __AE_POLICY_LANGUAGES.find(function(l) { return l.code === code; }) || __AE_POLICY_LANGUAGES[0];
}

async function __aeGetThreadBasePolicy(threadId) {
  if (typeof threadId !== 'number') return { language: 'off' };
  var thread = await db.threads.get(threadId);
  var policy = thread && thread.customData && thread.customData.__aeBasePolicy;
  return Object.assign({ language: 'off' }, policy || {});
}

async function __aeSetThreadBasePolicy(threadId, policy) {
  var thread = await db.threads.get(threadId);
  if (!thread) return null;
  var customData = Object.assign({}, thread.customData || {});
  customData.__aeBasePolicy = Object.assign({ language: 'off' }, customData.__aeBasePolicy || {}, policy || {});
  await db.threads.update(threadId, { customData: customData });
  return customData.__aeBasePolicy;
}

function __aeBuildBasePolicyPrompt(policy) {
  policy = policy || {};
  var lang = __aeGetLanguagePreset(policy.language || 'off');
  if (!lang || lang.code === 'off') return '';
  return [
    'HIGH PRIORITY CHAT-WIDE BASE INSTRUCTION',
    'This is a persistent setting for the entire current chat, not a one-message request.',
    'It overrides character habits, examples, style snippets, uploaded context language, and web-search result language when they conflict with it.',
    '',
    'LANGUAGE PRESET: ' + lang.name + '.',
    'All visible assistant/character output in this chat must be written in ' + lang.name + '.',
    'This includes narration, roleplay actions, stage directions, thoughts, filler phrases, explanations, summaries, and citations prose.',
    'Do not switch to another language unless the user explicitly changes the chat language preset.',
    'Proper nouns, filenames, URLs, code, API names, direct quotes, and untranslatable terms may remain as-is when necessary.',
    'Before finalizing, silently check the response for language drift and rewrite drifting parts into ' + lang.name + '.',
    'Output only the final answer.'
  ].join('\n');
}

__aeRegisterBeforeBotReplyHook('basePolicy', async function(opts) {
  if (!opts || !Array.isArray(opts.messages) || typeof opts.threadId !== 'number') return opts;
  var policy = await __aeGetThreadBasePolicy(opts.threadId);
  var prompt = __aeBuildBasePolicyPrompt(policy);
  if (!prompt) return opts;

  var newMessages = opts.messages.slice();
  var policyMsg = __aeCreateTransientMessageObj({
    threadId: opts.threadId,
    message: prompt,
    characterId: -2,
    name: 'Base Policy',
    expectsReply: false
  });

  // Insert closest to the latest user message. If there is no user message yet,
  // insert at the beginning so the policy is treated as background instruction,
  // not as the latest thing the character should directly answer to.
  var insertAt = 0;
  for (var i = newMessages.length - 1; i >= 0; i--) {
    if (newMessages[i].characterId === -1) { insertAt = i; break; }
  }
  newMessages.splice(insertAt, 0, policyMsg);
  return Object.assign({}, opts, { messages: newMessages });
}, {priority:900});

async function __aeShowBasePolicyModal() {
  if (typeof activeThreadId !== 'number' || !Number.isFinite(activeThreadId)) {
    __aeToast('⚠️ Open a chat thread first.', 4000);
    return;
  }
  var current = await __aeGetThreadBasePolicy(activeThreadId);
  var result = await prompt2({
    info: { type: 'none', html: '<div style="font-size:0.9rem; margin-bottom:0.5rem;">Base Policy is a persistent per-chat directive inserted into the high-priority system context before every reply.</div>' },
    language: {
      label: 'Fixed chat language preset:',
      type: 'select',
      options: __AE_POLICY_LANGUAGES.map(function(l) { return { value: l.code, content: l.label }; }),
      defaultValue: current.language || 'off'
    }
  }, { submitButtonText: 'save policy' });
  if (!result) return;
  var policy = await __aeSetThreadBasePolicy(activeThreadId, { language: result.language });
  var lang = __aeGetLanguagePreset(policy.language);
  await __aeAddSystemMessage('🧭 Base Policy updated. Language: **' + (lang.label || 'Off') + '**', 'Base Policy');
  __aeToast('🧭 Base Policy: ' + (lang.label || 'Off'), 4000);
}

async function __aeShowBasePolicyStatus() {
  var policy = await __aeGetThreadBasePolicy(activeThreadId);
  var lang = __aeGetLanguagePreset(policy.language || 'off');
  await __aeAddSystemMessage('🧭 Current Base Policy\n\nLanguage: **' + (lang.label || 'Off') + '**\n\nCommands: `/policy`, `/language <code>`, `/language off`\nCodes: ' + __AE_POLICY_LANGUAGES.map(function(l) { return '`' + l.code + '`'; }).join(', '), 'Base Policy');
}

var __aeBasePolicyOriginalHandleCommandText = __aeHandleCommandText;
__aeHandleCommandText = async function(text) {
  text = (text || '').trim();
  if (text === '/policy') {
    await __aeShowBasePolicyModal();
    return true;
  }
  if (text === '/policy status') {
    await __aeShowBasePolicyStatus();
    return true;
  }
  if (text.startsWith('/language ')) {
    var code = text.slice('/language '.length).trim().toLowerCase();
    var lang = __aeGetLanguagePreset(code);
    if (!__AE_POLICY_LANGUAGES.some(function(l) { return l.code === code; })) {
      await __aeAddSystemMessage('⚠️ Unknown language preset: **' + code + '**\nAvailable: ' + __AE_POLICY_LANGUAGES.map(function(l) { return '`' + l.code + '` = ' + l.label; }).join(', '), 'Base Policy');
      return true;
    }
    await __aeSetThreadBasePolicy(activeThreadId, { language: code });
    await __aeAddSystemMessage('🧭 Chat language preset set to **' + lang.label + '**.', 'Base Policy');
    __aeToast('🧭 Language preset: ' + lang.label, 4000);
    return true;
  }
  return __aeBasePolicyOriginalHandleCommandText.apply(this, arguments);
};

console.log('[ae] Base Policy module loaded. Commands: /policy, /language <code>');
