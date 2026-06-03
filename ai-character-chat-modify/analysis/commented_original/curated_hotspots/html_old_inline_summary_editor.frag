  // function createInlineSummaryEditor(summaryText) {
  //   let tmp = document.createElement("div");
  //   if(summaryText.length > 50) summaryText = summaryText.slice(0, 30) + "…";
  //   tmp.innerHTML = `
  //     <div class="inlineSummaryEditor" style="margin-bottom: 0.25rem;">
  //       <div style="opacity: 0.5;font-size: 0.7rem;text-align: center;"><b>Summary so far:</b> <span>${summaryText}</span> <span class="inlineSummaryEditButton" style="cursor: pointer;">✏️</span></div>
  //     </div>
  //   `;
  //   let el = tmp.firstElementChild;
  //   el.querySelector(".inlineSummaryEditButton").addEventListener("click", async function() {
  //     let threadSummariesArr = await db.summaries.where('threadId').equals(threadId).toArray();
  //     let latestSummary = threadSummariesArr.sort((a,b) => b.id-a.id)[0];
  //     let result = await prompt2({
  //       summaryText: {label: "Summary of preceding messages:", height:"fit-content", type: "text", defaultValue: reminderMessage, placeholder: "Write your summary here."}
  //     });
  //     if(result) {
  //       await db.summaries.update(characterId, {reminderMessage:result.reminderMessage});
  //       await updateInlineSummaryEditor();
  //     }
  //   });
  //   return el;
  // }

  // async function updateInlineSummaryEditor() {
  //   $.messageFeed.querySelectorAll(".inlineSummaryEditor").forEach(el => el.remove());
  //   let threadId = activeThreadId;
  //   let threadSummariesArr = await db.summaries.where('threadId').equals(threadId).toArray();
  //   let messagesArr = await db.messages.where('threadId').equals(threadId).toArray();
  //   let undeletedMessageIds = messagesArr.map(m => m.id);
  //   let latestSummaryObj = threadSummariesArr.sort((a,b) => b.id-a.id)[0];

  //   if(!latestSummaryObj) {
  //     return;
  //   }
  //   let latestMessage = botMessages.at(-1);
  //   let el = createInlineSummaryEditor(latestSummaryObj);
  //   lastBotMessageEl.before(el);
  // }
