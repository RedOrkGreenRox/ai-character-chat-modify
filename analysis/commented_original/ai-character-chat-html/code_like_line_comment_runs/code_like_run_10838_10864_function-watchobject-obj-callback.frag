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
