# Аудит репозитория `ai-character-chat-modify`

> Это baseline-аудит до внесения исправлений в текущей рабочей копии. Сводка применённых исправлений: `FIX_REPORT_2026-06-05_RU.md`.

Дата проверки: 2026-06-05, ~21:03 MSK  
Репозиторий: `https://github.com/RedOrkGreenRox/ai-character-chat-modify`  
Проверенный commit: `63568d0224b7b476ce14b7333e398e683776fea4` (`2026-06-05T20:17:07+03:00`, message: `a`).

> Важно по требованию «коммит должен быть новый (менее получаса с загрузки)»: на момент клонирования/проверки последний commit был примерно **46 минут назад**, то есть требование **не выполнено** для текущего состояния remote. Нужен новый push/commit, если это жёсткий gate.

## Объём сканирования

Сканирование выполнено по всем файлам рабочей копии, исключая `.git`:

- всего файлов: **1163**;
- текстовых/декодируемых файлов: **1156**;
- бинарных файлов: **7** (`zip`, `wav`, `png`, `docx`, `xlsx`, часть pdf/архивов);
- суммарно строк в декодируемых файлах: **114 316**;
- общий размер рабочей копии без `.git`: **~6.74 MB**.

Основные зоны:

| Зона | Файлов | Строк | Размер |
|---|---:|---:|---:|
| `ai-character-chat-modify/modify` | 23 | 8 987 | 560 KB |
| `workshop-backend` | 11 | 1 476 | 58 KB |
| `ai-character-chat-modify/tools` | 10 | 1 203 | 48 KB |
| `mini-library` | 24 | 551 | 27 KB |
| `uploads` | 4 | 13 125 | 591 KB |
| `new_data` | 3 | 1 890 | 283 KB |

## Выполненные проверки

Команды:

```bash
git clone https://github.com/RedOrkGreenRox/ai-character-chat-modify.git
python ai-character-chat-modify/tools/regression.py
cd workshop-backend && node --check src/worker.js && node tests/worker-smoke.mjs
```

Результаты:

- `regression.py`: **OK**;
- exact component roundtrip: **OK**;
- overlay assembly: **OK**;
- manifest consistency: **OK**;
- JS syntax for fragments/inline scripts: **OK**;
- встроенный security linter проекта: **OK**;
- `node --check src/worker.js`: **OK**;
- `worker-smoke.mjs`: **OK** при запуске из `workshop-backend`.

## Счётчики подозрительных паттернов в кодовых зонах

По `modify`, `workshop-backend/src`, `workshop-backend/tests`, `tools`, `scripts`:

| Паттерн | Кол-во | Комментарий |
|---|---:|---|
| `console.log/warn/error` | 190 | шум в production, возможные утечки диагностики |
| remote script/import/CDN URLs | 42 | supply-chain риск, отсутствие SRI/pinning beyond version |
| `.innerHTML =` | 46 | часть безопасна через `sanitizeHtml`, но нужен единый safe-render слой |
| пустые `catch {}` / `catch(e) {}` | 28 | подавление ошибок, ухудшение observability |
| `localStorage` | 13 | особенно критично для session token Workshop |
| `TODO/FIXME` | 7 | технический долг в modified fragments |
| `Math.random()` | 6 | местами допустимо, но не для id/security |
| token/session в query string | 2 | security issue |
| `postMessage(...)` | 2 | backend + тест/linter; backend зависит от `ALLOWED_ORIGINS` |
| `eval/new Function` | 0 в runtime-коде | только строки в linter/test; прежний eval заблокирован |

---

# Приоритетные находки

## CRITICAL/HIGH — небезопасно

### 1. Workshop session token хранится в `localStorage`

Файл: `ai-character-chat-modify/modify/new/056_extensions_workshop.frag`

- строки 41–46: token входит в `__AE_WORKSHOP_DEFAULTS`;
- строки 48–59: чтение/запись всего state, включая token, в `localStorage`;
- строки 65–72: getter/setter token.

Риск: при XSS в основной странице, вредоносном генераторе, compromised CDN-script или расширении браузера session token легко читается из `localStorage`.

Рекомендация:

- перейти на `HttpOnly; Secure; SameSite=Lax/Strict` cookie для session;
- если cookie невозможен из-за Perchance/Worker архитектуры — хранить access token только in-memory, а refresh/session делать через защищённый popup/channel;
- минимизировать TTL session и добавить revoke/rotation.

