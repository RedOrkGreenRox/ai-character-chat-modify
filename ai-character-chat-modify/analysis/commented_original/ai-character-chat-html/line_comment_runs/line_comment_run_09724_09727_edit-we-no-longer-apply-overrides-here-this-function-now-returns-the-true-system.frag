    // EDIT: we no longer apply overrides here. This function now returns the "true" systemCharacter, and we apply overrides manually - via e.g. messageObjToCharacterName and messageObjToCharacterAvatar
    // override with character and then thread-specific settings:
    // let thread = await db.threads.get(threadId);
    // applyObjectOverrides({object:characterObj, overrides:thread.systemCharacter});
