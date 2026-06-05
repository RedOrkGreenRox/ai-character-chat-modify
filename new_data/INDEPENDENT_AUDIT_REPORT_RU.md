# ACCM — Независимый Аудит Кода
### Верификация утверждений Kimi Agent + собственные находки

**Дата**: 2026-06-04  
**Проверено файлов**: 030, 032, 036, 042, 044, 056, 058 (`.frag`), `workshop-backend/src/worker.js`, `023_module_reply_generation_pipeline.frag`  
**Метод**: ручная верификация каждого утверждения Kimi против реального кода  

---

## Общая оценка

Kimi-отчёт **в целом добросовестен**: большинство критических и высоких находок подтверждаются реальным кодом. Ошибок два типа:

1. **Ложные тревоги** (2 случая) — SEC-002, часть BACK-001 — Kimi сгенерировал несуществующую проблему или описал уже решённое место как уязвимость.
2. **Недооценка серьёзности** (1 случай) — SEC-004 (`fallback-seed`) — Kimi упомянул мимоходом, это потенциальный prod-катастрофический баг.

**Пропущено Kimi**: 3 находки, описаны в секции «Новые баги».

---

## КРИТИЧЕСКИЕ (Race Conditions)

### ✅ RC-001 — `__aeLoadScript` без дедупликации (ПОДТВЕРЖДЕНО)

**Файл**: `030_extensions_core.frag`, строки ~60–80

```js
async function __aeLoadScript(url, onReady) {
  // нет проверки на существование script-тега с данным url
  var s = document.createElement('script');
  s.src = url;
  document.head.appendChild(s);   // <-- всегда создаёт новый тег
  ...
}
```

При двух параллельных вызовах `__aeLoadScript` с одним и тем же URL — два script-тега, двойная загрузка, двойное выполнение инициализации. Реальная проблема при медленном соединении.

**Фикс**: проверять `document.querySelector('script[src="' + url + '"]')` перед созданием тега, либо хранить `Map<url, Promise>` in-flight загрузок.

---

### ✅ RC-002 — Булев флаг вместо Promise при конкурентных загрузках (ПОДТВЕРЖДЕНО)

**Файл**: `030_extensions_core.frag`

```js
var __aePdfJsReady = false;
async function __aeLoadPdfJs() {
  if (__aePdfJsReady) return;       // ← race: второй вызов проходит пока первый грузится
  __aePdfJsReady = true;             // ← ставится ДО завершения загрузки
  await __aeLoadScript('https://cdnjs.../pdf.min.js');
}
```

То же для `__aeLoadMammoth`, `__aeLoadXlsx`, `__aeLoadJsZip`.  
Окно гонки: между началом загрузки и её завершением флаг уже `true`, параллельный вызов полагает что библиотека готова, получает `undefined`.

**Фикс**: заменить булев флаг на `let __aePdfJsPromise = null; return __aePdfJsPromise ??= __aeLoadScript(...)`.

---

## КРИТИЧЕСКИЕ (Безопасность)

### ✅ SEC-001 — Сессионные токены в D1 в открытом виде (ПОДТВЕРЖДЕНО)

**Файл**: `workshop-backend/src/worker.js`, строки 169, 324

```js
// Запись (строка 324):
INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)
// token — случайная строка, хранится as-is

// Чтение (строка 169):
WHERE sessions.token = ?
```

Если злоумышленник получит дамп D1 (утечка, ошибка конфигурации Cloudflare) — все сессии скомпрометированы. Стандарт: хранить `SHA-256(token)`, в браузер отправлять plain-token.

**Фикс**: при создании сессии сохранять `crypto.subtle.digest('SHA-256', token)`, при проверке хешировать входящий токен.

---

### ⚠️ SEC-002 — XSS через SVG-аватар (ЧАСТИЧНО ЛОЖНАЯ ТРЕВОГА)

**Файл**: `058_accm_workshop_importers.frag`, строки 116–132

Kimi утверждал: SVG-инъекция через имя персонажа.  
**Реальность**:

