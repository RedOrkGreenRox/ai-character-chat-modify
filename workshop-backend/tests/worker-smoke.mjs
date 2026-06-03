#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const workerPath = resolve('src/worker.js');
const source = await readFile(workerPath, 'utf8');
const mod = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const worker = mod.default;

function createEnv(opts = {}) {
  const calls = [];
  function makeStatement(sql) {
    return {
      _bindings: [],
      bind(...args) { this._bindings = args; return this; },
      async first() {
        if (/FROM sessions/i.test(sql)) return opts.authUser || null;
        if (/SELECT id, author_id, gist_id FROM items/i.test(sql)) return opts.itemRow || null;
        if (/SELECT version FROM items/i.test(sql)) return opts.itemVersion || null;
        if (/SELECT 1 FROM items/i.test(sql)) return opts.itemExists || null;
        return null;
      },
      async all() {
        return { results: [] };
      },
      async run() {
        calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), bindings: this._bindings });
        return { success: true };
      }
    };
  }
  return {
    calls,
    env: {
      DB: { prepare: makeStatement },
      PUBLIC_URL: 'https://accm-workshop.accm.workers.dev',
      ALLOWED_ORIGINS: '*',
      DISCORD_CLIENT_ID: 'discord-client-id',
      DISCORD_CLIENT_SECRET: 'discord-secret',
      GITHUB_CLIENT_ID: 'github-client-id',
      GITHUB_CLIENT_SECRET: 'github-secret',
      BOOTSTRAP_ADMIN_DISCORD_UID: '',
    }
  };
}

const ctx = { waitUntil() {} };

async function request(env, path, init) {
  return worker.fetch(new Request('https://accm-workshop.accm.workers.dev' + path, init), env, ctx);
}

let t = createEnv();
let res = await request(t.env, '/');
assert.equal(res.status, 200);
assert.equal(await res.text(), 'Workshop API alive');

res = await request(t.env, '/v1');
assert.equal(res.status, 200);
let json = await res.json();
assert.equal(json.ok, true);
assert.equal(json.version, '0.2.0');

res = await request(t.env, '/v1/catalog');
assert.equal(res.status, 200);
json = await res.json();
assert.deepEqual(json.items, []);

res = await request(t.env, '/v1/me');
assert.equal(res.status, 401);

res = await request(t.env, '/v1/auth/discord/start', { redirect: 'manual' });
assert.equal(res.status, 302);
assert.match(res.headers.get('location') || '', /^https:\/\/discord\.com\/oauth2\/authorize/);

// Delete route must remove dependent rows before deleting the item, otherwise D1 FK constraints fail.
t = createEnv({
  authUser: {
    id: 1, handle: 'admin', role: 'admin', avatar_url: null,
    tos_accepted_at: Date.now(), tos_version: '1', github_login: null,
    github_token_enc: null, banned_at: null, expires_at: Date.now() + 100000
  },
  itemRow: { id: 'item-1', author_id: 1, gist_id: 'gist-1' }
});
res = await request(t.env, '/v1/items/item-1', { method: 'DELETE', headers: { Authorization: 'Bearer test-session' } });
assert.equal(res.status, 200);
const orderedSql = t.calls.map(c => c.sql);
const idxVotes = orderedSql.findIndex(s => /DELETE FROM votes/i.test(s));
const idxInstalls = orderedSql.findIndex(s => /DELETE FROM installs/i.test(s));
const idxReports = orderedSql.findIndex(s => /DELETE FROM reports/i.test(s));
const idxItems = orderedSql.findIndex(s => /DELETE FROM items/i.test(s));
assert.ok(idxVotes >= 0 && idxInstalls >= 0 && idxReports >= 0 && idxItems >= 0);
assert.ok(idxVotes < idxItems && idxInstalls < idxItems && idxReports < idxItems, 'dependent rows must be deleted before item');

console.log('worker smoke tests OK');
