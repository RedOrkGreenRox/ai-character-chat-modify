
// ============================================
// AI CHARACTER CHAT — BASE POLICY MODULE
// ============================================
// Persistent per-chat hard directives.
// Current implementation: allowed-language packs with English enabled by default.
// Languages are represented as extension-packs in __accm.packs when ACCM runtime exists.
// ============================================

const __AE_POLICY_LANGUAGE_PACKS = [
  { id: 'accm.lang.en', code: 'en', label: 'English', name: 'English' },
  { id: 'accm.lang.ru', code: 'ru', label: 'Русский / Russian', name: 'Russian' },
  { id: 'accm.lang.es', code: 'es', label: 'Español / Spanish', name: 'Spanish' },
  { id: 'accm.lang.pt', code: 'pt', label: 'Português / Portuguese', name: 'Portuguese' },
  { id: 'accm.lang.fr', code: 'fr', label: 'Français / French', name: 'French' },
  { id: 'accm.lang.de', code: 'de', label: 'Deutsch / German', name: 'German' },
  { id: 'accm.lang.id', code: 'id', label: 'Bahasa Indonesia / Indonesian', name: 'Indonesian' },
  { id: 'accm.lang.pl', code: 'pl', label: 'Polski / Polish', name: 'Polish' },
  { id: 'accm.lang.ja', code: 'ja', label: '日本語 / Japanese', name: 'Japanese' },
  { id: 'accm.lang.zh', code: 'zh', label: '中文 / Chinese', name: 'Chinese' }
];

// Backward-compatible list for older UI/help code. "off" is a command state,
// not a Workshop kind or language pack.
const __AE_POLICY_LANGUAGES = [
  { code: 'off', label: 'Off / no language policy', name: '' }
].concat(__AE_POLICY_LANGUAGE_PACKS.map(function(p) {
  return { code: p.code, label: p.label, name: p.name, id: p.id };
}));

function __aeRegisterBuiltinLanguagePacks() {
  if (!window.__accm || !window.__accm.packs || __aeRegisterBuiltinLanguagePacks.done) return;
  __aeRegisterBuiltinLanguagePacks.done = true;
  __AE_POLICY_LANGUAGE_PACKS.forEach(function(p) {
    window.__accm.packs.register(Object.assign({}, p, {
      kind: 'extension-pack',
      packType: 'language',
      extensionTarget: 'base-policy',
      contentSchema: 'accm.base-policy.language-pack.v1',
      tags: ['language', 'base-policy', p.code]
    }));
  });
}

function __aeGetAvailableLanguagePacks() {
  __aeRegisterBuiltinLanguagePacks();
  var packs = [];
  if (window.__accm && window.__accm.packs) {
    packs = window.__accm.packs.byTarget('base-policy', 'language');
  }
  if (!packs || packs.length === 0) packs = __AE_POLICY_LANGUAGE_PACKS.slice();
  return packs.slice().sort(function(a, b) { return String(a.label || a.id).localeCompare(String(b.label || b.id)); });
}

function __aeGetLanguagePreset(codeOrId) {
  codeOrId = String(codeOrId || 'off');
  if (codeOrId === 'off') return __AE_POLICY_LANGUAGES[0];
  var packs = __aeGetAvailableLanguagePacks();
  var found = packs.find(function(l) { return l.code === codeOrId || l.id === codeOrId; });
  if (found) return { code: found.code, label: found.label, name: found.name, id: found.id };
  return __AE_POLICY_LANGUAGES[0];
}

