  // Someone mentioned that their power went out while they were using it, and the error message they gave seems to indicate that an item in `await db.characters.toArray()` was null.
  // So this is a hack to ensure that sort of failure isn't a problem (hopefully it doesn't affect queries...)
