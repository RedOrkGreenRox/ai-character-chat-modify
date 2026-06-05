# Function → component map

> **Status note (2026-06-05):** This document is still useful for understanding the original/base Perchance app and the exact decomposition. For the current ACCM overlay architecture, registries, Workshop, Explorer, skillbooks, backend, and active replace patches, read `docs/16_current_accm_architecture.md` first.

## html

### html_002_emergency_export_script (20-231)

- fragment: `analysis/exact_components/ai-character-chat-html/002_emergency_export_script.frag`
- description: Emergency export/delete IndexedDB recovery flow and raw DB export helpers.
  - `emergencyDeleteAllDataClickHandler` — 32-50
  - `emergencyExportClickHandler` — 51-96
  - `exportRawDb` — 97-225
  - `setTimeout` — 226-292

### html_004_utility_foundations (259-392)

- fragment: `analysis/exact_components/ai-character-chat-html/004_utility_foundations.frag`
- description: Core helpers: countTokens aliases, $/$$ DOM proxy, show/hide, delay, floating window.
  - `createFloatingWindow` — 293-392

### html_005_utility_formatting_io (393-521)

- fragment: `analysis/exact_components/ai-character-chat-html/005_utility_formatting_io.frag`
- description: sanitizeHtml, text-to-speech, sha256, dedent, downloadTextOrBlob, cosineDistance, createLoadingModal.
  - `sanitizeHtml` — 393-403
  - `textToSpeech` — 404-423
  - `sha256Text` — 424-432
  - `dedent` — 433-446
  - `downloadTextOrBlob` — 447-457
  - `setTimeout` — 458-461
  - `cosineDistance` — 462-473
  - `createLoadingModal` — 474-521

### html_006_utility_background_and_json (522-745)

- fragment: `analysis/exact_components/ai-character-chat-html/006_utility_background_and_json.frag`
- description: Object override helpers, background media manager, stylesheet import, htmlToElement, jsonToBlob.
  - `applyObjectOverrides` — 522-537
  - `objectKeysAndTypesAreValid` — 538-571
  - `addBackgroundToElement` — 572-591
  - `isVideoUrl` — 592-595
  - `getMediaType` — 596-612
  - `nextMediaIndex` — 613-647
  - `importStylesheet` — 648-659
  - `htmlToElement` — 660-668
  - `jsonToBlob` — 669-675
  - `ensureCapacity` — 676-685
  - `writeToBuffer` — 686-692
  - `flushStringBuffer` — 693-699
  - `processValue` — 700-745

### html_007_utility_editor_prompt_modal (746-1175)

- fragment: `analysis/exact_components/ai-character-chat-html/007_utility_editor_prompt_modal.frag`
- description: CodeMirror loader, data-URL upload helper, prompt2 modal system and form controls.
  - `applyCodeMirror5ToTextarea` — 746-806
  - `uploadDataUrlToTextInput` — 807-849
  - `prompt2` — 850-855
  - `sanitizeHtml` — 856-983
  - `updateFitHeights` — 984-1076
  - `setTimeout` — 1077-1091
  - `getAllValues` — 1092-1110
  - `updateInputVisibilies` — 1111-1779

### html_010_app_shell_dom (1741-1993)

- fragment: `analysis/exact_components/ai-character-chat-html/010_app_shell_dom.frag`
- description: Top notification, three-column app shell, thread sidebar, character selection, chat interface, options popup, right column DOM.
  - `toggleFeedbackModal` — 1780-1795
  - `showFeedbackModal` — 1796-1812
  - `beforeSubmit` — 1813-1837
  - `showCommentsModal` — 1838-2020

### html_011_module_bootstrap_core (1994-2108)

- fragment: `analysis/exact_components/ai-character-chat-html/011_module_bootstrap_core.frag`
- description: Main module start, clear-data button, avatar toggle, platform guards, JSON5 lazy load, image helpers bootstrap.
  - `setTimeout` — 2021-2024
  - `toggleAvatarPicDisplay` — 2025-2068
  - `blobToDataUrl` — 2069-2076
  - `processAvatarImageUrl` — 2077-2097
  - `startX` — 2098-2108

