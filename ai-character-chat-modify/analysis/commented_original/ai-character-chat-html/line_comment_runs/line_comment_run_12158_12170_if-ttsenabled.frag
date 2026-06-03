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
