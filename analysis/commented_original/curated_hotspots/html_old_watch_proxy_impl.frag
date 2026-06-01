        // function watchObject(obj, callback) {
        //   let proxy = new Proxy(obj, {
        //     set: function(target, prop, value) {
        //       target[prop] = value;
        //       callback(prop, value);
        //       return true;
        //     }
        //   });
        //   return proxy;
        // }
        // function watchArray(arr, callback) {
        //   // note that we need to watch set and get because get is called for push/pop/etc.
        //   let proxy = new Proxy(arr, {
        //     set: function(target, prop, value) {
        //       target[prop] = value;
        //       callback(prop);
        //       return true;
        //     },
        //     get: function(target, prop) {
        //       if(isNaN(Number(prop))) { // ignore array indexing
        //         callback(prop);
        //       }
        //       return target[prop];
        //     }
        //   });
        //   return proxy;
        // }

        // TODO: later we can track changes in a more fine-grained way to reduce data transfer between this frame and parent

        // oc.thread.messages = watchArray(oc.thread.messages, (prop) => {
        //   dataChangedByCustomCode = true;
        // });
        // let currentThreadMessagesArray = oc.thread.messages;
        // let ignoreMessagePropSetter = false;
        // window.oc.thread = watchObject(oc.thread, (prop, value) => {
        //   if(ignoreMessagePropSetter) return;
        //   // if they set the messages prop to a new array, we need to watch that array:
        //   if(prop === "messages" && value && value !== currentThreadMessagesArray) { // NOTE: oc.thread.messages is *already* set to 'value', so we need to track with currentThreadMessagesArray
        //     ignoreMessagePropSetter = true; // need to ignore because we're about to change oc.thread.messages which would cause infinite loop
        //     oc.thread.messages = watchArray(value, (prop) => {
        //       dataChangedByCustomCode = true;
        //     });
        //     ignoreMessagePropSetter = false;
        //     currentThreadMessagesArray = oc.thread.messages;
        //   }
        //   dataChangedByCustomCode = true;
        // });
        // window.oc.character = watchObject(oc.character, (prop) => {
        //   dataChangedByCustomCode = true;
        // });