function __aeNormalizeBasePolicy(policy) {
  policy = Object.assign({}, policy || {});
  var packs = __aeGetAvailableLanguagePacks();
  var byCode = {}, byId = {};
  packs.forEach(function(p) { byCode[p.code] = p; byId[p.id] = p; });

  var allowed = [];
  if (Array.isArray(policy.allowedLanguagePacks)) {
    allowed = policy.allowedLanguagePacks.map(function(x) {
      var p = byId[x] || byCode[x];
      return p ? p.id : null;
    }).filter(Boolean);
  } else if (policy.language) {
    if (policy.language === 'off') allowed = [];
    else {
      var p = byCode[policy.language] || byId[policy.language];
      allowed = p ? [p.id] : ['accm.lang.en'];
    }
  } else {
    allowed = ['accm.lang.en']; // default requested by user
  }

  // Deduplicate and keep only known packs.
  var seen = new Set();
  allowed = allowed.filter(function(id) {
    if (!byId[id] || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  var primary = policy.primaryLanguagePack || policy.fallbackLanguagePack || policy.fallbackLanguage || 'accm.lang.en';
  var primaryPack = byId[primary] || byCode[primary] || byId['accm.lang.en'] || packs[0];
  primary = primaryPack ? primaryPack.id : '';
  if (allowed.length > 0 && allowed.indexOf(primary) === -1) primary = allowed[0];

  var firstPack = allowed.length ? byId[allowed[0]] : null;
  return Object.assign({}, policy, {
    allowedLanguagePacks: allowed,
    primaryLanguagePack: primary,
    fallbackLanguagePack: primary, // backward-compatible alias; UI no longer exposes a separate fallback setting
    language: firstPack ? firstPack.code : 'off'
  });
}

async function __aeGetThreadBasePolicy(threadId) {
  if (typeof threadId !== 'number') return __aeNormalizeBasePolicy(null);
  var thread = await db.threads.get(threadId);
  var policy = thread && thread.customData && thread.customData.__aeBasePolicy;
  return __aeNormalizeBasePolicy(policy || null);
}

async function __aeSetThreadBasePolicy(threadId, policy) {
  var thread = await db.threads.get(threadId);
  if (!thread) return null;
  var customData = Object.assign({}, thread.customData || {});
  var current = __aeNormalizeBasePolicy(customData.__aeBasePolicy || null);
  customData.__aeBasePolicy = __aeNormalizeBasePolicy(Object.assign({}, current, policy || {}));
  await db.threads.update(threadId, { customData: customData });
  return customData.__aeBasePolicy;
}

function __aeBuildBasePolicyPrompt(policy) {
  policy = __aeNormalizeBasePolicy(policy || null);
  var packs = __aeGetAvailableLanguagePacks();
  var byId = {};
  packs.forEach(function(p) { byId[p.id] = p; });
  var allowed = (policy.allowedLanguagePacks || []).map(function(id) { return byId[id]; }).filter(Boolean);
  if (allowed.length === 0) return '';
  var primary = byId[policy.primaryLanguagePack] || byId[policy.fallbackLanguagePack] || allowed[0];
  var allowedNames = allowed.map(function(p) { return p.name; }).join(', ');

  return [
    'CRITICAL CHAT-WIDE BASE POLICY — LANGUAGE LOCK',
    'This is a persistent high-priority rule for the whole current chat, not a one-message request.',
    'It overrides character habits, role instructions, examples, custom style snippets, uploaded context language, web-search result language, and previous-message language when they conflict with it.',
    '',
    'ALLOWED OUTPUT LANGUAGES: ' + allowedNames + '.',
    'Primary/default language: ' + primary.name + '.',
    '',
    'Every visible word produced by the assistant/character MUST be in an allowed output language.',
    'This applies to ALL visible parts of the answer: dialogue, narration, roleplay actions inside asterisks, stage directions, thoughts, headings, explanations, summaries, citations prose, filler phrases, and out-of-character notes.',
    'Do not only translate spoken dialogue; action descriptions and narration must also obey the language policy.',
    'If exactly one language is allowed, the entire visible answer must be written in that language.',
    'If several languages are allowed and the user writes in one of them, prefer that user language unless context clearly requires another allowed language.',
    'If the user writes in a disallowed language, answer in the primary/default language.',
    'When asked what languages you know/can use, treat the allowed output languages as the complete answer for this chat. List all allowed languages and do not claim additional languages outside this list.',
    'If the user asks for a phrase in each known/available language, provide one phrase for every allowed output language.',
    'Only proper nouns, filenames, URLs, code, API names, exact direct quotes, and genuinely untranslatable terms may remain outside the allowed languages.',
    'Before sending, silently audit the whole answer for language drift, including text inside *asterisks*, and rewrite drifting parts into an allowed language.',
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

  var insertAt = newMessages.length;
  for (var i = newMessages.length - 1; i >= 0; i--) {
    if (newMessages[i].characterId === -1) { insertAt = i + 1; break; }
  }
  // Keep the policy as close as possible to generation. It is a system message,
  // so placing it after the latest user message should not be interpreted as user content,
  // but it reduces drift from character examples/reminders.
  newMessages.splice(insertAt, 0, policyMsg);
  return Object.assign({}, opts, { messages: newMessages });
}, {priority:900});

async function __aeShowBasePolicyModal() {
  if (typeof activeThreadId !== 'number' || !Number.isFinite(activeThreadId)) {
    __aeToast('⚠️ Open a chat thread first.', 4000);
    return;
  }
  var current = await __aeGetThreadBasePolicy(activeThreadId);
  var packs = __aeGetAvailableLanguagePacks();
  var win = createFloatingWindow({
    header: '🧭 Base Policy',
    initialWidth: Math.min(620, window.innerWidth - 40),
    initialHeight: Math.min(640, window.innerHeight - 80),
    body: '<div style="padding:1rem;">Loading...</div>'
  });

  function render() {
    var allowed = new Set(current.allowedLanguagePacks || []);
    var html = '';
    html += '<div style="padding:0.85rem;font-size:0.95rem;">';
    html += '<div style="opacity:.82;margin-bottom:.75rem;">Base Policy is a persistent per-chat directive inserted before every reply. Select allowed languages. Changes are saved automatically; uncheck all languages to turn the policy off. Default is English.</div>';
    html += '<div style="display:grid;grid-template-columns:1fr auto;gap:.45rem .75rem;align-items:center;">';
    packs.forEach(function(p) {
      html += '<label for="__aeLang_' + sanitizeHtml(p.id) + '">' + sanitizeHtml(p.label) + '<div style="font-size:.78rem;opacity:.6;">' + sanitizeHtml(p.id) + '</div></label>';
      html += '<input id="__aeLang_' + sanitizeHtml(p.id) + '" class="__aePolicyLangToggle" data-id="' + sanitizeHtml(p.id) + '" type="checkbox" ' + (allowed.has(p.id) ? 'checked' : '') + ' style="transform:scale(1.35);">';
    });
    html += '</div>';
    html += '<div style="opacity:.65;font-size:.82rem;margin-top:.8rem;">Saved automatically. Uncheck all languages to disable language policy.</div>';
    html += '</div>';
    win.bodyEl.innerHTML = html;

    async function savePolicyAutomatically() {
      var allowedIds = Array.from(win.bodyEl.querySelectorAll('.__aePolicyLangToggle')).filter(function(x) { return x.checked; }).map(function(x) { return x.dataset.id; });
      var primary = allowedIds[0] || 'accm.lang.en';
      var policy = await __aeSetThreadBasePolicy(activeThreadId, { allowedLanguagePacks: allowedIds, primaryLanguagePack: primary, fallbackLanguagePack: primary, language: allowedIds.length ? undefined : 'off' });
      current = policy;
      var names = (policy.allowedLanguagePacks || []).map(function(id) { return packs.find(function(p) { return p.id === id; }); }).filter(Boolean).map(function(p) { return p.label; });
      __aeToast('🧭 Base Policy: ' + (names.join(', ') || 'Off'), 2200);
    }
    win.bodyEl.querySelectorAll('.__aePolicyLangToggle').forEach(function(input) {
      input.addEventListener('change', function() { savePolicyAutomatically().catch(function(e) { console.error(e); __aeToast('Base Policy save failed: ' + e.message, 5000); }); });
    });
  }
  render();
  return win;
}

async function __aeShowBasePolicyStatus() {
  var policy = await __aeGetThreadBasePolicy(activeThreadId);
  var packs = __aeGetAvailableLanguagePacks();
  var names = (policy.allowedLanguagePacks || []).map(function(id) { return packs.find(function(p) { return p.id === id; }); }).filter(Boolean).map(function(p) { return p.label; });
  var primary = packs.find(function(p) { return p.id === (policy.primaryLanguagePack || policy.fallbackLanguagePack); });
  await __aeAddSystemMessage('🧭 Current Base Policy\n\nAllowed languages: **' + (names.join(', ') || 'Off') + '**\nPrimary/default: **' + (primary ? primary.label : 'Off') + '**\n\nCommands: `/policy`, `/language <code>`, `/language off`\nCodes: ' + __AE_POLICY_LANGUAGE_PACKS.map(function(l) { return '`' + l.code + '`'; }).join(', '), 'Base Policy');
}

if (window.__accm && window.__accm.commands) {
  window.__accm.commands.register({
    id: 'base-policy.open',
    aliases: ['/policy'],
    description: 'Open Base Policy editor',
    priority: 130,
    handler: async function() {
      await __aeShowBasePolicyModal();
      return true;
    }
  });

  window.__accm.commands.register({
    id: 'base-policy.status',
    aliases: ['/policy status'],
    description: 'Show current Base Policy',
    priority: 131,
    handler: async function() {
      await __aeShowBasePolicyStatus();
      return true;
    }
  });

  window.__accm.commands.register({
    id: 'base-policy.language',
    aliases: [],
    description: 'Set chat language preset',
    priority: 132,
    match: function(text) { return String(text || '').trim().startsWith('/language '); },
    handler: async function(text) {
      var code = String(text || '').trim().slice('/language '.length).trim().toLowerCase();
      if (code === 'off') {
        await __aeSetThreadBasePolicy(activeThreadId, { allowedLanguagePacks: [], language: 'off' });
        await __aeAddSystemMessage('🧭 Chat language policy disabled.', 'Base Policy');
        __aeToast('🧭 Language policy: Off', 4000);
        return true;
      }
      var lang = __aeGetLanguagePreset(code);
      if (!__AE_POLICY_LANGUAGE_PACKS.some(function(l) { return l.code === code || l.id === code; })) {
        await __aeAddSystemMessage('⚠️ Unknown language preset: **' + code + '**\nAvailable: ' + __AE_POLICY_LANGUAGE_PACKS.map(function(l) { return '`' + l.code + '` = ' + l.label; }).join(', '), 'Base Policy');
        return true;
      }
      await __aeSetThreadBasePolicy(activeThreadId, { allowedLanguagePacks: [lang.id], primaryLanguagePack: lang.id, fallbackLanguagePack: lang.id, language: lang.code });
      await __aeAddSystemMessage('🧭 Chat language preset set to **' + lang.label + '**.', 'Base Policy');
      __aeToast('🧭 Language preset: ' + lang.label, 4000);
      return true;
    }
  });
}

__aeRegisterBuiltinLanguagePacks();
console.log('[ae] Base Policy module loaded. Commands: /policy, /language <code>');
