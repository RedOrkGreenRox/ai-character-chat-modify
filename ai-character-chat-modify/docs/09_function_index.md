# 09. Function index

> **Status note (2026-06-03):** This document is still useful for understanding the original/base Perchance app and the exact decomposition. For the current ACCM overlay architecture, registries, Workshop, Explorer, skillbooks, backend, and active replace patches, read `docs/16_current_accm_architecture.md` first.

Ниже — практический индекс самых важных функций и runtime-узлов.

## Utility layer (early bootstrap)
- `window.createFloatingWindow` — html 293-391
- `window.sanitizeHtml` — 393-398
- `window.textToSpeech` — 404-422
- `window.sha256Text` — 424-430
- `window.dedent` — 433-444
- `window.downloadTextOrBlob` — 447-459
- `window.cosineDistance` — 462-471
- `window.createLoadingModal` — 474-519
- `window.applyObjectOverrides` — 522-536
- `window.objectKeysAndTypesAreValid` — 538-568
- `window.addBackgroundToElement` — 572-646
- `window.importStylesheet` — 648-657
- `window.htmlToElement` — 660-666
- `window.jsonToBlob` — 669-744
- `window.applyCodeMirror5ToTextarea` — 746-805
- `window.uploadDataUrlToTextInput` — 807-848
- `window.prompt2` — 850-1174

## Startup / environment
- `window.generateCharacterFromUrl` — 2109-2593
- `tryPersistBrowserStorageData` — 2594-2617
- `showMessageFeedHeaderBar` — 2757-2761
- `hideMessageFeedHeaderBar` — 2762-2766
- `openLeftColumn` — 2768-2778
- `closeLeftColumn` — 2779-2787

## DB / migration
- `upgradeCharacterInitialMessagesArrayIfNeeded` — 3031-3056
- `upgradeCharacterFromOldVersion` — 3058-3100
- `upgradeMessageFromOldVersion` — 3102-3120
- `upgradeThreadFromOldVersion` — 3122-3167
- `sanitizeExportJson` — 3169-3239
- `upgradeMemoryFromOldVersion` — 3241-3260
- `upgradeLoreFromOldVersion` — 3262-3270
- `createMemoryIdToIndexMapForIncorrectlyIndexedOrUnindexedMemories` — 3307-3337

## Thread / character UI rendering
- `renderThreadList` — 3484-3920
- `getThreadJSONById` — 3922-4001
- `renderMessageFeed` — 4004-4187
- `updateThreadScene` — 4194-4259
- `prependEarlierMessagesToFeed` — 4261-4297
- `createInlineReminderMessage` — 4339-4380
- `updateInlineReminderMessage` — 4382-4444
- `createCharacterCardHtml` — 4445-4465
- `filterAndRenderCharacterList` — 4871-4881
- `renderCharacterList` — 4883-5124
- `editCharacterById` — 5256-5289
- `createNewThreadWithCharacterId` — 5294-5330
- `renderMessageInputPlaceholder` — 5340-5350
- `showThread` — 5354-5440
- `showAddCharacterShortcutToThreadPopup` — 5490-5568
- `renderShortcutButtons` — 5570-5668
- `characterDetailsPrompt` — 5670-6199

## Parsing / model objects
- `generateTextFormatFromMessages` — 6204-6224
- `parseMessagesFromTextFormat` — 6226-6283
- `addCharacter` — 6285-6294
- `createMessageObj` — 6313-6341
- `addMessageToDb` — 6343-6372
- `addThread` — 6374-6438
- `ensureLoreUrlsAreLoaded` — 6440-6518

## Embeddings / token helpers
- `getTokenizerByModelName` — 6522-6536
- `countTokensInMessages` — 6539-6548
- `embedTextWithLocalModel` — 6630-6648
- `embedTexts` — 6650-6723

## Message preparation / formatting bridge
- `prepareMessagesForBot` — 6725-6788
- `renderMessagesForReader` — 6790-6836
- `messageObjToCharacterName` — 6838-6862
- `messageObjToCharacterAvatar` — 6864-6908
- `messagesToCustomCodeFormat` — 6910-6954
- `messagesFromCustomCodeFormat` — 6956-7153

