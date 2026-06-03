# Будущие наработки и архитектурные идеи

Этот документ фиксирует идеи, которые пока **не реализованы** или реализованы частично. Цель — не потерять направление и иметь общий backlog для человека и ИИ.

## 1. Базовые установки: языки через тумблеры

Текущее состояние:

- Base Policy использует один preset языка.
- Сейчас это выглядит как выбор одного языка из списка.

Идея:

- Заменить single-select на набор тумблеров: «какими языками можно говорить».
- По умолчанию включён английский.
- Можно включить несколько языков одновременно.

Пример UI:

```text
Allowed languages
[✓] English
[ ] Russian
[ ] Spanish
[ ] French
[ ] German
[ ] Japanese
[ ] Chinese

Fallback behaviour:
(•) reply in user's language if allowed, otherwise English
( ) always English unless user explicitly asks
```

Хранение:

```js
thread.customData.__aeBasePolicy = {
  allowedLanguages: ['en'],
  fallbackLanguage: 'en',
  allowUserLanguageWhenDetected: true
}
```

Промпт:

```text
Language policy:
You may use only: English, Russian.
If the user writes in a disallowed language, respond in English unless they explicitly request translation.
```

## 2. Глобальная кнопка Workshop

Текущее состояние:

- Workshop доступен через `/workshop`, `/ws` и shortcut в треде.
- Shortcut зависит от треда.

Идея:

- Сделать Workshop глобальной кнопкой на уровне приложения, а не треда.
- Кнопка должна быть доступна даже до открытия конкретного чата.

Возможные варианты:

1. Floating pill в правом нижнем углу:

```text
🏛 Workshop
```

2. Кнопка в левом sidebar/header, рядом с глобальными действиями.
3. Пункт внутри единого Extensions menu.

Требования:

- Не плодить кнопки при каждом `showThread`.
- Не зависеть от `thread.shortcutButtons`.
- На мобильных — крупная нижняя кнопка или пункт в fullscreen меню.

## 3. Глобальный проводник файлов/памяти

Текущее состояние:

- File Explorer в основном работает per-thread.
- Загруженные файлы привязаны к конкретному threadId.

Идея:

- Проводник должен быть глобальным: файлы/лорбуки доступны из любого чата.
- У каждого файла/чанка должен быть тумблер активности для каждого чата.
- Можно загрузить условный лорбук один раз и включать его в нужных чатах переключателем.

Предлагаемая модель:

```js
fileRecord = {
  id,
  owner: 'local',
  name,
  kind,
  uploadedAt,
  global: true,
  fullText,
  chunks: [...],
  activations: {
    [threadId]: {
      enabled: true,
      contextMessageId,
      lastUsedAt
    }
  }
}
```

UI modes:

```text
Explorer
[ Files ] [ Memory ] [ Lorebooks ] [ Disabled ]

Global file:
  🟢 enabled in current chat
  [toggle current chat] [preview] [delete globally]

Inactive file:
  ⚪ available globally, not active here
  [enable here]
```

Важно:

- `Delete` и `Disable` — разные действия.
- Disable скрывает из промпта, но не удаляет.
- Delete удаляет запись глобально или только привязку к текущему чату — это нужно явно разделить.

## 4. Современный дизайн

Текущее состояние:

- UI в основном функциональный, но выглядит как набор HTML-кнопок.

Идея:

- Ввести общий дизайн-язык для extension UI:
  - cards;
  - tabs;
  - badges;
  - clear empty states;
  - skeleton/loading states;
  - mobile-first layout;
  - минимально навязчивые иконки.

Базовые CSS-переменные:

```css
--ae-surface
--ae-surface-2
--ae-border
--ae-accent
--ae-danger
--ae-muted
--ae-radius
--ae-shadow
```

Компоненты:

```text
AeButton
AeCard
AeTabs
AeBadge
AeModalView
AeListItem
AeEmptyState
AeToast
AeConfirm
```

Так как проект без сборки UI-фреймворка, компоненты лучше делать как функции, возвращающие HTML-строки + delegated event handlers.

## 5. Кнопка удаления объекта в Workshop

Текущее состояние:

- Backend умеет `DELETE /v1/items/:id`.
- Фронт Workshop пока не показывает нормальный My Library / My uploads экран с удалением.

Нужно реализовать:

- View `My Library`.
- Разделы:
  - Installed;
  - My uploads.
- Для собственных uploads:

```text
[View] [Open Gist] [Delete from Workshop]
```

