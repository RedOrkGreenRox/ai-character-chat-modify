# AI Character Chat Workshop — backend

Cloudflare Worker + D1 backend for the future in-generator Workshop UI.

This is the **GitHub-Gist edition**:

- Discord OAuth = primary identity.
- GitHub OAuth = optional publishing permission.
- Published content is stored as **secret/unlisted Gists under the author's own GitHub account**. They are accessible by link, but do not appear in the author's public Gist listing.
- This backend stores only metadata in Cloudflare D1.
- No R2 bucket is required, so Cloudflare does not ask for a card.
- The file intended for Cloudflare Dashboard copy-paste is `src/worker.js`.

## Files

```text
workshop-backend/
├── src/worker.js             # pure JavaScript Worker, no npm dependencies
├── schema.sql                # D1 tables and indexes
├── wrangler.toml             # optional CLI config
├── package.json              # optional CLI helper scripts
├── .dev.vars.example         # local-only secrets example
├── docs/
│   ├── TOS-template.md
│   └── PRIVACY-template.md
└── README.md
```

## Where to edit variables

Backend non-secret defaults are collected at the top of `src/worker.js` in `WORKSHOP_CONFIG`.

Frontend/generator defaults are collected at the top of `ai-character-chat-modify/modify/new/056_extensions_workshop.frag` in `__AE_WORKSHOP_CONFIG`.

Cloudflare secrets and OAuth IDs still belong in Cloudflare Dashboard → Worker → Settings → Variables/Secrets.

## Required accounts

- Cloudflare account.
- Discord Developer application.
- GitHub OAuth App.

All can be free. No card is needed for this Gist-based version.

## 1. Create Discord OAuth app

1. Open <https://discord.com/developers/applications>.
2. Create an application, e.g. `AI Character Chat Workshop`.
3. Open **OAuth2**.
4. Copy **Client ID**.
5. Reset/copy **Client Secret**. Do not share it.
6. Add a temporary redirect:

```text
https://example.com/v1/auth/discord/callback
```

You will replace it after the Worker URL is known.

## 2. Create GitHub OAuth App

1. Open <https://github.com/settings/developers>.
2. **OAuth Apps** → **New OAuth App**.
3. Application name: `AI Character Chat Workshop`.
4. Homepage URL: temporary `https://example.com`.
5. Authorization callback URL: temporary:

```text
https://example.com/v1/auth/github/callback
```

6. Register app.
7. Copy **Client ID**.
8. Generate/copy **Client Secret**. Do not share it.
9. Leave **Enable Device Flow** disabled. It is not used.

## 3. Create Cloudflare D1 database

1. Cloudflare Dashboard → **Workers & Pages** → set up your workers.dev subdomain if asked.
2. **Storage & Databases** → **D1 SQL Database** → create `workshop-db`.
3. Open the D1 **Console**.
4. Execute statements from `schema-console.sql` one by one. It is the copy-paste-friendly version without header comments.

Cloudflare D1 Console may reject multi-statement scripts. If so, run each `CREATE TABLE` / `CREATE INDEX` block separately.

Check:

```sql
SELECT name FROM sqlite_master WHERE type='table';
```

Expected tables:

```text
users
sessions
oauth_states
items
votes
installs
reports
```

`sqlite_sequence` or `_cf_*` service tables are normal.

## 4. Create Worker

1. Cloudflare → **Workers & Pages** → **Create Worker**.
2. Name: `workshop-api`.
3. Deploy the default Worker once.
4. Copy its URL, for example:

```text
https://accm-workshop.accm.workers.dev
```

5. Open **Edit code**.
6. Delete all default code.
7. Paste the entire content of `src/worker.js`.
8. **Save and deploy**.

## 5. Bind D1 and variables

Worker → **Settings** → **Bindings**.

Add D1 binding:

| Type | Variable name | Value |
|---|---|---|
| D1 database | `DB` | `workshop-db` |

Add plain text variables:

| Name | Value |
|---|---|
| `DISCORD_CLIENT_ID` | Discord Client ID |
| `GITHUB_CLIENT_ID` | GitHub Client ID |
| `PUBLIC_URL` | your Worker URL, e.g. `https://accm-workshop.accm.workers.dev` |
| `ALLOWED_ORIGINS` | `*` for testing, later `https://perchance.org` |
| `DAILY_PUBLISH_LIMIT_NEW` | `3` |
| `DAILY_PUBLISH_LIMIT_TRUSTED` | `50` |
| `BOOTSTRAP_ADMIN_DISCORD_UID` | your Discord user id, optional but recommended |

Add encrypted secrets:

| Name | Value |
|---|---|
| `DISCORD_CLIENT_SECRET` | Discord Client Secret |
| `GITHUB_CLIENT_SECRET` | GitHub Client Secret |

Save and deploy.

## 6. Update OAuth redirects

Replace temporary redirects with exact Worker URLs.

Discord:

```text
https://accm-workshop.accm.workers.dev/v1/auth/discord/callback
```

GitHub:

```text
https://accm-workshop.accm.workers.dev/v1/auth/github/callback
```

## 7. Test

Health:

```text
https://accm-workshop.accm.workers.dev/
```

Expected:

```text
Workshop API alive
```

Discord login:

```text
https://accm-workshop.accm.workers.dev/v1/auth/discord/start
```

After login, D1 should contain your user:

```sql
SELECT id, handle, role, github_login FROM users;
```

If `BOOTSTRAP_ADMIN_DISCORD_UID` matched your Discord id, role should be `admin`.

## 8. GitHub linking note

The GitHub link endpoint requires an existing Workshop session. A frontend popup should open:

```text
https://accm-workshop.accm.workers.dev/v1/auth/github/start?session=<WORKSHOP_SESSION_TOKEN>
```

This is intentional: `window.open()` cannot send an `Authorization` header.

## API summary

Important endpoints:

```text
GET  /v1/auth/discord/start
GET  /v1/auth/discord/callback
GET  /v1/auth/github/start?session=<token>
GET  /v1/auth/github/callback
POST /v1/me/accept-tos
GET  /v1/me
GET  /v1/catalog
GET  /v1/items/:id
POST /v1/items
POST /v1/items/:id/install
POST /v1/items/:id/vote
POST /v1/items/:id/report
DELETE /v1/items/:id
GET  /v1/moderation/queue
POST /v1/moderation/:id/hide
POST /v1/moderation/:id/unhide
POST /v1/moderation/users/:id/ban
POST /v1/moderation/users/:id/unban
```

`POST /v1/items` creates a secret/unlisted GitHub Gist under the linked GitHub account and stores only metadata in D1.

## CLI deployment, optional

If you prefer local deployment:

```bash
npm install
# Fill wrangler.toml placeholders.
npm run db:init
npm run secret:discord
npm run secret:github
npm run deploy
```

## Important security notes

- Never publish Discord/GitHub client secrets.
- GitHub OAuth token is encrypted with AES-GCM before storage in D1.
- Authors own their Gists and can delete/edit them on GitHub.
- Workshop is a directory, not a content host. See `docs/TOS-template.md` and `docs/PRIVACY-template.md` before going public.
