# Fix report — 2026-06-05

Commit base: `63568d0224b7b476ce14b7333e398e683776fea4`.

## Исправлено в этой рабочей копии

### Security

- Убран Workshop session token из persistent `localStorage`; frontend теперь использует HttpOnly cookie Worker'а, а in-memory bearer оставлен только как legacy fallback.
- Убрана передача session token через query string в GitHub OAuth flow.
- Backend `getUser()` больше не читает `session`/`token` из URL query; только `Authorization: Bearer` или HttpOnly cookie.
- Discord OAuth callback больше не отправляет session token через `postMessage`; вместо этого ставит `Set-Cookie: accm_ws_session=...; HttpOnly; Secure; SameSite=None`.
- `postMessage` targetOrigin больше не использует `*` как default для OAuth payload; default origin — `https://perchance.org`.
- Frontend OAuth listener проверяет `ev.origin` и `ev.source === popup`.
- CORS переведён на credentials-aware headers (`Access-Control-Allow-Credentials: true`) и strict default origin.
- `wrangler.toml` default `ALLOWED_ORIGINS` изменён с `*` на `https://perchance.org`.
- Backend 500 errors больше не возвращают наружу raw exception message.
- Добавлен static safety gate для публикуемого executable Workshop-контента (`generator`, `generator-extension`, `extension-pack`, `.js`): блокируются `eval`, `new Function`, dynamic `import`, cookie/storage access, network APIs, `<script>`.
- Filename для Gist content нормализуется и ограничивается длиной.
- Некриптографические id/stream id переведены с `Math.random()` на `crypto.randomUUID()` с deterministic fallback для тестов.
- Cache-busting fallback в importer заменён с `Math.random()` на `Date.now()`.

### Correctness / counters

- `install_count` больше не увеличивается при повторной установке одним и тем же пользователем.
- `vote_score` обновляется через delta old/new vote, без полного `SUM()` по всем votes на каждый голос.

### DB / performance

Добавлены индексы:

- `idx_items_status_nsfw_kind_score`
- `idx_items_status_nsfw_updated`
- `idx_installs_item`
- `idx_votes_item`
- `idx_reports_unique_open_user_item`

### Reproducibility / best practices

- `pyproject.toml`: Python requirement снижен с `>=3.14` до `>=3.11`.
- `Dockerfile.tools`: base image зафиксирован на `node:20.20.2-bookworm` вместо floating `node:20-bookworm`.
- `workshop-backend/package.json`: `wrangler` зафиксирован на `3.95.0` вместо `^3.95.0`.

## Проверки

Успешно выполнено:

```bash
cd ai-character-chat-modify && python tools/regression.py
cd workshop-backend && node --check src/worker.js && node tests/worker-smoke.mjs
```

Результат:

- `REGRESSION OK`
- `worker smoke tests OK`

## Осталось как архитектурный долг

Не все пункты можно безопасно исправить одним механическим patch без риска сломать приложение:

- CDN/dynamic imports по-прежнему требуют полноценного vendor-lock/checksum-loader или self-hosted bundles.
- Монолитный `workshop-backend/src/worker.js` стоит разбить на модули отдельным refactor PR.
- Массовое удаление `uploads/`, `new_data/`, generated `analysis/*` лучше делать отдельным cleanup commit после подтверждения, что эти файлы не нужны как исторические fixtures/golden snapshots.
- Raw `innerHTML`, пустые `catch`, многочисленные `console.*` требуют отдельного lint/refactor pass, потому что часть HTML строится из уже-sanitized данных, а часть `catch` intentional.