### 2. Session token передаётся в query string при GitHub-link flow

Файлы:

- `ai-character-chat-modify/modify/new/056_extensions_workshop.frag:256`
- `workshop-backend/src/worker.js:168-172`

```js
let url = api + '/v1/auth/github/start?session=' + encodeURIComponent(token);
token = u.searchParams.get('session') || u.searchParams.get('token');
```

Риск: token может попасть в browser history, server/access logs, analytics, Referer, screenshots/debug dumps.

Рекомендация:

- не принимать session/token из query string;
- использовать Authorization header для API-запроса, который создаёт one-time OAuth state;
- popup открывать уже с opaque state, не содержащим session token;
- если нужен popup-only flow — передавать session через `postMessage` после проверки `origin`, а не через URL.

### 3. `postMessage` зависит от небезопасного default `ALLOWED_ORIGINS='*'`

Файл: `workshop-backend/src/worker.js`

- строки 64–65: default `ALLOWED_ORIGINS: '*'`;
- строки 217–224: если allowed содержит `*`, `targetOrigin` остаётся `*`;
- строка 234: `window.opener.postMessage(..., targetOrigin)`.

Сейчас код стал лучше, чем явный `postMessage(..., '*')`, но default фактически возвращает поведение `*`.

Риск: если вредоносный сайт откроет OAuth popup и backend разрешает `*`, он может получить payload popup, включая token при Discord login.

Рекомендация:

- запретить `*` для OAuth payloads;
- валидировать `origin`/`redirect_origin` по строгому allowlist;
- на frontend в `__aeWsOpenPopup` проверять `ev.origin === new URL(api).origin`.

### 4. Frontend не проверяет `message` origin

Файл: `ai-character-chat-modify/modify/new/056_extensions_workshop.frag:211-226`

`onMessage` проверяет только `data.type`, но не `ev.origin` и не `ev.source === popup`.

Риск: любой другой window/frame может отправить fake `workshop.auth.ok` / `workshop.github.linked`, подменив auth state.

Рекомендация:

- сохранить ссылку на `popup` и проверять `ev.source === popup`;
- проверять `ev.origin === new URL(__aeWsApiUrl()).origin`;
- использовать одноразовый nonce в state и payload.

### 5. Runtime загрузка сторонних скриптов с CDN без SRI/локального pinning

Файл: `ai-character-chat-modify/modify/new/030_extensions_core.frag:78-180` и `029_module_import_hash_startup.frag:118-123`.

Примеры:

- `pdf.js` из `cdnjs/jsdelivr/unpkg`;
- `mammoth` из `jsdelivr/unpkg`;
- `xlsx` из `jsdelivr/unpkg`;
- `JSZip` из `jsdelivr/unpkg`;
- `@xenova/transformers` через dynamic import;
- `cbor-x` fallback из `unpkg`;
- `user.uploads.dev/file/...js`.

Риск: supply-chain compromise, CDN poisoning, непредсказуемые изменения зависимостей, CSP несовместимость.

Рекомендация:

- vendor-lock: хранить vetted/minified libs в репозитории или фиксировать immutable URL + checksum;
- добавить CSP и subresource integrity там, где возможно;
- для dynamic `import()` реализовать checksum verification через `fetch → hash → Blob URL import`.

### 6. Публикация пользовательского `generator`/`.js` в Workshop без статической модерации контента

Файлы:

- frontend publish: `ai-character-chat-modify/modify/new/056_extensions_workshop.frag:537-580`;
- backend publish: `workshop-backend/src/worker.js:537-623`.

Backend валидирует размер/name/kind/version, но не проверяет содержимое генераторов/extension-pack на dangerous API.

Риск: каталог может распространять вредоносный custom generator, который затем пользователь установит/исполнит в Perchance context.

Рекомендация:

- добавить static scanner на `eval`, `Function`, remote fetch/import, credential exfiltration patterns;
- ввести moderation states: `pending_review` → `live`;
- для generator-kind требовать ручное approval или sandbox capability manifest.

---

## MEDIUM — неэффективность / O-сложность / scalability

### 7. Поиск дублей lore — O(N) + полная загрузка записей

Файл: `ai-character-chat-modify/modify/new/030_extensions_core.frag:214-221`

