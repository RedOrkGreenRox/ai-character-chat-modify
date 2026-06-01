//     let loreBookIdEntries = await db.lore.where({bookId:thread.loreBookId}).count();
//     let loreBookUrlEntries = await db.lore.where("bookUrl").anyOf(character.loreBookUrls).count();
//     let memories = await db.memories.where({threadId, status:"current"}).count();
