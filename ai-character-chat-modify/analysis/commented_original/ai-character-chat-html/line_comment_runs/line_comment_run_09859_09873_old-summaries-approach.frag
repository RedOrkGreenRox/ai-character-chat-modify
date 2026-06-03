          // OLD SUMMARIES APPROACH:
          // // first ensure summary is up to date:
          // let loadingModal = createLoadingModal("Please wait...");
          // const onProgressMessage = (e) => loadingModal.updateContent("Please wait... "+e.message);
          // let {summary, instructionHash, remainingMessages} = await computeAndSaveThreadSummaryIfNeeded({threadId, onProgressMessage});
          // loadingModal.delete();
          // if(summary === undefined) {
          //   return alert("No summary available for this thread yet. Wait until the thread gets longer.");
          // }
          // // now let them edit it:
          // let result = await prompt2({summary: {label: "Summary:", type: "text", height:"fit-content", defaultValue: summary, focus:true}});
          // if(result) {
          //   await db.summaries.update(instructionHash, {summary:result.summary});
          //   addToDebugLog(`<b>edited summary:</b> ${result.summary}`);
          // }
