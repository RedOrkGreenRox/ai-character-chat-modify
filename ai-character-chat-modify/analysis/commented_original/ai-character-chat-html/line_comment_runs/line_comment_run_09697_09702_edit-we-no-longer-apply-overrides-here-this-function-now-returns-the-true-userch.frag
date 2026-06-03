    // EDIT: we no longer apply overrides here. This function now returns the "true" userCharacter, and we apply overrides manually - via e.g. messageObjToCharacterName and messageObjToCharacterAvatar
    // // override with character and then thread-specific settings:
    // let thread = await db.threads.get(threadId);
    // let threadCharacter = await db.characters.get(thread.characterId);
    // applyObjectOverrides({object:characterObj, overrides:threadCharacter.userCharacter});
    // applyObjectOverrides({object:characterObj, overrides:thread.userCharacter});
