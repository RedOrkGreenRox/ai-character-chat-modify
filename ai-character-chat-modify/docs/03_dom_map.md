# 03. DOM map

> **Status note (2026-06-05):** This document is still useful for understanding the original/base Perchance app and the exact decomposition. For the current ACCM overlay architecture, registries, Workshop, Explorer, skillbooks, backend, and active replace patches, read `docs/16_current_accm_architecture.md` first.

## Top-level shell

### Global overlays / shell
- `#initialPageLoadingModal` — line 10 — стартовый fullscreen loading overlay
- `#emergencyExportCtn` — line 12 — recovery/export container if boot stalls
- `#topNotification` — line 1744 — floating top notification wrapper
- `#topNotificationContent` — line 1745 — notification text body
- `#main` — line 1748 — корневой fixed app shell

## Three-column layout

### Left column
- `#leftColumn` — 1749 — sidebar
- `#newThreadButton` — 1751 — переход к выбору/new chat/character
- `#closeLeftColumnButton` — 1752 — закрыть sidebar на mobile/narrow mode
- `#threadSearchCtn` — 1754 — контейнер поиска thread'ов
- `#threadSearchInput` — 1755 — строка поиска thread'ов
- `#threadSearchButton` — 1756 — кнопка поиска
- `#chatThreads` — 1762 — список thread cards / folder cards
- `#appOptions` — 1763 — блок settings/import/export/comments/etc.
- `#settingsButton` — 1765
- `#tipsButton` — 1766
- `#clearDataButton` — 1770
- `#exportDataButton` — 1771
- `#importDataFileInput` — 1772
- `#showFeedbackButton` — 1792
- `#showCommentsButton` — 1793

### Middle column
- `#middleColumn` — 1860 — центральный экранный контейнер
- `#middleColumnShadowOverlay` — 1861 — mobile overlay при открытом sidebar

### Right column
- `#rightColumn` — 1984 — правая панель под custom-code UI
- `#customCodeColumn` — 1985 — flex-column для iframe и resize bar
- `#customCodeIframeHorizontalResizeBar` — 1986 — drag resize
- `#customCodeIframeCtn` — 1987 — контейнер iframe
- `#toggleRightColumnButton` — 1992 — mobile toggle custom-code panel

## Character selection screen
- `#characterSelection` — 1862 — screen выбора/создания character
- `#characterSelectionOpenLeftColumnButton` — 1863
- `#createCharacterAreaCtn` — 1865
- `#generateCharacterFromUrlInputEl` — 1869
- `#generateCharacterFromUrlBtn` — 1869
- `#charFromUrlExtraInstrCtn` — 1871
- `#generateCharacterFromUrlExtraInstructionsInputEl` — 1872
- `#newCharacterButton` — 1876
- `#yourCharactersTitleEl` — 1886
- `#characterSearchCtn` — 1890
- `#characterSearchInputEl` — 1891
- `#characterSearchBtn` — 1892
- `#characterFoldersList` — 1897
- `#characterList` — 1898
- `#loadAllCharactersBtn` — 1899
- `#tapACharacterHintEl` — 1900
- `#starterCharacterList` — 1904
- `#storageNoticeEl` — 1907

## Chat interface screen
- `#chatInterface` — 1930 — основной middle-screen для чата
- `#customCodeChatInterfaceWrapper` — 1931 — placeholder под custom-code driven chat UI
- `#builtInChatInterfaceWrapper` — 1932 — built-in chat UI

### Header / environment
- `#musicPlayerCtn` — 1933
- `#musicPlayer` — 1934
- `#messageFeedHeaderBar` — 1937
- `#messageFeedOpenLeftColumnButton` — 1938
- `#threadModelSelector` — 1941
- `#chatBackgroundCtn` — 1947
- `#noMessagesNotice` — 1948
- `#messageFeed` — 1949
- `#statusNotifier` — 1950

### Input zone
- `#inputWrapper` — 1951
- `#userMessagesSentHistoryCtn` — 1955
- `#shortcutButtonsCtn` — 1956
- `#messageInput` — 1958 — ключевой textarea send-flow
- `#sendButton` — 1960
- `#threadOptionsPopup` — 1962
- `#changeThreadUserNameButton` — 1965
- `#changeThreadUserAvatarUrlButton` — 1966
- `#toggleAutoReplyToUserButton` — 1967
- `#threadLevelResponseLengthButton` — 1968
- `#addCharacterOptionsButton` — 1969
- `#editCharacterOptionsButton` — 1970
- `#replyAsOptionsButton` — 1971
- `#threadReplyAsCharacterListPopup` — 1974
- `#threadOptionsButton` — 1976

## Important generated DOM structures

### Thread cards (rendered dynamically)
Rendered in `renderThreadList()`:
- `.thread`
- `.threadFolder`
- `.favStar`
- `.changeFolderPath`
- `.duplicateThreadBtn`
- `.nameEditButton`
- `.exportButton`
- `.deleteButton`
- `.characterEditButton`

### Character cards
Rendered in `createCharacterCardHtml()` / `renderCharacterList()`:
- `.character`
- `.avatar`
- `.info`
- `.buttons`
- `.edit`
- `.changeFolderPath`
- `.duplicate`
- `.share`
- `.delete`

### Message cards
Rendered in `createMessageElement()`:
- `.message`
- `.messageWrap`
- `.messageText`
- `.bottomButtons`
- `.brainButton`
- `.editButton`
- `.deleteButton`
- `.recomputeButton`
- `.recomputeWithAltModelButton`
- `.messageVariantsCtn`
- `.prevMessageVariantButton`
- `.nextMessageVariantButton`
- `.showHiddenMessageButton`
- `.statusMessage`
- `.hiddenFromAiIcon`
- `.generated-image-container`

## DOM sections by exact component
- App shell markup: `analysis/exact_components/ai-character-chat-html/010_app_shell_dom.frag`
- Global CSS affecting shell: `009_global_styles_themes.frag`
- Thread list renderer: `017_module_thread_list_and_thread_export.frag`
- Message feed renderer: `018_module_message_feed_and_scene.frag`
- Message element factory: `025_module_message_render_edit_delete_user_system_chars.frag`
