# Commented original code catalog

> **Status note (2026-06-03):** This document is still useful for understanding the original/base Perchance app and the exact decomposition. For the current ACCM overlay architecture, registries, Workshop, Explorer, skillbooks, backend, and active replace patches, read `docs/16_current_accm_architecture.md` first.

Каталог комментариев и закомментированных кусков, извлечённых из `original/` без изменения текста. Особенно полезен каталог `code_like_line_comment_runs/` — там собраны длинные `//`-блоки, похожие на выключенный код, старые фичи, альтернативные реализации и экспериментальные персонажи.

## original/ai-character-chat-html.txt

- HTML comment blocks: **24**
- Block comments (`/* ... */`): **15**
- All `//` runs: **762**
- Code-like `//` runs: **131**

### Code-like `//` runs

- lines 804-805: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_00804_00805_document-body-innerhtml-textarea-id-textareael-textarea.frag`  
  hint: `document.body.innerHTML = `<textarea id="textareaEl"></textarea>`;`
- lines 818-830: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_00818_00830_resize-center-crop.frag`  
  hint: `RESIZE + CENTER CROP:`
- lines 1806-1807: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_01806_01807_change-the-below-variable-to-false-to-disable-debug-info-e-g-browser-version-dev.frag`  
  hint: `Change the below variable to `false` to disable debug info (e.g. browser version, device type, localStorage size limits,`
- lines 1997-2007: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_01997_02007_let-dependencybundleurl-document-queryselector-maindependencybundlescriptel-src.frag`  
  hint: `let dependencyBundleUrl = document.querySelector("#mainDependencyBundleScriptEl").src;`
- lines 2464-2479: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_02464_02479_if-url-startswith-https-charhub-ai-doc-queryselector-form-button-to-action-conve.frag`  
  hint: `if(url.startsWith("https://charhub.ai/") && doc.querySelector(`form.button_to[action="/conversations"] [name="authentici`
- lines 2677-2679: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_02677_02679_messagefeed-addeventlistener-keydown-async-function-e.frag`  
  hint: `$.messageFeed.addEventListener("keydown", async function(e) {`
- lines 2710-2715: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_02710_02715_dragula-messagefeed.frag`  
  hint: `dragula([$.messageFeed], {`
- lines 2748-2749: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_02748_02749_todo-improve-this-heuristic-this-isn-t-just-about-screen-width-it-s-also-about-t.frag`  
  hint: `TODO: improve this heuristic. this isn't just about screen width - it's also about touch screens (no pointer hover event`
- lines 2842-2847: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_02842_02847_if-newscrolltop-messagefeedscrolltop-they-scrolled-down-so-hide-menu-if-their-mo.frag`  
  hint: `if (newScrollTop > messageFeedScrollTop) { // they scrolled down, so hide menu if their mouse isn't in trigger area`
- lines 2925-2928: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_02925_02928_things-to-check.frag`  
  hint: `Things to check:`
- lines 3005-3006: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_03005_03006_someone-mentioned-that-their-power-went-out-while-they-were-using-it-and-the-err.frag`  
  hint: `Someone mentioned that their power went out while they were using it, and the error message they gave seems to indicate `
- lines 3092-3098: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_03092_03098_warning-if-you-add-something-here-you-ll-likely-have-to-edit.frag`  
  hint: `WARNING: If you add something here, you'll likely have to edit:`
- lines 3159-3165: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_03159_03165_warning-if-you-add-something-here-you-may-need-to-edit.frag`  
  hint: `WARNING: If you add something here, you may need to edit:`
- lines 3276-3294: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_03276_03294_function-creatememoryidtoindexmapfromallmemories-memories.frag`  
  hint: `function createMemoryIdToIndexMapFromAllMemories(memories) {`
- lines 3296-3305: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_03296_03305_this-was-buggy-for-some-reason.frag`  
  hint: `// this was buggy for some reason:`
- lines 4031-4039: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_04031_04039_for-let-message-of-displayedmessages.frag`  
  hint: `for(let message of displayedMessages) {`
- lines 4116-4122: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_04116_04122_if-previouslyrenderedmessagefeedthreadid-threadid.frag`  
  hint: `if(previouslyRenderedMessageFeedThreadId === threadId) {`
- lines 4210-4211: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_04210_04211_note-that-dev-can-fully-override-scene-with-an-empty-scene-by-just-adding-a-scen.frag`  
  hint: `note that dev can fully override scene with an 'empty' scene by just adding a scene with background.url=null, etc.`
- lines 4300-4321: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_04300_04321_function-createinlinesummaryeditor-summarytext.frag`  
  hint: `function createInlineSummaryEditor(summaryText) {`
- lines 4323-4329: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_04323_04329_async-function-updateinlinesummaryeditor.frag`  
  hint: `async function updateInlineSummaryEditor() {`
- lines 4331-4337: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_04331_04337_if-latestsummaryobj.frag`  
  hint: `if(!latestSummaryObj) {`
- lines 4517-4521: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_04517_04521_comment.frag`  
  hint: `{`
- lines 4525-4535: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_04525_04535_the-following-response-will-not-move-the-story-along-too-fast-it-will-stay-mostl.frag`  
  hint: `The following response will NOT move the story along too fast - it will stay mostly in the present moment, and describe `
- lines 4576-4579: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_04576_04579_comment.frag`  
  hint: `{`
- lines 4581-4593: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_04581_04593_you-are-known-for-saying-things-like-this.frag`  
  hint: `You are known for saying things like this:`
- lines 4599-4618: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_04599_04618_important.frag`  
  hint: `IMPORTANT:`
- lines 4626-4639: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_04626_04639_the-user-will-respond-with-their-character-s-thoughts-actions-dialogue.frag`  
  hint: `The user will respond with their character's thoughts/actions/dialogue.`),`
- lines 4678-4679: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_04678_04679_async-function-processmessage-message.frag`  
  hint: `async function processMessage({message}) {`
- lines 4701-4718: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_04701_04718_let-instruction-you-are-a-helpful-assistant-that-classifies-the-hypothetical-fac.frag`  
  hint: `let instruction = `You are a helpful assistant that classifies the hypothetical facial expression of particular text mes`
- lines 4720-4723: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_04720_04723_python-coder.frag`  
  hint: `Python Coder:`
- lines 4728-4735: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_04728_04735_ike.frag`  
  hint: `ike: {`
- lines 4791-4797: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_04791_04797_phoebe.frag`  
  hint: `phoebe: {`
- lines 4881-4882: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_04881_04882_the-character-list-appears-when-user-clicks-the-new-chat-button.frag`  
  hint: `The character list appears when user clicks the "new chat" button.`
- lines 4959-4961: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_04959_04961_if-obj-quickadd.frag`  
  hint: `if(obj.quickAdd) {`
- lines 5043-5048: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_05043_05048_let-warnthatavatarurlwasremoved-false.frag`  
  hint: `let warnThatAvatarUrlWasRemoved = false;`
- lines 5053-5059: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_05053_05059_let-urlhashdata-encodeuricomponent-json-stringify-addcharacter-character-replace.frag`  
  hint: `let urlHashData = encodeURIComponent(JSON.stringify({addCharacter:character})).replace(/[!'()*]/g, function(c) {`
- lines 5061-5070: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_05061_05070_if-warnthatavatarurlwasremoved.frag`  
  hint: `if(warnThatAvatarUrlWasRemoved) {`
- lines 5135-5138: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_05135_05138_newfoldercharacterbutton-addeventlistener-click-async-function.frag`  
  hint: `$.newFolderCharacterButton.addEventListener("click", async function() {`
- lines 5208-5209: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_05208_05209_important-if-you-make-changes-here-ensure-it-it-doesn-t-break-the-undo-deletion-.frag`  
  hint: `IMPORTANT: If you make changes here, ensure it it doesn't break the 'undo deletion' feature for messages.`
- lines 5332-5338: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_05332_05338_threadmodelselector-addeventlistener-change-async-function.frag`  
  hint: `$.threadModelSelector.addEventListener("change", async function() {`
- lines 5358-5362: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_05358_05362_if-thread-currentsummaryhashchain-undefined.frag`  
  hint: `if(thread.currentSummaryHashChain === undefined) {`
- lines 5442-5458: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_05442_05458_function-shortcutsfromtextformat-text.frag`  
  hint: `function shortcutsFromTextFormat(text) {`
- lines 6028-6029: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_06028_06029_initialthreadmemories-hidden-true-show-d-d-autogeneratememories-none-label-initi.frag`  
  hint: `initialThreadMemories: { hidden:true, show:d=>d.autoGenerateMemories!=="none", label: "Initial thread-specific memories.`
- lines 6050-6053: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_06050_06053_caution-we-can-t-actually-delete-these-like-i-thought-we-could-because-dexie-s-u.frag`  
  hint: `CAUTION: we can't actually delete these like I thought we could, because dexie's `update` function is by default a "$set`
- lines 6087-6089: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_06087_06089_perchance-edit.frag`  
  hint: `PERCHANCE EDIT:`
- lines 6297-6310: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_06297_06310_perchance-edit.frag`  
  hint: `PERCHANCE EDIT`
- lines 6403-6410: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_06403_06410_perchance-edit-it-doesn-t-make-sense-to-fix-the-thread-specific-user-character-o.frag`  
  hint: `PERCHANCE EDIT: it doesn't make sense to "fix" the thread-specific user character *overrides* to the *global* defaults, `
- lines 6429-6433: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_06429_06433_perchance-edit-see-note-above-about-usercharacter-commenting-these-out.frag`  
  hint: `PERCHANCE EDIT: See note above about userCharacter. Commenting these out.`
- lines 6589-6590: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_06589_06590_let-worker-new-worker-url-createobjecturl-new-blob-importscripts-https-user-uplo.frag`  
  hint: `let worker = new Worker(URL.createObjectURL(new Blob([`importScripts("https://user.uploads.dev/file/fb599e745c0f1b1c7854`
- lines 6615-6616: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_06615_06616_you-can-test-the-function-below-by-typing-this-in-the-browser-console.frag`  
  hint: `You can test the function below by typing this in the browser console:`
- lines 7042-7043: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_07042_07043_note-it-s-possible-for-m-id-to-be-undefined-since-custom-code-can-completely-rep.frag`  
  hint: `note: it's possible for m.id to be undefined, since custom code can completely replace messages`
- lines 7054-7056: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_07054_07056_it-s-possible-for-the-custom-code-to-produce-a-message-with-an-id-that-doesn-t-e.frag`  
  hint: `It's possible for the custom code to produce a message with an id that doesn't exist in the original messages because it`
- lines 7075-7077: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_07075_07077_async-function-threadhasmemoriesorlore-threadid.frag`  
  hint: `async function threadHasMemoriesOrLore(threadId) {`
- lines 7079-7081: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_07079_07081_let-lorebookidentries-await-db-lore-where-bookid-thread-lorebookid-count.frag`  
  hint: `let loreBookIdEntries = await db.lore.where({bookId:thread.loreBookId}).count();`
- lines 7083-7084: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_07083_07084_return-lorebookidentries-0-lorebookurlentries-0-memories-0.frag`  
  hint: `return loreBookIdEntries > 0 || loreBookUrlEntries > 0 || memories > 0;`
- lines 7090-7093: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_07090_07093_let-remindermessage-character-remindermessage.frag`  
  hint: `let reminderMessage = character.reminderMessage || "";`
- lines 7100-7106: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_07100_07106_apply-thread-specific-overrides.frag`  
  hint: `// apply thread-specific overrides:`
- lines 7108-7110: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_07108_07110_let-maxtokenlimit-root-aitextplugin-getmetaobject-true-idealmaxcontexttokens.frag`  
  hint: `let maxTokenLimit = root.aiTextPlugin({getMetaObject:true}).idealMaxContextTokens;`
- lines 7115-7122: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_07115_07122_tokenlimit-await-counttokens-roleinstruction-thread-modelname-allow-for-system-m.frag`  
  hint: `tokenLimit -= await countTokens(roleInstruction, thread.modelName); // allow for system message tokens`
- lines 7163-7165: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_07163_07165_note-currently-if-replyingcharacter-only-overrides-the-reminder-and-instruction.frag`  
  hint: `NOTE: Currently, if replyingCharacter only overrides the reminder and instruction.`
- lines 7198-7199: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_07198_07199_note-these-are-not-used-for-message-log-text-creation-since-preparemessagesforbo.frag`  
  hint: `NOTE: These are not used for 'message log text' creation, since `prepareMessagesForBot` already does all the proper name`
- lines 7374-7375: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_07374_07375_each-message-should-generally-include-dialogue-actions-and-thoughts-enclose-acti.frag`  
  hint: ``   - Each message should generally include dialogue, actions, and thoughts. Enclose actions and thoughts in asterisks, `
- lines 7424-7425: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_07424_07425_no-need-to-await-this-it-s-just-to-trigger-the-next-iteration-of-summary-stuff-i.frag`  
  hint: `no need to await this - it's just to trigger the next iteration of summary stuff if needed.`
- lines 7462-7463: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_07462_07463_note-we-shouldn-t-actually-need-to-fall-back-to-username-systemname-etc-because-.frag`  
  hint: `NOTE: we shouldn't actually need to fall back to userName, systemName, etc. because prepareMessagesForBot should have al`
- lines 7517-7518: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_07517_07518_let-memories-await-db-memories-where-threadid-status-current-toarray.frag`  
  hint: `let memories = await db.memories.where({threadId, status:"current"}).toArray();`
- lines 7520-7527: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_07520_07527_debugging-fix.frag`  
  hint: `debugging fix:`
- lines 7700-7702: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_07700_07702_we-create-batches-of-memories-i-e-chronologically-ordered-groups-of-memories-tha.frag`  
  hint: `we create "batches" of memories - i.e. chronologically ordered groups of memories that are relevant and adjacent`
- lines 8197-8198: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_08197_08198_let-usercharacter-await-getusercharacterobj.frag`  
  hint: `let userCharacter = await getUserCharacterObj();`
- lines 8295-8299: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_08295_08299_note-you-d-thing-that-if-the-characterid-were-a-thread-external-character-that-w.frag`  
  hint: `NOTE: You'd thing that if the characterId were a thread-external character, that we'd write that character's name/avatar`
- lines 8381-8382: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_08381_08382_we-need-to-make-each-image-prompt-in-a-message-unique-because-the-keys-for-the-k.frag`  
  hint: `we need to make each image prompt in a message unique, because the keys for the "keep" button are based on the prompt te`
- lines 8408-8412: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_08408_08412_edit-new-hierarchical-summary-approach-doesn-t-hold-up-message-generation-so-we-.frag`  
  hint: `EDIT: new hierarchical summary approach doesn't "hold up" message generation, so we don't need to trigger summary here`
- lines 8855-8856: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_08855_08856_messageel-queryselector-messagetext-queryselectorall-pre-code-foreach-el-el-oute.frag`  
  hint: `messageEl.querySelector(".messageText").querySelectorAll("pre > code").forEach(el => el.outerHTML = el.innerHTML); // no`
- lines 8876-8877: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_08876_08877_new-approach-stores-memories-within-the-last-message-that-they-were-constructed-.frag`  
  hint: `new approach stores memories within the last message that they were 'constructed' with - memoriesEndingHere:`
- lines 9133-9137: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_09133_09137_if-thread-modelname-gpt-3-5-turbo-thread-modelname-gpt-4.frag`  
  hint: `if(thread.modelName === "gpt-3.5-turbo" || thread.modelName === "gpt-4") {`
- lines 9303-9307: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_09303_09307_if-math-random-0-5.frag`  
  hint: `if(Math.random() < 0.5) {`
- lines 9317-9319: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_09317_09319_note-originally-this-just-had-the-mobilecss-and-i-was-going-to-change-it-complet.frag`  
  hint: `NOTE: Originally this just had the 'mobileCss' and I was going to change it completely to the inline-block one, but I va`
- lines 9368-9384: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_09368_09384_text-to-image-parsing.frag`  
  hint: `// text-to-image parsing:`
- lines 9415-9428: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_09415_09428_function-textcontainsasalanguagemodeltext-text.frag`  
  hint: `function textContainsAsALanguageModelText(text) {`
- lines 9652-9653: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_09652_09653_add-message-back-to-db.frag`  
  hint: `add message back to db.`
- lines 9697-9702: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_09697_09702_edit-we-no-longer-apply-overrides-here-this-function-now-returns-the-true-userch.frag`  
  hint: `EDIT: we no longer apply overrides here. This function now returns the "true" userCharacter, and we apply overrides manu`
- lines 9724-9727: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_09724_09727_edit-we-no-longer-apply-overrides-here-this-function-now-returns-the-true-system.frag`  
  hint: `EDIT: we no longer apply overrides here. This function now returns the "true" systemCharacter, and we apply overrides ma`
- lines 9829-9830: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_09829_09830_let-charactertoreplywith-await-getusercharacterobj-threadid.frag`  
  hint: `let characterToReplyWith = await getUserCharacterObj(threadId);`
- lines 9844-9845: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_09844_09845_charactertoreplywith-modelname-thread-modelname-use-whatever-model-the-thread-ch.frag`  
  hint: `characterToReplyWith.modelName = thread.modelName; // use whatever model the thread character is using`
- lines 9859-9873: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_09859_09873_old-summaries-approach.frag`  
  hint: `OLD SUMMARIES APPROACH:`
- lines 10065-10073: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_10065_10073_async-function-regeneratememorieshandler.frag`  
  hint: `async function regenerateMemoriesHandler() {`
- lines 10131-10133: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_10131_10133_debugger.frag`  
  hint: `debugger;`
- lines 10154-10187: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_10154_10187_first-we-remove-edited-deleted-memories-from-their-parent-message-object.frag`  
  hint: `// first we remove edited/deleted memories from their parent message object:`
- lines 10189-10191: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_10189_10191_let-isafterprevious-false.frag`  
  hint: `let isAfterPrevious = false;`
- lines 10193-10225: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_10193_10225_if-messageidlevelschanged-has-originalmessageid-originallevel-isafterprevious.frag`  
  hint: `if(messageIdLevelsChanged.has(originalMessageId+"|"+originalLevel) || !isAfterPrevious) {`
- lines 10353-10354: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_10353_10354_let-regex-new-regexp-characternamevalidationpattern.frag`  
  hint: `let regex = new RegExp(characterNameValidationPattern);`
- lines 10357-10359: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_10357_10359_else.frag`  
  hint: `} else {`
- lines 10403-10411: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_10403_10411_edit-system-command-is-now-instruction-based-like-with-ai-and-user.frag`  
  hint: `EDIT: system command is now instruction-based, like with /ai and /user`
- lines 10469-10473: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_10469_10473_edit-new-hierarchical-summary-approach-doesn-t-hold-up-chat-message-generation-s.frag`  
  hint: `EDIT: new hierarchical summary approach doesn't "hold up" chat message generation, so no need to trigger summarization h`
- lines 10585-10587: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_10585_10587_let-floatingwindow-createfloatingwindow-header-character-name-closebuttonaction-.frag`  
  hint: `let floatingWindow = createFloatingWindow({header:character.name, closeButtonAction:"hide"});`
- lines 10627-10643: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_10627_10643_this-is-what-allows-characters-to-make-arbitrary-requests-to-resources-on-the-in.frag`  
  hint: `// This is what allows characters to make arbitrary requests to resources on the internet.`
- lines 10746-10749: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_10746_10749_getcompletion-async-function-options.frag`  
  hint: `getCompletion: async function(options) {`
- lines 10773-10775: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_10773_10775_forcesavedata-async-function.frag`  
  hint: `forceSaveData: async function() {`
- lines 10838-10864: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_10838_10864_function-watchobject-obj-callback.frag`  
  hint: `function watchObject(obj, callback) {`
- lines 10868-10888: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_10868_10888_oc-thread-messages-watcharray-oc-thread-messages-prop.frag`  
  hint: `oc.thread.messages = watchArray(oc.thread.messages, (prop) => {`
- lines 10985-10987: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_10985_10987_if-changeddata-thread-messages-new-set-changeddata-thread-messages-map-m-m-conte.frag`  
  hint: `if(changedData.thread.messages && new Set(changedData.thread.messages.map(m => m.content)).size < changedData.thread.mes`
- lines 11457-11460: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_11457_11460_edit-i-ve-commented-this-out-because-now-rendermessagefeed-handles-data-currentl.frag`  
  hint: `EDIT: I've commented this out because now renderMessageFeed handles `data-currently-streaming="1"` messages correctly.`
- lines 11589-11590: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_11589_11590_if-chunkdata-index-lastchunkindexa-1-console-warn-out-of-order-before-posting-ch.frag`  
  hint: `if(chunkData.index !== lastChunkIndexA+1) console.warn("OUT OF ORDER **BEFORE POSTING** CHUNK111", chunkData);`
- lines 11617-11618: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_11617_11618_note-that-originalmessages-will-only-be-defined-if-this-is-part-of-the-messageha.frag`  
  hint: `note that originalMessages will only be defined if this is part of the MessageHandler process - because in that case we `
- lines 11659-11669: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_11659_11669_if-originalorcurrentmessageids-includes-referencedid-referencedid-1.frag`  
  hint: `if(!originalOrCurrentMessageIds.includes(referencedId) && referencedId !== -1) {`
- lines 11675-11677: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_11675_11677_replace-messages-in-the-database-with-the-new-messages.frag`  
  hint: `replace messages in the database with the new messages`
- lines 11696-11697: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_11696_11697_let-newmessages-await-db-messages-where-threadid-equals-threadid-toarray.frag`  
  hint: `let newMessages = await db.messages.where("threadId").equals(threadId).toArray();`
- lines 11814-11817: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_11814_11817_edit-commented-these-out-because-dobotreplyinplaceofuser-is-now-only-for-the-act.frag`  
  hint: `EDIT: Commented these out because doBotReplyInPlaceOfUser is now only for the actual user character - others use doBotRe`
- lines 12107-12114: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_12107_12114_let-alreadyautoreplying-false.frag`  
  hint: `let alreadyAutoReplying = false;`
- lines 12120-12134: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_12120_12134_get-list-of-characters-sorting-by-lastmessagetime.frag`  
  hint: `// get list of characters, sorting by lastMessageTime`
- lines 12136-12138: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_12136_12138_let-ttsenabled-promptresult-texttospeechvoicesenabled-enabled.frag`  
  hint: `let ttsEnabled = promptResult.textToSpeechVoicesEnabled === "enabled";`
- lines 12140-12148: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_12140_12148_let-charactertoreplywith-await-db-characters-get-parseint-promptresult-character.frag`  
  hint: `let characterToReplyWith = await db.characters.get(parseInt(promptResult.characterId));`
- lines 12150-12152: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_12150_12152_if-signals-stop.frag`  
  hint: `if(signals.stop) {`
- lines 12154-12156: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_12154_12156_if-threadid-activethreadid.frag`  
  hint: `if(threadId !== activeThreadId) {`
- lines 12158-12170: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_12158_12170_if-ttsenabled.frag`  
  hint: `if(ttsEnabled) {`
- lines 12174-12176: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_12174_12176_signals-stop-false-wasdeleted-false.frag`  
  hint: `signals = {stop:false, wasDeleted:false};`
- lines 12178-12180: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_12178_12180_if-signals-stop.frag`  
  hint: `if(signals.stop) {`
- lines 12182-12192: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_12182_12192_if-ttsenabled.frag`  
  hint: `if(ttsEnabled) {`
- lines 12194-12217: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_12194_12217_wait-for-the-other-bot-to-respond.frag`  
  hint: `// // wait for the other bot to respond`
- lines 12219-12224: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_12219_12224_i.frag`  
  hint: `i++;`
- lines 12447-12448: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_12447_12448_let-openaiapikeyoriginal-await-db-misc-get-openaiapikey-value.frag`  
  hint: `let openAiApiKeyOriginal = (await db.misc.get("openAiApiKey"))?.value || "";`
- lines 12584-12604: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_12584_12604_async-function-readfirstlineoftextblob-file.frag`  
  hint: `async function readFirstLineOfTextBlob(file) {`
- lines 12628-12633: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_12628_12633_note-this-is-commented-out-because-it-causes-chrome-to-crash-probably-memory-iss.frag`  
  hint: `Note: This is commented out because it causes Chrome to crash (probably memory issues)`
- lines 12721-12738: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_12721_12738_if-successreadingjsonasdexie.frag`  
  hint: `if(!successReadingJsonAsDexie) {`
- lines 12747-12751: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_12747_12751_if-json.frag`  
  hint: `if(!json) {`
- lines 12978-12980: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_12978_12980_if-there-s-just-one-thread-then-we-assume-it-was-from-a-single-thread-export.frag`  
  hint: `if there's just one thread, then we assume it was from a single-thread export`
- lines 13004-13006: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_13004_13006_if-importedsummaries.frag`  
  hint: `if(importedSummaries) {`
- lines 13059-13061: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_13059_13061_if-importedsummaries.frag`  
  hint: `if(importedSummaries) {`
- lines 13084-13085: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_13084_13085_convert-json-back-to-blob-and-import.frag`  
  hint: `convert json back to blob and import`
- lines 13194-13200: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_13194_13200_convert-file-to-a-data-url.frag`  
  hint: `convert `file` to a data URL:`
- lines 13205-13211: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_13205_13211_let-bitmap-await-createimagebitmap-file.frag`  
  hint: `let bitmap = await createImageBitmap(file);`
- lines 13556-13557: `analysis/commented_original/ai-character-chat-html/code_like_line_comment_runs/code_like_run_13556_13557_newthreadbutton-click.frag`  
  hint: `$.newThreadButton.click();`

### HTML comment blocks

- lines 1-6: `analysis/commented_original/ai-character-chat-html/html_comments/html_comment_00001_00006_comment.frag`
- lines 233-233: `analysis/commented_original/ai-character-chat-html/html_comments/html_comment_00233_00233_open-characters-base-code-a-loooot-of-hacky-edits-which-i-initially-tried-to-kee.frag`
- lines 236-239: `analysis/commented_original/ai-character-chat-html/html_comments/html_comment_00236_00239_comment.frag`
- lines 242-247: `analysis/commented_original/ai-character-chat-html/html_comments/html_comment_00242_00247_comment.frag`
- lines 248-248: `analysis/commented_original/ai-character-chat-html/html_comments/html_comment_00248_00248_bundle-of-above-scripts.frag`
- lines 249-249: `analysis/commented_original/ai-character-chat-html/html_comments/html_comment_00249_00249_old-version-1-script-src-https-user-uploads-dev-file-9992637c7d690500ce39ae47642.frag`
- lines 250-250: `analysis/commented_original/ai-character-chat-html/html_comments/html_comment_00250_00250_old-version-2-script-src-https-user-uploads-dev-file-e7f08d9c863ca4a4a6c2eed28bf.frag`
- lines 252-252: `analysis/commented_original/ai-character-chat-html/html_comments/html_comment_00252_00252_script-id-maindependencybundlescriptel-src-https-user-uploads-dev-file-356cdae1f.frag`
- lines 257-257: `analysis/commented_original/ai-character-chat-html/html_comments/html_comment_00257_00257_script-src-https-cdn-jsdelivr-net-npm-msgpackr-1-11-0-dist-index-min-js-script.frag`
- lines 1176-1176: `analysis/commented_original/ai-character-chat-html/html_comments/html_comment_01176_01176_script-async-defer-src-https-cdn-jsdelivr-net-npm-morphdom-2-7-2-dist-morphdom-u.frag`
- lines 1758-1760: `analysis/commented_original/ai-character-chat-html/html_comments/html_comment_01758_01760_div-id-threadfoldernavigationbar-style-display-flex-width-100-margin-top-0-5rem.frag`
- lines 1761-1761: `analysis/commented_original/ai-character-chat-html/html_comments/html_comment_01761_01761_div-id-chatthreadfolders-data-current-folder-path-div.frag`
- lines 1774-1774: `analysis/commented_original/ai-character-chat-html/html_comments/html_comment_01774_01774_perchance-edit.frag`
- lines 1775-1790: `analysis/commented_original/ai-character-chat-html/html_comments/html_comment_01775_01790_div-style-height-0px-position-relative.frag`
- lines 1895-1895: `analysis/commented_original/ai-character-chat-html/html_comments/html_comment_01895_01895_button-id-newfoldercharacterbutton-style-padding-0-25rem-margin-left-0-5rem-new-.frag`
- lines 1909-1922: `analysis/commented_original/ai-character-chat-html/html_comments/html_comment_01909_01922_comment.frag`
- lines 1943-1945: `analysis/commented_original/ai-character-chat-html/html_comments/html_comment_01943_01945_div-id-threadsettingsbutton-style-margin-left-0-5rem-cursor-pointer-background-v.frag`
- lines 1952-1954: `analysis/commented_original/ai-character-chat-html/html_comments/html_comment_01952_01954_div-style-display-flex-margin-bottom-0-25rem.frag`
- lines 1963-1963: `analysis/commented_original/ai-character-chat-html/html_comments/html_comment_01963_01963_button-id-addshortcutbutton-style-text-align-left-add-shortcut-button.frag`
- lines 1972-1972: `analysis/commented_original/ai-character-chat-html/html_comments/html_comment_01972_01972_button-id-replyloopbutton-reply-loop-button.frag`
- lines 4452-4452: `analysis/commented_original/ai-character-chat-html/html_comments/html_comment_04452_04452_div-class-roleinstruction-style-font-size-0-8rem-text-overflow-ellipsis-word-wra.frag`
- lines 9150-9150: `analysis/commented_original/ai-character-chat-html/html_comments/html_comment_09150_09150_div-class-time-style-font-size-0-8rem-opacity-0-5-margin-left-0-5rem-display-fle.frag`
- lines 11151-11151: `analysis/commented_original/ai-character-chat-html/html_comments/html_comment_11151_11151_note-this-must-be-a-separate-code-block-from-above-because-otherwise-static-impo.frag`
- lines 11180-11180: `analysis/commented_original/ai-character-chat-html/html_comments/html_comment_11180_11180_some-code-for-helping-devs-with-custom-code-bugs-problems.frag`

## original/ai-character-chat-list.txt

- HTML comment blocks: **0**
- Block comments (`/* ... */`): **0**
- All `//` runs: **36**
- Code-like `//` runs: **4**

### Code-like `//` runs

- lines 230-231: `analysis/commented_original/ai-character-chat-list/code_like_line_comment_runs/code_like_run_00230_00231_it-s-we-go-backwards-through-the-messages-and-only-collect-a-message-if-its-leve.frag`  
  hint: `it's we go backwards through the messages, and only 'collect' a message if its level is not below the highest level we'v`
- lines 414-415: `analysis/commented_original/ai-character-chat-list/code_like_line_comment_runs/code_like_run_00414_00415_note-a-block-is-just-an-array-of-messages-and-all-of-them-have-a-summary-message.frag`  
  hint: `note: a block is just an array of messages, and all of them have a summary message (i.e. higher-level message) at the en`
- lines 449-453: `analysis/commented_original/ai-character-chat-list/code_like_line_comment_runs/code_like_run_00449_00453_let-existingsummary-window-aihierarchicalsummarystuff-threadid-summariesreadytoi.frag`  
  hint: `let existingSummary = window.__aiHierarchicalSummaryStuff[threadId].summariesReadyToInject.filter(s => s.summarizedMessa`
- lines 630-631: `analysis/commented_original/ai-character-chat-list/code_like_line_comment_runs/code_like_run_00630_00631_console-log-instruction.frag`  
  hint: `console.log("𝗜𝗡𝗦𝗧𝗥𝗨𝗖𝗧𝗜𝗢𝗡:", instruction);`

### HTML comment blocks
