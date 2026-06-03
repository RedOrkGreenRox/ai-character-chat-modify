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
