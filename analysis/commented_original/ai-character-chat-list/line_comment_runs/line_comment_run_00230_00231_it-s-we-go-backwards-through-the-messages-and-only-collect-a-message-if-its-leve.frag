  // it's we go backwards through the messages, and only 'collect' a message if its level is not below the highest level we've seen so far. it makes sense if you think about it for a bit.
  // said another way, we go from the end of the messages to the start while 'monotonically climbing' up a level whenever we hit a 'higher' message.
