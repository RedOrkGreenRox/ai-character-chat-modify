  //   tokenLimit -= await countTokens(roleInstruction, thread.modelName); // allow for system message tokens
  //   tokenLimit -= await countTokens( "("+(reminderMessage||"")+")" , thread.modelName); // allow for reminder message tokens
  //   tokenLimit -= Math.round(maxTokenLimit*0.15); // allow for bot response
  //   if(await threadHasMemoriesOrLore(thread.id)) {
  //     tokenLimit -= Math.round(maxTokenLimit*retrievedMemoriesTokenLimitFraction); // allow for retrieved memories
  //   }
  //   return tokenLimit;
  // }
