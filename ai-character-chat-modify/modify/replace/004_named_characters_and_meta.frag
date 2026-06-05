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
      title: `ACCM Character Chat Workshop — AI roleplay with files, skillbooks and extensions`,
      description: `ACCM Character Chat Workshop is a modified Perchance AI character chat focused on extensible roleplay workflows: global Workshop/library, file and memory Explorer, skillbooks, lorebooks, extension packs, web search helpers, voice tools, Base Policy language controls, importers and safer modular ACCM runtime registries. It is based on ai-character-chat, but its metadata, feature focus and extension layer are intentionally distinct from the original generator and ordinary forks.`,
    };
    let fileName;
    if(inputs.urlParams.data && inputs.urlParams.data.endsWith(".gz")) {
      fileName = inputs.urlParams.data.split("~").slice(-1)[0];
    } else if(inputs.urlParams.char) {
      if(inputs.urlParams.char === "assistant") {
        return {
          title: `ACCM AI Assistant Chat — Workshop-enabled Perchance character workspace`,
          description: `A modified ACCM assistant workspace for Perchance character chat: use the assistant with Workshop imports, skillbooks, file context, global Explorer, web search helpers, voice tools and language policy controls. This page is intentionally branded separately from the original ai-character-chat metadata.`,
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
          title: character.metaTitle ? character.metaTitle : `${character.name.slice(0, 40)} — ACCM Character Chat`,
          description: character.metaDescription ? character.metaDescription : `Chat with ${character.name} in the ACCM Character Chat Workshop, with optional files, memories, skillbooks, lore and extension tools. Character description: ${character.roleInstruction.slice(0, 430).replace(/\s+/g, " ")}`,
          image: character.metaImage ? character.metaImage : character.avatarUrl,
        };
      } catch(e) {
        console.error(e);
        return defaults;
      }
    } else {
      return defaults;
    }




