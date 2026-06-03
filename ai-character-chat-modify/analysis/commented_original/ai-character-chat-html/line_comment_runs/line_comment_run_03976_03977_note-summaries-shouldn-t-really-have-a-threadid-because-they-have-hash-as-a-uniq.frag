      // note: summaries shouldn't really have a threadId because they have hash as a unique key, which means if someone duplicates a thread, there is a single summary, but it's used for multiple threads.
      // that's why we use hashes instead of threadId here. I've yet to adjust the db to remove threadId from summaries.
