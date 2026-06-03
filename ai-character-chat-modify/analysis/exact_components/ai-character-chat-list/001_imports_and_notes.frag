loadDependencies = {import:ai-character-chat-dependencies-v1} // dexie.js, dompurify, etc.
aiTextPlugin = {import:ai-text-plugin}
textToImagePlugin = {import:text-to-image-plugin}
commentsPlugin = {import:comments-plugin}
tabbedCommentsPlugin = {import:tabbed-comments-plugin-v1}
uploadPlugin = {import:upload-plugin} // <-- for character share links
superFetch = {import:super-fetch-plugin} // <-- to bypass CORs issues in character custom code
fullscreenButtonPlugin = {import:fullscreen-button-plugin}
combineEmojis = {import:combine-emojis-plugin}
bugReport = {import:bug-report-plugin} // for comments-plugin-based feedback button - it's a helper for getting browser debug info like browser version, localStorage size limits, etc. - stuff that's relevant to bug reports

// HEADS UP:
// All the code you see here and in the bottom-right editor is what "powers" this chat app thing.
// Perchance allows you to make random generators, but it also allows you to create more complex applications like this one.
// If you accidentally opened this, then click the "fullscreen" button to go back to using the chat app.
// If you want to customize it to create your own chat app, then you can do that by editing this code, but it's pretty complex!
// I'd recommend starting simpler if you're new to Perchance.
// Start with the tutorial:  perchance.org/tutorial
// Then check out this plugin and the examples linked on the plugin page:  perchance.org/ai-text-plugin

