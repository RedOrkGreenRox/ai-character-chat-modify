# Documentation/comment sync report — 2026-06-05

Цель: актуализировать документацию и комментарии под фактическое состояние кодовой базы после security/fix изменений и текущей overlay-сборки.

## Что проанализировано

- Текущие overlay-модули `ai-character-chat-modify/modify/new/*.frag`.
- Replace-патчи `ai-character-chat-modify/modify/replace/*.frag`.
- Workshop frontend `056_extensions_workshop.frag` и importers `058_accm_workshop_importers.frag`.
- Workshop backend `workshop-backend/src/worker.js`, schema/tests/docs.
- Machine-readable индексы расширений.
- Документы `docs/15`, `docs/16`, `BASELINE_CURRENT`, `DESIGN_NOTES`, `ANALYSIS_REPORT_RU`, `workshop-backend/README.md`.

## Главное актуальное состояние

- Workshop auth теперь cookie-first: Discord login выставляет `accm_ws_session` как `HttpOnly; Secure; SameSite=None`.
- Frontend делает запросы с `credentials: 'include'`.
- Persistent `localStorage` больше не хранит session token; in-memory bearer оставлен только как legacy fallback.
- GitHub linking запускается через authenticated `POST /v1/auth/github/start`; session token не передаётся через query string.
- D1 хранит SHA-256 hashes session tokens.
- GitHub OAuth tokens шифруются AES-GCM; для production рекомендуется отдельный `TOKEN_ENCRYPTION_KEY`.
- Binary publish уже существует через `accm.binary-file.v1` wrappers; PNG/WebP/JPEG character-card wrappers устанавливаются importer'ом `workshop.binary-character-card`.
- Extension-pack importer уже есть: `workshop.extension-pack`, с регистрацией в `__accm.packs` и `__accm.library`.

## Обновлены документы

- `README.md` — дата актуального состояния.
- `ANALYSIS_REPORT_RU.md` — backend/auth/security/future-work state.
- `ai-character-chat-modify/docs/15_extension_modules_current_state.md` — backend/auth state.
- `ai-character-chat-modify/docs/16_current_accm_architecture.md` — hashes, Workshop binary/extension-pack state, backend auth/session, limitations/next steps.
- `ai-character-chat-modify/docs/BASELINE_CURRENT.md` — hashes, security/auth baseline, limitations.
- `ai-character-chat-modify/docs/DESIGN_NOTES.md` — publish/install state and backend hardening state.
- `ai-character-chat-modify/docs/README.md` and older doc status notes — refreshed to 2026-06-05.
- `ai-character-chat-modify/analysis/*.md` status notes — refreshed to 2026-06-05.
- `workshop-backend/README.md` — removed obsolete `?session=` GitHub linking instructions, documented POST flow, HttpOnly cookies, hashed sessions, `TOKEN_ENCRYPTION_KEY`.
- `workshop-backend/.dev.vars.example` — added `TOKEN_ENCRYPTION_KEY` placeholder.

## Обновлены комментарии / inline notes

- `workshop-backend/src/worker.js` — `ALLOWED_ORIGINS` comment now documents comma-separated trusted origins and `https://perchance.org` default/recommendation instead of suggesting `*`.
- `056_extensions_workshop.frag` — top-level module comment now says ACCM sidebar/global button instead of old shortcut-button wording.
- `056_extensions_workshop.frag` — GitHub linking and `/v1/me` comments now document cookie-first auth and legacy in-memory bearer fallback.

## Небольшая кодовая коррекция, выявленная при синхронизации комментариев

Документация и backend уже описывали cookie-first flow, но frontend still pre-checked `__aeWsToken()` before GitHub linking and `/v1/me`. Это ломало cookie-only sessions после Discord login.

Исправлено в `056_extensions_workshop.frag`:

- `__aeWsLinkGithub()` больше не требует local/in-memory token; он делает authenticated POST с cookie через `__aeWsFetch()`.
- `__aeWsGetMe()` больше не возвращает `null` только потому, что bearer token отсутствует; теперь он пробует cookie-auth request.

## Регенерировано

- `ai-character-chat-modify/analysis/extension_module_manifest.json`
- `ai-character-chat-modify/analysis/extension_wrapper_chains.md`
- `ai-character-chat-modify/output/ai-character-chat-html.txt`

Текущий output hash:

```text
output/ai-character-chat-html.txt
739bf7b7d2a6f180c254293138f0947b77c4116f434b50d9cf2a9fcf89fc7559

output/ai-character-chat-list.txt
10d622471dac2f3de0e86cf4217f211408b6741b33677fecbaf0371ce93497a1
```

## Проверки

Успешно выполнено:

```bash
python3 ai-character-chat-modify/tools/build_extension_indexes.py
python3 ai-character-chat-modify/tools/regression.py
cd workshop-backend && node --check src/worker.js && node tests/worker-smoke.mjs
```

Результат:

```text
REGRESSION OK
worker smoke tests OK
```

## Оставлено как историческое

`AUDIT_REPORT_2026-06-05_RU.md` содержит старые упоминания `?session=` как исходные findings до исправлений. Они не переписаны, потому что файл явно является baseline-аудитом до fixes.

---

## Дополнение: ACCM launcher и metadata — 2026-06-05

По дополнительному запросу обновлено:

- `044_accm_runtime.frag`: ACCM больше не монтируется внутрь `#leftColumn`. Кнопка теперь всегда доступна как fixed launcher at mid-left viewport, монтируется в `document.body`, открывает floating panel и остаётся кликабельной на страницах/состояниях, где левый sidebar скрыт или отсутствует.
- `004_named_characters_and_meta.frag`: добавлен replace-патч list-компонента `$meta`, чтобы default/assistant/character fallback metadata были ACCM-specific и не совпадали с оригинальным `ai-character-chat` или обычными форками.
- `README.md`, `ANALYSIS_REPORT_RU.md`, `docs/15`, `docs/16`, `BASELINE_CURRENT`, `DESIGN_NOTES` обновлены под это состояние.

Новые output hashes после сборки:

```text
output/ai-character-chat-html.txt
739bf7b7d2a6f180c254293138f0947b77c4116f434b50d9cf2a9fcf89fc7559

output/ai-character-chat-list.txt
10d622471dac2f3de0e86cf4217f211408b6741b33677fecbaf0371ce93497a1
```

Проверки повторно пройдены:

```text
REGRESSION OK
worker smoke tests OK
```
