urlNamedCharacters
  assistant = assistant
  psychologist = 615fdef95fa7e75cbbaf943dc44d72be.gz
  ai-adventure = b33c6ff0c14f92e8095ca90765848485.gz
  coding-assistant = 570b3c67b8ed9ed8f83ef652be549b1c.gz
  story-writer = 76b20593b117ab083d746312df4df296.gz
  world-war-simulator = e1cf5213432a7eb9e310ec269fe38672.gz
  therapist = 5cdaa39f9aabc7424c3b2e1b780a1e29.gz
  // NOTE: must add named chars to $meta.dynamic too

$meta
  header
    mode = minimal
  // construct metadata based on character if the URL has a character reference:
  async dynamic(inputs) => // note that $meta.dynamic function *cannot reference/use any variables/lists/etc. that are outside of itself*. In other words, its code must be *fully* self-contained (i.e. only use `inputs.urlParams`). It must also use pure JavaScript (i.e. no Perchance-specific features like `foo.selectOne`, `foo.titleCase`, etc.).
    let defaults = {
      title: `AI Character Chat (online, free, no sign-up, unlimited)`,
      description: `Perchance AI Chat - completely free, online, no login, unlimited messages, unlimited AI-generated images. Chat with AI characters via this Character.AI (C.AI) chat alternative. Custom AI character creation. Chat to the default Chloe character, or make your own AI character and talk to them freely - no limits, and no freemium gimicks that lure you to sign up. No message limits, no filter. You can create characters that can send pictures/images/photos, roleplay chatbots, AI RPGs/D&D experiences, an AI Dungeon alternative, anime AI chat, and basically anything else you can think of. No restrictions on daily usage. Like ChatGPT, but for fictional character RPs and AI characters, with image generation in chat.`,
    };
    let fileName;
    if(inputs.urlParams.data && inputs.urlParams.data.endsWith(".gz")) {
      fileName = inputs.urlParams.data.split("~").slice(-1)[0];
    } else if(inputs.urlParams.char) {
      if(inputs.urlParams.char === "assistant") {
        return {
          title: `AI Character Chat (online, free, no sign-up, unlimited)`,
          description: `AI Chat with characters for roleplaying or to get help with writing, language practice, creative tasks, coding questions, and lots more. Completely free, online, no login, unlimited messages, unlimited AI-generated images. Basically a more creative (and unfiltered/uncensored) ChatGPT alternative. Chat to the Chloe or make an AI assistant/character and talk to them freely - no limits on credits, and no freemium gimicks that lure you to sign up. Completely unlimited, no filter. You can create characters that can send pictures/images/photos, roleplay chatbots, AI RPGs/D&D game masters. Like ChatGPT, but better at fictional character RPs and AI characters, with image generation in chat.`,
        };
      }
      let urlNamedCharacters = {
        "ai-adventure": "b33c6ff0c14f92e8095ca90765848485.gz",
        "coding-assistant": "570b3c67b8ed9ed8f83ef652be549b1c.gz",
        "story-writer": "76b20593b117ab083d746312df4df296.gz",
        "world-war-simulator": "e1cf5213432a7eb9e310ec269fe38672.gz",
        "psychologist": "615fdef95fa7e75cbbaf943dc44d72be.gz",
        "therapist": "5cdaa39f9aabc7424c3b2e1b780a1e29.gz",
      };
      fileName = urlNamedCharacters[inputs.urlParams.char];
    }
    if(fileName) {
      try {
        let fileUrl = "https://user.uploads.dev/file/" +  fileName;
        let blob = await fetch(fileUrl, {signal:AbortSignal.timeout ? AbortSignal.timeout(8000) : null}).then(res => res.blob());
        const ds = new DecompressionStream("gzip");
        const decompressedStream = blob.stream().pipeThrough(ds);
        let decompressedBlob = await new Response(decompressedStream).blob();
        let text = await decompressedBlob.text();
        let data = JSON.parse(text);
        let character = data.addCharacter;
        return {
          title: character.metaTitle ? character.metaTitle : `${character.name.slice(0, 40)} - AI Character Chat (free, no sign-up, unlimited)`,
          description: character.metaDescription ? character.metaDescription : `Chat with the ${character.name} AI character. Here's this character's description: ${character.roleInstruction.slice(0, 450).replace(/\s+/g, " ")}`,
          image: character.metaImage ? character.metaImage : character.avatarUrl,
        };
      } catch(e) {
        console.error(e);
        return defaults;
      }
    } else {
      return defaults;
    }




