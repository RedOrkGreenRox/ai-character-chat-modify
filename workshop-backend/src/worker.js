// ============================================================
// AI Character Chat Workshop — Cloudflare Worker (backend)
// v0.2 — JavaScript edition (для редактора в Cloudflare Dashboard)
// ============================================================
// Этот файл — чистый ES2022 без TypeScript и без npm-зависимостей.
// Вставляется ЦЕЛИКОМ в Cloudflare Dashboard → Workers → workshop-api → Edit code.
//
// Архитектура:
//   Login         : Discord OAuth
//   Publish       : GitHub OAuth (по запросу) → Gist под аккаунтом юзера
//   Storage       : GitHub Gists (контент НЕ на нашей стороне)
//   Distribution  : gist.githubusercontent.com → user's Gist
//   Metadata      : Cloudflare D1 (SQLite)
//
// Bindings, которые ОБЯЗАТЕЛЬНО надо привязать в Settings:
//   - DB                     (D1 database: workshop-db)
//   - DISCORD_CLIENT_ID      (plain text var)
//   - GITHUB_CLIENT_ID       (plain text var)
//   - PUBLIC_URL             (plain text var, URL Worker'а)
//   - ALLOWED_ORIGINS        (plain text var: '*' или 'https://perchance.org')
//   - BOOTSTRAP_ADMIN_DISCORD_UID  (plain text var, можно пустой)
//   - DAILY_PUBLISH_LIMIT_NEW      (plain text var, опц., default '3')
//   - DAILY_PUBLISH_LIMIT_TRUSTED  (plain text var, опц., default '50')
//   - DISCORD_CLIENT_SECRET  (SECRET)
//   - GITHUB_CLIENT_SECRET   (SECRET)
// ============================================================

// ============================================================
// EDITABLE CONFIG — all non-secret knobs are collected here.
// Secrets and IDs still live in Cloudflare Dashboard → Variables/Secrets.
// ============================================================
const WORKSHOP_CONFIG = {
  // Public URL of this Worker. Cloudflare variable PUBLIC_URL overrides this.
  PUBLIC_URL: 'https://accm-workshop.accm.workers.dev',

  // Legal / UX version. Bump when ToS text changes.
  TOS_VERSION: '1',

  // OAuth/session timing.
  SESSION_DAYS: 30,
  OAUTH_STATE_TTL_MINUTES: 10,

  // Publishing limits.
  NEW_USER_DAILY_PUBLISH_LIMIT: 3,
  TRUSTED_USER_DAILY_PUBLISH_LIMIT: 50,
  TRUSTED_AFTER_LIVE_ITEMS: 3,
  MAX_GIST_CONTENT_BYTES: 5 * 1024 * 1024,

  // Canonical Workshop taxonomy. 'thread' remains accepted as legacy content
  // for old records, but new UI should not present it as a primary kind.
  ITEM_KINDS: ['generator', 'generator-extension', 'lorebook', 'skillbook', 'character', 'extension-pack'],
  LEGACY_ITEM_KINDS: ['thread'],

  // Moderation automation.
  AUTO_HIDE_AFTER_OPEN_REPORTS: 3,

  // GitHub integration.
  GITHUB_GIST_SCOPE: 'gist',
  GITHUB_USER_AGENT: 'ai-character-chat-workshop',
  // false = secret/unlisted Gist: accessible to anyone with link, not shown in public Discover.
  // GitHub does not provide true private Gists via this OAuth flow.
  GITHUB_GIST_PUBLIC: false,

  // CORS fallback if ALLOWED_ORIGINS variable is absent.
  ALLOWED_ORIGINS: '*'
};

const TOS_VERSION = WORKSHOP_CONFIG.TOS_VERSION;
function cfg(env, key) {
  return env && env[key] !== undefined && env[key] !== null && String(env[key]) !== '' ? env[key] : WORKSHOP_CONFIG[key];
}