### html_012_module_generate_character_from_url (2109-2594)

- fragment: `analysis/exact_components/ai-character-chat-html/012_module_generate_character_from_url.frag`
- description: URL-based character generation/import pipeline and browser storage persistence helper.
  - `generateCharacterFromUrl` — 2109-2123
  - `tidyUp` — 2124-2559
  - `setTimeout` — 2560-2593
  - `tryPersistBrowserStorageData` — 2594-2655

### html_013_module_sanitization_markdown_scaffolding (2595-2756)

- fragment: `analysis/exact_components/ai-character-chat-html/013_module_sanitization_markdown_scaffolding.frag`
- description: DOMPurify hooks, marked renderer, global error handler, resize observer, prompt defaults, debug window bootstrap.
  - `onerror` — 2656-2727
  - `addToDebugLog` — 2728-2756

### html_014_module_layout_navigation (2757-2889)

- fragment: `analysis/exact_components/ai-character-chat-html/014_module_layout_navigation.frag`
- description: Left-column open/close behavior, header bar visibility, mobile right-column toggle logic.
  - `showMessageFeedHeaderBar` — 2757-2761
  - `hideMessageFeedHeaderBar` — 2762-2767
  - `openLeftColumn` — 2768-2778
  - `closeLeftColumn` — 2779-2807
  - `showMessageFeedTopMenu` — 2808-2812
  - `hideMessageFeedTopMenu` — 2813-3030

### html_015_module_db_bootstrap_upgrades (2890-3339)

- fragment: `analysis/exact_components/ai-character-chat-html/015_module_db_bootstrap_upgrades.frag`
- description: Dexie bootstrap, schema version 90, upgrades for characters/threads/messages/memories/lore.
  - `upgradeCharacterInitialMessagesArrayIfNeeded` — 3031-3057
  - `upgradeCharacterFromOldVersion` — 3058-3101
  - `upgradeMessageFromOldVersion` — 3102-3121
  - `upgradeThreadFromOldVersion` — 3122-3168
  - `sanitizeExportJson` — 3169-3240
  - `upgradeMemoryFromOldVersion` — 3241-3261
  - `upgradeLoreFromOldVersion` — 3262-3306
  - `createMemoryIdToIndexMapForIncorrectlyIndexedOrUnindexedMemories` — 3307-3483

### html_017_module_thread_list_and_thread_export (3484-4001)

- fragment: `analysis/exact_components/ai-character-chat-html/017_module_thread_list_and_thread_export.frag`
- description: Thread list rendering, search/folders/favorites, duplicate/export/delete thread interactions, thread JSON export.
  - `renderThreadList` — 3484-3921
  - `getThreadJSONById` — 3922-4003

### html_018_module_message_feed_and_scene (4002-4444)

- fragment: `analysis/exact_components/ai-character-chat-html/018_module_message_feed_and_scene.frag`
- description: Message feed rendering, lazy prepend, scene background/music, inline reminder rendering.
  - `renderMessageFeed` — 4004-4015
  - `threadCharacter` — 4016-4124
  - `setTimeout` — 4125-4145
  - `setTimeout` — 4146-4193
  - `updateThreadScene` — 4194-4260
  - `prependEarlierMessagesToFeed` — 4261-4272
  - `thread` — 4273-4273
  - `threadCharacter` — 4274-4338
  - `createInlineReminderMessage` — 4339-4381
  - `updateInlineReminderMessage` — 4382-4444

### html_019_module_character_catalog_and_crud (4445-5290)

- fragment: `analysis/exact_components/ai-character-chat-html/019_module_character_catalog_and_crud.frag`
- description: Character cards, starter/example characters, character list rendering, character/thread deletion helpers.
  - `createCharacterCardHtml` — 4445-4870
  - `filterAndRenderCharacterList` — 4871-4882
  - `renderCharacterList` — 4883-5033
  - `character` — 5034-5141
  - `safelyDeleteCharacterById` — 5142-5187
  - `safelyDeleteThreadById` — 5188-5206
  - `safelyDeleteMessagesByIds` — 5207-5255
  - `editCharacterById` — 5256-5293

