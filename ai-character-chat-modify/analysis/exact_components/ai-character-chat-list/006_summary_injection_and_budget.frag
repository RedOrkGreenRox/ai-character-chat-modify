async injectHierarchicalSummariesAndComputeNextSummariesInBackgroundIfNeeded(threadId, opts) =>
  // HEADS UP: This function is a bit confusing/convoluted, in part because it was "ported" from /ai-chat
  // which uses a plain textarea instead of an IndexedDB database of actual message objects.
  if(!window.__aiHierarchicalSummaryStuff) window.__aiHierarchicalSummaryStuff = {};
  if(!window.__aiHierarchicalSummaryStuff[threadId]) {
    window.__aiHierarchicalSummaryStuff[threadId] = {};
    window.__aiHierarchicalSummaryStuff[threadId].summariesReadyToInject = [];
  }
  if(!opts) opts = {};

  // IMPORTANT: these messages will not have the latest N summaries (where N is defined below) in their summariesEndingHere property because we withhold them (see code below) until we have a few of them so that prefix cache invalidation doesn't happen every step.
  let originalMessages = await db.messages.where({threadId}).toArray();

  let idToOriginalMessage = originalMessages.reduce((a,v) => (a[v.id]=v, a), {});
  let preparedMessages = await prepareMessagesForBot({messages:originalMessages})
  for(let m of preparedMessages) {
    let originalMessage = idToOriginalMessage[m.id];
    if(originalMessage.summariesEndingHere) m.summariesEndingHere = originalMessage.summariesEndingHere;
  }

  let thread = await db.threads.get(threadId);
  let threadCharacter = await db.characters.get(thread.characterId);
  let userName = thread.userCharacter.name ?? threadCharacter.userCharacter.name ?? (await getUserCharacterObj()).name;
  let characterName = thread.character.name ?? threadCharacter.name;
  let roleInstruction = threadCharacter.roleInstruction.replaceAll("{{char}}", characterName).replaceAll("{{user}}", userName);
  let extraContext = `In case it's useful here's a description of the **${characterName}** character: `+roleInstruction.replace(/\n+/g, " ");

  let idToPreparedMessage = preparedMessages.reduce((a,v) => (a[v.id]=v, a), {});

  // inject summaries if we have any - NOTE: we inject them into the preparedMessages *regardless* of whether we actually inject them into the DB (see note below on prefix cache stuff), since the next summary to be computed needs to have a completely up-to-date version of the messages - otherwise it'll repeat summaries that it has already done.
  if(window.__aiHierarchicalSummaryStuff[threadId].summariesReadyToInject.length > 0) {
    // NOTE: lastMessageSummarizedId is the id of the message object, but one of that objects *summaries* (i.e. `message.summary[level]`) may have been what was actually last summarized
    let messagesToUpdate = new Set();
    for(let {summarizedMessages, lastMessageSummarizedId, summary, memories, level} of window.__aiHierarchicalSummaryStuff[threadId].summariesReadyToInject) {
      if(level <= 0) { console.error("summary level should be 1 or higher"); continue; }
      let lastSummarizedMessageText = summarizedMessages[summarizedMessages.length-1];
      let lastMessageObjInSummary = idToPreparedMessage[lastMessageSummarizedId];
      if(!lastMessageObjInSummary) {
        console.error(`!lastMessageObjInSummary ???? either the lastMessageSummarizedId is somehow wrong, or the original message no longer exists? custom code manipulating messages (specifically ids, maybe? or just deleted old message?)`, {preparedMessages, idToPreparedMessage, lastMessageSummarizedId});
        continue;
      }
      let expectedLastSummarizedText = level===1 ? `${lastMessageObjInSummary.name}: ${lastMessageObjInSummary.content}` : lastMessageObjInSummary.summariesEndingHere[level-1];
      if(expectedLastSummarizedText.trim() === lastSummarizedMessageText.trim()) { // mainly as a safety check in case of algorithm bugs, since we're only checking the *last* message
        let m = lastMessageObjInSummary;
        if(!m.summariesEndingHere) m.summariesEndingHere = {};
        m.summariesEndingHere[level] = summary;
        if(memories) {
          // NOTE: as of writing, we only do memory creation at a single level. But I'm making memoriesEndingHere a level-keyed object like summariesEndingHere just in case I end up adding 'multi-level' memories at some point.
          if(!m.memoriesEndingHere) m.memoriesEndingHere = {};
          if(!m.memoriesEndingHere[level]) m.memoriesEndingHere[level] = [];
          m.memoriesEndingHere[level].push(...(memories || []).map(memText => ({text:memText, embedding:null}))); // NOTE: this code gets run even when we're not injecting the updates from messagesToUpdate into the database. So we don't compute embedding here, because it's not needed for summary process, and this will get run every time this function is called, so we'd end up embedding the text multiple times for no reason. So instead we only do the embedding when we actually inject memories into the database (see window.embedTexts call below).
        }
        messagesToUpdate.add(m);
      } else {
        console.warn("Content of last-summmarized-message doesn't match content of message at lastMessageSummarizedId. Safe to ignore this warning if messages have been edited since last 'send' button click. This summary will simply be discarded and we'll compute a new one with the up-to-date messages.");
      }
    }
    // IMPORTANT: we only inject summaries into the actual database if we have more than N of them, to reduce prefix cache invalidation.
    if(window.__aiHierarchicalSummaryStuff[threadId].summariesReadyToInject.length >= 3) { // CAUTION: if you make this number higher, you might need to subtract more from idealMaxContextTokens, below. Otherwise middle-out stuff will do its own prefix cache invalidation.
      for(let m of messagesToUpdate) {
        // now that we're actually going to inject memories into the database, we compute the embeddings:
        if(window.textEmbedderFunction) { // can't save memories if the user's browser can't load the text embedder model (for whatever reason)
          if(m.memoriesEndingHere) {
            for(let level in m.memoriesEndingHere) {
              for(let memory of m.memoriesEndingHere[level]) {
                if(!memory.embedding) {
                  let [ embedding ] = await window.embedTexts({textArr:[memory.text], modelName:thread.textEmbeddingModelName});
                  memory.embedding = embedding;
                }
              }
            }
          }
        }
        let updateObj = {summariesEndingHere: m.summariesEndingHere};
        if(window.textEmbedderFunction) {
          if(m.memoriesEndingHere) updateObj.memoriesEndingHere = m.memoriesEndingHere;
        }
        await db.messages.update(m.id, updateObj);
      }
      window.__aiHierarchicalSummaryStuff[threadId].summariesReadyToInject = [];
    }
  }

  const { countTokens, idealMaxContextTokens } = root.aiTextPlugin({getMetaObject:true});
  let tokenCountToIdeallyStayUnder = idealMaxContextTokens-800; // leave buffer to allow for only intermittent summary injection (to prevent prefix cache invalidation after ~every message)

  const numCharsToSummarizeAtATime = 1500; // don't make this bigger without testing - IIRC, the summary calls to the AI could have context too large (causing implicit middle-out ablation) at when the summary hierarchy gets "deep"

  const messageTextWithSummaryReplacements = root.getMessageObjsWithoutSummarizedOnes(preparedMessages).map(m => {
    let level = m.summariesEndingHere ? Math.max(...Object.keys(m.summariesEndingHere).map(n => Number(n))) : 0;
    if(level === 0) return m.content;
    else return m.summariesEndingHere[level];
  });

  let currentlyUsedContextLength = countTokens(messageTextWithSummaryReplacements.join("\n\n") + (opts.extraTextForAccurateTokenCount || ""));
  if(currentlyUsedContextLength < tokenCountToIdeallyStayUnder) {
    console.log(`Summarization NOT needed. currentlyUsedContextLength=${currentlyUsedContextLength} which is less than ${tokenCountToIdeallyStayUnder}`, messageTextWithSummaryReplacements);
    window.summarizationWasNeededLastCheck = false;
    return;
  } else {
    console.log(`Summarization IS needed. currentlyUsedContextLength=${currentlyUsedContextLength} which is greater than ${tokenCountToIdeallyStayUnder}`, messageTextWithSummaryReplacements);
    window.summarizationWasNeededLastCheck = true;
  }

  // compute next summary in background if needed:
  (async function() {
    if(window.__aiHierarchicalSummaryStuff[threadId].alreadyDoingSummary) return;
    try {
      window.__aiHierarchicalSummaryStuff[threadId].alreadyDoingSummary = true;

      const allMessageObjs = [];
      let i = 0;
      for(let m of preparedMessages) {
        allMessageObjs.push({
          text: `${m.name}: ${m.content}`, // WARNING: if you change the format of this, you need to change the `expectedLastSummarizedText` check, above, since they need to *exactly* match for the sanity check to pass
          index: i++,
          messageId: m.id,
          level: 0,
        });
        let summaryEntries = Object.entries(m.summariesEndingHere || {}).sort((a,b) => Number(a[0])-Number(b[0]));
        for(let [level, summary] of summaryEntries) {
          level = Number(level);
          allMessageObjs.push({
            text: summary,
            index: i++,
            messageId: m.id,
            level,
          });
        }
      }

      // conceptually we treat each "level" just like the first.
      // the first level is just a bunch of messages with interspersed "SUMMARY^1: ..." messages, where the summary messages are a summary of the messages before them, up to the *previous* "SUMMARY^1: ..." message.
      // so for the next level, we just delete/ignore the ^0 messages (i.e. the *actual* messages), and do exactly the same thing - i.e. treat "SUMMARY^1: ..." as if they were "messages" and "SUMMARY^2: ..." are the summaries of those "messages".

      let summaryLevelToMessageBlocks = new Map();
      let summaryLevelBeingProcessed = 1;
      while(1) {
        // grab messages that are relevant to this 'level' (i.e. only this level and lower one):
        const thisLevelAndPreviousLevelMessageObjs = allMessageObjs.filter(m => m.level === summaryLevelBeingProcessed || m.level === summaryLevelBeingProcessed-1);

        if(thisLevelAndPreviousLevelMessageObjs.length === 0) {
          console.log("Finished creating summaryLevelToMessageBlocks.");
          break;
        }

        // get all summary 'blocks' (i.e. groups of messages ending with a summary message of this `level` that summarizes them, except for final block which doesn't have a summary at the end)
        const blocks = [];
        let currentBlock = [];
        currentBlock.messageData = []; // data for each message, in same order as the messages in the block
        for(let m of thisLevelAndPreviousLevelMessageObjs) {
          currentBlock.push(m.text);
          currentBlock.messageData.push(m);
          if(m.level === summaryLevelBeingProcessed) {
            blocks.push(currentBlock);
            currentBlock = [];
            currentBlock.messageData = [];
          }
        }
        if(summaryLevelBeingProcessed === 1 && currentBlock.length === 0) {
          console.warn("final block for summaryLevel==1 should have messages? if it doesn't, then we're maybe summarizing too close to the end of the chat log?");
        }
        blocks.push(currentBlock); // final block doesn't have a summary at the end
        summaryLevelToMessageBlocks.set(summaryLevelBeingProcessed, blocks);

        summaryLevelBeingProcessed++;
      }

      const summaryLevelBlockEntries = [...summaryLevelToMessageBlocks.entries()].sort((a,b) => a[0]-b[0]); // ascending order
      for(let [summaryLevel, blocks] of summaryLevelBlockEntries) {

        // note: a block is just an array of messages, and all of them have a summary message (i.e. higher-level message) at the end EXCEPT the last block - we're in the process of adding that summary message here.
        // but also note: the block has a messageData property which is also an array (see above)
        let messagesToSummarizeFromFinalBlock = blocks[blocks.length-1];

        // note that we can use numCharsToSummarizeAtATime here even for the first level without worrying about summarizing too close to the end of the chat because we have a currentlyUsedContextLength check before running this summarization process.
        let numCharsInFinalBlock = messagesToSummarizeFromFinalBlock.reduce((a,v) => a+v.length, 0);
        if(numCharsInFinalBlock < numCharsToSummarizeAtATime) {
          console.log(`summaryLevel=${summaryLevel} doesn't need summarizing yet. numCharsInFinalBlock=${numCharsInFinalBlock}`);
          continue;
        }

        // remove messages from last block (which contains all messages after the last summary) until it's a good size for summarization:
        while(1) {
          if(messagesToSummarizeFromFinalBlock.length <= 1) break;
          let numChars = messagesToSummarizeFromFinalBlock.reduce((a,v) => a+v.length, 0);
          if(numChars < numCharsToSummarizeAtATime) break;

          // to speed things up, drop latter half if it's way too big:
          if(numChars > numCharsToSummarizeAtATime*10) {
            let halfOfMessagesCount = Math.floor(messagesToSummarizeFromFinalBlock.length/2);
            for(let j = 0; j < halfOfMessagesCount; j++) {
              messagesToSummarizeFromFinalBlock.pop();
              messagesToSummarizeFromFinalBlock.messageData.pop();
            }
          } else {
            messagesToSummarizeFromFinalBlock.pop();
            messagesToSummarizeFromFinalBlock.messageData.pop();
          }
        }

        if(messagesToSummarizeFromFinalBlock.length === 0) {
          console.error("No messages to summarize??");
          continue;
        }

        // let existingSummary = window.__aiHierarchicalSummaryStuff[threadId].summariesReadyToInject.filter(s => s.summarizedMessages.join("\n\n") === messagesToSummarizeFromFinalBlock.join("\n\n"))[0];
        // if(existingSummary) {
        //   console.error("Existing summary hasn't been injected yet?? Should have happened before this code ran.");
        //   return;
        // }

        // Note: It may seem brittle to choose an *index* to inject the summary at, but we also check to ensure the previous message matches.
        // And if the text has since been edited, that's fine - the summary just gets thrown away and we re-do it next time the send button is clicked.
        let lastMessageSummarizedData = messagesToSummarizeFromFinalBlock.messageData[messagesToSummarizeFromFinalBlock.length-1];
        let lastMessageSummarizedIndex = lastMessageSummarizedData.index;
        let lastMessageSummarizedId = lastMessageSummarizedData.messageId;
        if(messagesToSummarizeFromFinalBlock.messageData.length !== messagesToSummarizeFromFinalBlock.length) { console.error("should be one data object per message (aligned)"); return; }

        let exampleBlocksForStartWith = blocks.slice(-3, -1);
        let exampleBlockSummaries = exampleBlocksForStartWith.map(b => b[b.length-1]);

        // we get all messages for this summary level and above for placement in instruction (i.e. as context to help with summarization):
        let summariesAtThisLevelAndAbove = root.getMessageObjsWithoutSummarizedOnes(preparedMessages, {minimumMessageLevel:summaryLevel}).map(m => {
          let level = m.summariesEndingHere ? Math.max(...Object.keys(m.summariesEndingHere).map(n => Number(n))) : 0;
          if(level === 0) return m.content;
          else return m.summariesEndingHere[level];
        });

        // note that we can't just remove the last two instruction summaries here - they aren't necessarily the same as the summaries from the `exampleBlocksForStartWith` because they may have been 'compressed' into a higher level, so there can actually be no overlap at all.
        // so we need to pop the instructionSummaries off based on the ones that are actually in the example blocks:
        let instructionSummaries = JSON.parse(JSON.stringify(summariesAtThisLevelAndAbove));
