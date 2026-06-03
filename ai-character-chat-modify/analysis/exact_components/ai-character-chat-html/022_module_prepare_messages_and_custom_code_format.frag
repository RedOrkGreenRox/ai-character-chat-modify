  window.prepareMessagesForBot = async function({messages, onProgressMessage}) {
    // note that we don't need to handle {{user}}/{{char}} stuff in this function because that's just for instruction, reminder, and initial messages. Initial messages have already had {{char}} stuff "rendered" when they were added to the thread.

    if(messages.length === 0) return [];

    let threadId = messages[0].threadId;

    let thread = await db.threads.get(threadId);
    let threadCharacter = await db.characters.get(thread.characterId);

    let messageCharacters = await db.characters.where("id").anyOf([...new Set(messages.map(m => m.characterId))]).toArray();
    let characterIdToCharacter = {};
    for(let c of messageCharacters) {
      characterIdToCharacter[c.id] = c;
    }
    characterIdToCharacter[-1] = await getUserCharacterObj();
    characterIdToCharacter[-2] = await getSystemCharacterObj();

    for(let m of messages) {
      m.message = m.message.replace(/<!--hidden-from-ai-start-->.+?<!--hidden-from-ai-end-->/gs, "");

      // There's no need for the bot to see multiple instance of the same image tag, so we remove all duplicates.
      let alreadyGotImageTagTexts = new Set();
      m.message = m.message.replace(/<image>.+?<\/image>/gs, function(imageTagText) {
        imageTagText = imageTagText.replace(/\(img[0-9]+:0\)/g, "").trim(); // need to remove the "key uniqueness tag" that is added by the image gen (uniqueness is because the "keep" button feature keys based on exact prompts)
        if(alreadyGotImageTagTexts.has(imageTagText)) {
          return "";
        } else {
          alreadyGotImageTagTexts.add(imageTagText);
          return imageTagText;
        }
      });

    }

    messages = await renderMessagesForReader({messages, reader:"ai", threadId, onProgressMessage});

    // TODO: not sure that this will work as expected for the "reply with..." function, since the in-place-of-user bot will see the hidden-from-ai messages (like the user would - do we want that?)
    messages = structuredClone(messages).filter(m => {
      if(m.hiddenFrom && m.hiddenFrom.includes("ai")) return false;
      return true;
    });

    messages = messages.map(m => {
      let role;
      if(m.characterId === -1) role = "user";
      else if(m.characterId === -2) role = "system";
      else role = "assistant";

      let name = messageObjToCharacterName(m, {thread, character:characterIdToCharacter[m.characterId], threadCharacter});
      // NOTE: we don't need to get `avatar` here because this function is only for preparing messages for the *BOT* - i.e. purely textual format

      if(name === undefined) throw new Error("message name is undefined in prepareMessagesForBot");

      name = name.replaceAll(" ", "_");
      // name = name.replace(/[^A-Za-z0-9_\-]/g, ""); // <-- we need to replace invalid characters here since the name could have been set with custom code, and in that case it wouldn't have been validated as happens when name is set in the character editor UI
      name = name.replace(/\n/g, " "); // newlines in name would confuse AI
      name = name.replace(/[\[\]]/g, ""); // square brackets are used in message formatting.

      return { role, content: m.message+"", name, id: m.id }; // id is used for summary upToMessageId stuff, and tracking the messages that were used in each summary and memory (brain button popup) and in hierarchical summary stuff
    });

    return messages;
  }

  async function renderMessagesForReader({messages, reader, threadId, onProgressMessage}) {
    // `reader` can be "ai" or "user"

    if(messages.length === 0) return [];

    let thread = await db.threads.get(threadId);
    let threadCharacter = await db.characters.get(thread.characterId);
    // let userCharacter = await getUserCharacterObj();

    if(!threadCharacter.customCode.trim()) return messages;

    // sometimes we need to render messages for a thread that isn't active (e.g. if user clicks thread export, and then we need to compute thread.currentSummaryHashChain because it hasn't been 'lazily' upgraded yet)
    if(!customCodeIframes[threadId] && threadCharacter.customCode.trim()) {
      await createNewCustomCodeIframeForThread(threadId); // this adds iframe as here: customCodeIframes[threadId]
    }

    if(onProgressMessage) onProgressMessage({message:"waiting for custom code iframe..."});
    while(!customCodeIframes[threadId]) {
      await delay(100);
    }
    if(onProgressMessage) onProgressMessage({message:"rendering messages..."});
    let functionText = `async function({messages}) {
      let messagePromises = [];
      // we process messages in parallel, but process handlers for each message in series
      for(let message of messages) {
        messagePromises.push((async function() {
          for(let fn of oc.messageRenderingPipeline) {
            await fn({message, reader:"${reader}"});
          }
        })());
      }
      await Promise.all(messagePromises);
      return messages;
    }`;

    let originalCustomCodeFormatMessages = await messagesToCustomCodeFormat({messages, thread, threadCharacter:threadCharacter});
    let functionArg = {messages:originalCustomCodeFormatMessages};
    let renderedMessagesInCustomCodeFormat = await sendCustomCodeIframeMessage(threadId, {type:"function", functionText, functionArg});

    let renderedMessages = await messagesFromCustomCodeFormat({messages:renderedMessagesInCustomCodeFormat, originalMessages:messages, threadId});

    if(!renderedMessages[0].variants) {
      throw new Error("reader message rendering shouldn't be stripping properties from messages");
    }

    return renderedMessages;
  }

  function messageObjToCharacterName(m, opts={}) {
    let thread = opts.thread;
    let character = opts.character;
    let threadCharacter;
    if(m.characterId < 0) {
      threadCharacter = opts.threadCharacter; // only needed if `character` is the user or system character, since in that case we need to apply any user/system name overrides that that character has
    }

    let name;
    if(m.characterId === -1) { // USER
      name = m.name ?? thread.userCharacter.name ?? threadCharacter.userCharacter.name ?? character.name;
    } else if(m.characterId === -2) { // SYSTEM
      name = m.name ?? thread.systemCharacter.name ?? threadCharacter.systemCharacter.name ?? character.name;
    } else { // NORMAL CHARACTER
      if(m.name) {
        name = m.name
      } else if(m.characterId === thread.characterId) { // since `character` could actually be a non-thread character! (that was e.g. brought into this thread via /ai @CharName#123). In that case using `thread.character.name` as part of the fallback chain doesn't make sense.
        name = thread.character.name ?? character.name;
      } else {
        name = character.name;
      }
    }

    return name;
  }

  function messageObjToCharacterAvatar(m, opts={}) {
    let thread = opts.thread;
    let character = opts.character;
    let threadCharacter;
    if(m.characterId < 0) {
      threadCharacter = opts.threadCharacter; // only needed if `character` is the user or system character, since in that case we need to apply any user/system name overrides that that character has
    }

    let url, size, shape;
    if(m.characterId === -1) { // USER
      url = m.avatar?.url ?? thread.userCharacter.avatar?.url ?? threadCharacter.userCharacter.avatar?.url ?? character.avatar?.url;
      size = m.avatar?.size ?? thread.userCharacter.avatar?.size ?? threadCharacter.userCharacter.avatar?.size ?? character.avatar?.size;
      shape = m.avatar?.shape ?? thread.userCharacter.avatar?.shape ?? threadCharacter.userCharacter.avatar?.shape ?? character.avatar?.shape;
    } else if(m.characterId === -2) { // SYSTEM
      url = m.avatar?.url ?? thread.systemCharacter.avatar?.url ?? threadCharacter.systemCharacter.avatar?.url ?? character.avatar?.url;
      size = m.avatar?.size ?? thread.systemCharacter.avatar?.size ?? threadCharacter.systemCharacter.avatar?.size ?? character.avatar?.size;
      shape = m.avatar?.shape ?? thread.systemCharacter.avatar?.shape ?? threadCharacter.systemCharacter.avatar?.shape ?? character.avatar?.shape;
    } else { // NORMAL CHARACTER
      if(m.avatar?.url) {
        url = m.avatar?.url
      } else if(m.characterId === thread.characterId) { // since `character` could actually be a non-thread character! (that was e.g. brought into this thread via /ai @CharName#123). In that case using `thread.character.name` as part of the fallback chain doesn't make sense.
        url = thread.character.avatar?.url ?? character.avatar?.url;
      } else {
        url = character.avatar?.url;
      }
      if(m.avatar?.size) {
        size = m.avatar?.size
      } else if(m.characterId === thread.characterId) { // since `character` could actually be a non-thread character! (that was e.g. brought into this thread via /ai @CharName#123). In that case using `thread.character.name` as part of the fallback chain doesn't make sense.
        size = thread.character.avatar?.size ?? character.avatar?.size;
      } else {
        size = character.avatar?.size;
      }
      if(m.avatar?.shape) {
        shape = m.avatar?.shape
      } else if(m.characterId === thread.characterId) { // since `character` could actually be a non-thread character! (that was e.g. brought into this thread via /ai @CharName#123). In that case using `thread.character.name` as part of the fallback chain doesn't make sense.
        shape = thread.character.avatar?.shape ?? character.avatar?.shape;
      } else {
        shape = character.avatar?.shape;
      }
    }

    return {url, size, shape};
  }



  async function messagesToCustomCodeFormat(opts={}) {
    let messages = opts.messages;
    if(messages.length === 0) return [];

    let thread = opts.thread;
    if(!thread) {
      thread = await db.threads.get(messages[0].threadId);
    }

    let threadCharacter = opts.threadCharacter;
    if(!threadCharacter) {
      threadCharacter = await db.characters.get(thread.characterId);
    }

    let characters = await db.characters.where("id").anyOf([...new Set(messages.map(m => m.characterId))]).toArray();
    let characterIdToCharacter = {};
    for(let c of characters) {
      characterIdToCharacter[c.id] = c;
    }
    characterIdToCharacter[-1] = await getUserCharacterObj();
    characterIdToCharacter[-2] = await getSystemCharacterObj();

    messages = structuredClone(messages);
    messages = messages.map((m, i) => {
      let author;
      if(m.characterId == -1) author = "user";
      else if(m.characterId == -2) author = "system";
      else author = "ai";

      let name = m.name;
      if(!m.name && m.characterId !== -1 && m.characterId !== -2 && m.characterId !== threadCharacter.id){
        // we only override the `name` of a message if it's a character that *isn't from this thread* - since otherwise there's no way for the custom code to get the actual name.
        // NOTE: I think this will actually cause the name to get written into to the message itself when the custom code iframe sends the data back, right? Yeah. Because the diff algorithm will notice that the name doesn't match the messages.
        // That seems okay, I guess? Just a byproduct of having custom code that needs to read thread-external characters.
        name = messageObjToCharacterName(m, {thread, character:characterIdToCharacter[m.characterId], threadCharacter});
        // NOTE: custom code *cannot* see the avatar of thread-external characters. This saves us from the dilemma of e.g. having to write a 50kb data URL into the avatar.url field of hundreds of messages.
      }

      let hiddenFrom = m.hiddenFrom || [];

      // note: we need to pass `id` to custom code because it's used in stuff like renderMessagesForReader - we could map the ids to "public" ones, but it's probably not necessary
      return {id:m.id, author, content:m.message, hiddenFrom, expectsReply:m.expectsReply, name, scene:m.scene, avatar:m.avatar, customData:m.customData, wrapperStyle:m.wrapperStyle, wrapperStyle:m.wrapperStyle, instruction:m.instruction};
    });
    return messages;
  }

  async function messagesFromCustomCodeFormat({messages, originalMessages, threadId}) {
    messages = structuredClone(messages);

    let thread = await db.threads.get(threadId);
    let threadCharacter = await db.characters.get(thread.characterId);
    // let userCharacter = await getUserCharacterObj();

    let messageCharacters = await db.characters.where("id").anyOf([...new Set(originalMessages.map(m => m.characterId))]).toArray();
    let characterIdToCharacter = {};
    for(let c of messageCharacters) {
      characterIdToCharacter[c.id] = c;
    }
    characterIdToCharacter[-1] = await getUserCharacterObj();
    characterIdToCharacter[-2] = await getSystemCharacterObj();

    let messageIdToCharacterName = {};
    for(let m of originalMessages) {
      messageIdToCharacterName[m.id] = messageObjToCharacterName(m, {thread, character:characterIdToCharacter[m.characterId], threadCharacter});
    }

    // NOTE: originalMessages is needed to "hydrate" the messages with any missing data, assuming that `messages` have `id`s (which they might not, since custom code can completely overwrite messages)
    let allOriginalMessageKeys = [...new Set(originalMessages.map(m => Object.keys(m)).flat())];
    let idToOriginalMessage = {};
    for(let m of originalMessages) {
      idToOriginalMessage[m.id] = m;
    }

    let doneSceneWarning = false;
    let doneAvatarWarning = false;

    messages = messages.map(m => {
      let originalMessage = idToOriginalMessage[m.id];

      m.characterId = -2; // default to 'system'
      if(m.author == "ai") m.characterId = originalMessage?.characterId ?? threadCharacter.id;
      if(m.author == "user") m.characterId = -1;
      delete m.author;

      if(originalMessage) {
        // if they didn't change the name, and the original name was 'null' (which is the case for 'normal' messages - i.e. messages which don't overwrite the name of the character), then we delete the name
        let nameThatWasSentToCustomCode = messageIdToCharacterName[m.id];
        if(!originalMessage.name && m.name === nameThatWasSentToCustomCode) {
          delete m.name;
        }
      }

      if(!Array.isArray(m.hiddenFrom)) {
        m.hiddenFrom = [];
      }
      m.hiddenFrom = m.hiddenFrom.filter(h => h==="ai" || h==="user");

      if(![true, false, undefined].includes(m.expectsReply)) {
        m.expectsReply = undefined;
      }

      if(m.scene) {
        let exampleStructure = {background:{url:"", filter:""}, music:{url:"", volume:0}};
        let matches = objectKeysAndTypesAreValid(m.scene, exampleStructure);
        if(!matches) {
          if(!doneSceneWarning) alert(`Invalid scene object produced by custom code. Please ensure structure and types are valid. Here's your object:\n\n${JSON.stringify(m.scene, null, 2)}\n\nAnd here's an example structure with valid types:\n\n${JSON.stringify(exampleStructure, null, 2)}\n\nYou don't need to include all properties - you just need to make sure that you don't include invalid ones, and that the types of the ones you include are valid.`);
          doneSceneWarning = true;
          m.scene = null;
        }
      } else {
        m.scene = null;
      }

      if(m.avatar) {
        let exampleStructure = {url:"", shape:"", size:0};

        // hacky fix - not sure why url/shape/size were null instead of just not existing on the object
        if(m.avatar.url === null) delete m.avatar.url;
        if(m.avatar.shape === null) delete m.avatar.shape;
        if(m.avatar.size === null) delete m.avatar.size;

        let matches = objectKeysAndTypesAreValid(m.avatar, exampleStructure);
        if(!matches) {
          debugger;
          if(!doneAvatarWarning) alert(`Invalid avatar object produced by custom code. Please ensure structure and types are valid. Here's your object:\n\n${JSON.stringify(m.avatar, null, 2)}\n\nAnd here's an example structure with valid types:\n\n${JSON.stringify(exampleStructure, null, 2)}\n\nYou don't need to include all properties - you just need to make sure that you don't include invalid ones, and that the types of the ones you include are valid.`);
          doneAvatarWarning = true;
          m.avatar = {};
        }
      } else {
        m.avatar = {};
      }

      // note: it's possible for m.id to be undefined, since custom code can completely replace messages
      // but if it does exist, then we 'rehydrate' it with private data based on the `id`
      if(m.id) {
        let originalMessage = idToOriginalMessage[m.id];
        if(originalMessage) {
          for(let key of allOriginalMessageKeys) {
            // if original message had it, and new one doesn't, then we add it to the new one
            if(originalMessage.hasOwnProperty(key) && !m.hasOwnProperty(key)) {
              m[key] = originalMessage[key];
            }
          }
        } else {
          // It's possible for the custom code to produce a message with an id that doesn't exist in the original messages because it could have "held on" to a message that existed earlier, but which not longer exists, and then pushed that on to the oc.thread.messages array layer.
          // In this case we just delete the id so that a new one message object will be generated.
          // The new message object will not inherit any of the properties of the old one, which is fine.
          delete m.id;
        }
      }

      m.threadId = threadId;
      m.message = m.content+"";
      delete m.content;
      m.wrapperStyle = (m.wrapperStyle ?? "")+"";
      m.instruction = (!m.instruction || !(m.instruction+"").trim()) ? null : m.instruction+"";

      let obj = createMessageObj(m);
      obj.id = m.id; // see messagesToCustomCodeFormat for why we need ids
      return obj;
    });

    return messages;
  }