### html_020_module_thread_entry_shortcuts_character_prompt (5291-6312)

- fragment: `analysis/exact_components/ai-character-chat-html/020_module_thread_entry_shortcuts_character_prompt.frag`
- description: Thread creation/show flow, shortcut parser/renderer, character editor modal, message text parsing, addCharacter/createMessageObj entry utilities.
  - `createNewThreadWithCharacterId` — 5294-5339
  - `renderMessageInputPlaceholder` — 5340-5353
  - `showThread` — 5354-5459
  - `shortcutsFromTextFormat` — 5460-5485
  - `shortcutsToTextFormat` — 5486-5489
  - `showAddCharacterShortcutToThreadPopup` — 5490-5499
  - `handleCharChoiceButtonClick` — 5500-5569
  - `renderShortcutButtons` — 5570-5622
  - `handleChoiceButtonClick` — 5623-5669
  - `characterDetailsPrompt` — 5670-5689
  - `setTimeout` — 5690-5697
  - `showMessageStyleExamples` — 5698-6203
  - `generateTextFormatFromMessages` — 6204-6225
  - `parseMessagesFromTextFormat` — 6226-6284
  - `addCharacter` — 6285-6312

### html_021_module_message_models_lore_embeddings (6313-6724)

- fragment: `analysis/exact_components/ai-character-chat-html/021_module_message_models_lore_embeddings.frag`
- description: DB message/thread insertion, lore loading, token counting, local embedding loader/bootstrap.
  - `createMessageObj` — 6313-6342
  - `addMessageToDb` — 6343-6373
  - `addThread` — 6374-6439
  - `ensureLoreUrlsAreLoaded` — 6440-6521
  - `getTokenizerByModelName` — 6522-6530
  - `textToTokenIds` — 6531-6538
  - `countTokensInMessages` — 6539-6592
  - `loadModel` — 6593-6602
  - `extractFeatures` — 6603-6617
  - `textEmbedderFunction` — 6618-6629
  - `embedTextWithLocalModel` — 6630-6649
  - `embedTexts` — 6650-6724

### html_022_module_prepare_messages_and_custom_code_format (6725-7155)

- fragment: `analysis/exact_components/ai-character-chat-html/022_module_prepare_messages_and_custom_code_format.frag`
- description: prepareMessagesForBot, reader rendering pipeline, character name/avatar resolvers, custom-code message format bridge.
  - `prepareMessagesForBot` — 6725-6789
  - `renderMessagesForReader` — 6790-6837
  - `messageObjToCharacterName` — 6838-6863
  - `messageObjToCharacterAvatar` — 6864-6909
  - `messagesToCustomCodeFormat` — 6910-6955
  - `messagesFromCustomCodeFormat` — 6956-7123
  - `updateFavicon` — 7124-7139
  - `startX` — 7140-7140
  - `startY` — 7141-7157

### html_023_module_reply_generation_pipeline (7156-8235)

- fragment: `analysis/exact_components/ai-character-chat-html/023_module_reply_generation_pipeline.frag`
- description: Core bot reply construction: role instructions, reminders, summaries, memories/lore retrieval, AI completion helpers.
  - `getBotReply` — 7158-7261
  - `getRoleInstructionText` — 7262-7459
  - `messageArrayToMessagesText` — 7460-7566
  - `explainMemLoreQueryPrompt` — 7567-7782
  - `createMemoriesAndLoreMessageContent` — 7783-7815
  - `countTokensInRetrievalText` — 7816-7825
  - `dropBatchOrMemoryFromBatch` — 7826-7946
  - `streamId` — 7947-8070
  - `getChatCompletion` — 8071-8097
  - `messageArrayToMessagesText` — 8098-8133
  - `dotProduct` — 8134-8149
  - `highlightCodeBlocks` — 8150-8171
  - `handleStreamingReplyChunk` — 8172-8194
  - `autoNameThreadIfNeeded` — 8195-8235

### html_024_module_streaming_regen_message_controls (8236-9008)

