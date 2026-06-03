      // replace messages in the database with the new messages
      // we need to make sure that no other db.messages code runs between .delete and .bulkAdd, so we use a transaction that gets a read-write lock on the messages table.
      // otherwise e.g. another call to updateDbWithNewDataFromCustomCode could run between them, and that would cause `db.messages.where("threadId").equals(threadId).toArray()` to incorrectly return zero messages.
