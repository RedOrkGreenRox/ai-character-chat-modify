  // $.replyLoopButton.addEventListener("click", async function() {

  // });

  // let alreadyAutoReplying = false;
  // $.replyWithButton.addEventListener("click", async function() {
  //   if(alreadyAutoReplying) {
  //     return;
  //   }
  //   alreadyAutoReplying = true;
  //   $.sendButton.disabled = true;
  //   $.replyWithButton.disabled = true;

  //   let threadId = activeThreadId;

  //   let availableVoiceNames = speechSynthesis.getVoices().map(v => v.name).sort((a,b) => a.toLowerCase().includes("english") ? -1 : 1);

  //   // get list of characters, sorting by lastMessageTime
  //   const characters = await db.characters.orderBy("lastMessageTime").reverse().toArray();
  //   const promptResult = await prompt2({
  //     characterId: {label: "Choose a character to reply with:", type: "select", options:characters.map(c => ({content:`${c.name} #${c.id}`, value:c.id}))},
  //     repeat: {label: "How many replies?", type: "textLine", defaultValue: "10"},
  //     textToSpeechVoicesEnabled: {label: "Text-to-Speech Voices?", type: "select", options: [{content: "Disabled", value: "disabled"}, {content: "Enabled", value: "enabled"}]},
  //     threadCharVoiceName: {show:d=>d.textToSpeechVoicesEnabled==="enabled", label: "Existing chatacter voice:", type: "select", options:availableVoiceNames.map(v => ({content: v, value: v})) },
  //     otherCharVoiceName: {show:d=>d.textToSpeechVoicesEnabled==="enabled", label: "Reply-with character voice:", type: "select", options:availableVoiceNames.map(v => ({content: v, value: v})) },
  //   });
  //   if(!promptResult) {
  //     alreadyAutoReplying = false;
  //     $.replyWithButton.disabled = false;
  //     $.sendButton.disabled = false;
  //     return;
  //   }

  //   let ttsEnabled = promptResult.textToSpeechVoicesEnabled === "enabled";
  //   let threadCharVoiceName = promptResult.threadCharVoiceName;
  //   let otherCharVoiceName = promptResult.otherCharVoiceName;

  //   let characterToReplyWith = await db.characters.get(parseInt(promptResult.characterId));
  //   let repeat = parseInt(promptResult.repeat);
  //   let i = 0;
  //   let signals, result;
  //   while(i < repeat) {
  //     signals = {stop:false, wasDeleted:false};
  //     result = {};
  //     let success = await doBotReplyInPlaceOfUser({characterToReplyWith, signals, result});
  //     if(!success) break;

  //     if(signals.stop) {
  //       break;
  //     }

  //     if(threadId !== activeThreadId) {
  //       break; // if the user clicked into a different thread, stop replying
  //     }

  //     if(ttsEnabled) {
  //       // chrome has a bug that occurs if you try to speak text that's too long
  //       // so we split message up into sentences and speak each one
  //       let sentences = result.message.match(/[^\.!\?]+[\.!\?]+/g)?.map(s => s.trim()) ?? [result.message];
  //       for(let sentence of sentences) {
  //         let result = await textToSpeech({text: sentence, voiceName: otherCharVoiceName}).catch(e => {
  //           console.error(e);
  //           alert("There was an error with speech synthesis. You may need to close this tab and re-open it (not just refresh) if you're using Chrome due to a weird bug that sometimes causes this.\n\n"+e.toString());
  //           return false;
  //         });
  //         if(result === false) break;
  //       }
  //     }

  //     await delay(100);

  //     signals = {stop:false, wasDeleted:false};
  //     result = {};
  //     await doBotReplyIfNeeded({signals, result});

  //     if(signals.stop) {
  //       break;
  //     }

  //     if(ttsEnabled) {
  //       let sentences = result.message.match(/[^\.!\?]+[\.!\?]+/g)?.map(s => s.trim()) ?? [result.message];
  //       for(let sentence of sentences) {
  //         let result = await textToSpeech({text: sentence, voiceName: threadCharVoiceName}).catch(e => {
  //           console.error(e);
  //           alert("There was an error with speech synthesis. You may need to close this tab and re-open it (not just refresh) if you're using Chrome due to a weird bug that sometimes causes this.\n\n"+e.toString());
  //           return false;
  //         });
  //         if(result === false) break;
  //       }
  //     }

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

  //     i++;
  //   }
  //   alreadyAutoReplying = false;
  //   $.replyWithButton.disabled = false;
  //   $.sendButton.disabled = false;
  // });
