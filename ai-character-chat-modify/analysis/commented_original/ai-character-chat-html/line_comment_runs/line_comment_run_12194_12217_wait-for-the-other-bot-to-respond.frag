  //     // // wait for the other bot to respond
  //     // while(1) {
  //     //   await delay(100);
  //     //   let messages = await db.messages.where("threadId").equals(threadId).toArray();
  //     //   messages.sort((a,b) => a.order - b.order);
  //     //   // get characterId of this thread
  //     //   let thread = await db.threads.get(threadId);
  //     //   let thisThreadCharacterId = thread.characterId;
  //     //   let lastMessage = messages[messages.length-1];
  //     //   if(lastMessage.characterId === thisThreadCharacterId) {
  //     //     if(ttsEnabled) {
  //     //       let sentences = lastMessage.message.match(/[^\.!\?]+[\.!\?]+/g);
  //     //       for(let sentence of sentences) {
  //     //         let result = await textToSpeech({text: sentence, voiceName: threadCharVoiceName}).catch(e => {
  //     //           console.error(e);
  //     //           alert("There was an error with speech synthesis. You may need to close this tab and re-open it (not just refresh) if you're using Chrome due to a weird bug that sometimes causes this.\n\n"+e.toString());
  //     //           return false;
  //     //         });
  //     //         if(result === false) break;
  //     //       }
  //     //     }
  //     //     break;
  //     //   }
  //     // }