```js
let existingEntries = await db.lore.where({ bookId: loreBookId }).toArray();
for (...) if (existingEntries[ei].text === text) ...
```

На больших lorebooks это дорого по памяти и CPU.

Рекомендация: хранить `textHash`/`sourceHash` и индексировать `(bookId, textHash)`.

### 8. `renderThreadList` startup: полная сортировка threads в память

Файл: `ai-character-chat-modify/modify/replace/029_module_import_hash_startup.frag:1042`

```js
let mostRecentlyInteractedThread = (await db.threads.orderBy("lastViewTime").reverse().toArray())[0];
```

Лучше: `.last()`/`.first()` на reverse cursor, без `toArray()` всех threads.

### 9. Import renumbering/lookup потенциально O(N²) на больших Dexie exports

Файл: `ai-character-chat-modify/modify/replace/029_module_import_hash_startup.frag:247-285+`.

Код получает max id и далее перенумеровывает связанные таблицы. TODO на строке 275 прямо указывает, что UUID был бы лучше.

Рекомендация: перейти на UUID/ULID для сущностей и maps для cross-reference remap.

### 10. Backend catalog queries не имеют достаточных составных индексов

Файлы:

- `workshop-backend/src/worker.js:486-517`;
- `workshop-backend/schema.sql:78-82`.

Запросы фильтруют `status`, `nsfw`, `kind`, `tags LIKE`, `name/summary LIKE`, сортируют `updated_at`, `install_count`, `vote_score`. Есть индексы `kind,status`, `updated`, `score`, но нет композитов под реальные WHERE+ORDER.

Рекомендация:

- добавить `idx_items_status_nsfw_kind_score(status, nsfw, kind, vote_score DESC, install_count DESC)`;
- `idx_items_status_nsfw_updated(status, nsfw, updated_at DESC)`;
- для search/tag перейти на FTS5/нормализованные tags.

### 11. `install_count` инкрементируется при каждом install POST, даже повторном

Файл: `workshop-backend/src/worker.js:641-645`.

`installs` делает upsert, но `items.install_count=install_count+1` выполняется всегда. Повторная установка одним пользователем завышает счётчик.

Рекомендация: инкрементировать только если не было существующей пары `(user_id,item_id)`, либо периодически пересчитывать `COUNT(*) FROM installs`.

### 12. `vote_score` пересчитывается SUM по всем votes каждого item

Файл: `workshop-backend/src/worker.js:667-669`.

На больших объёмах лучше вычислять delta old/new vote, а не full SUM каждый раз.

---

## MEDIUM/LOW — не best practices / поддерживаемость

### 13. Много production `console.*`

190 совпадений в кодовых зонах. Особенно много в `modify/new/*` и `replace/029*`.

Рекомендация: общий logger с уровнями (`debug/info/warn/error`) и production flag. В UI — user-facing toast, в dev — console.

### 14. Пустые `catch` блоки

28 совпадений. Примеры:

- `031_extensions_processors.frag:226`
- `034_extensions_voice.frag:67`
- `035_extensions_shortcuts_commands_init.frag:19`
- `036_extensions_file_explorer.frag:66-67,157`
- `041_extensions_voice_profile.frag:41`

Рекомендация: минимум `console.debug` под feature flag или structured telemetry; где ожидаемо — комментарий `// intentionally ignored: ...`.

### 15. `innerHTML` используется как основной rendering API

46 совпадений. Многие строки экранируют через `sanitizeHtml` / `__aeWsEsc`, но это не везде очевидно.

Рекомендация:

- ввести `html` tagged-template с auto-escape или DOM builder;
- запретить raw `innerHTML` lint-правилом, разрешать только `safeSetHtml(el, trustedHtml)`.

### 16. Backend — монолитный `worker.js` ~800 строк

Файл: `workshop-backend/src/worker.js`.

Проблемы: смешаны config, crypto, auth, OAuth, catalog, publish, moderation. Тестировать/ревьюить сложно.

Рекомендация: разбить на модули `auth.js`, `oauth.js`, `catalog.js`, `publish.js`, `moderation.js`, `responses.js`; добавить table-driven router.

### 17. Ошибки backend возвращают internal message наружу

Файл: `workshop-backend/src/worker.js:260-266`.

```js
console.error(err);
res = jsonErr(500, 'internal', String((err && err.message) || err));
```

