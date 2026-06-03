      // note that originalMessages will only be defined if this is part of the MessageHandler process - because in that case we actually sent the messages, whereas in the data polling updates, we didn't send anything
      // currentMessages and originalMessages can differ because e.g. a message could have been deleted by the user while the custom code was processing
