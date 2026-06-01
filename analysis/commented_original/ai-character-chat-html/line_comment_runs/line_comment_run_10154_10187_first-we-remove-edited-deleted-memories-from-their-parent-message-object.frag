                // // first we remove edited/deleted memories from their parent message object:
                // let memoriesIdsMovedOrDeleted = [];
                // for(let i = 0; i < originalMemories.length; i++) {
                //   let memoryObj = originalMemories[i];
                //   if(!newMemoriesTextArr.includes(memoryObj.text)) {
                //     memoriesIdsMovedOrDeleted.push(memoryObj.id);
                //     let [messageId, level, indexWithinLevel] = memoryObj
                //     let message = await db.messages.get(messageId);
                //     message.memoriesEndingHere[level][indexWithinLevel] = null;
                //     await db.messages.update(messageId, {memoriesEndingHere:message.memoriesEndingHere});
                //   }
                // }
                // debugger;
                // // we make the assumption that the first entry goes in the same position as the original first one, so if it's different, we need to update it:
                // if(newMemoriesTextArr[0] !== originalMemories[0].text) {
                //   let [messageId, level, indexWithinLevel] = originalMemories[0].id.split("|").map(n => Number(n));
                //   let embedding = textToEmbeddingCache.get(newMemoriesTextArr[0]);
                //   if(!embedding) throw new Error("Text embedding should have been precomputed and cached. Code:1");
                //   let message = await db.messages.get(messageId);
                //   message.memoriesEndingHere[level][indexWithinLevel] = {text:newMemoriesTextArr[0], embedding};
                //   await db.messages.update(messageId, {memoriesEndingHere:message.memoriesEndingHere});
                // }
                // // newly added/edited memories get added into the same message/level as the last seen existing memory object.
                // // we use the first 'null' spot (else put at end) because the deleted ones above will create null spots for new versions of that same entry.
                // let [lastSeenMessageId, lastSeenLevel, lastSeenIndexWithinLevel] = originalMemories[0].id.split("|").map(n => Number(n));
                // let messageIdLevelsChanged = new Set();
                // for(let i = 1; i < newMemoriesTextArr.length; i++) {
                //   let text = newMemoriesTextArr[i];
                //   let embedding = textToEmbeddingCache.get(text);
                //   if(!embedding) throw new Error("Text embedding should have been precomputed and cached. Code:2");
                //   let originalMemory = textToOriginalMemory.get(text);
                //   let needsToBeAdded = false;
                //   if(originalMemory) {
                //     let [originalMessageId, originalLevel, originalIndexWithinLevel] = originalMemory.id.split("|").map(n => Number(n));