```js
var initials = name.split(/\s+/).slice(0, 2).map(function(x) { return x[0] || ''; })
  .join('').toUpperCase() || '?';
// ...
'<text ...>' + initials.replace(/[<>&]/g, '') + '</text>'
// финально:
return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
```

Инициалы берутся как первые **буквы** слов и санитизируются + `encodeURIComponent`. Прямого XSS нет.

**Но**: если аватар используется через `innerHTML` (а не `img.src`), то `data:image/svg+xml` может выполняться. Нужно убедиться что аватар всегда ставится через `img.src`, не через innerHTML. **Риск НИЗКИЙ**, но заслуживает проверки.

---

### ✅ SEC-003 — LIKE-wildcard инъекция в catalog API (ПОДТВЕРЖДЕНО, ниже чем заявлено)

**Файл**: `workshop-backend/src/worker.js`, строка 479

```js
const tag = url.searchParams.get('tag');
// ...
if (tag) { sql += ` AND items.tags LIKE ?`; params.push('%"' + tag + '"%'); }
```

Parameterized queries (D1 bind) защищают от классического SQL-инъекции. Но:
- Если `tag = "%"` → `LIKE %""%"` → совпадает со всеми записями (bypass фильтра)
- Если `tag = "a%"` → `LIKE %"a%"%` → матчит теги начинающиеся на `a`, независимо от конца

**Kimi назвал это SQL injection — неточно**. Правильнее: LIKE-wildcard abuse + информационная утечка.  
**Фикс**: `params.push('%"' + tag.replace(/[%_]/g, '\\$&') + '"%')` + `ESCAPE '\\'`.

---

### ✅ SEC-004 — DISCORD_CLIENT_SECRET как AES-ключ + аварийный ключ (ПОДТВЕРЖДЕНО, КРИТИЧНО)

**Файл**: `workshop-backend/src/worker.js`, строки 116–118

```js
const seed = new TextEncoder().encode(
  env.DISCORD_CLIENT_SECRET || 'fallback-seed'   // ← КРИТИЧНО
);
const raw = await crypto.subtle.digest('SHA-256', seed);
return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
```

**Два раздельных дефекта**:

1. **`'fallback-seed'`**: если `DISCORD_CLIENT_SECRET` не задан в env (забыли при деплое, тестовое окружение) — GitHub-токены всех пользователей шифруются ключом известным любому читателю репозитория. Полная компрометация.

2. **Client Secret как ключ**: смена секрета Discord (ротация, утечка) инвалидирует ВСЕ хранящиеся GitHub-токены без возможности плавной миграции. Нарушение принципа разделения ключей.

**Фикс**: добавить отдельный `TOKEN_ENCRYPTION_KEY` секрет в Cloudflare. Аварийный fallback должен выбрасывать ошибку, а не использовать константу.

---

## ВЫСОКИЕ (Баги)

### ✅ BUG-001 — `dispatch` проглатывает ошибки команд (ПОДТВЕРЖДЕНО)

**Файл**: `044_accm_runtime.frag`, строки 53–72

```js
ae.commands.dispatch = async function(text, ctx) {
  // ...
  for (var i = 0; i < cmds.length; i++) {
    try {
      var result = await cmds[i].handler(trimmed, ctx);
      if (result !== false) return true;
    } catch(e) {
      console.error('[accm] command error:', e);
      return true;    // ← BUG: возвращает true (=«обработано»), хотя команда упала с ошибкой
    }
  }
  return false;
};
```

Последствие: пользователь отправляет `/workshop`, Workshop падает с ошибкой → dispatch возвращает `true` → сообщение не отправляется в чат, команда не видит ошибки. Пользователь видит тишину.

