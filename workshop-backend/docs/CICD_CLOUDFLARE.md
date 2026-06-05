# Cloudflare Worker CI/CD setup

This repository deploys `workshop-backend` with GitHub Actions via `.github/workflows/workshop-backend-cicd.yml`.

## 1. Create a Cloudflare API token

Cloudflare Dashboard → **My Profile → API Tokens → Create Token → Custom token**.

Recommended permissions:

- Account → Cloudflare Workers Scripts → Edit
- Account → D1 → Edit
- Account → Account Settings → Read
- User → User Details → Read

Limit the token to the target Cloudflare account if possible.

## 2. Add GitHub Environment

GitHub repo → **Settings → Environments → New environment**:

```text
cloudflare-production
```

Optional but recommended: enable required reviewers for production deploys.

## 3. Add GitHub Secrets

Add these secrets either repository-wide or under the `cloudflare-production` environment:

```text
CLOUDFLARE_API_TOKEN       Cloudflare API token
CLOUDFLARE_ACCOUNT_ID      Cloudflare account id
CLOUDFLARE_D1_DATABASE_ID  D1 database UUID, not the database name
DISCORD_CLIENT_SECRET      Discord OAuth client secret
GITHUB_CLIENT_SECRET       GitHub OAuth client secret
TOKEN_ENCRYPTION_KEY       Strong random key for GitHub token encryption at rest
```

Optional secrets if you do not want client IDs in GitHub Variables:

```text
DISCORD_CLIENT_ID
WORKSHOP_GITHUB_CLIENT_ID
BOOTSTRAP_ADMIN_DISCORD_UID
```

Generate `TOKEN_ENCRYPTION_KEY` locally, for example:

```bash
openssl rand -base64 48
```

## 4. Add GitHub Variables

Recommended non-secret variables:

```text
DISCORD_CLIENT_ID              Discord OAuth client id
WORKSHOP_GITHUB_CLIENT_ID      GitHub OAuth client id (GitHub variables cannot start with GITHUB_)
PUBLIC_URL                     https://<your-worker>.<your-subdomain>.workers.dev or custom domain
ALLOWED_ORIGINS                https://perchance.org
BOOTSTRAP_ADMIN_DISCORD_UID    optional Discord user id for first admin
```

`ALLOWED_ORIGINS` may be comma-separated, for example:

```text
https://perchance.org,https://your-custom-domain.example
```

Do **not** use `*` for OAuth production flows.

## 5. Configure OAuth redirect URLs

### Discord

In the Discord Developer Portal, set redirect URI:

```text
<PUBLIC_URL>/v1/auth/discord/callback
```

Example:

```text
https://accm-workshop.accm.workers.dev/v1/auth/discord/callback
```

### GitHub OAuth App

Set Authorization callback URL:

```text
<PUBLIC_URL>/v1/auth/github/callback
```

## 6. First deploy

Push to `main`, or run manually:

GitHub → **Actions → Workshop Backend CI/CD → Run workflow**.

The workflow will:

1. install backend dependencies;
2. run syntax check and smoke tests;
3. render `wrangler.toml` with GitHub variables/secrets;
4. sync Worker secrets if provided;
5. apply `schema.sql` to remote D1;
6. deploy Worker.

## 7. Manual local deploy equivalent

From `workshop-backend`:

```bash
npm install
npx wrangler secret put DISCORD_CLIENT_SECRET
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put TOKEN_ENCRYPTION_KEY
npx wrangler d1 execute workshop-db --remote --file=schema.sql
npx wrangler deploy
```


Daily publish limits are intentionally not required as GitHub variables. The committed `wrangler.toml` defaults are used unless you decide to manage them separately in Cloudflare.

## 8. Notes

- `schema.sql` uses `CREATE ... IF NOT EXISTS`, so re-running it is safe for current migrations.
- The workflow patches placeholder values in `wrangler.toml` at CI runtime. Do not commit real Cloudflare database IDs or OAuth client IDs unless you intentionally want them public.
- Production auth relies on cookies and credentialed CORS. `ALLOWED_ORIGINS` must include the real frontend origin.