Удаление:

- Если удаляет автор и GitHub token привязан — Worker пытается удалить Gist.
- Если удаление Gist не удалось — минимум удаляется запись из каталога.
- Если удаляет модератор — удаляется только каталоговая запись, Gist автора не трогается.

Нужен confirm:

```text
Delete this item from Workshop?
If you are the author, the backend will also try to delete the GitHub Gist.
```

## 6. Идеи из `uploads/chats.txt`: AI-agent platform

Загруженный файл описывает более широкую концепцию: переход от чата к платформе автономных AI-агентов.

### 6.1 RAG / Skillbooks

Идея:

- Skillbook = специализированный набор знаний, включаемый в конкретный чат.
- Примеры: `Senior Go`, `D&D DM`, `Medical terminology`, `Cyberpunk lore`.

Связь с нашими наработками:

- Workshop может распространять Skillbooks как тип item:

```text
kind: skillbook
```

- Глобальный проводник включает/выключает Skillbook для конкретного чата.
- Retrieval использует embeddings/lore pipeline.

### 6.2 Sandbox execution: Pyodide / Lua / SQLite WASM

Идея:

- Встроить локальные инструменты исполнения кода:
  - Pyodide для Python;
  - Fengari для Lua;
  - SQLite WASM для локального состояния.

Связь с текущим проектом:

- Это лучше делать не в основном потоке, а через Worker.
- Инструменты должны быть доступны агенту через explicit tool API, а не произвольный eval.

Возможный модуль:

```text
060_extensions_agent_tools.frag
```

API:

```js
ae.tools.register({ id: 'python', run(code) {} })
ae.tools.register({ id: 'lua', run(code) {} })
ae.tools.register({ id: 'sqlite', query(sql) {} })
```

### 6.3 ReAct loop

Идея:

```text
Thought → Action/Code → Observation → Final answer
```

Важно:

- Не показывать Thought пользователю, если не нужно.
- Action должен быть ограниченным и логируемым.
- Любой tool call должен иметь timeout.

Связь с Perchance:

- `getBotReply` hook может вставлять tool results в prompt.
- Для реального автономного цикла нужен task queue и stop/cancel.

### 6.4 Игровой Hybrid Engine

Идея:

- Механика считается клиентским JS/WASM.
- LLM отвечает за художественное описание.

Пример:

```text
User: атакую
JS: roll d20 + stats → hit/miss/damage
LLM: описывает сцену, учитывая результат
```

Связь с уже обсуждёнными dice/tap/typewriter:

- Dice parser = первый шаг.
- Choices/tap = UI действий.
- Scene state = память игрового состояния.

### 6.5 Spider-chart / мета-слой

Идея:

- AI возвращает скрытый JSON с изменениями параметров:

```json
{
  "relationship": {"trust": +2, "fear": -1},
  "reputation": {"guild": +1}
}
```

- UI визуализирует через chart/radar/spider chart.

Связь с текущими планами:

- Это часть `Scene memory map`.
- Хранить в `thread.customData.__aeSceneState` или отдельном `db.misc` ключе.

### 6.6 AI initiative / фоновые события

Идея:

- Бот/агенты могут инициировать события сами.

Связь с multi-character agents:

- Это режим `User → Agents → Agents`.
- Нужен scheduler, random delay, stop button, guard against user typing.

### 6.7 Client-side DOCX/PDF export

Идея:

- Экспортировать диалог/историю/ответы в DOCX/PDF на клиенте.

Связь:

- Workshop может распространять export templates.
- Generator module может добавить `/export docx`.

### 6.8 BYOK / API-независимость

Идея:

- Bring Your Own Key для внешних LLM-провайдеров.

Комментарий:

- Это архитектурно возможно, но требует аккуратной security модели.
- Ключи нельзя отправлять в Workshop backend без явного согласия.
- Лучше хранить BYOK локально в IndexedDB, шифровать паролем пользователя.

## 7. Таксономия Workshop: виды и теги

Правило для будущей Мастерской:

**Видом (`kind`) является только один из этих верхнеуровневых типов:**

```text
generator          — Генератор
generator-extension — Расширение для генератора
lorebook           — Лорбук
skillbook          — Скиллбук
character          — Персонаж
extension-pack     — Пакет для расширений
```

Всё, что не входит в этот список, **не является видом**, а становится тегом,
категорией, подтипом или capability внутри metadata.

Примеры того, что должно быть тегом/подтипом, а не отдельным kind:

