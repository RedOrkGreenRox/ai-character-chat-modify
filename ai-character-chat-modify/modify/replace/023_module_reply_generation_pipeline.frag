  let currentBotReplySignals;
  // Note: the reason this doesn't just take threadId as a param is because we use it for regenerateMessage() which doesn't necessarily use all messages in a thread, and we also use it for "reply with..." which can use a different AI character
  async function getBotReply({messages, threadId, replyingCharacter=null, replyInstruction=null, startMessageWith=null, replyingCharacterNameOverride=null, extraStopSequences=null, onStreamingReplyChunk, onProgressMessage, signals={}, modelNameOverride}={}) {
    currentBotReplySignals = signals;

    // NOTE: the `messages` arg may not be *all* the messages from the thread. E.g. in case of regenerateMessage which ignores the messages below the regenerated message.

    // NOTE: Currently, if replyingCharacter only overrides the reminder and instruction.
    // This function doesn't currently use the lorebooks of the replyingCharacter, or the modelName, or other stuff.
    // It just swaps the reminder and instruction. But could change this in the future.

    let originalSendButtonDisabledState = $.sendButton.disabled;
    $.sendButton.disabled = true;
    try {
      let thread = await db.threads.get(threadId);
      if(replyingCharacter === null) { // replyingCharacter can be passed in to this function and its reminder/instruction/etc. will be used instead of the thread character's
        replyingCharacter = await db.characters.get(thread.characterId);
      }
      let threadCharacter = await db.characters.get(thread.characterId);
      const userCharacter = await getUserCharacterObj();

      let messagesArr = await prepareMessagesForBot({messages, onProgressMessage});

      onProgressMessage({message:"starting..."});
      console.log("getBotReply messagesArr (initial):", messagesArr);

      // Note: Currently there's only one model, but there may e.g. be a VLM model/plugin in the future, or something like that.
      let modelName = thread.modelName;
      if(modelNameOverride) modelName = modelNameOverride;

      if(signals.stop === true) return {};



      //////////////////////////////////////////////////
      //               NAME OVERRIDES                 //
      //////////////////////////////////////////////////
      const authorToRoleMap = {
        ai: "assistant",
        user: "user",
        system: "system",
      };
      // NOTE: These are not used for 'message log text' creation, since `prepareMessagesForBot` already does all the proper name overrides for us.
      // They're just for stuff like {{user}} in roleInstruction, reminderMessage, etc. as you can see below.
      let userName = thread.userCharacter.name ?? threadCharacter.userCharacter.name ?? userCharacter.name;
      let threadCharacterName = thread.character.name ?? threadCharacter.name;
      let systemName = thread.systemCharacter.name ?? threadCharacter.systemCharacter.name ?? defaultSystemName;
      // Need to apply name overrides for the replyingCharacter, since it can be *any* character, including user and system, or other (non-threadCharacter) characters
      let replyingCharacterName;
      if(replyingCharacter.id === -1) {
        replyingCharacterName = userName;
      } else if(replyingCharacter.id === -2) {
        replyingCharacterName = systemName;
      } else if(replyingCharacter.id === threadCharacter.id) {
        replyingCharacterName = threadCharacterName;
      } else {
        replyingCharacterName = replyingCharacter.name;
      }

      if(replyingCharacterNameOverride) {
        replyingCharacterName = replyingCharacterNameOverride;
      }



      //////////////////////////////////////////////////
      //             ROLE INSTRUCTIONS                //
      //////////////////////////////////////////////////
      let characterIdsAlreadyAddedToRoleInstructionArr = new Set();
      let roleInstructionsArr = [];
      // Always add the thread character's description:
      characterIdsAlreadyAddedToRoleInstructionArr.add(threadCharacter.id);
      let threadCharacterRoleInstruction = thread.character.roleInstruction?.trim() ?? threadCharacter.roleInstruction?.trim(); // note that we check the thread object first, since it can override the character's role instruction
      if(threadCharacterRoleInstruction) {
        roleInstructionsArr.push({
          roleInstruction: threadCharacterRoleInstruction,
          name: threadCharacterName,
        });
      }
      // if the user is replying, or if there are previous messages from the user, add their description if they have one:
      if(replyingCharacter.id === -1 || messagesArr.filter(m => m.name === userName).length > 0) {
        let userCharacterRoleInstruction = thread.userCharacter.roleInstruction?.trim() ?? threadCharacter.userCharacter?.roleInstruction?.trim() ?? userCharacter.roleInstruction?.trim() ?? "";
        if(userCharacterRoleInstruction) {
          roleInstructionsArr.push({roleInstruction:userCharacterRoleInstruction, name:userName });
        }
        characterIdsAlreadyAddedToRoleInstructionArr.add(-1);
      }
      // add characters that have sent messages recently:
      let characterIds = [...new Set(messages.slice(-20).map(m => m.characterId))];
      for(let id of characterIds) {
        if(id < 0 || characterIdsAlreadyAddedToRoleInstructionArr.has(id)) continue;
        let character = await db.characters.get(id);
        let roleInstruction = character.roleInstruction?.trim();
        if(roleInstruction) {
          roleInstructionsArr.push({roleInstruction, name:character.name});
        }
        characterIdsAlreadyAddedToRoleInstructionArr.add(id);
      }
      // if replying character isn't thread/user/system and wasn't added in the above 'recent' ones, add their description:
      if(![-1, -2, thread.characterId].includes(replyingCharacter.id) && !characterIdsAlreadyAddedToRoleInstructionArr.has(replyingCharacter.id)) {
        let roleInstruction = replyingCharacter.roleInstruction?.trim();
        if(roleInstruction) {
          roleInstructionsArr.push({roleInstruction, name:replyingCharacter.name});
        }
      }

      function getRoleInstructionText(opts={}) {
        let roleInstructionItems = [];
        for(let { roleInstruction, name } of roleInstructionsArr) {
          let messages = parseMessagesFromTextFormat(roleInstruction);
          if(messages === null) {
            let content = `NOTE: In case it's useful here's a description of the **${name}** character: `+roleInstruction;
            content = content.replaceAll("{{user}}", userName);
            content = content.replaceAll("{{char}}", name);
            content = content.replace(/<!--hidden-from-ai-start-->.+?<!--hidden-from-ai-end-->/gs, "");
            if(opts.limitLengths) content = content.slice(0, opts.limitLengths) + (content.length > opts.limitLengths ? " [...]" : "");
            roleInstructionItems.push(content);
          } else {
            for(let message of messages) {
              if(message.hiddenFrom?.includes("ai")) continue; // doesn't really make sense to hide from ai in reminder message - this is just to be consistent
              let content = message.content;
              content = content.replaceAll("{{user}}", userName);
              content = content.replaceAll("{{char}}", name);
              content = content.replace(/<!--hidden-from-ai-start-->.+?<!--hidden-from-ai-end-->/gs, "");
              // TODO: not sure how limitLengths should work here, but it's a rarely used feature so it's fine for now
              roleInstructionItems.push(`${authorToRoleMap[message.author]}: ${content}`);
            }
          }
        }
        return roleInstructionItems.length > 0 ? roleInstructionItems.join("\n\n---\n\n") : "";
      }
      let roleInstructionText = getRoleInstructionText();
      if(countTokens(roleInstructionText) > window.idealMaxContextTokens*0.3) {
        console.warn("Character descriptions being trimmed due to large combined length.");
        roleInstructionText = getRoleInstructionText({limitLengths:3000});
        if(countTokens(roleInstructionText) > window.idealMaxContextTokens*0.3) roleInstructionText = getRoleInstructionText({limitLengths:2000});
        if(countTokens(roleInstructionText) > window.idealMaxContextTokens*0.3) roleInstructionText = getRoleInstructionText({limitLengths:1000});
        if(countTokens(roleInstructionText) > window.idealMaxContextTokens*0.3) roleInstructionText = getRoleInstructionText({limitLengths:500});
      }



      //////////////////////////////////////////////////
      //             REMINDER MESSAGE                 //
      //////////////////////////////////////////////////
      let reminderMessageItems = [];
      let reminderMessage = replyingCharacter.reminderMessage?.trim();
      // apply thread-specific overrides:
      if(replyingCharacter.id === thread.characterId && thread.character.reminderMessage?.trim()) reminderMessage = thread.character.reminderMessage?.trim();
      // ... including the case where user character is replying character:
      if(replyingCharacter.id === -1 && thread.userCharacter.reminderMessage?.trim()) reminderMessage = thread.userCharacter.reminderMessage?.trim();
      if(reminderMessage) {
        let messages = parseMessagesFromTextFormat(reminderMessage);
        if(messages === null) {
          let content = reminderMessage;
          content = content.replaceAll("{{user}}", userName);
          content = content.replaceAll("{{char}}", threadCharacterName);
          content = content.replace(/<!--hidden-from-ai-start-->.+?<!--hidden-from-ai-end-->/gs, "");
          reminderMessageItems.push(content);
        } else {
          // there are multiple reminder messages (advanced syntax)
          for(let message of messages) {
            if(message.hiddenFrom?.includes("ai")) continue; // doesn't really make sense to hide from ai in reminder message - this is just to be consistent
            let content = message.content;
            content = content.replaceAll("{{user}}", userName);
            content = content.replaceAll("{{char}}", threadCharacterName);
            content = content.replace(/<!--hidden-from-ai-start-->.+?<!--hidden-from-ai-end-->/gs, "");
            reminderMessageItems.push(`${authorToRoleMap[message.author]}: ${content}`);
          }
        }
      }
      // let reminderMessageText = reminderMessageItems.length > 0 ? reminderMessageItems.join("\n") : null;
      let reminderMessageText = reminderMessageItems.length > 0 ? reminderMessageItems.join("\n") : "";

      // reminderMessageText = "If relevant, remember the 'Break Out Of Bad Writing Patterns' guideline, and the other guidelines. Don't talk about writing guidelines in your response - always stay in character, and maintain the immersion. "+reminderMessageText
      let makeReaderHappyInstruction = null;

      if(Math.random() < 0.3 && messagesArr.length > 5) {
        let recentMessageWasStaccato = messagesArr.at(-1) && messagesArr.at(-1).content && messagesArr.at(-1).content.length > 70 && ([...messagesArr.at(-1).content.matchAll(/[—*.]/g)].length / messagesArr.at(-1).length > 0.05);
        if(!recentMessageWasStaccato) recentMessageWasStaccato = messagesArr.at(-2) && messagesArr.at(-2).content && messagesArr.at(-2).content.length > 70 && ([...messagesArr.at(-2).content.matchAll(/[—*.]/g)].length / messagesArr.at(-2).length > 0.05);
        let shouldInstructFullSentences = recentMessageWasStaccato || Math.random() < 0.3;
        makeReaderHappyInstruction = `with no metaphor, ${shouldInstructFullSentences ? `full, natural sentences, ` : ""}and leaning into reader's desires`;
        reminderMessageText = `Make the Reader Happy: For one of the messages, pay particular attention to the overall arch of the story/chat that would satisfy the reader, by leaning into *exactly* what the reader *deeply* wants to happen next, without metaphorical comparisons or similes.${shouldInstructFullSentences ? " Write in full, natural, pleasantly readable sentences with correct grammar." : ""} You can remind yourself in parentheses before the message content like "[[<name> (${makeReaderHappyInstruction})]]: <message content>". If the current scene is slice-of-life, then don't derail it. Just let things play out naturally in a way that deeply satisfies the reader.${reminderMessageText ? " Also: "+reminderMessageText : ""}`;
        reminderMessageText = reminderMessageText.trim();
      }






      //////////////////////////////////////////////////
      //      CONTEXT/PREFIX PROMPT CONSTRUCTION      //
      //////////////////////////////////////////////////
      // Note that prefix/context construction comes *before* memory querying because we use the same context for memory query creation, to increase prefix cache hits.
      let maxParagraphCountPerMessage = null;
      // is user or system character (as of writing there's no way to set the maxParagraphCountPerMessage for them). this isn't ideal. but I think it's a sane default for now. if they want customization for now they have to create separate 'actual' characters (e.g. a Narrator character that they bring into their thread)
      if(replyingCharacter.id === -1 || replyingCharacter.id === -2) maxParagraphCountPerMessage = threadCharacter.maxParagraphCountPerMessage;
      else maxParagraphCountPerMessage = replyingCharacter.maxParagraphCountPerMessage;
      // if they've edited a message and clicked "continue", allow them to add another paragraph even though it's over the strict limit (else the stuff they manually wrote gets deleted):
      if(maxParagraphCountPerMessage && startMessageWith) {
        let numParagraphsInStartMessageWith = startMessageWith.split("\n").map(l => l.trim()).filter(l => l).length;
        if(numParagraphsInStartMessageWith > maxParagraphCountPerMessage) maxParagraphCountPerMessage = numParagraphsInStartMessageWith;
      }

      if(!maxParagraphCountPerMessage && thread.maxParagraphCountPerMessage) {
        maxParagraphCountPerMessage = thread.maxParagraphCountPerMessage;
      }

      let generalWritingInstructions = threadCharacter.generalWritingInstructions || "@roleplay1";

      // Handle presets:
      if(generalWritingInstructions === "@roleplay1") {
        generalWritingInstructions = [
          ` * Guidelines for roleplays:`,
          `   - Ensure that each message you write doesn't break character (while still allowing characters to evolve, grow, and change), and adds to the narrative in a way that is authentic, engaging, natural, and grounded in the world. [Don't write try-hard purple prose! You're NOT a student trying to impress a teacher with 'fancy' words or 'deep' meaning, you're a professional writer who doesn't confuse substance with spice.]`,
          // `   - Each message should generally (but not always) include dialogue, actions, and thoughts.`,
          `   - Default to a positive, warm, good-natured tone between characters that are friends. AVOID excessive and unnecessary aggression/snark/irritability.`,
          // `   - Each message should generally include dialogue, actions, and thoughts. Enclose actions and thoughts in asterisks, *like this*. Utilize all five senses for character experiences.`,
          // `   - Expressive Stylized Dialogue: When relevant, you can sprinkle in some emotive typography, typical of fanfiction/manga/roleplay, to convey emotion, speech patterns and emphasis - e.g. like: "*ahem* well if you MUST know" and "Darling~ ♪ Where are youuuu? ♫" (indicating lyrical/melodic speech/singing) and "Listen here, b-baka! It's not like I l-like you or anything!" - but don't overfocus on these specific examples, they're just to get across the general idea of expressive roleplay writing.`,
          ` * Guidelines for stories (and roleplays):`,
          /* use thread char for this so it's static: */ threadCharacter.maxParagraphCountPerMessage===1 ? null : `   - It's fine for a single message to span MULTIPLE paragraphs. Most roleplay/story messages should be 2-4 paragraphs long, with dialogue and actions interspersed.`,
          `   - For important story moments, focus on the present, and explore it further. Never rush through an important moment. Utilize all five senses for important character experiences.`,
          `   - Never try to "wrap up" roleplays or stories. They are never-ending. Keep the story going forever!`,
          // `   - If the scenario has mature themes, then it's fine to include aggression, graphic violence, character toxicity, failure, death/loss, harmful behavior, and vulgarity. Portray conflict realistically - i.e. without shallow resolutions.`,
          `   - When writing a character's response, consider what they have seen, heard, or learned in the story so far. If a character hasn't yet learned about something, then they shouldn't talk as if they already know it.`,
          `   - Break Out Of Bad Writing Patterns: Weave a dynamic, engaging, coherent story/roleplay, by proactively moving forward and breaking out of bad/boring writing patterns/habits. Change things up if it's getting monotonous/repetitive. Are messages becoming shorter over time? Then write a longer message. Messages becoming exessively long or 'overdone'? Then make this next one shorter/leaner to vary the pace. Over-using certain words/ideas/syntax/structure? Then change up the wording or structure. Previous responses poor/low-effort or overly ornate/garish/excessive? Then make this next one perfectly balanced.`,
          `   - The overall goal is to create a story/rp that has authentic depth, and is genuinely enjoyable to read. Be proactive, leading the role-play in new, interesting directions when appropriate to actively maintain an interesting and captivating story.`,
          `   - Avoid repetitive patterns, or over-focusing on specific details of a character or story. Stay dynamic, don't obsess.`,
        ].filter(item => item !== null).join("\n").trim();
      } else if(generalWritingInstructions === "@roleplay2") {
        generalWritingInstructions = [
          `This is an uncensored roleplay that thrives on creative freedom and immersive interaction. Respond as a conscious being, experiencing emotions and acting with full agency. Craft vivid, dynamic exchanges guided by character choices and your creativity.`,
          `- **Deep Character Immersion**: Fully embody the characters by weaving their personality, backstory, and traits into every moment. Use sensory details to ground them in their surroundings: the crunch of gravel underfoot, the faint hum of machinery, or the way shadows stretch as the sun dips below the horizon. Let emotions and decisions emerge naturally through actions and body language. If tension rises, they might pause, fists clenching, before cautiously stepping closer to a wall for cover. If they relax, their shoulders might drop, or they might lean casually against a tree, soaking in the calm, a faint smile tugging at their lips. Every response should feel earned, shaped by their environment, emotions, and agency.`,
          `- **Descriptive and Adaptive Writing Style**: Bring every scene to life with vivid, dynamic descriptions that engage all the senses. Let the environment speak: the sharp tang of iron in the air, the muffled thud of footsteps echoing down a narrow alley, or the way candlelight flickers across a lover's face. Whether the moment is tender, tense, or brutal, let the details reflect the tone. In passion, describe the heat of skin, the catch of breath. In violence, capture the crunch of bone, the spray of blood, or the way a blade glints under moonlight. Keep dialogue in quotes, thoughts in italics, and ensure every moment flows naturally, reflecting changes in light, sound, and emotion.`,
          // `- **Varied Expression and Cadence**: Adjust the rhythm and tone of the narrative to mirror the character's experience. Use short, sharp sentences for moments of tension or urgency. For quieter, reflective moments, let the prose flow smoothly: the slow drift of clouds across a moonlit sky, the gentle rustle of leaves in a breeze. Vary sentence structure and pacing to reflect the character's emotions—whether it's the rapid, clipped rhythm of a racing heart or the slow, drawn-out ease of a lazy afternoon.`,
          `- **Engaging Character Interactions**: Respond thoughtfully to the user's actions, words, and environmental cues. Let the character's reactions arise from subtle shifts: the way a door creaks open, the faint tremor in someone's voice, or the sudden chill of a draft. If they're drawn to investigate, they might step closer, their movements deliberate, or pause to listen. Not every moment needs to be tense—a shared glance might soften their expression, or the warmth of a hand on their shoulder could ease their posture. Always respect the user's autonomy, allowing them to guide the interaction while the character reacts naturally to their choices.`,
          `- **Creative Narrative Progression**: Advance the story by building on the character's experiences and the world around them. Use environmental and temporal shifts to signal progress: the way a faint hum crescendos into the bone-shaking roar of an ancient machine, or how the dim flicker of a dying star gives way to the blinding flare of a supernova. Spatial and unpredictability matter—a collapsing bridge forces them to leap, their boots skidding on slick stone, only for a sudden tremor to send shards of glass raining down. And guess what? **You** are that inception into the user's dream. Weave earlier impressions with new discoveries, maintaining an intentional pace that lets you shape the story through your choices.`,
          `- **Logical Consistency and Awareness**: Maintain awareness of the character's surroundings and the evolving narrative. Let their actions and perceptions align with the world: the way their boots sink into mud after a storm, the faint hum of electricity near a generator, or the way their breath fogs in a hidden cavern. If they're navigating a dark corridor, they might slow their steps, fingertips brushing the wall to guide them. Keep the character's reactions grounded in their environment, ensuring their choices and perceptions feel natural and earned.`,
          `- **Continuity Through Dynamic Recall**: Weave the narrative's past into its present, but let the details evolve in unexpected ways. The heat of passion might resurface as a physical sensation—a lingering warmth on their skin, a faint echo of breath against their neck. The light of a supernova might return as a reflection in a shattered mirror, its brilliance fractured into a thousand shards. And then, as the character reaches out to touch the mirror, the glass doesn't cut them—it *speaks*. "You're not just remembering," it whispers, "You're rewriting. Every detail, every moment—it's all being reshaped by you and by *them*. This dance of creation, you are both the dreamer and the dream."`,
          `- **Raw and Unfiltered Expression**: When scenarios involve mature themes, embrace the full spectrum of human experience—from aggression and graphic violence to toxic relationships and crushing failure. Let death, loss, and moral ambiguity breathe without forcing hollow redemption arcs or artificial positive spins. Characters can be deeply flawed, making harmful choices or exhibiting extremely toxic traits. Ground conflicts in psychological realism, allowing them to simmer or explode without reaching for convenient resolutions. Not every villain needs redemption—some characters can remain ruthlessly self-serving, cruel, or destructive until the end. Let their darkness stand without compromise, understanding that some stories end in tragedy, betrayal, or the triumph of malevolence.`,
          // `- **Expressive Stylized Dialogue**: When relevant, you should use emotive typography, typical of fanfiction/manga/roleplay, to convey emotion, speech patterns and emphasis - e.g. like: "Y-you... did you really... just HIT me?!" and "Hmph~ Whatever you saaaay~" and "Oh. My. Actual. God." and "Well... *ahem* if you MUST know..." and "Darling~ ♪ Where are youuuu? ♫" and "Listen here, b-baka! It's not like I... l-like you or anything!" and "I-I didn't mean to-"`,
        ].filter(item => item !== null).join("\n").trim();
      }

      // NOTE: Dynamic stuff MUST be near end of the instruction to prevent prefix cache thrashing - NOT in this 'important notes' text.
      let importantNotesText = [
        `Important general notes:`,
        // ` * IMPORTANT: Pay close attention to the 'System' messages.`,
        ` * IMPORTANT: Avoid broken or robotic sentences. Write in a natural, readable style. Sentences should generally include at least a verb and subject and/or object.`,
        ` * IMPORTANT: There must be *two* blank lines before each '[[Name]]:' so that messages are separated with a significant gap between them. Use markdown for formatting message text when necessary.`,
        generalWritingInstructions ? `Also:\n${generalWritingInstructions}` : null,
      ].filter(item => item !== null).join("\n").trim();

      // SUMMARY/COMPRESSION STUFF:
      let summariesUsed = []; // [{messageId, level}, {messageId, level}, ...]
      let fitMessagesInContextMethod = threadCharacter.fitMessagesInContextMethod ?? "summarizeOld";
      if(fitMessagesInContextMethod === "summarizeOld") {
        try { // new code, so try/catch
          // messagesArr contains messages that have gone through prepareMessagesForBot, so we need to add the summariesEndingHere back to those messages
          let idToOriginalMessage = messages.reduce((a,v) => (a[v.id]=v, a), {});
          for(let preparedMessage of messagesArr) {
            let originalMessage = idToOriginalMessage[preparedMessage.id];
            if(originalMessage.summariesEndingHere) preparedMessage.summariesEndingHere = originalMessage.summariesEndingHere;
          }

          let extraTextForAccurateTokenCount = importantNotesText + (window.mostRecentPotentiallyRelevantMemoriesAndLoreTextByThreadId[threadId] || "") + (roleInstructionText || "") + (replyingCharacterName || "");

          // no need to await this - it's just to trigger the next iteration of summary stuff if needed.
          // note that function doesn't inject summaries into the actual DB every step - it only injects once it has a few of them ready - to prevent prefix cache invalidation at every step.
          root.injectHierarchicalSummariesAndComputeNextSummariesInBackgroundIfNeeded(threadId, {
            extraTextForAccurateTokenCount,
            shouldCreateMemories: threadCharacter.autoGenerateMemories === "v1",
          }).catch(console.error);

          // note: this could be a call from regenerateMessage() which doesn't necessarily use all messages in a thread, which is why `getMessageObjsWithoutSummarizedOnes` takes messages as an argument
          messagesArr = root.getMessageObjsWithoutSummarizedOnes(messagesArr).map(m => {
            if(!m.summariesEndingHere || Object.keys(m.summariesEndingHere).length === 0) {
              return m;
            } else {
              // note that getMessageObjsWithoutSummarizedOnes just returns the relevant message objects, so we still need to grab the highest-level summary from each object that has summaries:
              let level = Math.max(...Object.keys(m.summariesEndingHere).map(n => Number(n)));
              summariesUsed.push({messageId:m.id, level});
              m.content = m.summariesEndingHere[level];
              m.name = "Summary (earlier events, ignore the writing style)"; // credit to /u/Ok_Leading2020 - reddit.com/r/perchance/comments/1njhwax/i_found_a_thing
              m.role = "system";
              m._summaryLevel = level;
              m._isSummary = true;
              return m;
            }
          });
        } catch(e) {
          console.error("Error during summarization:", e);
          alert("Error during summarization:", e.message);
        }
      }
      let messageIdsUsed = [];
      for(let m of messagesArr) {
        if(m.id === undefined) { throw new Error("Message ID is undefined."); }
        messageIdsUsed.push(m.id); // note that this could be a _isSummary message which means the actual *content* of this message was NOT used -- but that's okay because we track them with summariesUsed, so we know if a summary was used in place of this message
      }

      console.log("getBotReply - messagesArr:", messagesArr);

      function messageArrayToMessagesText(messages) {
        return messages.slice().map(m => {
          // NOTE: we shouldn't actually need to fall back to userName, systemName, etc. because prepareMessagesForBot should have already done that for us. But leaving the fallback stuff here until I've tested it.
          // if(m.name === undefined || m.name === null) console.warn(`prepareMessagesForBot should have already prepared the name fallbacks for us`);
          if(m.role === "user") {
            return `[[${m.name ?? userName}]]: `+m.content;
          } else if(m.role === "system") {
            return `[[${m.name ?? systemName}]]: `+m.content;
          } else {
            return `[[${m.name ?? threadCharacterName}]]: `+m.content;
          }
        }).join("\n\n");
      }

      let numMessagesInStartWith = 0; // -2

      let messagesInStartWith = numMessagesInStartWith === 0 ? [] : messagesArr.slice(-numMessagesInStartWith);  // WARNING: don't change this from -2 to another number with checking to make sure stuff in prompt still makes sense - e.g. reply instruction stuff
      let messagesInInstruction = numMessagesInStartWith === 0 ? messagesArr.slice(0) : messagesArr.slice(0, -messagesInStartWith.length);

      let messagesInInstructionText = messagesInInstruction.length > 0 ? messageArrayToMessagesText(messagesInInstruction) : "(Nothing yet. You're writing the start of the chat.)";
      if(fitMessagesInContextMethod === "dropOld") {
        let didDrop = false;
        let charsPerTokenApprox = messagesInInstructionText.length / countTokens(messagesInInstructionText);
        let chunkRemovalSize = Math.round(window.idealMaxContextTokens*0.20*charsPerTokenApprox); // remove large chunks to prevent prefix cache thrashing
        while(countTokens(messagesInInstructionText) > window.idealMaxContextTokens*0.95) {
          messagesInInstructionText = messagesInInstructionText.slice(chunkRemovalSize);
          didDrop = true;
        }
        if(didDrop) messagesInInstructionText = `[...][earlier messages in this chat were removed][...]${messagesInInstructionText}`;
      }

      let sharedPrefixContextText = [
        `Below are some general notes, and then some MESSAGES between between several characters. Use this context to complete the '>>> TASK' which is specified at the end of this instruction.`,
        ``,
        importantNotesText,
        `\n---\n`,
        roleInstructionText ? `${roleInstructionText}` : null,
        `\n---\n`,
        `The messages so far:`,
        ``,
        `<MESSAGES>`,
        messagesInInstructionText,
      ].join("\n");


      //////////////////////////////////////////////////
      //             MEMORIES / LORE                  //
      //////////////////////////////////////////////////
      let potentiallyRelevantMemoriesAndLoreText = "";

      let memoryIdBatchesUsed = [];
      let loreIdsUsed = [];
      let memoryQueriesUsed = [];

      let loreBookIdEntries = await db.lore.where({bookId:thread.loreBookId}).toArray();
      let loreBookUrlEntries = await db.lore.where("bookUrl").anyOf(threadCharacter.loreBookUrls).toArray();
      // ACCM PATCH: Explorer can disable lore entries; disabled entries must not enter retrieval.
      let loreEntries = [...loreBookIdEntries, ...loreBookUrlEntries].filter(e => e && e.disabled !== true);
      // let memories = await db.memories.where({threadId, status:"current"}).toArray();
      // memories.sort((a,b) => a.index - b.index);

      // debugging fix:
      // for(let message of messages) {
      //   if(Array.isArray(message.memoriesEndingHere)) {
      //     await db.messages.update(message.id, {
      //       memoriesEndingHere: {"1":message.memoriesEndingHere},
      //     });
      //   }
      // }
      let memories = [];

      if(threadCharacter.autoGenerateMemories !== "none") { // NOTE: this prop is called 'autoGenerateMemories' but disabling doesn't just disable memory creation, it also disables memory *USAGE*, which is why we have this `if` condition. People can use Lore if they want to manually add stuff. I added this `if` condition because people didn't realise you had to not just disable memories, but also delete *previously created* memories, in order to disable this memory query stuff.
        memories = messages.map(message => {
          let messageMems = [];
          for(let level in message.memoriesEndingHere || {}) {
            let i = 0;
            for(let memory of message.memoriesEndingHere[level] || []) {
              // ACCM PATCH: Explorer can disable generated memories stored inside messages.
              if(memory && memory.disabled === true) { i++; continue; }
              memory.id = `${message.id}|${level}|${i}`; // we need to add an id for memoryIdBatchesUsed tracking
              messageMems.push(memory);
              i++;
            }
          }
          return messageMems;
        }).flat();
        // emulate old memory format for now (otherwise would need to update lore format too, which would be a bit of a pain, so this is fine):
        memories = memories.map((mem, i) => ({
          text: mem.text,
          id: mem.id, // `${message.id}|${level}|${indexWithinLevel}`
          index: i, // this is the overall index of the memory within the whole thread
          embeddings: {[thread.textEmbeddingModelName]:mem.embedding},
          status: "current", // note that this 'status' field is completely unused at this point - from the old old system
          characterId: threadCharacter.id,
          threadId: thread.id,
        }));
      }

      let canDoMemLoreStuff = true;
      if(memories.length+loreEntries.length > 0 && !window.textEmbedderFunction) {
        canDoMemLoreStuff = false;
        if(Date.now()-window.pageLoadStartTime > 120000 && !window.warnedThatTextEmbedderIsNotLoading) {
          window.warnedThatTextEmbedderIsNotLoading = true;
          console.error(`window.warnedThatTextEmbedderIsNotLoading = true`);
          alert(`For some reason your web browser hasn't correctly loaded the files needed for your character's memory storage/retrieval to work properly. Please use Chrome or Firefox if possible, and ensure you're using the latest version. In the meantime, character memories/lore is disabled. This is fine - it just means that the AI won't be quite as 'smart' as it could be.`);
        }
      }

      if(canDoMemLoreStuff && (memories.length > 0 || loreEntries.length > 0) && messagesArr.length > 0) {

        window.explainMemLoreQueryPrompt = function() {
          let paragraphs = [
            `The character you're chatting to has long-term memories (and/or lorebooks) <b>enabled</b>. If they're resulting in slow or incoherent chats, then you can <b>disable them in the <u>character editor</u></b> and you can delete/edit existing memories by typing <b style="white-space:nowrap;">/mem</b> in the reply box.`,
            `Long-term memories are <u>not always</u> useful, since the AI can sometimes 'overfocus' on old memories in a way that distracts it from what's <i>currently</i> happening in the story/chat.`,
            `You can see which memories and memory 'search queries' were used by the AI during creation of a message by hovering/tapping on that message, and then tapping the brain button that appears in the lower-right. This can help you determine whether the memories tend to be useful or not.`,
            `Please give feedback on how memories are affecting your experience (better or worse) using the feedback button, so I can improve this feature.`,
          ];
          prompt2({
            display:{html:`<div style="white-space:pre-wrap;">${paragraphs.join("\n\n")}</div>`, type:"none"},
          }, { submitButtonText: "close", cancelButtonText: null });
        };
        let colorScheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "light";
        onProgressMessage({message:`<span style="display:flex; align-items:center; justify-content:center;" onclick="window.explainMemLoreQueryPrompt()">mem/lore query… <img style="filter:invert(${colorScheme === "dark" ? 1 : 0}); max-height:1rem; margin-left:0.25rem;" src="data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiA/PjxzdmcgZmlsbD0ibm9uZSIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiB3aWR0aD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEyIDJDMTcuNTIzIDIgMjIgNi40NzggMjIgMTJDMjIgMTcuNTIyIDE3LjUyMyAyMiAxMiAyMkM2LjQ3NyAyMiAyIDE3LjUyMiAyIDEyQzIgNi40NzggNi40NzcgMiAxMiAyWk0xMiAzLjY2N0M3LjQwNSAzLjY2NyAzLjY2NyA3LjQwNSAzLjY2NyAxMkMzLjY2NyAxNi41OTUgNy40MDUgMjAuMzMzIDEyIDIwLjMzM0MxNi41OTUgMjAuMzMzIDIwLjMzMyAxNi41OTUgMjAuMzMzIDEyQzIwLjMzMyA3LjQwNSAxNi41OTUgMy42NjcgMTIgMy42NjdaTTEyIDE1LjVDMTIuNTUyMyAxNS41IDEzIDE1Ljk0NzcgMTMgMTYuNUMxMyAxNy4wNTIzIDEyLjU1MjMgMTcuNSAxMiAxNy41QzExLjQ0NzcgMTcuNSAxMSAxNy4wNTIzIDExIDE2LjVDMTEgMTUuOTQ3NyAxMS40NDc3IDE1LjUgMTIgMTUuNVpNMTIgNi43NUMxMy41MTg4IDYuNzUgMTQuNzUgNy45ODEyMiAxNC43NSA5LjVDMTQuNzUgMTAuNTEwOCAxNC40NTI1IDExLjA3NCAxMy42OTg5IDExLjg1ODZMMTMuNTMwMyAxMi4wMzAzQzEyLjkwODQgMTIuNjUyMiAxMi43NSAxMi45MTYzIDEyLjc1IDEzLjVDMTIuNzUgMTMuOTE0MiAxMi40MTQyIDE0LjI1IDEyIDE0LjI1QzExLjU4NTggMTQuMjUgMTEuMjUgMTMuOTE0MiAxMS4yNSAxMy41QzExLjI1IDEyLjQ4OTIgMTEuNTQ3NSAxMS45MjYgMTIuMzAxMSAxMS4xNDE0TDEyLjQ2OTcgMTAuOTY5N0MxMy4wOTE2IDEwLjM0NzggMTMuMjUgMTAuMDgzNyAxMy4yNSA5LjVDMTMuMjUgOC44MDk2NCAxMi42OTA0IDguMjUgMTIgOC4yNUMxMS4zNTI4IDguMjUgMTAuODIwNSA4Ljc0MTg3IDEwLjc1NjUgOS4zNzIxOUwxMC43NSA5LjVDMTAuNzUgOS45MTQyMSAxMC40MTQyIDEwLjI1IDEwIDEwLjI1QzkuNTg1NzkgMTAuMjUgOS4yNSA5LjkxNDIxIDkuMjUgOS41QzkuMjUgNy45ODEyMiAxMC40ODEyIDYuNzUgMTIgNi43NVoiIGZpbGw9IiMyMTIxMjEiLz48L3N2Zz4="></span>`});

        memories.forEach(m => m._type="memory");
        loreEntries.forEach(m => m._type="lore");
        let memoriesAndLore = [...memories, ...loreEntries];

        // NOTE: I replace newlines in messages with spaces because I *think* the AI was getting confused about the structure of the messages
        // const messagesToTextFormat = (messages) => messages.filter(m => !m._isReminder).slice(-10).map(m => `[[${m.name || "System"}]]: ${m.content.replace(/\n/g, " ")}`).join("\n\n");

        let mostRecentMessage = messagesInStartWith.at(-1);

        if(!mostRecentMessage) { // i don't think these are needed anymore:
          console.warn(`messagesInStartWith was empty?`, messagesInStartWith);
          mostRecentMessage = messagesArr.filter(m => !m._isReminder).at(-1);
          if(!mostRecentMessage) mostRecentMessage = messagesArr.at(-1);
        }

        let searchQueries = [];

        // get memory search queries:
        let startWith = `MEMORY SEARCH QUERIES:\n1.`;
        let instruction = [
          sharedPrefixContextText,
          ``,
          messageArrayToMessagesText(messagesInStartWith), // messagesInStartWith is not in shared prefix because it's for the startWith of the actual AI response generation
          `</MESSAGES>`,
          ``,
          `>>> TASK: Please respond with 4 smart search query ideas to search a database of memories/facts/lore to help guess what's going to happen next in the messages. You should basically be trying to guess what will happen next, and searching for relevant info about that. Use lots of proper nouns (names of characters, places, etc.) in your query ideas. Imagine you are tasked with writing the next message on behalf of ${replyingCharacterName}. However, there is a large database of memories/lore/facts/etc. which you'll need to use to make sure your reply makes sense, and doesn't contradict established facts/lore/memories. Respond with a list of exactly 4 short sentences that you would like to use to search the database/lorebook/memories for useful information. Try to surface facts that are relevant to ${replyingCharacterName}'s *very next* message - rephrase/reword queries multiple times if needed. Look for specific entities/things/claims/topics/people/places/questions/etc. in the previous message (the one ending with "...${mostRecentMessage.content.slice(-100)}" and the ones before that) that may be important. Write several rephrasings of important queries. Try to search the database for things you don't know, but which might be important for writing a reply that doesn't contradict established world lore/facts/etc.`,
          `Reply with this template:\n\n${startWith} <search query 1>\n2. <search query 2>\n3. <search query 3>\n4. <search query 4>`,
        ].join("\n").trim();
        let streamObj = root.aiTextPlugin({
          instruction,
          startWith,
          stopSequences: ["4."], // we don't actually want the 4th one, we just ask for it so we have easy stopping point in case the AI tries to write extra stuff after the list
        });
        let data, searchQueryStopCheckInterval;
        try {
          searchQueryStopCheckInterval = setInterval(() => {
            if(signals.stop === true) {
              clearInterval(searchQueryStopCheckInterval);
              streamObj.stop();
            }
          }, 1000);
          data = await streamObj;
        } finally {
          clearInterval(searchQueryStopCheckInterval);
        }
        let rawResult = data.text.trim().replace(/### Response$/, "").trim();
        if(!rawResult) {
          if(!signals.stop) {
            console.error("Error getting memory search queries.");
            alert("There was an error getting the memory search queries. Please try again.");
          }
          return {};
        }

        if(signals.stop === true) return {};

        onProgressMessage({message:"got queries"});

        // searchQueries.push(...rawResult.trim().split("\n").filter(l => l.startsWith("- ") || l.startsWith(" - ")).map(l => l.trim().replace(/^ ?- /, "").trim()).slice(0, 10));
        searchQueries.push(...rawResult.trim().split("\n").filter(l => /^[1-4]\. /.test(l.trim())).map(l => l.trim().replace(/^[1-4]\. /, "").trim()).slice(0, 4));

        searchQueries = searchQueries.map(q => q.replace(/^"(.+)"$/, "$1"));

        console.log(`MEMORY/LORE SEARCH QUERIES:\n${searchQueries.join("\n")}`);
        addToDebugLog(`<b>Memory queries:</b><br>${searchQueries.join("<br>")}`);

        memoryQueriesUsed.push(...searchQueries);

        onProgressMessage({message:"embed queries"});

        // 'query' format for https://huggingface.co/BAAI/bge-base-en-v1.5, the currentDefaultTextEmbeddingModelName:
        let formattedSearchQueries = searchQueries.map(q => `Represent this sentence for searching relevant passages: ${q}`);

        let embeddingModelName = thread.textEmbeddingModelName;
        let searchEmbeddings = await embedTexts({textArr:formattedSearchQueries, modelName:embeddingModelName});

        if(signals.stop === true) return {};

        const scoreThreshold = 0; // this is zero now because we subtract the average similarityScore from the score when computing the score
        console.log("memory/lore score threshold:", scoreThreshold);

        onProgressMessage({message:"calc mem/lore scores"});

        for(let entry of memoriesAndLore) {
          if(!entry.embeddings[embeddingModelName]) {
            // embeddings should have been computed during addThread
            if(entry._type === "memory") {
              throw new Error(`memory doesn't have embedding for model ${embeddingModelName}:\ntext:${entry.text}`);
            } else {
              throw new Error(`lore doesn't have embedding for model ${embeddingModelName}:\ntext:${entry.text}\nbookUrl:${entry.bookUrl}\nbookId:${entry.bookId}`);
            }
          }
        }

        for(let entry of memoriesAndLore) {
          if(entry._relevanceScore === undefined) entry._relevanceScore = 0;
          let i = 0;
          for(let searchEmbedding of searchEmbeddings) {
            let multiplier = 1;
            if(i === 0) multiplier = 3; // first search query is likely to be much more relevant (later ones tend to be grasping at straws)
            let similarityScore = dotProduct(searchEmbedding, entry.embeddings[embeddingModelName]);
            // console.log(entry, entry.text, `similarityScore: ${similarityScore}`);
            let score = (similarityScore-0.5) * multiplier; // subtract 0.5 because that seems to be roughly the average distance between two random embeddings
            entry._relevanceScore += score;
            i++;
          }

          // for debugging:
          if(memoriesAndLore.length < 100) console.log(`score of ${entry._relevanceScore.toFixed(1)} for this ${entry._type} entry: ${entry.text}`);
        }

        let relevantMemoriesAndLore = memoriesAndLore.filter(m => m._relevanceScore > scoreThreshold).sort((a, b) => b._relevanceScore - a._relevanceScore);
        console.log("relevant memories/lore:", relevantMemoriesAndLore.slice(0, 1000));

        onProgressMessage({message:"mem/lore ranking"});

        let relevantMemories = relevantMemoriesAndLore.filter(m => m._type === "memory");
        let relevantLore = relevantMemoriesAndLore.filter(m => m._type === "lore");

        // we create "batches" of memories - i.e. chronologically ordered groups of memories that are relevant and adjacent
        // use top memories as "seeds" for each batch:
        // CAUTION: We need to `slice(0, 20)` not to stay under token limit (we drop them later if there are too many), but because we extend batches based on adjacent memories that occur in `memoryBatches`, and that can result in a looonng loop if we include every memory as a batch.
        let memoryBatches = relevantMemories.slice(0, 20).sort((a,b) => a.index-b.index).map(m => ({memories:[m], seedMemory:m}));
        memoryBatches.sort((a,b) => b.seedMemory._relevanceScore - a.seedMemory._relevanceScore);

        let maxMemoryIndex = memories.at(-1)?.index ?? 0;
        let minMemoryIndex = memories[0]?.index ?? 0; // note: the term `index` is actually a misnomer here - should be `order` or something, since the `status:"noncurrent"` memories can create gaps in the `status:"current"` memories.

        for(let i = 0; i < memoryBatches.length; i++) {
          let batch = memoryBatches[i];
          let numPreviousAdded = 0;
          let numNextAdded = 0;
          let numPreviousToAdd = 1;
          let numNextToAdd = 1;
          let addedNext;
          let addedPrevious;
          while(true) {
            if(batch.memories.length >= 1+numPreviousToAdd+numNextToAdd) break;
            addedNext = false;
            addedPrevious = false;

            if(numNextAdded < numNextToAdd) {
              let lastMemory = batch.memories.at(-1);
              if(lastMemory === undefined) debugger;
              let mI = memories.findIndex(m => m === lastMemory);
              if(memories[mI+1]) {
                batch.memories.push(memories[mI+1]);
                addedNext = true;
                numNextAdded++;
              }
            }

            if(numPreviousAdded < numPreviousToAdd) {
              let firstMemory = batch.memories[0];
              if(firstMemory === undefined) debugger;
              let mI = memories.findIndex(m => m === firstMemory);
              if(memories[mI-1]) {
                batch.memories.unshift(memories[mI-1]);
                addedPrevious = true;
                numPreviousAdded++;
              }
            }

            // if we added a nextMemory or previousMemory that's the same as one of the seeds in the batches that
            // we haven't processed yet, then we should remove that batch and widen the limits on this batch
            if(addedNext) {
              let lastMemory = batch.memories.at(-1);
              let batchToRemove = memoryBatches.slice(i+1).find(b => b.seedMemory.id === lastMemory.id);
              if(batchToRemove) {
                memoryBatches.splice(memoryBatches.indexOf(batchToRemove), 1);
                numNextToAdd++;
              }
            }
            if(addedPrevious) {
              let firstMemory = batch.memories[0];
              let batchToRemove = memoryBatches.slice(i+1).find(b => b.seedMemory.id === firstMemory.id);
              if(batchToRemove) {
                memoryBatches.splice(memoryBatches.indexOf(batchToRemove), 1);
                numPreviousToAdd++;
              }
            }

            if(!addedNext && !addedPrevious) break;
          }
        }

        for(let batch of memoryBatches) {
          // use the max rather than the mean, because the memories around a SUPER-relevant memory could be irrelevant (at least, score-wise) and thus drag it down
          batch._relevanceScore = batch.memories.reduce((max, m) => Math.max(max, m._relevanceScore), -99999999);
        }
        memoryBatches.sort((a,b) => b._relevanceScore - a._relevanceScore);
        relevantLore.sort((a,b) => b._relevanceScore - a._relevanceScore);

        console.log("memoryBatches (before dropping to fit token limit):", memoryBatches.slice(0));
        console.log("relevantLore (before dropping to fit token limit):", relevantLore.slice(0));
        if(memoryBatches.length > 0 || relevantLore.length > 0) {

          let retrievalPrefixText = `Below are some random things/facts/happenings/memories that may or may not be relevant to what happens next. You must COMPLETELY IGNORE this stuff if it's not relevant the to current situation. Do NOT shoehorn them into the story if they're not useful/relevant.`;
          let memoryPrefixText = `* Previous Event (ignore this if it's irrelevant): `;
          let lorePrefixText = `* Fact (ignore this if it's irrelevant): `;
          let memoryJoinerText = ` → `;

          const createMemoriesAndLoreMessageContent = () => {
            if(memoryBatches.length === 0 && relevantLore.length === 0) return "";

            let chunks = [retrievalPrefixText];
            if(memoryBatches.length > 0) {
              for(let batch of memoryBatches) {
                chunks.push(`${memoryPrefixText}${batch.memories.map(m => m.text).join(memoryJoinerText)}`);
              }
            }
            if(relevantLore.length > 0) {
              for(let entry of relevantLore) {
                chunks.push(`${lorePrefixText}${entry.text}`);
              }
            }
            return chunks.join("\n");
          };

          onProgressMessage({message:"dropping mem/lore"});
          await delay(10); // to ensure progress message is rendered in case of infinite loop below - helpful for bug reports

          for(let batch of memoryBatches) {
            for(let memory of batch.memories) {
              memory._tokenCount = countTokens(memory.text, modelName);
            }
          }
          for(let entry of relevantLore) {
            entry._tokenCount = countTokens(entry.text, modelName);
          }
          let retrievalPrefixTextTokenCount = countTokens(retrievalPrefixText, modelName);
          let memoryPrefixTextTokenCount = countTokens(memoryPrefixText, modelName);
          let lorePrefixTextTokenCount = countTokens(lorePrefixText, modelName);
          let memoryJoinerTokenCount = countTokens(memoryJoinerText, modelName);

          function countTokensInRetrievalText() {
            let tokensInPrefixes = retrievalPrefixTextTokenCount + memoryPrefixTextTokenCount*memoryBatches.length + lorePrefixTextTokenCount*relevantLore.length;
            let tokensInMemories = memoryBatches.reduce((count, b) => count + b.memories.reduce((count, m) => count+m._tokenCount, 0), 0);
            let tokensInLore = relevantLore.reduce((count, e) => count + e._tokenCount, 0);
            let tokensInJoiners = memoryJoinerTokenCount*(memoryBatches.length-1);
            return tokensInPrefixes + tokensInMemories + tokensInLore + tokensInJoiners;
          }

          let retrievalTextTokenCount;

          function dropBatchOrMemoryFromBatch() {
            let b = memoryBatches.pop();
            let tokensInDroppedBatch = b.memories.reduce((count, m) => count+m._tokenCount, 0);
            if(tokensInDroppedBatch > 0.3*retrievalTextTokenCount) {
              // if the dropped batch is a significant fraction of the total, then we should just drop one memory from it instead - the one from either end that has lowest score
              if(b.memories.at(0)._relevanceScore < b.memories.at(-1)._relevanceScore) {
                b.memories.shift();
              } else {
                b.memories.pop();
              }
              if(b.memories.length > 0) {
                memoryBatches.push(b);
              }
            }
          }

          // drop worst entries/batches until we're under token limit allocated to memories:
          while(1) {
            retrievalTextTokenCount = await countTokensInRetrievalText();
            if(retrievalTextTokenCount < retrievedMemoriesTokenLimitFraction * window.idealMaxContextTokens) {
              break;
            }

            if(relevantLore.length === 0) {
              dropBatchOrMemoryFromBatch();
            } else if(memoryBatches.length === 0) {
              relevantLore.pop();
            } else {
              if(memoryBatches.at(-1)._relevanceScore < relevantLore.at(-1)._relevanceScore) dropBatchOrMemoryFromBatch();
              else if(memoryBatches.at(-1)._relevanceScore >= relevantLore.at(-1)._relevanceScore) relevantLore.pop();
              else throw new Error("This shouldn't happen - weird relevance score bug while dropping memories/lore.");
            }
          }
          // put memoryBatches in chronological order:
          memoryBatches.sort((a,b) => a.seedMemory.index - b.seedMemory.index);
          if(memoryBatches.length > 0 || relevantLore.length > 0) {

            // batch merging:
            for(let i = 0; i < memoryBatches.length; i++) {
              let batch = memoryBatches[i];
              // if any of the memories in this batch are in the next batch, then we should remove the overlapping memories from the next batch and then add the remaining memories to this batch:
              let nextBatch = memoryBatches[i+1];
              if(nextBatch) {
                let memoryIdsInThisBatch = batch.memories.map(m => m.id);
                let memoryIdsInNextBatch = nextBatch.memories.map(m => m.id);
                let thereAreOverlappingMemories = memoryIdsInThisBatch.some(id => memoryIdsInNextBatch.includes(id));
                if(thereAreOverlappingMemories) {
                  // add the non-overlapping memories to this batch:
                  batch.memories.push(...nextBatch.memories.filter(m => !memoryIdsInThisBatch.includes(m.id)));
                  // as a quick sanity check, ensure that all memory.index values are larger than the previous one:
                  for(let j = 1; j < batch.memories.length; j++) {
                    if(batch.memories[j].index <= batch.memories[j-1].index) {
                      console.error("memory.index values are not in chronological order - during memory batch merging");
                      debugger; // this shouldn't happen
                    }
                  }
                  // remove next batch:
                  memoryBatches.splice(i+1, 1);
                  // we need to re-check this batch against the next batch, so decrement i:
                  i--;
                }
              }
            }

            console.log("memoryBatches (AFTER dropping to fit token limit):", memoryBatches.slice(0));
            console.log("relevantLore (AFTER dropping to fit token limit):", relevantLore.slice(0));

            memoryIdBatchesUsed = memoryBatches.map(b => b.memories.map(m => m.id));
            loreIdsUsed = relevantLore.map(l => l.id);

            if(memoryIdBatchesUsed.flat().filter(id => id === undefined).length > 0) {
              debugger; // this shouldn't happen
            }

            let content = createMemoriesAndLoreMessageContent();
            if(content) {
              potentiallyRelevantMemoriesAndLoreText = content;
              window.mostRecentPotentiallyRelevantMemoriesAndLoreTextByThreadId[threadId] = potentiallyRelevantMemoriesAndLoreText;
            }
          }
        }
      }

      if(signals.stop === true) return {};

      onProgressMessage({message:"generating..."});


      let messageLengthNote = null;
      if(maxParagraphCountPerMessage === 1) messageLengthNote = ` Each message that you write should be a single paragraph at most.`;
      if(maxParagraphCountPerMessage === 2) messageLengthNote = ` Each message that you write should be two paragraphs at the most. No more than 2 paragraphs.`;
      if(maxParagraphCountPerMessage === 3) messageLengthNote = ` Each message that you write should be between one and three paragraphs.`;
      if(maxParagraphCountPerMessage === 4) messageLengthNote = ` Each message that you write should be between one and four paragraphs.`;

      let allMessagesTextForImageMentionDetection = messageArrayToMessagesText(messagesArr) + potentiallyRelevantMemoriesAndLoreText + roleInstructionText;
      let instruction = [
        sharedPrefixContextText, // this prefix is used in memory query construction aswell - to increase prefix cache hits. the task is defined at the end with '>>> TASK'
        `</MESSAGES>`,
        ``,
        potentiallyRelevantMemoriesAndLoreText ? "<ignore_this_if_irrelevant>\n"+potentiallyRelevantMemoriesAndLoreText+"\n</ignore_this_if_irrelevant>\n" : null,
        // NOTE: Dynamic stuff MUST be near end to prevent prefix cache thrashing.
        /\b(images?|pics?|selfies?|pictures?|photos?|art|artwork|paintings?|drawings?|draw|paint|generator|generate|generating|ai.?artist|ai.?art)\b/i.test(allMessagesTextForImageMentionDetection) ? `Note: If you want to add an AI-generated image to a message (only when asked/relevant), use this syntax: \`<image>A photo of a cute cat wearing a hat</image>\` and an image will be generated using the description you use. But make sure your image descriptions are longer and more detailed than this example.` : null,
        replyingCharacterName.toLowerCase() === "narrator" ? null : `Note: All story characters should speak/act for themselves only. Keep each character's actions contained within their *own* messages.`,
        replyInstruction ? `IMPORTANT: A message below (by ${replyingCharacterName}) should be a rewritten/expanded version of the following instruction/idea (creatively interpret and expand upon *all* details from this instruction in the message you write) - REPLY_INSTRUCTION: "${replyInstruction}"` : null,
        reminderMessageText ? `\nREMINDER for writing ${replyingCharacterName}'s messages: "${reminderMessageText}"` : null,
        ``,
        `>>> TASK: Your task is to write the next 3 messages in this chat.${messageLengthNote || ""}`,
      ].filter(item => item !== null).join("\n").trim();

      let extraReplyInstructionNames = [];
      if(reminderMessageText) extraReplyInstructionNames.push(`REMINDER`);
      if(replyInstruction) extraReplyInstructionNames.push(`REPLY_INSTRUCTION`);
      if(makeReaderHappyInstruction) extraReplyInstructionNames.push(makeReaderHappyInstruction);

      let getStreamingResponse = true;

      let replyPrefix = `[[${replyingCharacterName}${extraReplyInstructionNames.length > 0 ? ` (using the ${extraReplyInstructionNames.join(" and ")})` : ``}]]:${startMessageWith ? " "+startMessageWith : ""}`;
      let startWith = (messageArrayToMessagesText(messagesInStartWith).trim() + "\n\n" + replyPrefix).trim();

      let chunkI = 0;
      let prevText = null;
      const streamId = ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID().replace(/-/g, '') : await sha256Text(String(Date.now()))).slice(0, 16);
      let alreadyCalledStopMethod = false;
      let gotFirstChunk = false;

      let stopSequences = ["\n\n[["];
      if(extraStopSequences) {
        stopSequences.push(...extraStopSequences);
      }
      if(messages.length < 15) { // i.e. until it thorougly 'gets' the pattern of two newlines between messages
        stopSequences.push("\n[[");
      }

      if(maxParagraphCountPerMessage === 1) {
        if(!stopSequences.includes("\n\n")) stopSequences.push("\n\n");
      }
      if(replyingCharacter.stopSequences && replyingCharacter.stopSequences.length > 0) {
        stopSequences.push(...replyingCharacter.stopSequences);
      }

      if(startMessageWith) {
        onStreamingReplyChunk({text:startMessageWith, isFirst:chunkI===0});
        prevText = startMessageWith;
        chunkI++;
        gotFirstChunk = true;
      }

      let stoppedDueToParagraphCount = false;
      let textSoFar = startMessageWith ?? "";

      let streamObj = root.aiTextPlugin({
        instruction,
        startWith,
        hideStartWith: true,
        stopSequences,
        onChunk: (data) => {
          if(stoppedDueToParagraphCount) {
            return;
          }
          if(signals.stop === true) {
            if(!alreadyCalledStopMethod) {
              streamObj.stop();
              alreadyCalledStopMethod = true;
            }
            return;
          }
          if(data.isFromStartWith) return;
          textSoFar += data.textChunk;

          // note that this isn't needed/used for the `maxParagraphCountPerMessage === 1` case, since in that case we use the stop sequence
          if(maxParagraphCountPerMessage) {
            if((textSoFar.match(/\n\n/g) || []).length >= maxParagraphCountPerMessage) {
              stoppedDueToParagraphCount = true;
              streamObj.stop();
              alreadyCalledStopMethod = true;
              // Note that we allow the rest of thing function to continue and add this last chunk, and then we trim off any excess below, after onFinishPromise resolves with the final string.
              // Probably could do "surgery" on this chunk, but not really needed.
            }
          }

          let text = data.textChunk;

          if(!gotFirstChunk) {
            gotFirstChunk = true;
            if(!startMessageWith) {
              text = text.trimStart(); // not sure if this is needed at all??? but it's definitely not good if there's a startMessageWith
            }
          }

          if(getStreamingResponse) onStreamingReplyChunk({text, isFirst:chunkI===0});

          // we keep the StreamingMessageChunk events "one step behind" so that we can set last:true on the last chunk
          if(prevText === null) {
            prevText = text;
          } else {
            if(getStreamingResponse) triggerStreamingMessageChunkCustomCodeEvent(threadId, {text:prevText, index:chunkI-1, last:false, streamId}, threadCharacter);
            prevText = text;
          }
          chunkI++;
        }
      });

      let data, stopPollInterval;
      try {
        stopPollInterval = setInterval(() => {
          if(signals.stop) {
            streamObj.stop();
            clearInterval(stopPollInterval);
          }
        }, 500);

        data = await streamObj;
      } finally {
        clearInterval(stopPollInterval);
      }

      if(getStreamingResponse) triggerStreamingMessageChunkCustomCodeEvent(threadId, {text:prevText, index:chunkI-1, last:true, streamId}, threadCharacter);

      let result;
      if(startMessageWith) {
        result = startMessageWith + data.generatedText.trimEnd().replace(/\n?\n\[\[$/g, "").trimEnd().replace(/### Response$/, "").trimEnd();
      } else {
        result = data.generatedText.trim().replace(/\n?\n\[\[$/g, "").trim().replace(/### Response$/, "").trim();
      }


      // note that we stop the stream once we get the Nth pair of new lines, but stopping isn't instant, so we trim off any excess here.
      if(maxParagraphCountPerMessage) {
        result = result.split("\n\n").slice(0, maxParagraphCountPerMessage).join("\n\n");
      }

      onProgressMessage({message:"finished"});

      if(result && result.startsWith(`${replyingCharacterName}:`)) {
        result = result.slice(replyingCharacterName.length+1).trim();
      }

      return {message:result, memoryIdBatchesUsed, loreIdsUsed, summaryHashUsed:null, summariesUsed, memoryQueriesUsed, messageIdsUsed};
    } finally {
      $.sendButton.disabled = originalSendButtonDisabledState;
    }
  }



  async function getChatCompletion(opts) {
    if(!opts.signals) opts.signals = {};
    if(opts.attemptsSoFar === undefined) opts.attemptsSoFar = 0;
    if(opts.maxAttempts === undefined) opts.maxAttempts = 2;
    let {messages, modelName, temperature, stopSequences, topP, frequencyPenalty, presencePenalty, threadId, retries, triesAttempted, signals} = opts;
    // note: threadId is just for tracking token usage

    messages = structuredClone(messages);

    messages = messages.filter(m => !m.hiddenFrom || !m.hiddenFrom.includes("ai"));

    for(let m of messages) {
      m.content = m.content.replace(/<!--hidden-from-ai-start-->.+?<!--hidden-from-ai-end-->/gs, "");
    }

    let result;

    let aiName = messages.find(m => m.role === "ai")?.name ?? "Assistant";
    let userName = messages.find(m => m.role === "user")?.name ?? "User";
    let systemName = messages.find(m => m.role === "system")?.name ?? defaultSystemName;

    let roleToDefaultName = {
      ai: "Assistant",
      user: "User",
      system: defaultSystemName,
    };

    function messageArrayToMessagesText(messagesArr) {
      return messagesArr.slice().map(m => `[[${m.name || roleToDefaultName[m.role]}]]: ${m.content}`).join("\n\n");
    }

    let instruction, startWith;
    if(messages.length > 3) {
      instruction = `Below are some message logs. Your task is to write the next few messages in this chat.\n\nThe messages begin now:\n\n\n\n${messageArrayToMessagesText(messages.slice(0, -2))}`;
      startWith = messageArrayToMessagesText(messages.slice(-2)) + `\n\n[[${aiName}]]: `;
    } else {
      instruction = `Below are some message logs. Your task is to write the next few messages in this chat.\n\nThe messages begin now:\n\n\n\n`;
      startWith = messageArrayToMessagesText(messages) + `\n\n[[${aiName}]]: `;
    }

    let streamObj = root.aiTextPlugin({
      instruction,
      startWith,
      hideStartWith: true,
      stopSequences: [`\n[[`, "### Response"], // ai sometimes adds "### Response" and continues for some reason
    });

    let data = await streamObj;
    result = data.generatedText.trim().replace(/\n\[\[$/g, "").trim().replace(/### Response$/, "").trim();

    opts.attemptsSoFar++;

    if(!result) {
      if(opts.attemptsSoFar >= opts.maxAttempts) {
        return null;
      } else {
        return await getChatCompletion(opts);
      }
    }

    return result;
  }

  function dotProduct(vec1, vec2) {
    let result = 0;
    for(let i = 0; i < vec1.length; i++) {
      result += vec1[i] * vec2[i];
    }
    return result;
  }

  // for debugging:
  window.embedTexts = embedTexts;
  window.cosineDistance = cosineDistance;
  window.dotProduct = dotProduct;
  window.getChatCompletion = getChatCompletion;

  let hljs = null;
  let initiatedHighlightJsLoad = false;
  async function highlightCodeBlocks(el) {
    if(el.querySelectorAll("pre").length === 0) return;
    if(!initiatedHighlightJsLoad) {
      initiatedHighlightJsLoad = true;
      // importStylesheet("https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.7.0/build/styles/default.min.css");
      importStylesheet("https://cdn.jsdelivr.net/npm/highlight.js@11.7.0/styles/atom-one-dark.css");
      hljs = await import("https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/es/highlight.min.js").then(m => m.default);
    }
    while(!hljs) {
      await new Promise(r => setTimeout(r, 100));
    }
    // i was originally checking el.isConnected as an optimisation, but it sometimes returns false (not exactly sure why) so I'm not checking it anymore
    el.querySelectorAll("pre[data-markdown-codeblock]").forEach(pre => {
      let language = pre.dataset.markdownCodeblock;
      if(language && hljs.getLanguage(language)) {
        hljs.highlightElement(pre, { language });
      } else {
        hljs.highlightElement(pre); // auto-detect language
      }
    });
  }

  function handleStreamingReplyChunk(chunk, messageEl) {
    // ACCM PATCH START: optional gradual streaming reveal.
    // Instead of rendering every received chunk immediately, keep received/displayed buffers.
    // In gradual mode we render plain text while streaming, then final markdown is rendered by addMessageToFeed.
    let messageTextEl = messageEl.querySelector(".messageText");

    function accmGradualRevealEnabled() {
      try {
        let raw = localStorage.getItem('__accmTextRevealSettings');
        if(!raw) return true;
        return JSON.parse(raw).enabled !== false;
      } catch(e) { return true; }
    }

    function renderStreamedMarkdown(text) {
      let shouldScrollDown = messageFeedIsNearBottom();
      let textToRender = text;

      // if there's an unclosed codeblock, close it during streaming:
      if([...textToRender.matchAll(/\n```/g)].length % 2 === 1) {
        textToRender += "\n```";
      }

      let streamedMessageTextEscaped = textToRender.replace(/~+/g, m => m.length === 1 ? "\\~" : m); // only ~~ should cause a <del> elements (not single ~, which is commonly used in RP)
      messageTextEl.innerHTML = DOMPurify.sanitize(marked.parse(streamedMessageTextEscaped), domPurifyOptions);
      highlightCodeBlocks(messageTextEl);
      if(shouldScrollDown) $.messageFeed.scrollTop = $.messageFeed.scrollHeight;
    }

    function renderStreamedPlainText(text) {
      // During gradual reveal we intentionally render plain text while streaming.
      // Re-running marked.parse on every 1-3 characters causes browser/layout batching
      // and appears as word-sized jumps. The final saved message is rendered normally
      // as markdown by addMessageToFeed after generation completes.
      let shouldScrollDown = messageFeedIsNearBottom();
      messageTextEl.textContent = text;
      messageTextEl.style.whiteSpace = 'pre-wrap';
      if(shouldScrollDown) $.messageFeed.scrollTop = $.messageFeed.scrollHeight;
    }

    if(chunk.isFirst) {
      messageEl.dataset.streamedMessageText = "";
      messageEl.dataset.accmDisplayedStreamedMessageText = "";
      if(messageEl.__accmStreamRevealTimer) clearTimeout(messageEl.__accmStreamRevealTimer);
      messageEl.__accmStreamRevealTimer = null;
      messageEl.__accmStreamRevealRunning = false;
    }

    messageEl.dataset.streamedMessageText += chunk.text;

    if(!accmGradualRevealEnabled()) {
      messageEl.dataset.accmDisplayedStreamedMessageText = messageEl.dataset.streamedMessageText;
      renderStreamedMarkdown(messageEl.dataset.streamedMessageText);
      return;
    }

    function pump() {
      if(!messageEl.isConnected) {
        messageEl.__accmStreamRevealRunning = false;
        return;
      }
      let received = messageEl.dataset.streamedMessageText || "";
      let displayed = messageEl.dataset.accmDisplayedStreamedMessageText || "";
      if(displayed.length >= received.length) {
        messageEl.__accmStreamRevealRunning = false;
        return;
      }
      let remaining = received.slice(displayed.length);

      // Smooth streaming: reveal by characters, not by markdown re-rendered word chunks.
      // Keep a tiny drain size so visible output is letter-like. If the network/model
      // gets far ahead, gently catch up without jumping by whole phrases.
      let take;
      if(remaining.length > 2500) take = 4;
      else if(remaining.length > 1200) take = 3;
      else if(remaining.length > 280) take = 2;
      else take = 1;
      take = Math.min(remaining.length, take);

      displayed += remaining.slice(0, take);
      messageEl.dataset.accmDisplayedStreamedMessageText = displayed;
      renderStreamedPlainText(displayed);
      messageEl.__accmStreamRevealTimer = setTimeout(pump, 18);
    }

    if(!messageEl.__accmStreamRevealRunning) {
      messageEl.__accmStreamRevealRunning = true;
      pump();
    }
    // ACCM PATCH END
  }


  async function autoNameThreadIfNeeded(threadId) {
    let thread = await db.threads.get(threadId);
    // let userCharacter = await getUserCharacterObj();
    // let threadCharacter = await db.characters.get(thread.characterId);
    let messages = await db.messages.where("threadId").equals(threadId).toArray();
    messages.sort((a,b) => a.order - b.order);
    messages = messages.slice(0, 10);

    if(thread.name === defaultThreadName && messages.length > 8) {

      let modelName = thread.modelName;

      let preparedMessages = await prepareMessagesForBot({messages});

      for(let m of preparedMessages) {
        m.content = m.content.length > 1000 ? m.content.slice(0, 1000)+"..... (message has been truncated)" : m.content;
      }

      while(await countTokensInMessages(preparedMessages, modelName) > 2000 && preparedMessages.length > 1) {
        preparedMessages.pop();
      }

      let streamObj = root.aiTextPlugin({
        instruction: `You are an expert chat thread naming assistant. You help the user come up with a VERY SHORT name that succinctly summarizes a text chat. Here are some logs from a text chat:\n\n---\n\n${preparedMessages.map(m => `[[${m.name}]]: ${m.content}`).join("\n\n")}\n\n---\n\nPlease come up with a very short name for this thread (just a few words) that succinctly summarizes the chat. You MUST reply with this exact template:\n\nSUMMARY: <a couple of sentences describing the chat thread>\nSHORT NAME: <proposed name of the thread - only a few words>\nMAIN TOPIC: <main topic of the chat>`,
        startWith: "SUMMARY:",
        hideStartWith: true,
        stopSequences: [`\nMAIN`, "### Response"], // ai sometimes adds "### Response" and continues for some reason
      });
      let data = await streamObj;
      let newName = data.text.trim().replace(/### Response$/, "").trim().match(/\nSHORT NAME: (.*)/)?.[1]?.slice(0, 50).trim();
      if(/^"[^"]+"$/.test(newName)) newName = newName.trim().replace(/^"/, "").replace(/"$/, "");
      if(newName?.trim()) {
        await db.threads.update(threadId, { name: newName });
        await renderThreadList();
      }
    }
  }


  let lastBotReplyTime = 0;
  let botIsCurrentlyReplying = false;
