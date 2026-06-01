getMessageObjsWithoutSummarizedOnes(messages, opts) =>
  if(!opts) opts = {};
  messages = messages.slice(0);
  const minimumMessageLevel = opts.minimumMessageLevel || 0; // used by the summarization process.

  let messageObjsWithoutSummarizedOnes = [];
  let highestLevelSeen = 0;

  // it's we go backwards through the messages, and only 'collect' a message if its level is not below the highest level we've seen so far. it makes sense if you think about it for a bit.
  // said another way, we go from the end of the messages to the start while 'monotonically climbing' up a level whenever we hit a 'higher' message.
  while(messages.length > 0) {
    let m = messages.pop();
    let level = m.summariesEndingHere ? Math.max(...Object.keys(m.summariesEndingHere).map(n => Number(n))) : 0;
    if(level < minimumMessageLevel) continue;
    if(level >= highestLevelSeen) {
      messageObjsWithoutSummarizedOnes.unshift(m);
      highestLevelSeen = level;
    }
  }
  return messageObjsWithoutSummarizedOnes; // NOTE: that this returns the message objects - when actually using for inference, you need to **use the highest level summary available within each message** (or the message text itself if `message.summariesEndingHere` is undefined)

