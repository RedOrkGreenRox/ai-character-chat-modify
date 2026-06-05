// --- Web Search ---

function __aeStripHtml(html) {
  let div = document.createElement('div');
  div.innerHTML = html || '';
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}

function __aeDecodeHtmlEntities(text) {
  let textarea = document.createElement('textarea');
  textarea.innerHTML = text || '';
  return textarea.value;
}

function __aeNormalizeDdgUrl(url) {
  if (!url) return '';
  url = __aeDecodeHtmlEntities(url);
  try {
    if (url.startsWith('//')) url = 'https:' + url;
    let u = new URL(url, location.href);
    let uddg = u.searchParams.get('uddg');
    if (uddg) return decodeURIComponent(uddg);
    return u.href;
  } catch(e) {
    return url;
  }
}

function __aeExtractJsonArray(text) {
  text = (text || '').trim();
  let m = text.match(/\[[\s\S]*\]/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch(e) { return null; }
}

function __aeExtractJsonObject(text) {
  text = (text || '').trim();
  let m = text.match(/\{[\s\S]*\}/);
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
    let decision = await root.aiTextPlugin({
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
    let obj = __aeExtractJsonObject(decision.text || decision.generatedText || '');
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
  let queries = [userQuery];
  try {
    let queryGenResult = await root.aiTextPlugin({
      instruction: [
        'Generate 2-3 concise web search queries for the user question.',
        'Reply ONLY with a JSON array of strings, no explanation.',
        'Keep named entities and important terms from the original question.',
        '',
        'Question: ' + userQuery
      ].join('\n')
    });
    let arr = __aeExtractJsonArray(queryGenResult.text || queryGenResult.generatedText || '');
    if (Array.isArray(arr)) {
      queries = queries.concat(arr.filter(function(q) { return typeof q === 'string' && q.trim(); }));
    }
  } catch(e) {
    console.warn('[ae] query generation failed:', e);
  }
  let seen = new Set();
  return queries.map(function(q) { return q.trim(); }).filter(function(q) {
    let k = q.toLowerCase();
    if (!q || seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 4);
}

async function __aeSearchWeb(userQuery, opts) {
  opts = opts || {};
  let queries = await __aeGenerateSearchQueries(userQuery);
  let allResults = [];
  let seen = new Set();

  function pushResult(result) {
    let key = (result.url || '') + '|' + (result.title || '') + '|' + (result.snippet || '').slice(0, 120);
    if (seen.has(key)) return;
    seen.add(key);
    allResults.push(result);
  }

  async function singleQuery(q) {
    let localResults = [];
    try {
      let ddgUrl = 'https://api.duckduckgo.com/?q=' + encodeURIComponent(q) + '&format=json&no_html=1&skip_disambig=1&t=aiextensions';
      let resp = await root.superFetch(ddgUrl);
      let data = await resp.json();

      if (data.Abstract && data.Abstract.trim()) {
        localResults.push({
          title: data.Heading || q,
          url: data.AbstractURL || '',
          source: data.AbstractSource || 'DuckDuckGo',
          snippet: data.Abstract.trim()
        });
      }

      if (data.Results && data.Results.length > 0) {
        for (let ri = 0; ri < data.Results.length; ri++) {
          if (data.Results[ri].Text) {
            localResults.push({ title: data.Results[ri].Text.split(' - ')[0] || q, url: data.Results[ri].FirstURL || '', source: 'DuckDuckGo', snippet: data.Results[ri].Text });
          }
        }
      }

      if (data.RelatedTopics && data.RelatedTopics.length > 0) {
        for (let ti = 0; ti < data.RelatedTopics.length && ti < 8; ti++) {
          let topic = data.RelatedTopics[ti];
          if (topic && topic.Text) {
            localResults.push({ title: topic.Text.split(' - ')[0] || q, url: topic.FirstURL || '', source: 'DuckDuckGo', snippet: topic.Text });
          }
        }
      }
    } catch(e) {
      console.warn('[ae] DDG json API failed for query:', q, e);
    }

    try {
      let htmlResp = await root.superFetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q));
      if (htmlResp.ok) {
        let html = await htmlResp.text();
        let blocks = html.split(/<div[^>]+class="[^"]*result[^"]*"[^>]*>/g).slice(1);
        for (let bi = 0; bi < blocks.length && bi < 8; bi++) {
          let block = blocks[bi];
          let a = block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
          let sn = block.match(/class="result__snippet"[^>]*>([\s\S]*?)(?:<\/a>|<\/div>)/i);
          if (a || sn) {
            let title = a ? __aeStripHtml(a[2]) : q;
            let url = a ? __aeNormalizeDdgUrl(a[1]) : '';
            let snippet = sn ? __aeStripHtml(sn[1]) : '';
            if (title || snippet) localResults.push({ title: title || q, url: url, source: 'DuckDuckGo HTML', snippet: snippet });
          }
        }
      }
    } catch(htmlErr) {
      console.warn('[ae] DDG html search failed for query:', q, htmlErr);
    }

    return localResults;
  }

  let promises = queries.map(function(q) {
    return singleQuery(q);
  });

  let outcomes = await Promise.allSettled(promises);
  for (let i = 0; i < outcomes.length; i++) {
    let out = outcomes[i];
    if (out.status === 'fulfilled' && Array.isArray(out.value)) {
      for (let j = 0; j < out.value.length; j++) {
        pushResult(out.value[j]);
      }
    }
  }

  if (allResults.length === 0) {
    return { query: userQuery, queries: queries, results: [], answer: '' };
  }

  let resultLines = allResults.slice(0, 12).map(function(r, i) {
    return '[' + (i + 1) + '] ' + (r.title || 'Untitled') + '\nURL: ' + (r.url || '(no URL)') + '\nSnippet: ' + (r.snippet || '').slice(0, 900);
  }).join('\n\n');

  let synthesisResult = await root.aiTextPlugin({
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
  let raw = (searchData.results || []).slice(0, 8).map(function(r, i) {
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
  let settings = __aeLoadSettings();
  if (!settings.webSearch) return null;
  if (!opts || !Array.isArray(opts.messages) || typeof opts.threadId !== 'number' || !Number.isFinite(opts.threadId)) return null;
  let messages = opts.messages.filter(function(m) { return !(m.hiddenFrom && m.hiddenFrom.includes('ai')); });
  let lastUserMessage = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].characterId === -1 && messages[i].message && !String(messages[i].message).startsWith('/')) {
      lastUserMessage = messages[i];
      break;
    }
  }
  if (!lastUserMessage) return null;
  let userText = String(lastUserMessage.message || '').replace(/<[^>]+>/g, ' ').trim();
  if (!userText) return null;

  let cacheKey = opts.threadId + '|' + userText;
  if (__AE_SEARCH_CACHE.has(cacheKey)) return __AE_SEARCH_CACHE.get(cacheKey);

  let decision = await __aeDecideIfShouldSearch(userText);
  if (!decision || !decision.search) return null;

  let query = decision.query || userText;
  if (opts.onProgressMessage) opts.onProgressMessage({message: '🌐 internet search…'});
  __aeToast('🌐 Searching: ' + query, 6000);

  let searchData = await __aeSearchWeb(query, { auto: true });
  if (!searchData.results || searchData.results.length === 0) {
    __aeToast('🌐 No results found: ' + query, 4000);
    return null;
  }

  try {
    await __aeAddLoreEntry('[Web Search: ' + query + '] ' + (searchData.answer || searchData.results.map(function(r) { return r.snippet; }).join(' ')).slice(0, 2500), 'Auto Search: ' + query);
  } catch(e) {
    console.warn('[ae] Could not save auto-search result to lore:', e);
  }

  let context = __aeBuildSearchContext(searchData);
  __AE_SEARCH_CACHE.set(cacheKey, context);
  return context;
}

async function __aePerformSearch(userQuery) {
  let settings = __aeLoadSettings();
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
    let searchData = await __aeSearchWeb(userQuery, {});
    if (!searchData.results || searchData.results.length === 0) {
      await __aeAddSystemMessage('🔍 No results found for: **' + userQuery + '**', 'Internet');
      __aeToast('🔍 No results found.', 4000);
      return;
    }

    try {
      let loreText = '[Web Search: ' + userQuery + '] ' + ((searchData.answer || '') + ' ' + searchData.results.map(function(r) { return r.snippet; }).join(' ')).substring(0, 2500);
      await __aeAddLoreEntry(loreText, 'Search: ' + userQuery);
    } catch(e) {
      console.warn('[ae] Search worked, but saving it to lore failed:', e);
    }

    let sources = __aeFormatSources(searchData.results);
    let deepNote = searchData.deep ? ('🔎 Deep search used' + (searchData.excerpts ? ' (' + searchData.excerpts.length + ' fetched excerpts)' : '') + '\n\n') : '';
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
  let context = await __aeMaybeBuildAutoSearchContext(opts);
  if (!context) return opts;

  let newMessages = opts.messages.slice();
  let contextMsg = __aeCreateTransientMessageObj({
    threadId: opts.threadId,
    message: context,
    characterId: -2,
    name: 'Internet',
    expectsReply: false
  });
  // Insert before the latest user message so the user question remains the last conversational turn.
  let insertAt = newMessages.length;
  for (let i = newMessages.length - 1; i >= 0; i--) {
    if (newMessages[i].characterId === -1) { insertAt = i; break; }
  }
  newMessages.splice(insertAt, 0, contextMsg);
  return Object.assign({}, opts, { messages: newMessages });
}, {priority:100});

