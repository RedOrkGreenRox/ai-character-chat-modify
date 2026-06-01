  // async function updateInlineSummaryEditor() {
  //   $.messageFeed.querySelectorAll(".inlineSummaryEditor").forEach(el => el.remove());
  //   let threadId = activeThreadId;
  //   let threadSummariesArr = await db.summaries.where('threadId').equals(threadId).toArray();
  //   let messagesArr = await db.messages.where('threadId').equals(threadId).toArray();
  //   let undeletedMessageIds = messagesArr.map(m => m.id);
  //   let latestSummaryObj = threadSummariesArr.sort((a,b) => b.id-a.id)[0];