```text
agent-tool        → kind: generator-extension, tags: [agent-tool, pyodide]
scene-pack        → kind: extension-pack, tags: [scene, ambience]
dice-system       → kind: extension-pack, tags: [dice, dnd]
ui-theme          → kind: extension-pack, tags: [theme, ui]
export-template   → kind: extension-pack, tags: [export, docx]
language-preset   → kind: extension-pack, tags: [language, base-policy]
language-style    → kind: skillbook, tags: [language, style, grammar]
procedural-words  → kind: extension-pack, tags: [procedural, words]
prompt-pack       → kind: extension-pack, tags: [prompts]
```

### 7.1 Пакеты для расширений

`extension-pack` — это данные/ресурсы, которые не являются самостоятельным
генератором или персонажем, но расширяют поведение существующих модулей.

Примеры:

- огромные сборники слов для процедурной генерации;
- наборы промптов;
- лёгкие языковые preset-пакеты для Base Policy;
- наборы сцен/амбьентов;
- dice rulesets;
- UI themes;
- export templates.

Пример metadata:

```json
{
  "kind": "extension-pack",
  "name": "Base Policy: Russian preset",
  "tags": ["language", "base-policy", "ru"],
  "extensionTarget": "base-policy",
  "packType": "language-preset",
  "contentSchema": "accm.base-policy.language-preset.v1"
}
```

### 7.2 Языки: preset vs skillbook

Уточнение: языки бывают двух разных типов.

**Language preset для Base Policy** — это лёгкий технический пакет расширения.
Он нужен, чтобы UI и prompt знали код языка, label и имя языка. Это
`extension-pack`, потому что он расширяет модуль Base Policy.

**Language skillbook** — это содержательное знание языка: грамматика,
стилистика, примеры RP-действий, правила перевода, honorifics, domain style.
Это уже `skillbook`, потому что он даёт модели знания, а не просто включает
тумблер.

Текущий набор Base Policy должен стать встроенными lightweight presets:

```text
English      → extension-pack, tags: [language, base-policy, en]
Russian      → extension-pack, tags: [language, base-policy, ru]
Spanish      → extension-pack, tags: [language, base-policy, es]
Portuguese   → extension-pack, tags: [language, base-policy, pt]
French       → extension-pack, tags: [language, base-policy, fr]
German       → extension-pack, tags: [language, base-policy, de]
Indonesian   → extension-pack, tags: [language, base-policy, id]
Polish       → extension-pack, tags: [language, base-policy, pl]
Japanese     → extension-pack, tags: [language, base-policy, ja]
Chinese      → extension-pack, tags: [language, base-policy, zh]
```

А расширенные языковые знания должны публиковаться как skillbooks:

```text
Russian literary RP stylebook        → skillbook, tags: [language, ru, style, rp]
Japanese honorifics and politeness   → skillbook, tags: [language, ja, honorifics]
German technical writing             → skillbook, tags: [language, de, technical]
English dark fantasy narration       → skillbook, tags: [language, en, style, fantasy]
```

По умолчанию включён English preset. Skillbooks подключаются отдельно через
глобальный проводник/Workshop и могут усиливать качество конкретного языка.

Будущая модель хранения:

```js
thread.customData.__aeBasePolicy = {
  allowedLanguagePacks: ['accm.lang.en'],
  primaryLanguagePack: 'accm.lang.en',
  activeLanguageSkillbooks: []
}
```

Preset registry:

```js
__accm.packs.register({
  id: 'accm.lang.ru',
  kind: 'extension-pack',
  packType: 'language-preset',
  extensionTarget: 'base-policy',
  label: 'Русский / Russian',
  languageName: 'Russian',
  tags: ['language', 'base-policy', 'ru']
});
```

Skillbook registry:

```js
__accm.skillbooks.register({
  id: 'skillbook.lang.ru.literary-rp',
  kind: 'skillbook',
  label: 'Russian literary RP stylebook',
  tags: ['language', 'ru', 'style', 'rp']
});
```

## 8. Приоритет будущих работ

1. Regression/tools — уже начато.
2. Extension SDK registries.
3. My Library + Delete in Workshop.
4. Global Workshop button.
5. Global Explorer with enable/disable per chat.
6. Base Policy language toggles.
7. Modern UI components.
8. Skillbooks as Workshop item type.
9. Dice/choices/typewriter interactive RP.
10. Agent tools sandbox.
11. Multi-agent initiative.
12. BYOK / local model experiments.
