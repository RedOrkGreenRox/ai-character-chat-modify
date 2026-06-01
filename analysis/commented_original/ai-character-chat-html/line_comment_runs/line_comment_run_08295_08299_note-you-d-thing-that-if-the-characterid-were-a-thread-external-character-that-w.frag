      // NOTE: You'd thing that if the characterId were a thread-external character, that we'd write that character's name/avatar
      // into the message object itself, but we don't do that because it causes problems - e.g. if the character's avatar is a data URL
      // then we end up bloating the database very quickly with lots of duplicate data. I probably should have the concept of "character assets"
      // or something to solve this. But for now, the source of truth remains *that thread-external character*, which does mean that if they delete it
      // their threads that include that character won't be able to load the 'correct' name/avatar for some messages.
