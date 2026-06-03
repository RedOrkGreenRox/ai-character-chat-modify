// --- Web Search ---

function __aeStripHtml(html) {
  var div = document.createElement('div');
  div.innerHTML = html || '';
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}

function __aeDecodeHtmlEntities(text) {
  var textarea = document.createElement('textarea');
  textarea.innerHTML = text || '';
  return textarea.value;
}

function __aeNormalizeDdgUrl(url) {
  if (!url) return '';
  url = __aeDecodeHtmlEntities(url);
  try {
    if (url.startsWith('//')) url = 'https:' + url;
    var u = new URL(url, location.href);
    var uddg = u.searchParams.get('uddg');
    if (uddg) return decodeURIComponent(uddg);
    return u.href;
  } catch(e) {
    return url;
  }
}

function __aeExtractJsonArray(text) {
  text = (text || '').trim();
  var m = text.match(/\[[\s\S]*\]/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch(e) { return null; }
}

function __aeExtractJsonObject(text) {
  text = (text || '').trim();
  var m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch(e) { return null; }
}

function __aeExplicitSearchRequested(text) {
  text = text || '';
  return /(интернет|в\s+сети|поиск|поищи|найди\s+(?:в\s+интернете|в\s+сети)|загугли|посмотри\s+(?:в\s+интернете|в\s+сети)|web\s*search|internet|search\s+the\s+web|google\s+it|look\s+up|find\s+online)/i.test(text);
}

function __aeLikelyBenefitsFromSearch(text) {
  text = text || '';
  return /(актуальн|свеж|новост|сегодня|сейчас|последн|цена|курс|погода|расписан|рецепт|как\s+приготов|инструкция|обзор|сравни|источник|ссылк|latest|current|today|news|price|weather|schedule|recipe|how\s+to|sources?|citation|compare|review)/i.test(text);
}

async function __aeDecideIfShouldSearch(userText) {
  if (__aeExplicitSearchRequested(userText) || __aeLikelyBenefitsFromSearch(userText)) {
    return { search: true, query: userText, reason: 'explicit/practical/current/factual query' };
  }
  if (!userText || userText.trim().length < 12 || !/[?？]|\b(как|что|кто|где|когда|почему|сколько|how|what|who|where|when|why)\b/i.test(userText)) {
    return { search: false, query: userText, reason: 'not a question/request' };
  }

  try {
    var decision = await root.aiTextPlugin({
      instruction: [
        'You are a web-search routing classifier for an AI chat app.',
        'Decide whether the assistant should search the internet BEFORE answering the user.',
        'Return ONLY compact JSON with this schema:',
        '{"search":true/false,"query":"best search query","reason":"short reason"}',
        '',
        'Search=true when:',
        '- the user explicitly asks to search/check/find online;',
        '- the answer may depend on current/recent facts, prices, news, versions, sources, links, schedules, availability;',
        '- the user asks for practical real-world instructions, recipes, troubleshooting, citations, comparison, or factual verification.',
        '',
        'Search=false when the user is just roleplaying, chatting personally, asking for creative writing, or all needed info is already in the conversation.',
        '',
        'USER MESSAGE:',
        userText
      ].join('\n')
    });
    var obj = __aeExtractJsonObject(decision.text || decision.generatedText || '');
    if (obj && typeof obj.search === 'boolean') {
      obj.query = obj.query || userText;
      return obj;
    }
  } catch(e) {
    console.warn('[ae] auto-search classifier failed:', e);
  }
  return { search: false, query: userText, reason: 'classifier fallback' };
}

async function __aeGenerateSearchQueries(userQuery) {
  var queries = [userQuery];
  try {
    var queryGenResult = await root.aiTextPlugin({
      instruction: [
        'Generate 2-3 concise web search queries for the user question.',
        'Reply ONLY with a JSON array of strings, no explanation.',
        'Keep named entities and important terms from the original question.',
        '',
        'Question: ' + userQuery
      ].join('\n')
    });
    var arr = __aeExtractJsonArray(queryGenResult.text || queryGenResult.generatedText || '');
    if (Array.isArray(arr)) {
      queries = queries.concat(arr.filter(function(q) { return typeof q === 'string' && q.trim(); }));
    }
  } catch(e) {
    console.warn('[ae] query generation failed:', e);
  }
  var seen = new Set();
  return queries.map(function(q) { return q.trim(); }).filter(function(q) {
    var k = q.toLowerCase();
    if (!q || seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 4);
}

async function __aeSearchWeb(userQuery, opts) {
  opts = opts || {};
  var queries = await __aeGenerateSearchQueries(userQuery);
  var allResults = [];
  var seen = new Set();

  function pushResult(result) {
    var key = (result.url || '') + '|' + (result.title || '') + '|' + (result.snippet || '').slice(0, 120);
    if (seen.has(key)) return;
    seen.add(key);
    allResults.push(result);
  }

  for (var qi = 0; qi < queries.length; qi++) {
    var q = queries[qi];
    try {
      var ddgUrl = 'https://api.duckduckgo.com/?q=' + encodeURIComponent(q) + '&format=json&no_html=1&skip_disambig=1&t=aiextensions';
      var resp = await root.superFetch(ddgUrl);
      var data = await resp.json();

      if (data.Abstract && data.Abstract.trim()) {
        pushResult({
          title: data.Heading || q,
          url: data.AbstractURL || '',
          source: data.AbstractSource || 'DuckDuckGo',
          snippet: data.Abstract.trim()
        });
      }

      if (data.Results && data.Results.length > 0) {
        for (var ri = 0; ri < data.Results.length; ri++) {
          if (data.Results[ri].Text) {
            pushResult({ title: data.Results[ri].Text.split(' - ')[0] || q, url: data.Results[ri].FirstURL || '', source: 'DuckDuckGo', snippet: data.Results[ri].Text });
          }
        }
      }

      if (data.RelatedTopics && data.RelatedTopics.length > 0) {
        for (var ti = 0; ti < data.RelatedTopics.length && ti < 8; ti++) {
          var topic = data.RelatedTopics[ti];
          if (topic && topic.Text) {
            pushResult({ title: topic.Text.split(' - ')[0] || q, url: topic.FirstURL || '', source: 'DuckDuckGo', snippet: topic.Text });
          }
        }
      }

      try {
        var htmlResp = await root.superFetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q));
        if (htmlResp.ok) {
          var html = await htmlResp.text();
          var blocks = html.split(/<div[^>]+class="[^"]*result[^"]*"[^>]*>/g).slice(1);
          for (var bi = 0; bi < blocks.length && bi < 8; bi++) {
            var block = blocks[bi];
            var a = block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
            var sn = block.match(/class="result__snippet"[^>]*>([\s\S]*?)(?:<\/a>|<\/div>)/i);
            if (a || sn) {
              var title = a ? __aeStripHtml(a[2]) : q;
              var url = a ? __aeNormalizeDdgUrl(a[1]) : '';
              var snippet = sn ? __aeStripHtml(sn[1]) : '';
              if (title || snippet) pushResult({ title: title || q, url: url, source: 'DuckDuckGo HTML', snippet: snippet });
            }
          }
        }
      } catch(htmlErr) {
        console.warn('[ae] DDG html search failed:', htmlErr);
      }
    } catch(e) {
      console.warn('[ae] Search query failed:', q, e);
    }
  }

  if (allResults.length === 0) {
    return { query: userQuery, queries: queries, results: [], answer: '' };
  }

  var resultLines = allResults.slice(0, 12).map(function(r, i) {
    return '[' + (i + 1) + '] ' + (r.title || 'Untitled') + '\nURL: ' + (r.url || '(no URL)') + '\nSnippet: ' + (r.snippet || '').slice(0, 900);
  }).join('\n\n');

  var synthesisResult = await root.aiTextPlugin({
    instruction: [
      'Use the following web search results to answer the user question.',
      'Be direct and useful. Use markdown. Include source links when URLs are available.',
      'Do not mention that you are unable to browse; the search results are already provided below.',
      '',
      'USER QUESTION:',
      userQuery,
      '',
      'SEARCH RESULTS:',
      resultLines
    ].join('\n')
  });

  return {
    query: userQuery,
    queries: queries,
    results: allResults,
    answer: (synthesisResult.text || synthesisResult.generatedText || '').trim()
  };
}

function __aeFormatSources(results) {
  results = (results || []).filter(function(r) { return r.url; }).slice(0, 8);
  if (results.length === 0) return '';
  return results.map(function(r, i) {
    return (i + 1) + '. [' + (r.title || r.url).replace(/[\[\]]/g, '') + '](' + r.url + ')';
  }).join('\n');
}

function __aeBuildSearchContext(searchData) {
  var raw = (searchData.results || []).slice(0, 8).map(function(r, i) {
    return '[' + (i + 1) + '] ' + (r.title || 'Untitled') + '\nURL: ' + (r.url || '(no URL)') + '\n' + (r.snippet || '');
  }).join('\n\n');
  return [
    'INTERNET SEARCH CONTEXT FOR THE NEXT ANSWER',
    'Use this information when answering the user.',
    'Do not claim you cannot access the internet; the relevant search results are provided here.',
    '',
    'User question: ' + searchData.query,
    '',
    'Synthesized search answer:',
    searchData.answer || '(No synthesized answer.)',
    '',
    'Raw search results:',
    raw
  ].join('\n');
}

async function __aeMaybeBuildAutoSearchContext(opts) {
  var settings = __aeLoadSettings();
  if (!settings.webSearch) return null;
  if (!opts || !Array.isArray(opts.messages) || typeof opts.threadId !== 'number' || !Number.isFinite(opts.threadId)) return null;
  var messages = opts.messages.filter(function(m) { return !(m.hiddenFrom && m.hiddenFrom.includes('ai')); });
  var lastUserMessage = null;
  for (var i = messages.length - 1; i >= 0; i--) {
    if (messages[i].characterId === -1 && messages[i].message && !String(messages[i].message).startsWith('/')) {
      lastUserMessage = messages[i];
      break;
    }
  }
  if (!lastUserMessage) return null;
  var userText = String(lastUserMessage.message || '').replace(/<[^>]+>/g, ' ').trim();
  if (!userText) return null;

  var cacheKey = opts.threadId + '|' + userText;
  if (__AE_SEARCH_CACHE.has(cacheKey)) return __AE_SEARCH_CACHE.get(cacheKey);

  var decision = await __aeDecideIfShouldSearch(userText);
  if (!decision || !decision.search) return null;

  var query = decision.query || userText;
  if (opts.onProgressMessage) opts.onProgressMessage({message: '🌐 internet search…'});
  __aeToast('🌐 Searching: ' + query, 6000);

  var searchData = await __aeSearchWeb(query, { auto: true });
  if (!searchData.results || searchData.results.length === 0) {
    __aeToast('🌐 No results found: ' + query, 4000);
    return null;
  }

  try {
    await __aeAddLoreEntry('[Web Search: ' + query + '] ' + (searchData.answer || searchData.results.map(function(r) { return r.snippet; }).join(' ')).slice(0, 2500), 'Auto Search: ' + query);
  } catch(e) {
    console.warn('[ae] Could not save auto-search result to lore:', e);
  }

  var context = __aeBuildSearchContext(searchData);
  __AE_SEARCH_CACHE.set(cacheKey, context);
  return context;
}

async function __aePerformSearch(userQuery) {
  var settings = __aeLoadSettings();
  if (!settings.webSearch) {
    await __aeAddSystemMessage('⚠️ Web search is disabled. Use `/toggle search` to enable.', 'Extensions');
    __aeToast('⚠️ Web search is disabled.', 4000);
    return;
  }

  if (!activeThreadId) {
    await __aeAddSystemMessage('⚠️ Open a chat thread first.', 'Extensions');
    __aeToast('⚠️ Open a chat thread first.', 4000);
    return;
  }

  __aeToast('🔍 Searching: ' + userQuery, 30000);

  try {
    var searchData = await __aeSearchWeb(userQuery, {});
    if (!searchData.results || searchData.results.length === 0) {
      await __aeAddSystemMessage('🔍 No results found for: **' + userQuery + '**', 'Internet');
      __aeToast('🔍 No results found.', 4000);
      return;
    }

    try {
      var loreText = '[Web Search: ' + userQuery + '] ' + ((searchData.answer || '') + ' ' + searchData.results.map(function(r) { return r.snippet; }).join(' ')).substring(0, 2500);
      await __aeAddLoreEntry(loreText, 'Search: ' + userQuery);
    } catch(e) {
      console.warn('[ae] Search worked, but saving it to lore failed:', e);
    }

    var sources = __aeFormatSources(searchData.results);
    var deepNote = searchData.deep ? ('🔎 Deep search used' + (searchData.excerpts ? ' (' + searchData.excerpts.length + ' fetched excerpts)' : '') + '\n\n') : '';
    await __aeAddSystemMessage(
      '🌐 **' + userQuery + '**\n\n' + deepNote +
      (searchData.answer || searchData.results.map(function(r) { return '- ' + r.snippet; }).join('\n')) +
      (sources ? '\n\n**Sources:**\n' + sources : ''),
      'Internet'
    );
    __aeToast('✅ Search complete.', 4000);
  } catch(e) {
    console.error('[ae] Search error:', e);
    await __aeAddSystemMessage('❌ Search failed: ' + e.message, 'Internet');
    __aeToast('❌ Search failed: ' + e.message, 6000);
  }
}

// Register auto-search as a before-reply hook. The core hook bus composes this
// cleanly with future modules like file mentions or base AI policy.
__aeRegisterBeforeBotReplyHook('autoWebSearch', async function(opts) {
  var context = await __aeMaybeBuildAutoSearchContext(opts);
  if (!context) return opts;

  var newMessages = opts.messages.slice();
  var contextMsg = __aeCreateTransientMessageObj({
    threadId: opts.threadId,
    message: context,
    characterId: -2,
    name: 'Internet',
    expectsReply: false
  });
  // Insert before the latest user message so the user question remains the last conversational turn.
  var insertAt = newMessages.length;
  for (var i = newMessages.length - 1; i >= 0; i--) {
    if (newMessages[i].characterId === -1) { insertAt = i; break; }
  }
  newMessages.splice(insertAt, 0, contextMsg);
  return Object.assign({}, opts, { messages: newMessages });
}, {priority:100});

