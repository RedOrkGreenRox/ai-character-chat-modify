  // function createMemoryIdToIndexMapFromAllMemories(memories) {
  //   // each memory has `nextMemoryId` and `previousMemoryId`, but we need to convert to `index` format.
  //   // we need to create a map of memory.id -> index
  //   // but first we need to group all memories by their threadId
  //   let memoriesByThreadId = {};
  //   for(let memory of memories) {
  //     if(memory.type === "user-written") continue; // <-- these don't have an order/index, and are being moved to the lore table
  //     if(!memoriesByThreadId[memory.threadId]) memoriesByThreadId[memory.threadId] = [];
  //     memoriesByThreadId[memory.threadId].push(memory);
  //   }
  //   // now for each thread's memories we follow the `previousMemoryId`/`nextMemoryId` chain to sort them
  //   // the first memory in the chain will have previousMemoryId==-1, so we get that first, and then crawl through:
  //   let memoryIdToIndexMap = {};
  //   for(let threadId of Object.keys(memoriesByThreadId)) {
  //     let threadMemories = memoriesByThreadId[threadId];
  //     threadMemories.sort((a,b) => a.id - b.id);
  //     for(let i = 0; i < threadMemories.length; i++) {
  //       memoryIdToIndexMap[threadMemories[i].id] = i;
  //     }
