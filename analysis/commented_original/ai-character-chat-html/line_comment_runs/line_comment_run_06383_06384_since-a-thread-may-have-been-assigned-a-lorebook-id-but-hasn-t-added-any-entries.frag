    // since a thread may have been assigned a lorebook id, but hasn't added any entries to it, we need to check if there's a higher loreBookId already assigned to a thread.
    // TODO: this may become an annoying cause of lag when creating a thread. Easy fix would just be to do some caching stuff.