//   async function threadHasMemoriesOrLore(threadId) {
//     let thread = await db.threads.get(threadId);
//     let character = await db.characters.get(thread.characterId);

//     let loreBookIdEntries = await db.lore.where({bookId:thread.loreBookId}).count();
//     let loreBookUrlEntries = await db.lore.where("bookUrl").anyOf(character.loreBookUrls).count();
//     let memories = await db.memories.where({threadId, status:"current"}).count();

//     return loreBookIdEntries > 0 || loreBookUrlEntries > 0 || memories > 0;
//   }

  const retrievedMemoriesTokenLimitFraction = 0.075;

  // async function getTokenLimitForSummaryAndMessages(character, thread) {

  //   let reminderMessage = character.reminderMessage || "";
  //   if(typeof thread.character.reminderMessage === "string") {
  //     reminderMessage = thread.character.reminderMessage;
  //   }

  //   let roleInstruction = character.roleInstruction || "";

  //   // TODO: Currently this function doesn't take into account that we now also add role instruction of other characters too (like the user character).
  //   // This isn't toooo bad because the ai text plugin will do "middle out" deletion to keep it under the token limit, but it's not ideal.

  //   // apply thread-specific overrides:
  //   if(character.id === thread.characterId && typeof thread.character.roleInstruction === "string" && thread.character.roleInstruction.trim()) {
  //     roleInstruction = thread.character.roleInstruction;
  //   }
  //   if(character.id === -1 && typeof thread.userCharacter.roleInstruction === "string" && thread.userCharacter.roleInstruction.trim()) {
  //     roleInstruction = thread.userCharacter.roleInstruction;
  //   }

  //   let maxTokenLimit = root.aiTextPlugin({getMetaObject:true}).idealMaxContextTokens;
  //   let tokenLimit = maxTokenLimit;
  //   // TODO: let user set threadCharacter.tokenLimit (via oc.character.tokenLimit) here to override this if it's smaller than the model's max token limit

  //   // buffer due to token count being an estimate
  //   tokenLimit -= Math.round(maxTokenLimit*0.05);

  //   tokenLimit -= await countTokens(roleInstruction, thread.modelName); // allow for system message tokens
  //   tokenLimit -= await countTokens( "("+(reminderMessage||"")+")" , thread.modelName); // allow for reminder message tokens
  //   tokenLimit -= Math.round(maxTokenLimit*0.15); // allow for bot response
  //   if(await threadHasMemoriesOrLore(thread.id)) {
  //     tokenLimit -= Math.round(maxTokenLimit*retrievedMemoriesTokenLimitFraction); // allow for retrieved memories
  //   }
  //   return tokenLimit;
  // }

  async function updateFavicon(url) {
    if(!url) return;

    let link = document.querySelector("link[rel~='icon']");
    if(!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    try {
      const response = await root.superFetch(url);
      const blob = await response.blob();
      const imageBitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const size = Math.min(imageBitmap.width, imageBitmap.height);
      const startX = (imageBitmap.width - size) / 2;
      const startY = (imageBitmap.height - size) / 2;
      const maxSize = 512;
      const scaleFactor = Math.min(1, maxSize / size);
      canvas.width = canvas.height = Math.floor(size * scaleFactor);
      ctx.drawImage(imageBitmap, startX, startY, size, size, 0, 0, canvas.width, canvas.height);
      url = canvas.toDataURL('image/jpeg');
    } catch(e) {
      console.error(e);
    }
    link.href = url || "";
  }
  updateFavicon();

  window.mostRecentPotentiallyRelevantMemoriesAndLoreTextByThreadId = {};

