  //   let characterToReplyWith = await db.characters.get(parseInt(promptResult.characterId));
  //   let repeat = parseInt(promptResult.repeat);
  //   let i = 0;
  //   let signals, result;
  //   while(i < repeat) {
  //     signals = {stop:false, wasDeleted:false};
  //     result = {};
  //     let success = await doBotReplyInPlaceOfUser({characterToReplyWith, signals, result});
  //     if(!success) break;