- fragment: `analysis/exact_components/ai-character-chat-html/024_module_streaming_regen_message_controls.frag`
- description: Streaming reply orchestration, regenerate flow, typing indicator, addMessageToFeed, swipe/variant controls.
  - `doBotReplyIfNeeded` — 8236-8337
  - `onStreamingReplyChunk` — 8338-8342
  - `onProgressMessage` — 8343-8434
  - `regenerateMessage` — 8435-8496
  - `onStreamingReplyChunk` — 8497-8513
  - `onProgressMessage` — 8514-8594
  - `createPaddedTypingIndicatorHtml` — 8595-8597
  - `createTypingIndicatorHtml` — 8598-8601
  - `messageFeedIsNearBottom` — 8602-8605
  - `addMessageToFeed` — 8606-8664
  - `switchMessageVariant` — 8665-8691
  - `hasHorizontalScrollableAncestor` — 8692-8707
  - `addHorizontalSwipeHandler` — 8708-8748
  - `resetElementPosition` — 8749-8755
  - `attachEventHandlersToMessageEl` — 8756-8784
  - `addHorizontalSwipeHandler` — 8785-9001
  - `showHiddenMessageClickHandler` — 9002-9010

### html_025_module_message_render_edit_delete_user_system_chars (9009-9749)

- fragment: `analysis/exact_components/ai-character-chat-html/025_module_message_render_edit_delete_user_system_chars.frag`
- description: Message element creation, image tag rendering, inline edit/delete handlers, user/system character resolvers.
  - `dataUrlToCachedBlobUrl` — 9011-9026
  - `loadGoogleWebFontsInMessageWrapperStyleIfNeccessary` — 9027-9046
  - `createMessageElement` — 9047-9405
  - `setTimeout` — 9406-9429
  - `messageEditButtonClickHandler` — 9430-9442
  - `insertMessageHandler` — 9443-9478
  - `editCharacter` — 9479-9531
  - `messageQuickEditButtonClickHandler` — 9532-9591
  - `clickAnywhereHandler` — 9592-9630
  - `messageDeleteButtonClickHandler` — 9631-9677
  - `getUserCharacterObj` — 9678-9710
  - `getSystemCharacterObj` — 9711-9749

### html_026_module_send_button_commands (9750-10525)

- fragment: `analysis/exact_components/ai-character-chat-html/026_module_send_button_commands.frag`
- description: sendButtonClickHandler, slash commands (/ai,/user,/sys,/sum,/mem,/lore,/image...), queue helper, custom-code-visible character property map preface.
  - `sendButtonClickHandler` — 9750-10279
  - `reloadButtonClickHandler` — 10280-10511
  - `queueUpAutoReplies` — 10512-10518
  - `getDateTimeString` — 10519-10554

### html_027_module_custom_code_iframe_api (10526-11797)

- fragment: `analysis/exact_components/ai-character-chat-html/027_module_custom_code_iframe_api.frag`
- description: Custom-code iframe creation, oc/thread API surface, postMessage bridge, sync plumbing, DB update reconciliation.
  - `createNewCustomCodeIframeForThread` — 10555-10569
  - `handler` — 10570-10820
  - `callParentWindow` — 10821-10824
  - `handler` — 10825-10893
  - `createDeepOnChangeProxy` — 10894-10924
  - `___setDataWithoutTriggeringChange` — 10925-10943
  - `getCurrentData` — 10944-10950
  - `getChangedData` — 10951-10976
  - `_do_not_use_this_use_oc_dot_pushDataChanges_instead___sendBackDataUpdatesIfNeeded` — 10977-10981
  - `sendBackDataUpdatesIfNeeded` — 10982-11100
  - `applyObjectOverrides` — 11101-11163
  - `await` — 11164-11248
  - `updateCustomCodeIframeVisibility` — 11249-11484
  - `surgicallyRerenderStreamingMessageEl` — 11485-11491
  - `sendCustomCodeIframeMessage` — 11492-11502
  - `runCodeInCustomCodeIframe` — 11503-11512
  - `getDataForCustomCode` — 11513-11554
  - `triggerInitCustomCodeEvent` — 11555-11560
  - `triggerMessageActionCustomCodeEvent` — 11561-11585
  - `triggerStreamingMessageChunkCustomCodeEvent` — 11586-11595
  - `updateDbWithNewDataFromCustomCode` — 11596-11799

