    // EDIT: Commented these out because doBotReplyInPlaceOfUser is now only for the actual user character - others use doBotReplyIfNeeded with the `characterOverride` parameter.
    // And this was wrong anyway because you can't e.g. put a thread-external character's avatar in a message - it could have a data URL, which would make each message huge, and bloat the database.
    // messageObj.name = messageObjToCharacterName(messageObj, {thread, character:characterToReplyWith, threadCharacter}); // was previously: `characterToReplyWith.name` which I'm quite sure is wrong
    // messageObj.avatar = messageObjToCharacterAvatar(messageObj, {thread, character:characterToReplyWith, threadCharacter}); // was previously: `structuredClone(characterToReplyWith.avatar)`
