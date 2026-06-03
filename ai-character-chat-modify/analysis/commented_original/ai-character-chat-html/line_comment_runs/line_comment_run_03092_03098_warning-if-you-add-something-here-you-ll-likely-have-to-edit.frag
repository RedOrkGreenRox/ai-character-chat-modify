    // WARNING: If you add something here, you'll likely have to edit:
    //  - characterDetailsPrompt (characterDetailsPrompt should return a valid character object - addCharacter only adds creationTime and lastMessageTime, so characterDetailsPrompt should fill in everything else, even if it's not visible in the editor)
    //  - getUserCharacterObj
    //  - getSystemCharacterObj
    //  - characterPropertiesVisibleToCustomCode
    //  - addThread - (EDIT: the following comment is no longer true - we don't copy scene/userCharacter/etc. over at start of thread) for things like `character.scene` where it's copied over to the thread at the start, and custom code can only edit it from there
    //  - the "share link" creation code (if you add any other private/user-specific data like id, lastMessageTime, etc.)