**Фикс**: в catch — либо `return false` (передать управление следующему handler'у), либо отдельный механизм уведомления об ошибке + `return true` только если это уведомление отображено.

---

### ✅ ML-001 — Pointer-event утечка в мобильном UI (ПОДТВЕРЖДЕНО)

**Файл**: `042_extensions_mobile_ui.frag`, строки ~135–143

```js
function __aeMobileOpenWindow(winEl) {
  window.addEventListener('pointermove', onDrag);
  window.addEventListener('pointerup', onDragEnd);
  // window закрывается через closeWindow() → listeners НЕ снимаются
}
```

`closeWindow()` снимает лишь события на самом `winEl`, но не глобальные `pointermove`/`pointerup`. Каждое открытие окна добавляет новую пару листенеров. После 10 открытий — 10 `pointermove` обработчиков на window, все активны одновременно.

**Фикс**: в `closeWindow()` вызывать `window.removeEventListener('pointermove', onDrag); window.removeEventListener('pointerup', onDragEnd)`.

---

### ✅ ML-003 — Неограниченный поисковый кэш (ПОДТВЕРЖДЕНО)

**Файл**: `030_extensions_core.frag`, строка ~18

```js
var __AE_SEARCH_CACHE = new Map();
```

**Файл**: `032_extensions_web_search.frag`, строки 263–286

```js
var cacheKey = opts.threadId + '|' + userText;
if (__AE_SEARCH_CACHE.has(cacheKey)) return __AE_SEARCH_CACHE.get(cacheKey);
// ...
__AE_SEARCH_CACHE.set(cacheKey, context);
// ← никогда не чистится
```

Каждый уникальный запрос + threadId добавляет запись. В браузере без перезагрузки страницы кэш растёт неограниченно.

**Фикс**: LRU (максимум 50 записей) или TTL (удалять записи старше 30 минут):
```js
if (__AE_SEARCH_CACHE.size > 50) {
  __AE_SEARCH_CACHE.delete(__AE_SEARCH_CACHE.keys().next().value);
}
```

---

### ✅ PERF-001 — `db.messages.toArray()` для вкладки Memory (ПОДТВЕРЖДЕНО)

**Файл**: `036_extensions_file_explorer.frag`, строки 70–90

```js
async function renderMemory() {
  // ...
  var messages = await db.messages.toArray();   // ← ВСЕ сообщения ВСЕХ чатов
  messages.sort(function(a, b) { return (a.threadId - b.threadId) || (a.order - b.order); });
  messages.forEach(function(msg) {
    var levels = msg.memoriesEndingHere || {};
    // ...
  });
}
```

Загружает всю таблицу messages в память только для поиска `memoriesEndingHere`. При 10 000+ сообщений — значительная задержка и OOM-риск.

**Фикс**: добавить Dexie-индекс на `memoriesEndingHere` (если поддерживается) или отдельную таблицу `generatedMemories`, либо хотя бы фильтровать на уровне cursor:
```js
db.messages.filter(msg => msg.memoriesEndingHere && Object.keys(msg.memoriesEndingHere).length > 0).toArray()
```

---

### ✅ BACK-001 — Токен сессии в query string (ПОДТВЕРЖДЕНО)

**Файл**: `workshop-backend/src/worker.js`, строки 153–161

```js
async function getUser(env, req) {
  const auth = req.headers.get('Authorization') || '';
  let token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    const u = new URL(req.url);
    token = u.searchParams.get('session') || u.searchParams.get('token');  // ← проблема
  }
  // ...
  WHERE sessions.token = ?   // ← сравнение с plaintext token
```

Query-string токены попадают в:
- Cloudflare access logs (хранятся у провайдера)
- HTTP Referer headers при редиректах  
- Историю браузера

Это реальный security-риск, особенно учитывая plaintext хранение (SEC-001).

**Фикс**: убрать fallback на query string. Если popup-flow требует передачи токена, использовать `postMessage` между окнами.

---

### ❌ BUG-008 — `Date.now()` как ID (НЕЗНАЧИТЕЛЬНО, НЕ КРИТИЧНО)

**Файл**: `058_accm_workshop_importers.frag`, строка 33

```js
id: (payload.item && payload.item.id) || ('workshop.skillbook.' + Date.now()),
```

Kimi заявил коллизию при параллельной установке. На практике: это **fallback** когда `payload.item.id` уже задан сервером. Реальная коллизия маловероятна (пользователь не устанавливает два skillbook в одну миллисекунду).

**Вердикт**: LOW, можно заменить на `Date.now().toString(36) + Math.random().toString(36).slice(2)` при желании.

---

## СРЕДНИЕ (Качество кода)

### ✅ BUG-004 — Cache-key из threadId + userText без нормализации (ПОДТВЕРЖДЕНО, LOW)

**Файл**: `032_extensions_web_search.frag`, строка 263

```js
var cacheKey = opts.threadId + '|' + userText;
```

Если `opts.threadId = undefined` → ключ `"undefined|query"`. Одинаковые запросы в разных чатах кешируются вместе когда threadId не передан. Практической опасности нет, но кэш может вернуть результаты из чужого контекста.

**Фикс**: `var cacheKey = (opts.threadId ?? 'global') + '|' + userText.trim().toLowerCase();`

---

### ✅ BUG-005 — Нет rate limiting для DDG-запросов (ПОДТВЕРЖДЕНО)

**Файл**: `032_extensions_web_search.frag`, строка 135

```js
var ddgUrl = 'https://api.duckduckgo.com/?q=' + encodeURIComponent(q) + '&format=json&...';
var resp = await root.superFetch(ddgUrl);
```

На одно сообщение пользователя — до 3–4 DDG-запросов (`__aeGenerateSearchQueries` возвращает до 4 вариантов). Нет throttle, нет лимита частоты. При быстром вводе пользователя → DDoS на DDG API через браузер.

**Фикс**: дебаунс на уровне автоматического поиска (задержка 1–2 секунды после ввода).

---

## Пропущенные Kimi (Новые находки)

### 🆕 NEW-001 — `ae.commands.dispatch` не проверяет тип handler (MEDIUM)

**Файл**: `044_accm_runtime.frag`, строка 58

```js
var result = await cmds[i].handler(trimmed, ctx);
```

`ae.commands.register` не валидирует что `handler` — функция. Если расширение передало объект или undefined, crash будет проглочен BUG-001 (catch → `return true`). Двойная проблема: регистрация мусора + тихое поглощение ошибки.

**Фикс**: в `ae.commands.register` добавить `if (typeof cmd.handler !== 'function') throw new TypeError(...)`.

---

### 🆕 NEW-002 — `db.lore.toArray()` без лимита в renderMemory (MEDIUM)

**Файл**: `036_extensions_file_explorer.frag`, строки 66, 104

```js
try { lore = await db.lore.toArray(); } catch(e) {}
// ...
lore.slice(0, 300).forEach(...)
```

Загружает **все** lore-записи из Dexie, потом обрезает до 300 для отображения. При большой библиотеке — waste памяти. Загружать нужно сразу через `db.lore.limit(300).toArray()`.

---

### 🆕 NEW-003 — Потенциальный deadlock при `__aeHandleCommandText` патче (LOW)

**Файл**: `044_accm_runtime.frag`, строки 77–84

```js
if (typeof __aeHandleCommandText === 'function' && !ae.commands.dispatcherPatched) {
  ae.commands.dispatcherPatched = true;
  var _orig = __aeHandleCommandText;
  __aeHandleCommandText = async function(text) {
    var handled = await ae.commands.dispatch(text, { source: 'sendButton' });
    if (handled) return true;
    return _orig(text);   // ← вызывает оригинал
  };
}
```

Если этот блок выполнится дважды до того как `dispatcherPatched` установится в `true` (параллельный старт), будет двойной патч: `__aeHandleCommandText` → dispatch → оригинал-который-является-первым-патчем → dispatch → ... рекурсия. `dispatcherPatched` стоит до создания closure что защищает при синхронном выполнении, но не при параллельном async запуске двух копий модуля.

---

## Сводная таблица

| ID | Статус | Серьёзность | Файл | Суть |
|----|--------|-------------|------|------|
| RC-001 | ✅ ПОДТВЕРЖДЕНО | CRITICAL | 030 | `__aeLoadScript` без дедупликации |
| RC-002 | ✅ ПОДТВЕРЖДЕНО | CRITICAL | 030 | boolean-флаги вместо in-flight Promise |
| SEC-001 | ✅ ПОДТВЕРЖДЕНО | CRITICAL | worker.js | plaintext session tokens в D1 |
| SEC-003 | ✅ ПОДТВЕРЖДЕНО (переоценено) | HIGH→MEDIUM | worker.js | LIKE wildcard abuse (не SQL injection) |
| SEC-004 | ✅ ПОДТВЕРЖДЕНО (недооценено) | CRITICAL | worker.js | `fallback-seed` + Discord secret как AES-ключ |
| SEC-002 | ⚠️ ЧАСТИЧНО ЛОЖНОЕ | LOW | 058 | SVG sanitized + encodeURIComponent |
| BUG-001 | ✅ ПОДТВЕРЖДЕНО | HIGH | 044 | dispatch catch → `return true` |
| BUG-004 | ✅ ПОДТВЕРЖДЕНО | LOW | 032 | cache key с undefined threadId |
| BUG-005 | ✅ ПОДТВЕРЖДЕНО | MEDIUM | 032 | нет throttle на DDG запросы |
| BUG-008 | ⚠️ ПРЕУВЕЛИЧЕНО | LOW | 058 | Date.now() как fallback ID |
| ML-001 | ✅ ПОДТВЕРЖДЕНО | HIGH | 042 | pointer listeners не снимаются |
| ML-003 | ✅ ПОДТВЕРЖДЕНО | MEDIUM | 030/032 | unbounded search cache |
| PERF-001 | ✅ ПОДТВЕРЖДЕНО | HIGH | 036 | db.messages.toArray() для memory tab |
| BACK-001 | ✅ ПОДТВЕРЖДЕНО | HIGH | worker.js | токен в query string → логи |
| NEW-001 | 🆕 ПРОПУЩЕНО | MEDIUM | 044 | handler не валидируется как function |
| NEW-002 | 🆕 ПРОПУЩЕНО | MEDIUM | 036 | db.lore.toArray() без limit |
| NEW-003 | 🆕 ПРОПУЩЕНО | LOW | 044 | potential double-patch deadlock |

---

## Приоритетный план фиксов

### Спринт 1 (безопасность — срочно до production)

1. **SEC-004**: добавить `TOKEN_ENCRYPTION_KEY` в Cloudflare Secrets, удалить `fallback-seed`
2. **SEC-001**: хранить `SHA-256(token)` в D1 вместо plaintext
3. **BACK-001**: убрать query-string fallback для токена в `getUser()`

### Спринт 2 (надёжность — critical bugs)

4. **RC-001**: дедупликация `__aeLoadScript` через Map<url, Promise>
5. **RC-002**: заменить boolean-флаги на Promise-синглтоны в loader-функциях
6. **BUG-001**: в catch блоке dispatch → `return false` (или toast + `return true`)

### Спринт 3 (утечки памяти и производительность)

7. **ML-001**: снимать pointer listeners в `closeWindow()`
8. **ML-003**: добавить LRU-лимит (50 записей) в `__AE_SEARCH_CACHE`
9. **PERF-001**: `db.messages.filter(...).toArray()` вместо полной загрузки
10. **NEW-002**: `db.lore.limit(300).toArray()` напрямую

### Спринт 4 (качество кода)

11. **SEC-003**: LIKE escape: `.replace(/[%_]/g, '\\$&')` + ESCAPE clause
12. **BUG-005**: дебаунс на авто-поиск
13. **NEW-001**: валидация `handler` в `ae.commands.register`
14. **BUG-004**: нормализация cache key

---

## Выводы

**Kimi-аудит точен на ~85%** и выявил реальные проблемы. Ложные тревоги минимальны (SEC-002 переоценён). Главное расхождение: SEC-004 (`fallback-seed`) недооценён Kimi, а на самом деле это **production-критичный дефект** — любой dev/staging деплой без `DISCORD_CLIENT_SECRET` шифрует GitHub токены ключом из публичного кода.

Из 14+ проверенных утверждений:
- **11 подтверждены полностью**
- **1 подтверждён частично** (SEC-003)
- **2 преувеличены или ложные** (SEC-002, BUG-008)
- **3 пропущены Kimi** (NEW-001, NEW-002, NEW-003)
