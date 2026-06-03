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