### html_028_module_reply_as_and_input_ux (11798-12473)

- fragment: `analysis/exact_components/ai-character-chat-html/028_module_reply_as_and_input_ux.frag`
- description: Reply-as flows, thread options, message input resizing/history, settings modal, UI bindings.
  - `doBotReplyInPlaceOfUser` — 11800-11849
  - `onStreamingReplyChunk` — 11850-11854
  - `onProgressMessage` — 11855-11926
  - `showAddShortcutButtonModal` — 11927-11948
  - `updateCustomCodePropIfNeeded` — 11949-11959
  - `changeThreadUserNameHandler` — 11960-12034
  - `renderThreadReplyAsCharacterListPopup` — 12035-12096
  - `setThreadCurrentReplyAsCharacterId` — 12097-12277
  - `resizeMessageInputTextAreaToFitContent` — 12278-12287
  - `isTouchDevice` — 12288-12342
  - `handleDoubleTap` — 12343-12352
  - `handleDoubleClick` — 12353-12363
  - `onDoubleTapOrClick` — 12364-12419
  - `clickAnywhereElseHandler` — 12420-12473

### html_029_module_import_hash_startup (12474-13619)

- fragment: `analysis/exact_components/ai-character-chat-html/029_module_import_hash_startup.frag`
- description: Character hashing, import pipelines, external character formats, hash/share-link bootstrap, initial screen startup.
  - `getCharacterHash` — 12474-12605
  - `tryImportingRawDbExport` — 12606-12667
  - `tryImportingDexieFile` — 12668-13153
  - `base64DecodeUnicode` — 13154-13165
  - `tryImportingExternalCharacterFileFormat` — 13166-13344
  - `tryImportingTavernAIThreadFile` — 13345-13392
  - `handleInvalidCharacterShareLink` — 13393-13396
  - `setTimeout` — 13397-13400
  - `checkForHashCommand` — 13401-13619

## list

### list_002_share_link_generation (21-65)

- fragment: `analysis/exact_components/ai-character-chat-list/002_share_link_generation.frag`
- description: Share-link generation and gzip compression helper.
  - `generateShareLinkForCharacter` — 21-59
  - `compressBlobWithGzip` — 60-65

### list_003_url_loading_and_sandbox (66-156)

- fragment: `analysis/exact_components/ai-character-chat-list/003_url_loading_and_sandbox.frag`
- description: Load shared character data from URL/cloud storage and sandboxed Perchance text evaluation.
  - `loadDataFromUrlThatReferencesCloudStorageFile` — 66-112
  - `decompressBlobWithGzip` — 113-117
  - `evaluatePerchanceTextInSandbox` — 118-149
  - `setTimeout` — 150-170

### list_004_named_characters_and_meta (157-221)

- fragment: `analysis/exact_components/ai-character-chat-list/004_named_characters_and_meta.frag`
- description: Named URL characters and $meta.dynamic metadata generation.
  - `dynamic` — 171-221

### list_005_summary_selection_helper (222-242)

- fragment: `analysis/exact_components/ai-character-chat-list/005_summary_selection_helper.frag`
- description: Helper that filters summarized vs unsummarized message objects.
  - `getMessageObjsWithoutSummarizedOnes` — 222-242

### list_006_summary_injection_and_budget (243-474)

- fragment: `analysis/exact_components/ai-character-chat-list/006_summary_injection_and_budget.frag`
- description: Summary injection back into DB, context-budget computation, prep for hierarchical summarization.
  - `injectHierarchicalSummariesAndComputeNextSummariesInBackgroundIfNeeded` — 243-648

### list_008_confirm_async (649-673)

- fragment: `analysis/exact_components/ai-character-chat-list/008_confirm_async.frag`
- description: confirmAsync modal helper.
  - `confirmAsync` — 649-691
