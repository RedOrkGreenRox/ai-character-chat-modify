      // PERCHANCE EDIT: it doesn't make sense to "fix" the thread-specific user character *overrides* to the *global* defaults, so i'm commenting this out and fixing all the fallout
      // userCharacter: { // note: we don't use await getUserCharacterObj because that is for *existing* threads (requires threadId as input param)
      //   name: (await db.misc.get("userName"))?.value || defaultUserName,
      //   avatar: {
      //     url: (await db.misc.get("userAvatarUrl"))?.value || "",
      //     // we leave `shape` and `size` as thread default
      //   },
      // },
