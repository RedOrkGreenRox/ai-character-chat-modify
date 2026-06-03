          // async function regenerateMemoriesHandler() {
          //   if(!confirm("This will DELETE all MEMORIES. Fresh memories will be regenerated during your character's next reply, which could take a *long* time if the chat thread is long. Are you sure you want to delete all memories?")) return;
          //   let { instructionHashChain } = await computeAndSaveThreadSummaryIfNeeded({threadId, exitOnFirstHashMissAndReturnHashChain:true});
          //   await db.transaction('rw', [db.summaries, db.memories], async tx => {
          //     await tx.table("summaries").where("hash").anyOf(instructionHashChain).delete();
          //     await tx.table("memories").where({threadId}).delete();
          //   });
          //   controls.cancel();
          // }