Риск: наружу уходят детали исключения. Это не всегда secret, но best practice — generic 500 клиенту и подробности только server logs.

### 18. `wrangler.toml` default `ALLOWED_ORIGINS='*'`

Файл: `workshop-backend/wrangler.toml:14`.

Для OAuth/auth API default должен быть строгим: `https://perchance.org` или конкретный origin.

### 19. `pyproject.toml` требует Python `>=3.14`

Файл: `pyproject.toml:5`.

На 2026-06-05 это резко снижает воспроизводимость. Скрипты используют обычный Python 3.10/3.11-compatible код.

Рекомендация: `>=3.11` или `>=3.12`.

### 20. Dockerfile не pin-ит base image digest

Файл: `Dockerfile.tools:1`.

`node:20-bookworm` mutable. Для воспроизводимого CI лучше digest pin.

### 21. `package.json` использует semver range для wrangler

Файл: `workshop-backend/package.json`.

```json
"wrangler": "^3.95.0"
```

Для deploy tooling лучше exact version в lockfile/npm lock.

---

## Мусорный код / артефакты / кандидаты на удаление

### 22. Закоммичены старые отчёты и архив workspace

- `new_data/FULL_CODE_AUDIT_RU.md`
- `new_data/INDEPENDENT_AUDIT_REPORT_RU.md`
- `new_data/workspace-019e8fa4-6a95-77b2-a14e-5a53801fccd9.zip`

Если это не источник требований, лучше удалить из repo или перенести в release artifacts/wiki.

### 23. `uploads/*` выглядит как рабочие/исторические dumps

- `uploads/chats.txt`
- `uploads/died-chat.txt`
- `uploads/js.txt`
- `uploads/perchance-characters-export-2026-06-03.json`

Риск: приватные данные, шум, устаревший код, ложные срабатывания grep.

Рекомендация: удалить из repo или перенести в приватное test fixture хранилище с redaction.

### 24. Дублирующие generated outputs

Полные дубли по hash:

- `original/ai-character-chat-html.txt` == `reassembled/ai-character-chat-html.txt`;
- `original/ai-character-chat-list.txt` == `reassembled/ai-character-chat-list.txt` == `output/ai-character-chat-list.txt`.

Если эти файлы нужны как golden snapshots — оставить, но пометить generated и проверять в CI. Если нет — генерировать на build.

### 25. Много сгенерированных analysis fragments продублированы

`analysis/commented_original/.../code_like_line_comment_runs/*` дублирует `line_comment_runs/*` и часть `curated_hotspots/*`.

Рекомендация: хранить только manifest + generator или добавить `.gitattributes linguist-generated`/README, чтобы reviewers не тратили время.

### 26. `test_files/*` бинарные fixtures

Бинарные fixtures допустимы для тестов, но нужно явно документировать назначение и минимизировать размер. Сейчас есть sample audio/docx/xlsx/pdf/png/zip. Нормально, если используются тестами; если нет — мусор.

---

## Положительные моменты

- Прямой `eval()` в runtime-коде не найден; прежний custom post page load code заблокирован в `029_module_import_hash_startup.frag:1049-1052`.
- SQL в Worker в основном parameterized через `.bind(...)`.
- GitHub token at rest шифруется AES-GCM (`worker.js:114-139`). Лучше использовать отдельный `TOKEN_ENCRYPTION_KEY`, а не fallback на `DISCORD_CLIENT_SECRET`.
- Regression pipeline уже покрывает assembly, syntax и базовый security lint.
- Workshop backend smoke tests проходят.

---

## Рекомендуемый порядок исправлений

1. Убрать session token из query string и запретить query-token auth на backend.
2. Запретить OAuth `postMessage` на `*`; добавить origin/source/nonce validation на frontend.
3. Перевести Workshop session из `localStorage` на cookie/in-memory + rotation.
4. Добавить static moderation scanner для Workshop-published JS/generators.
5. Закрыть supply-chain gap для CDN/dynamic imports.
6. Исправить `install_count` double count и оптимизировать vote delta.
7. Добавить индексы для catalog/moderation/delete paths.
8. Удалить или перенести `uploads/`, `new_data/`, лишние generated snapshots.
9. Ввести logger + lint rule против raw `innerHTML` и пустых `catch`.
10. Разбить `worker.js` на модули и расширить tests.
