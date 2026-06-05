
// ============================================
// AI CHARACTER CHAT — FILE MENTIONS MODULE
// ============================================
// Lets the user write @[filename.ext] to recall a file from File Explorer.
// Uses before-reply hook bus from core.
// ============================================

function __aeExtractFileMentions(text) {
  text = text || '';
  let result = [];
  let re = /@\[([^\]\n]{1,240})\]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    let name = (m[1] || '').trim();
    if (name) result.push(name);
  }
  return Array.from(new Set(result));
}

async function __aeBuildMentionContextForFile(file) {
  if (!file) return null;
  let text = file.fullText || file.preview || '';
  if (!text && typeof file.contextMessageId === 'number') {
    let msg = await db.messages.get(file.contextMessageId).catch(function() { return null; });
    if (msg && msg.message) text = msg.message;
  }
  if (!text) return null;
  return __aeBuildAiContextContent(file.kind || 'File', file.name, text, (file.metaText || '') + ' recalled by @mention');
}

__aeRegisterBeforeBotReplyHook('fileMentions', async function(opts) {
  if (!opts || !Array.isArray(opts.messages) || typeof opts.threadId !== 'number') return opts;

  let messages = opts.messages.filter(function(m) { return !(m.hiddenFrom && m.hiddenFrom.includes('ai')); });
  let lastUserMessage = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].characterId === -1 && messages[i].message) {
      lastUserMessage = messages[i];
      break;
    }
  }
  if (!lastUserMessage) return opts;

  let mentions = __aeExtractFileMentions(String(lastUserMessage.message || ''));
  if (mentions.length === 0) return opts;

  let contextBlocks = [];
  let unresolved = [];

  for (let mi = 0; mi < mentions.length; mi++) {
    let mentionName = mentions[mi];
    let found = await __aeFindUploadedFileByMention(mentionName, opts.threadId);
    if (found.file) {
      await __aeReactivateFileContext(found.file);
      let ctx = await __aeBuildMentionContextForFile(found.file);
      if (ctx) {
        contextBlocks.push(ctx);
        __aeToast('📎 Recalled file: ' + found.file.name, 2500);
      } else {
        unresolved.push(mentionName + ' (no stored preview/context)');
      }
    } else if (found.matches && found.matches.length > 1) {
      unresolved.push(mentionName + ' (ambiguous: ' + found.matches.map(function(f) { return f.name; }).slice(0, 5).join(', ') + ')');
    } else {
      unresolved.push(mentionName + ' (not found)');
    }
  }

  if (unresolved.length > 0) {
    contextBlocks.push('FILE MENTION RESOLUTION NOTES:\n' + unresolved.map(function(x) { return '- ' + x; }).join('\n'));
  }

  if (contextBlocks.length === 0) return opts;

  let newMessages = opts.messages.slice();
  let mentionMsg = __aeCreateTransientMessageObj({
    threadId: opts.threadId,
    message: contextBlocks.join('\n\n---\n\n'),
    characterId: -2,
    name: 'File Mention Context',
    expectsReply: false
  });

  let insertAt = newMessages.length;
  for (let j = newMessages.length - 1; j >= 0; j--) {
    if (newMessages[j].characterId === -1) { insertAt = j; break; }
  }
  newMessages.splice(insertAt, 0, mentionMsg);
  return Object.assign({}, opts, { messages: newMessages });
}, {priority:200});

console.log('[ae] File Mentions module loaded. Syntax: @[filename.ext]');
