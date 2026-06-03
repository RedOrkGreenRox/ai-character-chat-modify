
// ============================================
// AI CHARACTER CHAT — WORKSHOP FRONTEND MODULE
// ============================================
// Minimal in-generator frontend for the Cloudflare Worker Workshop backend.
//
// Provides:
//   /workshop
//   /ws
//   shortcut button: 🏛 Workshop
//
// Backend expected:
//   Cloudflare Worker from workshop-backend/src/worker.js
//   Discord OAuth for login
//   GitHub OAuth for publishing into user's own Gists
// ============================================

(function() {
  if (window.__aeWorkshopInstalled) return;
  window.__aeWorkshopInstalled = true;

  // ============================================================
  // EDITABLE CONFIG — change Workshop frontend defaults here.
  // ============================================================
  const __AE_WORKSHOP_CONFIG = {
    storageKey: '__aeWorkshop',
    defaultApiUrl: 'https://accm-workshop.accm.workers.dev',
    defaultSort: 'popular',
    defaultCatalogLimit: 30,
    defaultIncludeNsfw: false,
    popupName: 'aeWorkshopOAuth',
    popupFeatures: 'width=720,height=760,menubar=no,toolbar=no,location=yes,status=no',
    windowHeader: '🏛 Workshop',
    windowWidth: 760,
    windowHeight: 720,
    commands: ['/workshop', '/ws'],
    shortcutName: '🏛 Workshop'
  };

  const __AE_WORKSHOP_KEY = __AE_WORKSHOP_CONFIG.storageKey;
  const __AE_WORKSHOP_DEFAULTS = {
    token: '',
    lastKind: '',
    includeNsfw: __AE_WORKSHOP_CONFIG.defaultIncludeNsfw,
    sort: __AE_WORKSHOP_CONFIG.defaultSort
  };

  function __aeWsLoad() {
    try {
      var raw = localStorage.getItem(__AE_WORKSHOP_KEY);
      return Object.assign({}, __AE_WORKSHOP_DEFAULTS, raw ? JSON.parse(raw) : {});
    } catch(e) {
      return Object.assign({}, __AE_WORKSHOP_DEFAULTS);
    }
  }

  function __aeWsSave(s) {
    localStorage.setItem(__AE_WORKSHOP_KEY, JSON.stringify(Object.assign({}, __AE_WORKSHOP_DEFAULTS, s || {})));
  }

  function __aeWsApiUrl() {
    return String(__AE_WORKSHOP_CONFIG.defaultApiUrl || '').replace(/\/+$/, '');
  }

  function __aeWsToken() {
    return __aeWsLoad().token || '';
  }

  function __aeWsSetToken(token) {
    var s = __aeWsLoad();
    s.token = token || '';
    __aeWsSave(s);
  }

  function __aeWsEsc(s) {
    return sanitizeHtml(String(s == null ? '' : s));
  }

  async function __aeWsFetch(path, opts) {
    opts = opts || {};
    var api = __aeWsApiUrl();
    if (!api) throw new Error('Workshop API URL is not configured.');
    var headers = Object.assign({}, opts.headers || {});
    if (opts.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.json);
    }
    var token = __aeWsToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    var res = await fetch(api + path, Object.assign({}, opts, { headers: headers }));
    var text = await res.text();
    var data = null;
    try { data = text ? JSON.parse(text) : null; } catch(e) { data = { raw: text }; }
    if (!res.ok) {
      var msg = (data && (data.message || data.error)) || ('HTTP ' + res.status);
      var err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function __aeWsFetchText(url) {
    var res;
    try {
      res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.text();
    } catch(e) {
      // Some raw hosts may fail CORS depending on browser/context. Use Perchance proxy fallback.
      if (root && root.superFetch) {
        res = await root.superFetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.text();
      }
      throw e;
    }
  }

  async function __aeWsReadFileAsTextSmart(file) {
    var buf = await file.arrayBuffer();
    var bytes = new Uint8Array(buf);
    var isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
    if (isGzip) {
      // Perchance exports often have .json extension but are actually gzip-compressed Dexie JSON.
      try {
        if (root && typeof root.decompressBlobWithGzip === 'function') {
          var blob = await root.decompressBlobWithGzip(new Blob([buf]));
          return await blob.text();
        }
      } catch(e) {
        console.warn('[ae workshop] root.decompressBlobWithGzip failed:', e);
      }
      if (typeof DecompressionStream === 'function') {
        var ds = new DecompressionStream('gzip');
        var stream = new Blob([buf]).stream().pipeThrough(ds);
        return await new Response(stream).text();
      }
      throw new Error('This file is gzip-compressed, but this browser cannot decompress it here. Import it directly or use another browser.');
    }
    return new TextDecoder('utf-8').decode(bytes);
  }

  function __aeWsIsProbablyTextFile(file) {
    var name = (file && file.name || '').toLowerCase();
    var type = file && file.type || '';
    if (type.startsWith('text/')) return true;
    if (/\.(json|md|txt|csv|yaml|yml|xml|html|js|css|log)$/i.test(name)) return true;
    // Perchance exports can be gzip-compressed with a .json extension; readFileAsTextSmart handles that.
    return false;
  }

  function __aeWsArrayBufferToBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var chunk = 0x8000;
    var parts = [];
    for (var i = 0; i < bytes.length; i += chunk) {
      parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + chunk)));
    }
    return btoa(parts.join(''));
  }

  async function __aeWsReadPublishFile(file) {
    if (__aeWsIsProbablyTextFile(file)) {
      var text = await __aeWsReadFileAsTextSmart(file);
      return { content: text, contentFilename: file.name, detectedKind: __aeWsDetectPublishKind(text, file.name), isBinaryWrapper: false };
    }
    var base64 = __aeWsArrayBufferToBase64(await file.arrayBuffer());
    var wrapper = {
      schema: 'accm.binary-file.v1',
      filename: file.name,
      mime: file.type || 'application/octet-stream',
      size: file.size || 0,
      base64: base64
    };
    var detected = '';
    if (/\.(png|webp|jpe?g)$/i.test(file.name) || (file.type || '').startsWith('image/')) detected = 'character';
    return { content: JSON.stringify(wrapper, null, 2), contentFilename: file.name.replace(/[^a-z0-9_.-]+/gi, '_') + '.accm-binary.json', detectedKind: detected, isBinaryWrapper: true };
  }

  function __aeWsDetectPublishKind(text, fileName) {
    fileName = fileName || '';
    var lower = fileName.toLowerCase();
    var json = null;
    try { json = JSON.parse(text); } catch(e) {}
    if (json && json.formatName === 'dexie') {
      var tables = ((json.data && json.data.tables) || []).map(function(t) { return t && t.name; });
      if (/character|characters|персонаж/i.test(lower)) return 'character';
      if (tables.indexOf('characters') !== -1) return 'character';
      // Thread exports are legacy content in Workshop taxonomy. They should be represented
      // as tags/subtypes later, not as a primary kind. For now leave manual choice to user.
    }
    if (json && json.entries) return 'lorebook';
    if (/\.js$/i.test(lower)) return 'generator';
    if (/character|персонаж/i.test(lower)) return 'character';
    if (/thread|chat|чат/i.test(lower)) return 'thread';
    if (/lore|world|book|лор/i.test(lower)) return 'lorebook';
    return '';
  }

  function __aeWsIsDexieExportText(text) {
    try {
      var json = JSON.parse(text);
      return !!(json && json.formatName === 'dexie' && json.data && Array.isArray(json.data.tables));
    } catch(e) {
      return false;
    }
  }

  function __aeWsOpenPopup(url, expectedTypes) {
    expectedTypes = expectedTypes || [];
    return new Promise(function(resolve, reject) {
      var done = false;
      function cleanup() {
        window.removeEventListener('message', onMessage);
        done = true;
      }
      function onMessage(ev) {
        var data = ev.data || {};
        if (!data || typeof data !== 'object') return;
        if (expectedTypes.length && expectedTypes.indexOf(data.type) === -1) return;
        cleanup();
        resolve(data);
      }
      window.addEventListener('message', onMessage);
      var popup = window.open(url, __AE_WORKSHOP_CONFIG.popupName, __AE_WORKSHOP_CONFIG.popupFeatures);
      if (!popup) {
        cleanup();
        reject(new Error('Popup was blocked. Allow popups for this page and try again.'));
        return;
      }
      setTimeout(function() {
        if (!done) {
          // Do not reject too early: the user may still be authorizing.
          if (typeof __aeToast === 'function') __aeToast('Waiting for OAuth popup...', 4000);
        }
      }, 8000);
    });
  }

  async function __aeWsLoginDiscord() {
    var api = __aeWsApiUrl();
    if (!api) throw new Error('Set Workshop API URL first.');
    var msg = await __aeWsOpenPopup(api + '/v1/auth/discord/start', ['workshop.auth.ok']);
    if (msg.token) __aeWsSetToken(msg.token);
    __aeToast('Workshop: logged in.', 2500);
    return msg;
  }

  async function __aeWsLinkGithub() {
    var api = __aeWsApiUrl();
    var token = __aeWsToken();
    if (!api) throw new Error('Set Workshop API URL first.');
    if (!token) throw new Error('Login with Discord first.');
    var url = api + '/v1/auth/github/start?session=' + encodeURIComponent(token);
    var msg = await __aeWsOpenPopup(url, ['workshop.github.linked']);
    __aeToast('Workshop: GitHub linked' + (msg.github_login ? ' (' + msg.github_login + ')' : '') + '.', 3500);
    return msg;
  }

  async function __aeWsGetMe() {
    if (!__aeWsToken()) return null;
    try { return await __aeWsFetch('/v1/me'); }
    catch(e) {
      if (e.status === 401) __aeWsSetToken('');
      return null;
    }
  }

  function __aeWsDownloadText(filename, content, type) {
    var blob = new Blob([content], { type: type || 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'workshop-item.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function __aeWsExtractLoreEntries(text) {
    var entries = [];
    var json = null;
    try { json = JSON.parse(text); } catch(e) {}

    function pushEntry(content, triggers, title) {
      content = String(content || '').trim();
      if (!content) return;
      entries.push({ text: content, triggers: triggers || [], title: title || '' });
    }

    if (json) {
      // SillyTavern World Info: { entries: { "0": { key:[], content:"" } } }
      if (json.entries && typeof json.entries === 'object' && !Array.isArray(json.entries)) {
        Object.keys(json.entries).forEach(function(k) {
          var e = json.entries[k] || {};
          if (e.disable === true || e.disabled === true) return;
          pushEntry(e.content || e.text || e.value, [].concat(e.key || [], e.keysecondary || []), e.comment || e.name || k);
        });
      }
      // Array format.
      else if (Array.isArray(json)) {
        json.forEach(function(e, i) {
          if (!e) return;
          if (typeof e === 'string') pushEntry(e, [], 'entry ' + (i + 1));
          else if (!e.disabled && !e.disable) pushEntry(e.content || e.text || e.value || e.body, e.triggers || e.keys || e.key || [], e.title || e.name || e.comment);
        });
      }
      // Generic object with lore/items/data array.
      else if (Array.isArray(json.lore) || Array.isArray(json.items) || Array.isArray(json.data)) {
        (json.lore || json.items || json.data || []).forEach(function(e, i) {
          if (!e) return;
          if (typeof e === 'string') pushEntry(e, [], 'entry ' + (i + 1));
          else if (!e.disabled && !e.disable) pushEntry(e.content || e.text || e.value || e.body, e.triggers || e.keys || e.key || [], e.title || e.name || e.comment);
        });
      }
      else if (json.content || json.text) {
        pushEntry(json.content || json.text, json.triggers || json.keys || json.key || [], json.title || json.name);
      }
    }

    if (entries.length === 0) {
      // Markdown fallback: split by H2 headings if present, otherwise save whole file/chunks.
      if (/^##\s+/m.test(text)) {
        var parts = text.split(/^##\s+/m).filter(Boolean);
        parts.forEach(function(part) {
          var lines = part.split('\n');
          var title = lines.shift().trim();
          pushEntry(lines.join('\n').trim(), [], title);
        });
      } else {
        pushEntry(text, [], 'plain text');
      }
    }
    return entries;
  }

  async function __aeWsInstallLorebook(item, content) {
    if (typeof activeThreadId !== 'number' || !Number.isFinite(activeThreadId)) {
      throw new Error('Open a chat thread before installing a lorebook.');
    }
    var entries = __aeWsExtractLoreEntries(content);
    if (!entries.length) throw new Error('No lore entries found.');
    var added = 0;
    for (var i = 0; i < entries.length; i++) {
      var prefix = entries[i].title ? ('[' + entries[i].title + ']\n') : '';
      var triggerLine = entries[i].triggers && entries[i].triggers.length ? ('Triggers: ' + entries[i].triggers.join(', ') + '\n') : '';
      added += await __aeAddLoreEntry(prefix + triggerLine + entries[i].text, 'Workshop: ' + item.name + ' #' + (i + 1));
    }
    __aeToast('🏛 Installed lorebook: ' + item.name + ' (' + added + ' lore entries)', 5000);
    return added;
  }

  async function __aeWsInstallItem(item) {
    if (!item.content_url) {
      var meta = await __aeWsFetch('/v1/items/' + encodeURIComponent(item.id));
      item = Object.assign({}, item, meta || {});
    }
    if (!item.content_url) throw new Error('Item has no content_url.');

    __aeToast('Workshop: downloading ' + item.name + '...', 5000);
    var content = await __aeWsFetchText(item.content_url);

    var installed = false;
    if (window.__accm && window.__accm.importers) {
      installed = await window.__accm.importers.install({ item: item, content: content, source: 'workshop' });
    }
    if (!installed) {
      __aeWsDownloadText((item.name || item.id || 'workshop-item') + (item.kind === 'generator' ? '.js' : '.json'), content, item.kind === 'generator' ? 'application/javascript' : 'application/json');
      await __aeAddSystemMessage('🏛 Downloaded **' + item.name + '**. This item type is not auto-installed yet.', 'Workshop');
    }

    try { await __aeWsFetch('/v1/items/' + encodeURIComponent(item.id) + '/install', { method: 'POST' }); } catch(e) {}
    __aeToast('Workshop: installed/downloaded ' + item.name + '.', 3500);
  }


  async function __aeWsRender(win, view, state) {
    state = state || {};
    view = view || 'home';
    var me = await __aeWsGetMe();
    var s = __aeWsLoad();
    var api = __aeWsApiUrl();

    var html = '';
    html += '<div style="padding:.7rem;border-bottom:1px solid rgba(127,127,127,.25);display:flex;gap:.45rem;align-items:center;flex-wrap:wrap;">';
    html += '<button class="__wsHome">Home</button><button class="__wsCatalog">Catalog</button><button class="__wsLibrary">My Library</button><button class="__wsPublish">Publish</button>';
    html += '<span style="margin-left:auto;opacity:.75;font-size:.85rem;">' + (me ? ('Logged in as <b>' + __aeWsEsc(me.handle) + '</b>') : 'Not logged in') + '</span>';
    html += '</div>';
    html += '<div class="__wsBody" style="padding:.8rem;"></div>';
    win.bodyEl.innerHTML = html;

    win.bodyEl.querySelector('.__wsHome').onclick = function() { __aeWsRender(win, 'home'); };
    win.bodyEl.querySelector('.__wsCatalog').onclick = function() { __aeWsRender(win, 'catalog'); };
    win.bodyEl.querySelector('.__wsLibrary').onclick = function() { __aeWsRender(win, 'library'); };
    win.bodyEl.querySelector('.__wsPublish').onclick = function() { __aeWsRender(win, 'publish'); };

    var body = win.bodyEl.querySelector('.__wsBody');

    if (view === 'home') {
      body.innerHTML = [
        '<h3>Workshop</h3>',
        '<p style="opacity:.85;">Browse, install and publish lorebooks, characters, threads and custom generators.</p>',
        '<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin:.7rem 0;">',
        me ? '' : '<button class="__wsLogin">Login with Discord</button>',
        me && me.tos_required ? '<div style="flex-basis:100%;border:1px solid rgba(255,200,80,.35);border-radius:8px;padding:.55rem;background:rgba(255,200,80,.08);"><b>Terms:</b> content is user-published to the author\'s own GitHub Gist; illegal/minor sexual/NCII/malware/doxing content is forbidden; author is responsible for what they publish. <button class="__wsAcceptTos">Accept ToS</button></div>' : '',
        me && !me.github_linked ? '<button class="__wsGithub">Link GitHub for publishing</button>' : '',
        me && me.github_linked ? '<span style="opacity:.8;align-self:center;">GitHub linked: <b>' + __aeWsEsc(me.github_login) + '</b></span>' : '',
        '</div>',
        '<div style="display:flex;gap:.5rem;flex-wrap:wrap;"><button class="__wsOpenCatalog">Open catalog</button><button class="__wsOpenPublish">Publish item</button></div>'
      ].join('');
      body.querySelector('.__wsLogin')?.addEventListener('click', async function() { try { await __aeWsLoginDiscord(); __aeWsRender(win, 'home'); } catch(e) { alert(e.message); } });
      body.querySelector('.__wsGithub')?.addEventListener('click', async function() { try { await __aeWsLinkGithub(); __aeWsRender(win, 'home'); } catch(e) { alert(e.message); } });
      body.querySelector('.__wsAcceptTos')?.addEventListener('click', async function() { try { await __aeWsFetch('/v1/me/accept-tos', { method:'POST' }); __aeToast('ToS accepted.', 2500); __aeWsRender(win, 'home'); } catch(e) { alert(e.message); } });
      body.querySelector('.__wsOpenCatalog').onclick = function() { __aeWsRender(win, 'catalog'); };
      body.querySelector('.__wsOpenPublish').onclick = function() { __aeWsRender(win, 'publish'); };
      return;
    }

    if (view === 'catalog') {
      var kind = state.kind != null ? state.kind : s.lastKind;
      var q = state.q || '';
      body.innerHTML = [
        '<h3>Catalog</h3>',
        '<div style="display:flex;gap:.45rem;flex-wrap:wrap;margin-bottom:.7rem;">',
        '<select class="__wsKind"><option value="">All</option><option value="generator">Generators</option><option value="generator-extension">Generator extensions</option><option value="lorebook">Lorebooks</option><option value="skillbook">Skillbooks</option><option value="character">Characters</option><option value="extension-pack">Extension packs</option></select>',
        '<input class="__wsQ" placeholder="Search..." style="flex:1;min-width:140px;" value="' + __aeWsEsc(q) + '">',
        '<label style="display:flex;gap:.25rem;align-items:center;"><input class="__wsNsfw" type="checkbox" ' + (s.includeNsfw ? 'checked' : '') + '>NSFW</label>',
        '<button class="__wsDoSearch">Search</button>',
        '</div>',
        '<div class="__wsItems">Loading...</div>'
      ].join('');
      body.querySelector('.__wsKind').value = kind || '';
      body.querySelector('.__wsDoSearch').onclick = function() {
        var st = __aeWsLoad();
        st.lastKind = body.querySelector('.__wsKind').value;
        st.includeNsfw = body.querySelector('.__wsNsfw').checked;
        __aeWsSave(st);
        __aeWsRender(win, 'catalog', { kind: st.lastKind, q: body.querySelector('.__wsQ').value.trim() });
      };
      var list = body.querySelector('.__wsItems');
      try {
        var params = '?limit=' + encodeURIComponent(__AE_WORKSHOP_CONFIG.defaultCatalogLimit) + '&sort=' + encodeURIComponent(s.sort || 'popular') + (kind ? '&kind=' + encodeURIComponent(kind) : '') + (q ? '&q=' + encodeURIComponent(q) : '') + (s.includeNsfw ? '&nsfw=1' : '');
        var data = await __aeWsFetch('/v1/catalog' + params);
        var items = data.items || [];
        if (!items.length) {
          list.innerHTML = '<p style="opacity:.75;">No items found.</p>';
        } else {
          list.innerHTML = items.map(function(item, i) {
            var tags = Array.isArray(item.tags) ? item.tags : [];
            return '<div class="__wsItem" data-i="' + i + '" style="border:1px solid rgba(127,127,127,.25);border-radius:10px;padding:.65rem;margin-bottom:.55rem;">' +
              '<div style="display:flex;gap:.5rem;align-items:flex-start;"><div style="flex:1;min-width:0;"><b>' + __aeWsEsc(item.name) + '</b> <span style="opacity:.65;">' + __aeWsEsc(item.kind) + ' v' + __aeWsEsc(item.version) + '</span>' +
              '<div style="opacity:.8;margin-top:.25rem;">' + __aeWsEsc(item.summary || '') + '</div>' +
              '<div style="opacity:.65;font-size:.82rem;margin-top:.25rem;">by ' + __aeWsEsc(item.author_handle || item.gist_owner || '?') + ' · score ' + (item.vote_score || 0) + ' · installs ' + (item.install_count || 0) + (tags.length ? ' · ' + tags.map(__aeWsEsc).join(', ') : '') + '</div></div>' +
              '<button class="__wsInstall">Install</button></div></div>';
          }).join('');
          list.querySelectorAll('.__wsItem').forEach(function(row) {
            row.querySelector('.__wsInstall').onclick = async function() {
              var item = items[Number(row.dataset.i)];
              try { await __aeWsInstallItem(item); }
              catch(e) { console.error(e); alert('Install failed: ' + e.message); }
            };
          });
        }
      } catch(e) {
        list.innerHTML = '<p style="color:#f88;">Catalog error: ' + __aeWsEsc(e.message) + '</p>';
      }
      return;
    }

    if (view === 'library') {
      if (!me) {
        body.innerHTML = '<p>Login first.</p><button class="__wsLogin">Login with Discord</button>';
        body.querySelector('.__wsLogin').onclick = async function() { try { await __aeWsLoginDiscord(); __aeWsRender(win, 'library'); } catch(e) { alert(e.message); } };
        return;
      }
      body.innerHTML = '<h3>My Library</h3><div class="__wsLibraryBody">Loading...</div>';
      var lb = body.querySelector('.__wsLibraryBody');
      try {
        var lib = await __aeWsFetch('/v1/me/library');
        var uploads = lib.uploads || [];
        var installed = lib.installed || [];
        var html = '';
        html += '<h4>My uploads</h4>';
        if (!uploads.length) html += '<p style="opacity:.75;">No uploads yet.</p>';
        else html += uploads.map(function(item, i) {
          return '<div class="__wsUpload" data-i="'+i+'" style="border:1px solid rgba(127,127,127,.25);border-radius:10px;padding:.65rem;margin-bottom:.55rem;">' +
            '<div style="display:flex;gap:.5rem;align-items:flex-start;"><div style="flex:1;min-width:0;">' +
            '<b>' + __aeWsEsc(item.name) + '</b> <span style="opacity:.65;">' + __aeWsEsc(item.kind) + ' v' + __aeWsEsc(item.version) + ' · ' + __aeWsEsc(item.status) + '</span>' +
            '<div style="opacity:.65;font-size:.82rem;margin-top:.25rem;">score ' + (item.vote_score || 0) + ' · installs ' + (item.install_count || 0) + (item.content_url ? ' · <a target="_blank" rel="noopener" href="' + __aeWsEsc(item.content_url) + '">raw</a>' : '') + '</div>' +
            '</div><button class="__wsDeleteUpload" style="background:#7a1e1e;color:#fff;border-color:#a94444;">Delete</button></div></div>';
        }).join('');
        html += '<h4 style="margin-top:1rem;">Installed</h4>';
        if (!installed.length) html += '<p style="opacity:.75;">No installed items recorded yet.</p>';
        else html += installed.map(function(item) {
          return '<div style="border:1px solid rgba(127,127,127,.18);border-radius:10px;padding:.55rem;margin-bottom:.45rem;">' +
            '<b>' + __aeWsEsc(item.name) + '</b> <span style="opacity:.65;">' + __aeWsEsc(item.kind || '') + ' · installed v' + __aeWsEsc(item.installed_version || '?') + '</span></div>';
        }).join('');
        lb.innerHTML = html;
        lb.querySelectorAll('.__wsUpload').forEach(function(row) {
          row.querySelector('.__wsDeleteUpload').onclick = async function() {
            var item = uploads[Number(row.dataset.i)];
            if (!confirm('Delete \"' + item.name + '\" from Workshop?\\n\\nIf you are the author and GitHub is linked, the backend will also try to delete the GitHub Gist.')) return;
            try {
              await __aeWsFetch('/v1/items/' + encodeURIComponent(item.id), { method: 'DELETE' });
              __aeToast('Workshop item deleted.', 3000);
              __aeWsRender(win, 'library');
            } catch(e) {
              console.error(e);
              alert('Delete failed: ' + e.message);
            }
          };
        });
      } catch(e) {
        lb.innerHTML = '<p style="color:#f88;">Library error: ' + __aeWsEsc(e.message) + '</p>';
      }
      return;
    }

    if (view === 'publish') {
      if (!me) {
        body.innerHTML = '<p>Login first.</p><button class="__wsLogin">Login with Discord</button>';
        body.querySelector('.__wsLogin').onclick = async function() { try { await __aeWsLoginDiscord(); __aeWsRender(win, 'publish'); } catch(e) { alert(e.message); } };
        return;
      }
      if (me.tos_required) {
        body.innerHTML = '<div style="border:1px solid rgba(255,200,80,.35);border-radius:8px;padding:.75rem;background:rgba(255,200,80,.08);"><h3>Terms required</h3><p>Workshop is a directory. Published content is stored in a public GitHub Gist under your own GitHub account. Do not publish illegal content, sexual content involving minors, non-consensual intimate imagery, malware, doxing, or content you have no right to redistribute. You are responsible for what you publish.</p><button class="__wsAcceptTos">Accept ToS</button></div>';
        body.querySelector('.__wsAcceptTos').onclick = async function() { try { await __aeWsFetch('/v1/me/accept-tos', { method:'POST' }); __aeWsRender(win, 'publish'); } catch(e) { alert(e.message); } };
        return;
      }
      if (!me.github_linked) {
        body.innerHTML = '<p>Publishing stores content in a public GitHub Gist under your own GitHub account. Link GitHub first.</p><button class="__wsGithub">Link GitHub</button>';
        body.querySelector('.__wsGithub').onclick = async function() { try { await __aeWsLinkGithub(); __aeWsRender(win, 'publish'); } catch(e) { alert(e.message); } };
        return;
      }

      body.innerHTML = [
        '<h3>Publish item</h3>',
        '<div style="display:grid;gap:.45rem;">',
        '<label>Name<input class="__wsPubName" style="width:100%;box-sizing:border-box;"></label>',
        '<label>Kind<select class="__wsPubKind" style="width:100%;"><option value="generator">generator</option><option value="generator-extension">generator-extension</option><option value="lorebook">lorebook</option><option value="skillbook">skillbook</option><option value="character">character</option><option value="extension-pack">extension-pack</option></select></label>',
        '<label>Version<input class="__wsPubVersion" value="1.0.0" style="width:100%;box-sizing:border-box;"></label>',
        '<label>Tags, comma-separated<input class="__wsPubTags" placeholder="fantasy, rp" style="width:100%;box-sizing:border-box;"></label>',
        '<label>Summary<textarea class="__wsPubSummary" style="width:100%;min-height:4rem;box-sizing:border-box;"></textarea></label>',
        '<label>Content file<input class="__wsPubFile" type="file"></label>',
        '<label>Or paste content<textarea class="__wsPubContent" style="width:100%;min-height:10rem;box-sizing:border-box;font-family:monospace;"></textarea></label>',
        '<label><input class="__wsPubNsfw" type="checkbox"> Mark as NSFW</label>',
        '<button class="__wsSubmitPub" style="min-height:2.7rem;">Publish</button>',
        '</div>'
      ].join('');
      body.querySelector('.__wsPubFile').addEventListener('change', async function() {
        var file = body.querySelector('.__wsPubFile').files[0];
        if (!file) return;
        try {
          var read = await __aeWsReadPublishFile(file);
          var textarea = body.querySelector('.__wsPubContent');
          textarea.value = read.content;
          textarea.dataset.filename = read.contentFilename || file.name;
          if (!body.querySelector('.__wsPubName').value.trim()) body.querySelector('.__wsPubName').value = file.name.replace(/\.[^.]+$/, '');
          if (read.detectedKind) body.querySelector('.__wsPubKind').value = read.detectedKind;
          __aeToast('Workshop: file loaded' + (read.detectedKind ? ' as ' + read.detectedKind : '') + (read.isBinaryWrapper ? ' (binary wrapper)' : '') + '.', 3000);
        } catch(e) {
          console.error(e);
          alert('Could not read file: ' + e.message);
        }
      });
      body.querySelector('.__wsSubmitPub').onclick = async function() {
        try {
          var payload = {
            name: body.querySelector('.__wsPubName').value.trim(),
            kind: body.querySelector('.__wsPubKind').value,
            version: body.querySelector('.__wsPubVersion').value.trim() || '1.0.0',
            tags: body.querySelector('.__wsPubTags').value.split(',').map(function(x){return x.trim();}).filter(Boolean),
            summary: body.querySelector('.__wsPubSummary').value.trim(),
            nsfw: body.querySelector('.__wsPubNsfw').checked ? 1 : 0,
            contentFilename: body.querySelector('.__wsPubContent').dataset.filename || '',
            content: body.querySelector('.__wsPubContent').value
          };
          if (!payload.name || !payload.content) throw new Error('Name and content are required.');
          var result = await __aeWsFetch('/v1/items', { method:'POST', json: payload });
          __aeToast('Published: ' + result.id, 5000);
          alert('Published!\n\nItem id: ' + result.id + '\nGist: ' + result.gist_url);
          __aeWsRender(win, 'catalog');
        } catch(e) {
          console.error(e);
          alert('Publish failed: ' + e.message);
        }
      };
      return;
    }
  }

  function __aeWsOpen(view) {
    var win = createFloatingWindow({
      header: __AE_WORKSHOP_CONFIG.windowHeader,
      initialWidth: Math.min(__AE_WORKSHOP_CONFIG.windowWidth, window.innerWidth - 30),
      initialHeight: Math.min(__AE_WORKSHOP_CONFIG.windowHeight, window.innerHeight - 40),
      body: '<div style="padding:1rem;">Loading...</div>'
    });
    __aeWsRender(win, view || 'home').catch(function(e) {
      console.error(e);
      win.bodyEl.innerHTML = '<div style="padding:1rem;color:#f88;">' + __aeWsEsc(e.message) + '</div>';
    });
    return win;
  }

  window.__aeShowWorkshop = __aeWsOpen;

  if (window.__accm) {
    window.__accm.workshop = Object.assign(window.__accm.workshop || {}, {
      config: __AE_WORKSHOP_CONFIG,
      open: __aeWsOpen,
      fetch: __aeWsFetch,
      fetchText: __aeWsFetchText,
      downloadText: __aeWsDownloadText,
      installLorebook: __aeWsInstallLorebook,
      extractLoreEntries: __aeWsExtractLoreEntries,
      isDexieExportText: __aeWsIsDexieExportText,
      detectPublishKind: __aeWsDetectPublishKind,
      readFileAsTextSmart: __aeWsReadFileAsTextSmart,
      readPublishFile: __aeWsReadPublishFile
    });
  }

  // Register command/shortcut through the ACCM runtime when available.
  if (window.__accm && window.__accm.commands) {
    window.__accm.commands.register({
      id: 'workshop.open',
      aliases: __AE_WORKSHOP_CONFIG.commands,
      description: 'Open Workshop',
      priority: 100,
      handler: async function() {
        __aeWsOpen('home');
        return true;
      }
    });
  }



  // If mobile menu module exists, expose a Workshop view there too.
  if (window.__accm && window.__accm.ui) {
    window.__accm.ui.registerView('Workshop', async function(ctx) {
      ctx.slot.innerHTML = '<div style="padding:.8rem;"><button class="__wsOpenFull" style="min-height:3rem;width:100%;">Open Workshop window</button><p style="opacity:.75;">The Workshop is a larger window because catalog/publish forms need more space.</p></div>';
      ctx.slot.querySelector('.__wsOpenFull').onclick = function() { __aeWsOpen('home'); };
    });
  } else if (typeof window.__aeRegisterMenuView === 'function') {
    window.__aeRegisterMenuView('Workshop', async function(ctx) {
      ctx.slot.innerHTML = '<div style="padding:.8rem;"><button class="__wsOpenFull" style="min-height:3rem;width:100%;">Open Workshop window</button><p style="opacity:.75;">The Workshop is a larger window because catalog/publish forms need more space.</p></div>';
      ctx.slot.querySelector('.__wsOpenFull').onclick = function() { __aeWsOpen('home'); };
    });
  }

  if (window.__accm && window.__accm.ui && window.__accm.ui.globalButtons) {
    window.__accm.ui.globalButtons.register({
      id: 'workshop',
      label: '🏛 Workshop',
      title: 'Open Workshop',
      priority: 100,
      onClick: function() { __aeWsOpen('home'); }
    });
  }

  console.log('[ae] Workshop frontend module loaded. Commands: /workshop, /ws');
})();
