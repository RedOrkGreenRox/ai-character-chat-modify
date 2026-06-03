
// ============================================
// AI CHARACTER CHAT — DEEP WEB SEARCH MODULE
// ============================================
// Adds optional deep search: fetch top pages, extract text, pick relevant excerpts.
// ============================================

function __aeSearchTerms(query) {
  return String(query || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(function(w) { return w.length > 2; }).slice(0, 32);
}

function __aeScoreTextForQuery(text, terms) {
  text = String(text || '').toLowerCase();
  var score = 0;
  terms.forEach(function(t) {
    var idx = text.indexOf(t);
    if (idx !== -1) score += 1 + Math.max(0, 1 - idx / 4000);
  });
  return score;
}

function __aeHtmlToReadableText(html) {
  try {
    var doc = new DOMParser().parseFromString(html || '', 'text/html');
    doc.querySelectorAll('script,style,noscript,svg,canvas,iframe,nav,footer,header,form').forEach(function(n) { n.remove(); });
    var text = (doc.body && (doc.body.innerText || doc.body.textContent)) || '';
    return text.replace(/\s+/g, ' ').trim();
  } catch(e) {
    return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

function __aeChunkByChars(text, size, overlap) {
  size = size || 1800;
  overlap = overlap || 200;
  var chunks = [];
  text = String(text || '');
  for (var i = 0; i < text.length; i += size - overlap) {
    var c = text.slice(i, i + size).trim();
    if (c.length > 80) chunks.push(c);
    if (chunks.length > 60) break;
  }
  return chunks;
}

async function __aeDeepSearchWeb(userQuery, opts) {
  opts = opts || {};
  var quick = await __aeOriginalSearchWebForDeep(userQuery, opts);
  if (!quick.results || quick.results.length === 0) return quick;

  var terms = __aeSearchTerms(userQuery);
  var urls = [];
  quick.results.forEach(function(r) {
    if (r.url && /^https?:/i.test(r.url) && urls.indexOf(r.url) === -1) urls.push(r.url);
  });
  urls = urls.slice(0, opts.maxPages || 5);

  var excerpts = [];
  for (var ui = 0; ui < urls.length; ui++) {
    __aeAssertNotCancelled();
    var url = urls[ui];
    try {
      var resp = await root.superFetch(url, { signal: window.AbortSignal?.timeout ? window.AbortSignal.timeout(12000) : undefined });
      if (!resp || !resp.ok) continue;
      var ct = resp.headers && resp.headers.get ? (resp.headers.get('content-type') || '') : '';
      if (ct && !/text\/html|text\/plain|application\/xhtml/i.test(ct)) continue;
      var html = await resp.text();
      var text = __aeHtmlToReadableText(html).slice(0, 50000);
      var chunks = __aeChunkByChars(text, 1800, 200).map(function(chunk) {
        return { url: url, text: chunk, score: __aeScoreTextForQuery(chunk, terms) };
      });
      chunks.sort(function(a, b) { return b.score - a.score; });
      excerpts.push.apply(excerpts, chunks.slice(0, 3));
    } catch(e) {
      console.warn('[ae] Deep fetch failed:', url, e);
    }
  }

  excerpts.sort(function(a, b) { return b.score - a.score; });
  excerpts = excerpts.slice(0, 10);
  if (excerpts.length === 0) return quick;

  var sourceText = excerpts.map(function(e, i) {
    return '[' + (i + 1) + '] URL: ' + e.url + '\nExcerpt: ' + e.text;
  }).join('\n\n');

  var synthesisResult = await root.aiTextPlugin({
    instruction: [
      'Answer the user question using the fetched web page excerpts below.',
      'Prefer the fetched excerpts over search snippets. Be accurate, concise, and include source URLs where useful.',
      '',
      'USER QUESTION:',
      userQuery,
      '',
      'FETCHED WEB EXCERPTS:',
      sourceText
    ].join('\n')
  });

  quick.answer = (synthesisResult.text || synthesisResult.generatedText || quick.answer || '').trim();
  quick.deep = true;
  quick.excerpts = excerpts;
  // Add excerpts as high-quality pseudo-results for source formatting/context.
  quick.results = quick.results.concat(excerpts.map(function(e, i) { return { title: 'Fetched excerpt ' + (i + 1), url: e.url, source: 'deep-fetch', snippet: e.text.slice(0, 800) }; }));
  return quick;
}

var __aeOriginalSearchWebForDeep = __aeSearchWeb;
__aeSearchWeb = async function(userQuery, opts) {
  opts = opts || {};
  var settings = __aeLoadSettings();
  var explicitDeep = /^\s*deep\s+/i.test(userQuery || '');
  if (explicitDeep) userQuery = userQuery.replace(/^\s*deep\s+/i, '').trim();
  if (settings.deepWebSearch || opts.deep || explicitDeep) {
    __aeToast('🔎 Deep web search...', 5000);
    return __aeDeepSearchWeb(userQuery, opts);
  }
  return __aeOriginalSearchWebForDeep.apply(this, arguments);
};

console.log('[ae] Deep Web Search module loaded. Use /search deep <query> or /toggle deepsearch.');
