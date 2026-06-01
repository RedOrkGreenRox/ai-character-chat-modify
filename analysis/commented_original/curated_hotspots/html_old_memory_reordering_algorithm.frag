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

                //     let isAfterPrevious = false;
                //     if(!isAfterPrevious) isAfterPrevious = lastSeenMessageId === originalMessageId && lastSeenLevel === originalLevel && lastSeenIndexWithinLevel === originalIndexWithinLevel+1;
                //     if(!isAfterPrevious) isAfterPrevious = lastSeenLevel === originalLevel && lastSeenIndexWithinLevel === originalIndexWithinLevel+1;

                //     if(messageIdLevelsChanged.has(originalMessageId+"|"+originalLevel) || !isAfterPrevious) {
                //       needsToBeAdded = true; // it's not currently *exactly* after the last seen id/level/index, so we need to move it to that position
                //       // set old position to null:
                //       memoriesIdsMovedOrDeleted.push(originalMemory.id);
                //       let message = await db.messages.get(originalMessageId);
                //       message.memoriesEndingHere[originalLevel][originalIndexWithinLevel] = null;
                //       await db.messages.update(originalMessageId, {memoriesEndingHere:message.memoriesEndingHere});
                //     }
                //   } else {
                //     needsToBeAdded = true; // doesn't exist, so we need to add it right after the last seen id/level/index position
                //   }
                //   if(needsToBeAdded) {
                //     let message = await db.messages.get(lastSeenMessageId);
                //     message.memoriesEndingHere[lastSeenLevel].splice(lastSeenIndexWithinLevel+1, 0, {text, embedding})
                //     lastSeenIndexWithinLevel = lastSeenIndexWithinLevel+1;
                //     messageIdLevelsChanged.add(lastSeenMessageId+"|"+lastSeenLevel); // so we know that positions have been 'messed up' in this array - i.e. originalIndexWithinLevel are no longer accurate in this id/level
                //     await db.messages.update(lastSeenMessageId, {memoriesEndingHere:message.memoriesEndingHere});
                //   } else {
                //     ([lastSeenMessageId, lastSeenLevel, lastSeenIndexWithinLevel] = originalMemory.id.split("|").map(n => Number(n)));
                //   }
                // }
                // debugger;
                // // remove gaps due to deleted memories that weren't due to edits
                // // (this code is not efficient, but that's fine for now - not hot path)
                // let alreadyRemovedGapsForMessageIds = new Set();
                // for(let id of memoriesIdsMovedOrDeleted) {
                //   let [messageId, level, _] = id.split("|").map(n => Number(n));
                //   if(alreadyRemovedGapsForMessageIds.has(messageId+"|"+level)) continue;
                //   alreadyRemovedGapsForMessageIds.add(messageId+"|"+level);
                //   let message = await db.messages.get(messageId);
                //   message.memoriesEndingHere[level] = message.memoriesEndingHere[level].filter(o => o);
                //   await db.messages.update(messageId, {memoriesEndingHere:message.memoriesEndingHere});
                // }
