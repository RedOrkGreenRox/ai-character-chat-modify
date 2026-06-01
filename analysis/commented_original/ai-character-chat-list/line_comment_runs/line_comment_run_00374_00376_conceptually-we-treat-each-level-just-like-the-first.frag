      // conceptually we treat each "level" just like the first.
      // the first level is just a bunch of messages with interspersed "SUMMARY^1: ..." messages, where the summary messages are a summary of the messages before them, up to the *previous* "SUMMARY^1: ..." message.
      // so for the next level, we just delete/ignore the ^0 messages (i.e. the *actual* messages), and do exactly the same thing - i.e. treat "SUMMARY^1: ..." as if they were "messages" and "SUMMARY^2: ..." are the summaries of those "messages".
