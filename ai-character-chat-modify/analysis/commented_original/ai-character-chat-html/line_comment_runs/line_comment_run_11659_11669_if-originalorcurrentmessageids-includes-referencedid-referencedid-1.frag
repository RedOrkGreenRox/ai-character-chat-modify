          // if(!originalOrCurrentMessageIds.includes(referencedId) && referencedId !== -1) {
          //   // this is fine (i.e. not an error) if we *don't* have originalMessages (i.e. if we're relying on a fresh db request right at this moment) because it's possible that e.g. the user deleted a message while the custom code was processing.
          //   // but if we *do* have originalMessages, then something is wrong - why would messageIdsUsed (which isn't exposed to custom code, to be clear) contain ids of messages that don't exist in the *original* messages that we sent to the custom code iframe?
          //   if(originalMessages) {
          //     throw new Error("messageIdsUsed should only contain ids of messages that exist in the original messages");
          //   } else {
          //     return -1;
          //   }
          // }
          // if(deletedMessageIds.includes(referencedId)) return -1;
          // else return referencedId;