// ---------------- helpers ----------------
const now      = () => Date.now();
const uuid     = () => crypto.randomUUID();
const sToken   = () => uuid() + '.' + uuid();
const safeJSON = (s, fb) => { try { return JSON.parse(s); } catch { return fb; } };
const slugify  = (s) =>
  String(s || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'item';

function jsonResponse(obj, status, extraHeaders) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  if (extraHeaders) Object.assign(headers, extraHeaders);
  return new Response(JSON.stringify(obj), { status: status || 200, headers });
}
function textResponse(text, status, extraHeaders) {
  const headers = { 'Content-Type': 'text/plain; charset=utf-8' };
  if (extraHeaders) Object.assign(headers, extraHeaders);
  return new Response(text, { status: status || 200, headers });
}
function htmlResponse(html, status) {
  return new Response(html, { status: status || 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
function jsonErr(status, code, message) {
  return jsonResponse({ error: code, message: message || code }, status);
}

// --- base64 ---
function toBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function fromBase64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// --- encryption for github tokens at rest ---
async function getEncKey(env) {
  const seed = new TextEncoder().encode(env.DISCORD_CLIENT_SECRET || 'fallback-seed');
  const raw  = await crypto.subtle.digest('SHA-256', seed);
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
async function encryptToken(env, plain) {
  const key = await getEncKey(env);
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const ct  = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key,
    new TextEncoder().encode(plain)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0); out.set(ct, iv.length);
  return toBase64(out);
}
async function decryptToken(env, blob) {
  const buf = fromBase64(blob);
  const iv  = buf.slice(0, 12);
  const ct  = buf.slice(12);
  const key = await getEncKey(env);
  const pt  = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
  return new TextDecoder().decode(pt);
}

// ---------------- CORS ----------------
function corsHeaders(env, origin) {
  const allowed = String(cfg(env, 'ALLOWED_ORIGINS')).split(',').map(s => s.trim());
  const ok = allowed.includes('*') || allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin':  ok ? (origin || '*') : '',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age':       '86400',
    'Vary':                         'Origin',
  };
}

// ---------------- auth ----------------
async function getUser(env, req) {
  const auth = req.headers.get('Authorization') || '';
  let token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    try {
      const u = new URL(req.url);
      token = u.searchParams.get('session') || u.searchParams.get('token');
    } catch (e) {}
  }
  if (!token) return null;
  const row = await env.DB.prepare(`
    SELECT users.id, users.handle, users.avatar_url, users.role,
           users.tos_accepted_at, users.tos_version,
           users.github_login, users.github_token_enc, users.banned_at,
           sessions.expires_at
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ?
  `).bind(token).first();
  if (!row || row.expires_at < now()) return null;
  if (row.banned_at) return null;
  return row;
}

function tosOk(u) {
  return !!u.tos_accepted_at && u.tos_version === TOS_VERSION;
}

// ---------------- oauth state ----------------
async function makeOauthState(env, provider, intent, userId) {
  const state = sToken();
  const t = now();
  await env.DB.prepare(`
    INSERT INTO oauth_states (state, provider, intent, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(state, provider, intent, userId || null, t, t + WORKSHOP_CONFIG.OAUTH_STATE_TTL_MINUTES * 60 * 1000).run();
  return state;
}
async function consumeOauthState(env, state) {
  const row = await env.DB.prepare(`SELECT * FROM oauth_states WHERE state = ?`).bind(state).first();
  if (!row) return null;
  await env.DB.prepare(`DELETE FROM oauth_states WHERE state = ?`).bind(state).run();
  if (row.expires_at < now()) return null;
  return row;
}

// ---------------- popup pages ----------------
function popupReturn(payload, message) {
  const safe = JSON.stringify(payload).replace(/</g, '\\u003c');
  const msg  = String(message || 'Done.').replace(/[<>&]/g, '');
  const html =
    '<!doctype html><meta charset=utf-8><title>' + msg + '</title>' +
    '<style>html,body{margin:0;height:100%;background:#0f1115;color:#eee;' +
    'font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
    '.b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
    'flex-direction:column;gap:1rem;padding:1rem;text-align:center}.ok{font-size:2rem}</style>' +
    '<div class="b"><div class="ok">✓</div><div>' + msg + '</div>' +
    '<div style="opacity:.6">You can close this window.</div></div>' +
    '<script>(function(){try{if(window.opener){window.opener.postMessage(' + safe + ',"*");}}catch(e){}' +
    'setTimeout(function(){try{window.close();}catch(e){}},400);})();</script>';
  return htmlResponse(html);
}
function popupError(message) {
  const msg = String(message || 'Error').replace(/[<>&]/g, '');
  const html =
    '<!doctype html><meta charset=utf-8><title>Error</title>' +
    '<style>html,body{margin:0;height:100%;background:#0f1115;color:#eee;font:14px/1.4 system-ui}' +
    '.b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1rem;padding:1rem;text-align:center}.er{font-size:2rem;color:#f77}</style>' +
    '<div class="b"><div class="er">✗</div><div>' + msg + '</div>' +
    '<button onclick="window.close()">Close</button></div>';
  return htmlResponse(html, 400);
}

// ---------------- routes ----------------
async function handleRequest(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method.toUpperCase();
  const origin = req.headers.get('Origin') || '';
  const ch = corsHeaders(env, origin);

  // CORS preflight
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });

  let res;
  try {
    res = await router(req, env, ctx, url, path, method);
  } catch (err) {
    console.error(err);
    res = jsonErr(500, 'internal', String((err && err.message) || err));
  }

  // attach CORS headers to the response
  const headers = new Headers(res.headers);
  for (const k of Object.keys(ch)) headers.set(k, ch[k]);
  return new Response(res.body, { status: res.status, headers });
}

async function router(req, env, ctx, url, path, method) {
  // -------- health --------
  if (method === 'GET' && path === '/')   return textResponse('Workshop API alive');
  if (method === 'GET' && path === '/v1') return jsonResponse({ ok: true, version: '0.2.0', tos_version: TOS_VERSION });

  // -------- discord oauth --------
  if (method === 'GET' && path === '/v1/auth/discord/start') {
    const state = await makeOauthState(env, 'discord', 'login');
    const redirect = cfg(env, 'PUBLIC_URL') + '/v1/auth/discord/callback';
    const u = new URL('https://discord.com/oauth2/authorize');
    u.searchParams.set('client_id',     env.DISCORD_CLIENT_ID);
    u.searchParams.set('redirect_uri',  redirect);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('scope',         'identify');
    u.searchParams.set('state',         state);
    u.searchParams.set('prompt',        'consent');
    return Response.redirect(u.toString(), 302);
  }

  if (method === 'GET' && path === '/v1/auth/discord/callback') {
    const code  = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || !state) return popupError('Missing code/state');
    const st = await consumeOauthState(env, state);
    if (!st || st.provider !== 'discord' || st.intent !== 'login') return popupError('Bad or expired state');

    const redirect = cfg(env, 'PUBLIC_URL') + '/v1/auth/discord/callback';
    const tokRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  redirect,
      }),
    });
    if (!tokRes.ok) return popupError('Discord token exchange failed: ' + tokRes.status);
    const tok = await tokRes.json();

    const meRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: 'Bearer ' + tok.access_token },
    });
    if (!meRes.ok) return popupError('Discord profile fetch failed');
    const me = await meRes.json();

    const handle    = me.global_name || me.username;
    const avatarUrl = me.avatar
      ? 'https://cdn.discordapp.com/avatars/' + me.id + '/' + me.avatar + '.png'
      : null;
    const t = now();

    await env.DB.prepare(`
      INSERT INTO users (primary_provider, primary_uid, handle, avatar_url, created_at)
      VALUES ('discord', ?1, ?2, ?3, ?4)
      ON CONFLICT(primary_provider, primary_uid) DO UPDATE SET
        handle = excluded.handle, avatar_url = excluded.avatar_url
    `).bind(me.id, handle, avatarUrl, t).run();

    const userRow = await env.DB.prepare(
      `SELECT id, banned_at FROM users WHERE primary_provider='discord' AND primary_uid=?`
    ).bind(me.id).first();
    if (!userRow) return popupError('User upsert failed');
    if (userRow.banned_at) return popupError('This account is banned.');

    const admUid = String(env.BOOTSTRAP_ADMIN_DISCORD_UID || '').trim();
    if (admUid && admUid === me.id) {
      await env.DB.prepare(`UPDATE users SET role='admin' WHERE id = ?`).bind(userRow.id).run();
    }

    const sessTok = sToken();
    const exp = t + WORKSHOP_CONFIG.SESSION_DAYS * 24 * 3600 * 1000;
    await env.DB.prepare(`
      INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)
    `).bind(sessTok, userRow.id, t, exp).run();

    return popupReturn(
      { type: 'workshop.auth.ok', provider: 'discord', token: sessTok, expires_at: exp },
      'Logged in via Discord.'
    );
  }

  // -------- github oauth (link) --------
  if (method === 'GET' && path === '/v1/auth/github/start') {
    const u = await getUser(env, req);
    if (!u) return popupError('Login via Discord first, then link GitHub.');
    const state = await makeOauthState(env, 'github', 'link', u.id);
    const redirect = cfg(env, 'PUBLIC_URL') + '/v1/auth/github/callback';
    const au = new URL('https://github.com/login/oauth/authorize');
    au.searchParams.set('client_id',    env.GITHUB_CLIENT_ID);
    au.searchParams.set('redirect_uri', redirect);
    au.searchParams.set('scope',        WORKSHOP_CONFIG.GITHUB_GIST_SCOPE);
    au.searchParams.set('state',        state);
    au.searchParams.set('allow_signup', 'true');
    return Response.redirect(au.toString(), 302);
  }

  if (method === 'GET' && path === '/v1/auth/github/callback') {
    const code  = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || !state) return popupError('Missing code/state');
    const st = await consumeOauthState(env, state);
    if (!st || st.provider !== 'github' || st.intent !== 'link' || !st.user_id) return popupError('Bad or expired state');
    const userRow = await env.DB.prepare(`SELECT id, banned_at FROM users WHERE id=?`).bind(st.user_id).first();
    if (!userRow || userRow.banned_at) return popupError('User missing or banned');

    const tokRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        client_id:     env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    if (!tokRes.ok) return popupError('GitHub token exchange failed');
    const tok = await tokRes.json();
    if (!tok.access_token) return popupError('GitHub did not return an access token');

    const ghRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: 'Bearer ' + tok.access_token,
        Accept: 'application/vnd.github+json',
        'User-Agent': WORKSHOP_CONFIG.GITHUB_USER_AGENT,
      },
    });
    if (!ghRes.ok) return popupError('GitHub profile fetch failed');
    const ghMe = await ghRes.json();

    const enc = await encryptToken(env, tok.access_token);
    const t = now();
    await env.DB.prepare(`
      UPDATE users
         SET github_login=?, github_uid=?, github_token_enc=?, github_scope=?, github_linked_at=?
       WHERE id=?
    `).bind(ghMe.login, String(ghMe.id), enc, tok.scope || 'gist', t, st.user_id).run();

    return popupReturn(
      { type: 'workshop.github.linked', github_login: ghMe.login },
      'Linked GitHub: ' + ghMe.login
    );
  }

  if (method === 'POST' && path === '/v1/auth/github/unlink') {
    const u = await getUser(env, req); if (!u) return jsonErr(401, 'unauthorized');
    await env.DB.prepare(`
      UPDATE users SET github_login=NULL, github_uid=NULL, github_token_enc=NULL,
                       github_scope=NULL, github_linked_at=NULL WHERE id=?
    `).bind(u.id).run();
    return jsonResponse({ ok: true });
  }

  if (method === 'POST' && path === '/v1/auth/logout') {
    const auth = req.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (token) await env.DB.prepare(`DELETE FROM sessions WHERE token=?`).bind(token).run();
    return jsonResponse({ ok: true });
  }

  // -------- me --------
  if (method === 'POST' && path === '/v1/me/accept-tos') {
    const u = await getUser(env, req); if (!u) return jsonErr(401, 'unauthorized');
    await env.DB.prepare(`UPDATE users SET tos_accepted_at=?, tos_version=? WHERE id=?`)
      .bind(now(), TOS_VERSION, u.id).run();
    return jsonResponse({ ok: true, tos_version: TOS_VERSION });
  }

  if (method === 'GET' && path === '/v1/me') {
    const u = await getUser(env, req);
    if (!u) return jsonErr(401, 'unauthorized');
    return jsonResponse({
      id:            u.id,
      handle:        u.handle,
      avatar_url:    u.avatar_url,
      role:          u.role,
      tos_required:  !u.tos_accepted_at || u.tos_version !== TOS_VERSION,
      tos_version:   TOS_VERSION,
      github_linked: !!u.github_token_enc,
      github_login:  u.github_login,
    });
  }

  if (method === 'GET' && path === '/v1/me/library') {
    const u = await getUser(env, req); if (!u) return jsonErr(401, 'unauthorized');
    const installed = await env.DB.prepare(`
      SELECT items.id, items.kind, items.name, items.version AS current_version,
             items.status, items.vote_score, items.install_count,
             installs.version AS installed_version, installs.installed_at
      FROM installs
      JOIN items ON items.id = installs.item_id
      WHERE installs.user_id = ?
      ORDER BY installs.installed_at DESC
    `).bind(u.id).all();
    const uploads = await env.DB.prepare(`
      SELECT id, kind, name, version, status, status_reason,
             vote_score, install_count, report_count,
             gist_owner, gist_id, content_url,
             created_at, updated_at, last_checked_at
      FROM items
      WHERE author_id = ?
      ORDER BY updated_at DESC
    `).bind(u.id).all();
    return jsonResponse({ installed: installed.results, uploads: uploads.results });
  }

  // -------- catalog --------
  if (method === 'GET' && path === '/v1/catalog') {
    const kind = url.searchParams.get('kind');
    const tag  = url.searchParams.get('tag');
    const q    = url.searchParams.get('q');
    const nsfw = url.searchParams.get('nsfw') === '1';
    const sort = url.searchParams.get('sort') || 'popular';
    const page = Math.max(1, parseInt(url.searchParams.get('page')  || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '30')));
    const off  = (page - 1) * limit;

    let sql = `
      SELECT items.id, items.kind, items.name, items.summary, items.tags,
             items.version, items.size, items.nsfw, items.vote_score,
             items.install_count, items.preview_url, items.updated_at,
             items.gist_owner,
             users.handle AS author_handle, users.avatar_url AS author_avatar
      FROM items JOIN users ON users.id = items.author_id
      WHERE items.status = 'live'
    `;
    const params = [];
    if (!nsfw) sql += ` AND items.nsfw = 0`;
    if (kind)  { sql += ` AND items.kind = ?`; params.push(kind); }
    if (tag)   { sql += ` AND items.tags LIKE ?`; params.push('%"' + tag + '"%'); }
    if (q)     { sql += ` AND (items.name LIKE ? OR items.summary LIKE ?)`;
                 params.push('%' + q + '%', '%' + q + '%'); }
    if (sort === 'recent')         sql += ` ORDER BY items.updated_at DESC`;
    else if (sort === 'installed') sql += ` ORDER BY items.install_count DESC, items.updated_at DESC`;
    else                            sql += ` ORDER BY items.vote_score DESC, items.install_count DESC`;
    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, off);
    const r = await env.DB.prepare(sql).bind(...params).all();
    return jsonResponse({
      items: (r.results || []).map(row => Object.assign({}, row, { tags: safeJSON(row.tags, []) })),
      page, limit,
    });
  }

  // -------- item meta --------
  let m = path.match(/^\/v1\/items\/([^\/]+)$/);
  if (m && method === 'GET') {
    const id = decodeURIComponent(m[1]);
    const row = await env.DB.prepare(`
      SELECT items.*, users.handle AS author_handle, users.avatar_url AS author_avatar
      FROM items JOIN users ON users.id = items.author_id
      WHERE items.id = ? AND items.status IN ('live','unavailable')
    `).bind(id).first();
    if (!row) return jsonErr(404, 'not_found');
    return jsonResponse(Object.assign({}, row, { tags: safeJSON(row.tags, []) }));
  }

  // -------- publish --------
  if (method === 'POST' && path === '/v1/items') {
    const u = await getUser(env, req); if (!u) return jsonErr(401, 'unauthorized');
    if (!tosOk(u)) return jsonErr(451, 'tos_required',
      'Please accept the current Terms of Service (v' + TOS_VERSION + ') before this action.');
    if (!u.github_token_enc) return jsonErr(412, 'github_not_linked',
      'Publishing requires a linked GitHub account.');

    const oneDayAgo = now() - 24 * 3600 * 1000;
    const cnt = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM items WHERE author_id=? AND created_at>?`
    ).bind(u.id, oneDayAgo).first();
    const trusted = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM items WHERE author_id=? AND status='live'`
    ).bind(u.id).first();
    const limit = (trusted && trusted.n >= WORKSHOP_CONFIG.TRUSTED_AFTER_LIVE_ITEMS)
      ? parseInt(env.DAILY_PUBLISH_LIMIT_TRUSTED || WORKSHOP_CONFIG.TRUSTED_USER_DAILY_PUBLISH_LIMIT)
      : parseInt(env.DAILY_PUBLISH_LIMIT_NEW || WORKSHOP_CONFIG.NEW_USER_DAILY_PUBLISH_LIMIT);
    if ((cnt && cnt.n || 0) >= limit) {
      return jsonErr(429, 'publish_quota_exceeded',
        'Daily publish limit reached (' + limit + '/day).');
    }

    let body;
    try { body = await req.json(); } catch { return jsonErr(400, 'bad_json'); }
    const {
      name, kind, version, summary, tags, language, license,
      nsfw, content, contentFilename, gistDescription,
    } = body || {};

    if (!name || typeof name !== 'string' || name.length > 120) return jsonErr(400, 'bad_name');
    if (WORKSHOP_CONFIG.ITEM_KINDS.concat(WORKSHOP_CONFIG.LEGACY_ITEM_KINDS).indexOf(kind) === -1) return jsonErr(400, 'bad_kind');
    if (!version || !/^\d+\.\d+\.\d+$/.test(String(version))) return jsonErr(400, 'bad_version');
    if (!content || typeof content !== 'string') return jsonErr(400, 'bad_content');

    const contentBytes = new TextEncoder().encode(content).byteLength;
    if (contentBytes > WORKSHOP_CONFIG.MAX_GIST_CONTENT_BYTES) return jsonErr(413, 'too_large', 'Max ' + Math.round(WORKSHOP_CONFIG.MAX_GIST_CONTENT_BYTES / 1024 / 1024) + ' MB');

    const ext = (kind === 'generator' || kind === 'generator-extension') ? 'js' : 'json';
    const filename = (typeof contentFilename === 'string' && contentFilename.length > 0)
      ? contentFilename : (slugify(name) + '.' + ext);

    const ghToken = await decryptToken(env, u.github_token_enc);
    const gistRes = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + ghToken,
        'Accept':        'application/vnd.github+json',
        'Content-Type':  'application/json',
        'User-Agent':    'ai-character-chat-workshop',
      },
      body: JSON.stringify({
        description: gistDescription ||
          (kind + ': ' + name + ' v' + version + ' (AI Character Chat Workshop)'),
        public: WORKSHOP_CONFIG.GITHUB_GIST_PUBLIC,
        files: { [filename]: { content } },
      }),
    });
    if (!gistRes.ok) {
      const t = await gistRes.text().catch(() => '');
      return jsonErr(502, 'gist_create_failed',
        'GitHub Gist creation failed: ' + gistRes.status + ' ' + t.slice(0, 200));
    }
    const gist = await gistRes.json();
    const gistId    = gist.id;
    const gistOwner = (gist.owner && gist.owner.login) || u.github_login || 'unknown';
    const fileMeta  = gist.files && gist.files[filename];
    const contentSha = fileMeta && fileMeta.raw_url ? fileMeta.raw_url.split('/raw/')[1] || null : null;
    const contentUrl = fileMeta && fileMeta.raw_url ? fileMeta.raw_url : ('https://gist.githubusercontent.com/' + gistOwner + '/' + gistId + '/raw/' + filename);

    const id = slugify(name) + '-' + uuid().slice(0, 6);
    const t  = now();
    await env.DB.prepare(`
      INSERT INTO items
        (id, kind, name, author_id, version, summary, tags, language, license, nsfw,
         size, gist_id, gist_file, gist_owner, content_sha, content_url, preview_url,
         status, created_at, updated_at, last_checked_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,'live',?,?,?)
    `).bind(
      id, kind, name.trim(), u.id, version,
      summary  ? String(summary).slice(0, 1000) : null,
      JSON.stringify(Array.isArray(tags) ? tags.slice(0, 12).map(String) : []),
      language ? String(language).slice(0, 12) : null,
      license  ? String(license).slice(0, 80)  : null,
      Math.min(2, Math.max(0, parseInt(nsfw) || 0)),
      contentBytes, gistId, filename, gistOwner, contentSha, contentUrl,
      t, t, t,
    ).run();

    return jsonResponse({
      ok: true, id,
      gist_id:     gistId,
      gist_url:    'https://gist.github.com/' + gistOwner + '/' + gistId,
      content_url: contentUrl,
    });
  }

  // -------- install --------
  m = path.match(/^\/v1\/items\/([^\/]+)\/install$/);
  if (m && method === 'POST') {
    const u = await getUser(env, req); if (!u) return jsonErr(401, 'unauthorized');
    const id = decodeURIComponent(m[1]);
    const item = await env.DB.prepare(`SELECT version FROM items WHERE id=? AND status='live'`).bind(id).first();
    if (!item) return jsonErr(404, 'not_found');
    await env.DB.prepare(`
      INSERT INTO installs (user_id, item_id, version, installed_at) VALUES (?,?,?,?)
      ON CONFLICT(user_id, item_id) DO UPDATE SET version=excluded.version, installed_at=excluded.installed_at
    `).bind(u.id, id, item.version, now()).run();
    await env.DB.prepare(`UPDATE items SET install_count=install_count+1 WHERE id=?`).bind(id).run();
    return jsonResponse({ ok: true });
  }

  // -------- vote --------
  m = path.match(/^\/v1\/items\/([^\/]+)\/vote$/);
  if (m && method === 'POST') {
    const u = await getUser(env, req); if (!u) return jsonErr(401, 'unauthorized');
    if (!tosOk(u)) return jsonErr(451, 'tos_required');
    const id = decodeURIComponent(m[1]);
    let body; try { body = await req.json(); } catch { body = {}; }
    const value = body && (body.value === 1 || body.value === -1) ? body.value : 0;
    const exists = await env.DB.prepare(`SELECT 1 FROM items WHERE id=? AND status='live'`).bind(id).first();
    if (!exists) return jsonErr(404, 'not_found');
    if (value === 0) {
      await env.DB.prepare(`DELETE FROM votes WHERE user_id=? AND item_id=?`).bind(u.id, id).run();
    } else {
      await env.DB.prepare(`
        INSERT INTO votes (user_id, item_id, value, created_at) VALUES (?,?,?,?)
        ON CONFLICT(user_id, item_id) DO UPDATE SET value=excluded.value, created_at=excluded.created_at
      `).bind(u.id, id, value, now()).run();
    }
    const sum = await env.DB.prepare(`SELECT COALESCE(SUM(value),0) AS s FROM votes WHERE item_id=?`).bind(id).first();
    const s = (sum && sum.s) || 0;
    await env.DB.prepare(`UPDATE items SET vote_score=? WHERE id=?`).bind(s, id).run();
    return jsonResponse({ ok: true, vote_score: s });
  }

  // -------- report --------
  m = path.match(/^\/v1\/items\/([^\/]+)\/report$/);
  if (m && method === 'POST') {
    const u = await getUser(env, req); if (!u) return jsonErr(401, 'unauthorized');
    if (!tosOk(u)) return jsonErr(451, 'tos_required');
    const id = decodeURIComponent(m[1]);
    let body; try { body = await req.json(); } catch { body = {}; }
    const reason  = String((body && body.reason)  || '').slice(0, 80) || 'other';
    const details = body && body.details ? String(body.details).slice(0, 2000) : null;
    const exists = await env.DB.prepare(`SELECT 1 FROM items WHERE id=?`).bind(id).first();
    if (!exists) return jsonErr(404, 'not_found');
    await env.DB.prepare(`
      INSERT INTO reports (user_id, item_id, reason, details, created_at) VALUES (?,?,?,?,?)
    `).bind(u.id, id, reason, details, now()).run();
    await env.DB.prepare(`UPDATE items SET report_count=report_count+1 WHERE id=?`).bind(id).run();
    const cnt = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM reports WHERE item_id=? AND status='open'`
    ).bind(id).first();
    if (cnt && cnt.n >= WORKSHOP_CONFIG.AUTO_HIDE_AFTER_OPEN_REPORTS) {
      const autoHideReason = 'auto-hidden after ' + WORKSHOP_CONFIG.AUTO_HIDE_AFTER_OPEN_REPORTS + '+ reports';
      await env.DB.prepare(
        `UPDATE items SET status='hidden', status_reason=? WHERE id=? AND status='live'`
      ).bind(autoHideReason, id).run();
    }
    return jsonResponse({ ok: true });
  }

  // -------- delete item --------
  m = path.match(/^\/v1\/items\/([^\/]+)$/);
  if (m && method === 'DELETE') {
    const u = await getUser(env, req); if (!u) return jsonErr(401, 'unauthorized');
    const id = decodeURIComponent(m[1]);
    const row = await env.DB.prepare(
      `SELECT id, author_id, gist_id FROM items WHERE id=?`
    ).bind(id).first();
    if (!row) return jsonErr(404, 'not_found');
    const isOwner = row.author_id === u.id;
    const isMod   = u.role === 'moderator' || u.role === 'admin';
    if (!isOwner && !isMod) return jsonErr(403, 'forbidden');

    if (isOwner && u.github_token_enc) {
      try {
        const tok = await decryptToken(env, u.github_token_enc);
        await fetch('https://api.github.com/gists/' + row.gist_id, {
          method: 'DELETE',
          headers: {
            'Authorization': 'Bearer ' + tok,
            'Accept':        'application/vnd.github+json',
            'User-Agent':    'ai-character-chat-workshop',
          },
        });
      } catch (e) { /* ignore */ }
    }
    // Delete dependent rows before deleting the item itself: D1 enforces FK constraints.
    await env.DB.prepare(`DELETE FROM votes WHERE item_id=?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM installs WHERE item_id=?`).bind(id).run();
    // reports.item_id has an FK to items.id, so reports must be removed too.
    await env.DB.prepare(`DELETE FROM reports WHERE item_id=?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM items WHERE id=?`).bind(id).run();
    return jsonResponse({ ok: true });
  }

  // -------- moderation --------
  if (method === 'GET' && path === '/v1/moderation/queue') {
    const u = await getUser(env, req); if (!u) return jsonErr(401, 'unauthorized');
    if (u.role !== 'moderator' && u.role !== 'admin') return jsonErr(403, 'forbidden');
    const reports = await env.DB.prepare(`
      SELECT reports.id, reports.item_id, reports.reason, reports.details, reports.created_at,
             items.name AS item_name, items.kind, items.status, items.gist_owner, items.content_url,
             reporters.handle AS reporter_handle
      FROM reports
      JOIN items ON items.id = reports.item_id
      JOIN users AS reporters ON reporters.id = reports.user_id
      WHERE reports.status='open'
      ORDER BY reports.created_at ASC LIMIT 200
    `).all();
    const recent = await env.DB.prepare(`
      SELECT items.id, items.kind, items.name, items.created_at,
             items.gist_owner, items.content_url, items.status, items.report_count,
             users.handle AS author_handle
      FROM items JOIN users ON users.id = items.author_id
      ORDER BY items.created_at DESC LIMIT 50
    `).all();
    return jsonResponse({ reports: reports.results, recent: recent.results });
  }

  m = path.match(/^\/v1\/moderation\/([^\/]+)\/(hide|unhide)$/);
  if (m && method === 'POST') {
    const u = await getUser(env, req); if (!u) return jsonErr(401, 'unauthorized');
    if (u.role !== 'moderator' && u.role !== 'admin') return jsonErr(403, 'forbidden');
    const id = decodeURIComponent(m[1]);
    if (m[2] === 'hide') {
      let body; try { body = await req.json(); } catch { body = {}; }
      const reason = String((body && body.reason) || 'moderator hidden').slice(0, 200);
      await env.DB.prepare(`UPDATE items SET status='hidden', status_reason=? WHERE id=?`).bind(reason, id).run();
      await env.DB.prepare(
        `UPDATE reports SET status='resolved', resolved_at=?, resolved_by=? WHERE item_id=? AND status='open'`
      ).bind(now(), u.id, id).run();
    } else {
      await env.DB.prepare(`UPDATE items SET status='live', status_reason=NULL WHERE id=?`).bind(id).run();
    }
    return jsonResponse({ ok: true });
  }

  m = path.match(/^\/v1\/moderation\/users\/(\d+)\/(ban|unban)$/);
  if (m && method === 'POST') {
    const u = await getUser(env, req); if (!u) return jsonErr(401, 'unauthorized');
    if (u.role !== 'moderator' && u.role !== 'admin') return jsonErr(403, 'forbidden');
    const id = parseInt(m[1]);
    if (m[2] === 'ban') {
      let body; try { body = await req.json(); } catch { body = {}; }
      await env.DB.prepare(`UPDATE users SET banned_at=?, ban_reason=? WHERE id=?`)
        .bind(now(), String((body && body.reason) || 'banned').slice(0, 200), id).run();
      await env.DB.prepare(`UPDATE items SET status='hidden', status_reason='author banned' WHERE author_id=?`)
        .bind(id).run();
      await env.DB.prepare(`DELETE FROM sessions WHERE user_id=?`).bind(id).run();
    } else {
      await env.DB.prepare(`UPDATE users SET banned_at=NULL, ban_reason=NULL WHERE id=?`).bind(id).run();
    }
    return jsonResponse({ ok: true });
  }

  // -------- 404 --------
  return jsonErr(404, 'not_found');
}

export default {
  fetch(req, env, ctx) { return handleRequest(req, env, ctx); },
};
