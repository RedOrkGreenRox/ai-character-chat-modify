# 07. Styles, theme, CSS variables

> **Status note (2026-06-05):** This document is still useful for understanding the original/base Perchance app and the exact decomposition. For the current ACCM overlay architecture, registries, Workshop, Explorer, skillbooks, backend, and active replace patches, read `docs/16_current_accm_architecture.md` first.

## Global style block
- lines 1180-1740
- exact fragment: `009_global_styles_themes.frag`

Это основной style layer всего приложения.

## Theme variables

### Light / default
Defined at 1205-1225 under `:root, :root.light`:
- `--background`
- `--button-bg`
- `--button-bg-hover`
- `--text-color`
- `--textarea-bg`
- `--selected-thread-bg`
- `--border-color`
- `--border-radius`
- `--avatar-bg`
- `--notification-bg-color`
- `--button-border-color`
- `--button-font-size`
- `--inline-reminder-message-default-visibility`
- `--shortcut-buttons-display`
- `--link-color`
- `--box-color`
- `--box-color-hover`
- `--selected-thread-border-color`

### Dark mode override
Defined at 1231-1245 under `@media (prefers-color-scheme: dark)`.
Переопределяются основные palette variables.

## Global element styling
- `body, html` reset + background/text — 1253+
- `body *` box-sizing + inherited color/font — 1258+
- links use `--link-color`
- buttons and inputs inherit theme vars

## Major style zones

### Message content styling
Selectors:
- `.messageText`
- `.messageText pre[data-markdown-codeblock]`
- `.messageText p code`
- `.messageText table`
- `.messageText em, .messageText i`

Назначение:
- markdown/code blocks
- tables
- inline code
- emphasis rendering

### Thread sidebar styling
Selectors around 1306-1476:
- `#chatThreads`
- `#chatThreads .thread`
- `#chatThreads .threadFolder`
- `.favStar`
- `.changeFolderPath`
- `.duplicateThreadBtn`
- `.characterEditButton`
- `.selected`

### Message feed styling
Selectors around 1490-1607:
- `#messageFeed .message`
- `.bottomButtons`
- `.emojiButton`
- `.hiddenFromUser`
- `.showHiddenMessageButton`
- `.messageWrap`
- `.messageText`
- inline editor isolation rules

### Character selection styling
Selectors around 1609-1650:
- `#characterFoldersList`
- `#characterSelection .character`
- `#characterList`
- `#starterCharacterList`

### Shortcut/history/input area styling
Selectors around 1662-1718:
- `#userMessagesSentHistoryCtn`
- `.historyItem`
- `.pinButton`
- `.deleteButton`
- `#shortcutButtonsCtn`
- shortcut button spacing rules

### Misc UI animation styling
- typing indicator (`.ticontainer`, `.tidot`) — 1720+
- rotate / rotate-jiggle animations — 1725+
- loading dots animation earlier in style block

## Theme-related runtime hooks

### Inline reminder visibility
Default variable:
- `--inline-reminder-message-default-visibility`

Runtime changes:
- after enough messages, script sets it to `visible`
- lines ~10476 and ~13588

### Shortcut button display
Variable exists as `--shortcut-buttons-display`
Currently mostly left at `initial`; some prior declutter logic is commented.

### Safari mobile viewport workaround
- lines 13605-13619
- adds `maximum-scale=1` on iOS Safari/touch to prevent zooming issues.

## Style APIs exposed to data/model layer
Several persisted/user-editable fields directly influence styles:
- `message.wrapperStyle`
- `thread.messageWrapperStyle`
- `character.messageWrapperStyle`
- `character.avatar.{url,size,shape}`
- `thread.userCharacter.avatar.{url,size,shape}`
- `thread.systemCharacter.avatar.{url,size,shape}`
- `scene.background.url`
- `scene.background.filter`
- `scene.music.url`

## Message wrapper precedence
In `createMessageElement()` wrapper style precedence is effectively:
1. `messageObj.wrapperStyle`
2. `thread.messageWrapperStyle`
3. `character.messageWrapperStyle`
4. `threadCharacter.messageWrapperStyle`

Avatar name/image resolution also uses layered fallback through:
- message override
- thread override
- thread-character override
- base character

## Style-related commented treasure
Interesting commented style/UI experiments are now collected under:
- `analysis/commented_original/ai-character-chat-html/html_comments/`
- `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/`

Especially relevant:
- hidden message feed scrollbar block
- alternative role instruction preview in character cards
- time stamp in message header
- large catalog of message wrapper style presets and notes
