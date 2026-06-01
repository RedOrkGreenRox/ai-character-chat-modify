        // currently the only reason this is wrapped in an async function is to throw an error if the user's code contains a static import, since static imports are pre-loaded and thus jump ahead of initialization
        // oh and maybe we need it to be able to catch wrap this try/catch around it too?
