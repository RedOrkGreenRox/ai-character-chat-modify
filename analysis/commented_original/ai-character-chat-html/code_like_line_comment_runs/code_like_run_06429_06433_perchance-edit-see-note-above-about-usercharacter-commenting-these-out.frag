    // PERCHANCE EDIT: See note above about userCharacter. Commenting these out.
    // when a thread is first created, we copy across the character's userCharacter as a starting point for the `thread.userCharacter` - after that, the `threadCharacter.userCharacter` is not relevant to the thread (i.e. thread's userCharacter can diverge from the character's 'template' userCharacter)
    // applyObjectOverrides({object:threadObj.userCharacter, overrides:threadCharacter.userCharacter});
    // same for systemCharacter
    // applyObjectOverrides({object:threadObj.systemCharacter, overrides:threadCharacter.systemCharacter});
