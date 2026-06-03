    // WARNING: If you add something here, you may need to edit:
    // - addThread
    // - getThreadJSONById
    // and if exposing to custom code:
    // - window.oc.thread.<...>  (during declaration of window.oc object, with Object.seal if property is an object)
    // - getDataForCustomCode  (sending data to custom code)
    // - updateDbWithNewDataFromCustomCode (receiving data from custom code)