## Core AI reply pipeline
- `updateFavicon` — 7124-7153
- `getBotReply` — 7158-8070
- `getChatCompletion` — 8071-8132
- `dotProduct` — 8134-8141
- `highlightCodeBlocks` — 8150-8170
- `handleStreamingReplyChunk` — 8172-8193
- `autoNameThreadIfNeeded` — 8195-8233
- `doBotReplyIfNeeded` — 8236-8432
- `regenerateMessage` — 8435-8593

## Message DOM behavior
- `createPaddedTypingIndicatorHtml` — 8595-8597
- `createTypingIndicatorHtml` — 8598-8600
- `messageFeedIsNearBottom` — 8602-8604
- `addMessageToFeed` — 8606-8658
- `switchMessageVariant` — 8665-8690
- `hasHorizontalScrollableAncestor` — 8692-8706
- `addHorizontalSwipeHandler` — 8708-8754
- `attachEventHandlersToMessageEl` — 8756-9000
- `showHiddenMessageClickHandler` — 9002-9007
- `dataUrlToCachedBlobUrl` — 9011-9024
- `loadGoogleWebFontsInMessageWrapperStyleIfNeccessary` — 9027-9045
- `createMessageElement` — 9047-9430
- `messageEditButtonClickHandler` — 9431-9530
- `messageQuickEditButtonClickHandler` — 9532-9629
- `messageDeleteButtonClickHandler` — 9631-9675

## User/system character accessors
- `getUserCharacterObj` — 9678-9708
- `getSystemCharacterObj` — 9711-9729

## Input / command handling
- `sendButtonClickHandler` — 9750-10510
- `queueUpAutoReplies` — 10512-10517
- `getDateTimeString` — 10519-10523

## Custom code bridge
- `createNewCustomCodeIframeForThread` — 10555-11213
- `updateCustomCodeIframeVisibility` — 11249-11284
- `surgicallyRerenderStreamingMessageEl` — 11485-11490
- `sendCustomCodeIframeMessage` — 11492-11500
- `runCodeInCustomCodeIframe` — 11503-11511
- `getDataForCustomCode` — 11513-11553
- `triggerInitCustomCodeEvent` — 11555-11558
- `triggerMessageActionCustomCodeEvent` — 11561-11584
- `triggerStreamingMessageChunkCustomCodeEvent` — 11586-11594
- `updateDbWithNewDataFromCustomCode` — 11596-11796

## Alternate reply / options / UX
- `doBotReplyInPlaceOfUser` — 11800-11906
- `showAddShortcutButtonModal` — 11927-11947
- `updateCustomCodePropIfNeeded` — 11949-11957
- `changeThreadUserNameHandler` — 11960-11985
- `renderThreadReplyAsCharacterListPopup` — 12035-12095
- `setThreadCurrentReplyAsCharacterId` — 12097-12101
- `resizeMessageInputTextAreaToFitContent` — 12278-12282
- `isTouchDevice` — 12288-12290
- settings modal handler — 12442-12472

## Import / export / startup
- `getCharacterHash` — 12474-12507
- `readTextBlobLineByLine` — 12554-12583
- `tryImportingRawDbExport` — 12606-12666
- `tryImportingDexieFile` — 12668-13149
- `base64DecodeUnicode` — 13154-13164
- `tryImportingExternalCharacterFileFormat` — 13166-13344
- `tryImportingTavernAIThreadFile` — 13345-13390
- `handleInvalidCharacterShareLink` — 13393-13399
- `checkForHashCommand` — 13401-13530

## List-side function index
- `generateShareLinkForCharacter` — list 21-59
- `compressBlobWithGzip` — list 60-65
- `loadDataFromUrlThatReferencesCloudStorageFile` — list 66-112
- `decompressBlobWithGzip` — list 113-117
- `evaluatePerchanceTextInSandbox` — list 118-156
- `getMessageObjsWithoutSummarizedOnes` — list 222-242
- `injectHierarchicalSummariesAndComputeNextSummariesInBackgroundIfNeeded` — list 243-648
- `confirmAsync` — list 649-673
