          // It's possible for the custom code to produce a message with an id that doesn't exist in the original messages because it could have "held on" to a message that existed earlier, but which not longer exists, and then pushed that on to the oc.thread.messages array layer.
          // In this case we just delete the id so that a new one message object will be generated.
          // The new message object will not inherit any of the properties of the old one, which is fine.
