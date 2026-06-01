        while(1) {
          if(instructionSummaries.length === 0) break;
          if(exampleBlockSummaries.includes(instructionSummaries[instructionSummaries.length-1])) {
            instructionSummaries.pop();
            continue;
          }
          break;
        }

        let startWithBlocks = exampleBlocksForStartWith.map((block) => ({messages:block.slice(0, -1), summary:block.slice(-1)[0]}));
        startWithBlocks.push({messages:messagesToSummarizeFromFinalBlock, summary:""});

        let startWith = startWithBlocks.map(({messages, summary}, blockI) => {
          let letterLabel = "";
          if(blockI===0) letterLabel = "[A]";
          if(blockI===1) letterLabel = "[B]";
          if(blockI===2) letterLabel = "[C]";

          let messagesText = messages.map((message, mi) => {
            message = message.replace(/\n/g, " ").trim();
            return `${summaryLevel === 1 ? `(${mi+1}) ` : ""}${message}`; // we prefix bottom-level messages with numbers, but not SUMMARY^N messages.
          }).join(" ");

          summary = summary.replace(/\n/g, " ").trim();

          return `>>> FULL TEXT of ${letterLabel}: ${messagesText}\n>>> SUMMARY of ${letterLabel}: ${summary}`;
        }).join("\n---\n"); // NOTE: Need to ensure this joiner matches the task prompt below

        // since it's possible for there to be no blocks before the messages to summarize
        startWith = startWith.trim(); // this is also important to prevent whitespace at end of startWith

        // This shared prefix is extracted above so that memory creation (after summary creation) is sure to hit the prefix cache.
        let sharedContextPrefixText = [
          `Below is${extraContext ? ` some context, plus` : ""} a summary of some events. You must use this information to complete the '@@@ TASK' specified at the bottom of this instruction.`,
          `${extraContext ? `\n# Potentially Useful Context (may or may not be relevant):\n${extraContext}\n` : ""}`,
          `# Summary of Previous Events:`,
        ].join("\n").trim();

        // WARNING: In functions defined within Perchance lists, *full* dedentation of *every* line happens automatically. If you move this into a <script> function, then this needs to be dedented manually.
        const summaryTaskPrompt = `@@@ TASK: Your task is to generate some text and then a 'SUMMARY' of that text, and then do that a few more times. Above are the characters and the initial scenario, and a summary of earlier events. You must write the text, and then a summary of that text that you wrote, and then some more text, and a summary of that new text, and so on. Each summary should be a single paragraph of text which summarizes the important details from the preceding 'full text' to roughly half its original size.
        Use this format/template for your response:
        \`\`\`
        >>> FULL TEXT of [A]: <some text>
        >>> SUMMARY of [A]: <a one-paragraph summary of the [A] text>
        ---
        >>> FULL TEXT of [B]: <some text>
        >>> SUMMARY of [B]: <a one-paragraph summary of the [B] text>
        ---
        >>> FULL TEXT of [C]: <some text>
        >>> SUMMARY of [C]: <a one-paragraph summary of the [C] text>
        \`\`\`
        Again, your task is to write some text labelled with a letter, and then a summary of that text, and then some new text, and then a summary of that new text, and so on. Each summary should be a single paragraph of text which summarizes the new text to roughly half its original length. Don't add flowery prose to summaries. Summary text should contain only the most important information, and should use well-phrased sentences with natural structure and correct grammar.
        NOTE: Don't append any other commentary/notes in your summaries (e.g. no word counts or commentary after completing the task). Just do the task and then end your response.
        IMPORTANT: Avoid repetition within summaries! If there are erroneously repeated elements in the full text, then remove or ignore them when writing your well-phrased summary.
        TIP: In order to ensure the summary is half the length of the full text, you should consider what's actually happening in the story at a "higher level", rather than simply re-stating all the individual facts in a terse form. The summary should be a higher-level explanation of the full text.
        TIP: Ensure that your summaries use full, natural, readable sentences, with correct grammar. You can optionally remind yourself of this requirement in parentheses before one of the summaries.`.trim();

        // try to fix 'over-compression' bug (see 'TIP' in instruction, above):
        startWith = startWith.trim().slice(0, -1) + " (full, natural, readable sentences with correct grammar):";

        let promptOptions = {
          instruction: [ // IMPORTANT: if you change this instruction, make sure you don't affect the shared prefix cache with the memory generation, below
            sharedContextPrefixText,
            (instructionSummaries.length > 0 ? instructionSummaries : ["(None.)"]).join("\n"),
            ``,
            summaryTaskPrompt,
          ].join("\n").trim(),
          startWith,
          stopSequences: ["\n\n", "\n---", "\n>>> FULL TEXT", "FULL TEXT"],
        };
        let data = await root.aiTextPlugin(promptOptions);
        if(data.stopReason === "error") continue; // could retry a few times, but this is no big deal, since every message sent triggers another attempt

        let summary = data.generatedText.trim().replace(/\n+/g, " ").trim().replace(/---$/, "").replace(">>> FULL TEXT", "").replace("FULL TEXT", "").trim();
        if(!summary.trim() || (instructionSummaries[instructionSummaries.length-1] || "").trim() === summary.trim()) {
          // AI has copied the previous summary, which sometimes happens.
          console.warn("AI copied previous summary. Skipping this summary level for this 'round'.");
          continue;
        }

        // Automatically fix repetition within summaries:
        if(summary.split(summary.slice(-30)).length > 5) { // detect repetition of the final 30 chars many times, earlier in the text
          console.warn("Repeition detected within summary. Fixing...");
          let result = await root.aiTextPlugin({
            instruction: [
              `Does the following story summary snippet shown within <story_summary_snippet>...</story_summary_snippet> include erroneous/unnecessary repetition? If so, respond with fixed, repetition-free text within <fixed_story_summary_snippet>...</fixed_story_summary_snippet>. If the text is fine, then just respond with exactly 'no_repetition', and nothing more.`,
              ``,
              `<story_summary_snippet>`,
              `${summary}`,
              `</story_summary_snippet>`,
              ``,
              `Your response should either be 'no_repetition' or start with <fixed_story_summary_snippet> and give the repetition-free summary, and then end with </fixed_story_summary_snippet>. Feel free to just respond with 'no_repetition' if there's no repetition. Don't add any extra commentary.`,
            ].join("\n"),
            stopSequences: ["</fixed_story_summary_snippet>"],
          });
          if(result.stopReason === "error") continue;
          let fixedSummary = result.generatedText.match(/<fixed_story_summary_snippet>(.+)<\/fixed_story_summary_snippet>/s)?.[1].trim();
          console.warn("fixedSummary:", fixedSummary)
          if(fixedSummary) summary = fixedSummary;
        }

        let messagesSummarizedText = messagesToSummarizeFromFinalBlock.map((message, i) => {
          message = message.replace(/\n/g, " ").trim();
          return `(${i+1}) ${message}`;
        }).join(" ");

        // Generate memories if they're enabled, and if this is a level 2 summary. We use level 2 summaries because level 1 tends not to have enough 'substance'/info-density to extract several lore/fact entries from.
        let memories;
        if(summaryLevel === 1 && opts.shouldCreateMemories) {

          // WARNING: In functions defined within Perchance lists, *full* dedentation of *every* line happens automatically. If you move this into a <script> function, then this needs to be dedented manually.
          const memoryTaskPrompt = `@@@ TASK: Your task is condense the *NEW_TEXT* below into a series of up to 3 lore/memory/fact entries which can be added to a database of facts about this story/world/roleplay/chat. You must extract "timeless facts", not temporary facts.
          - An example of a "timeless fact" is "<char> was born in <town>". An example of a temporary fact is "<char> is hungry right now". We only want to put timeless facts in the database. Things that are likely to *always* be true.
          - You should aim to make each entry fully self-contained, since an entry may be read on its own. Within each fact, provide enough surrounding context such that it would make sense if read on its own. Each entry must be self-contained.
          - Give enough context so there there is no ambiguity in what/who is being referenced in each lore/memory entry that you write.
          - Each entry should be no more than 3 sentences.
          - Writing facts about specific significant/interesting events that happened is permissable, so long as you give enough details to deduce EXACTLY *when* AND *where* it happened. Don't leave any ambiguity.
          - Use actual *names* instead of pronouns or other relative references. For example, instead of "He said to her..." you should write "Bob said to Alice...". And instead of "this town" you should write the full name of the town/location.
          - If you're unsure whether a fact is "timeless", then you should err on the side of caution by adding more context. E.g. instead of "Bob is kind to Alice" (BAD, because may not be true forever), you should say "Bob was kind to Alice when he first met her." (GOOD because, if true, will *always* be true - i.e. it's a timeless version of the fact)

          IMPORTANT: Do NOT write about already-known things. Don't repeat things that we already know from the above context and previous events. Do NOT mention things from above character descriptions. Only add *new* things that we learned from the NEW_TEXT. Your task is to extract **NEW** information that we didn't already know. Only from NEW_TEXT.

          # NEW_TEXT:
          ${messagesSummarizedText}

          Use this format/template for your response:

          # Lore/memory entries from NEW_TEXT:
          1. <something we can deduce directly from NEW_TEXT>
          2. <something else can deduce directly from NEW_TEXT>
          3. <another thing can deduce directly from NEW_TEXT>
          `.trim();

          let data = await root.aiTextPlugin({
            instruction: [ // IMPORTANT: if you change this instruction, make sure you don't affect the shared prefix cache with the summary generation, above
              sharedContextPrefixText,
              (summariesAtThisLevelAndAbove.length > 0 ? summariesAtThisLevelAndAbove : ["(None.)"]).join("\n"),
              ``,
              memoryTaskPrompt,
            ].join("\n").trim(),
            startWith: [
              `# Lore/memory entries from NEW_TEXT:`,
              `1.`,
            ].join("\n"),
            stopSequences: ["\n4."],
          });
          if(data.stopReason === "error") continue; // could retry a few times, but this is no big deal, since every message sent triggers another attempt

          memories = ("1."+data.generatedText).trim().split("\n").map(l => l.trim()).filter(l => l && /^[0-9]\. .+/.test(l)).map(l => l.replace(/^[0-9]\. /, ""));
        }

        console.log("----------------");
        console.log("----------------");
        console.log("----------------");
        console.log("𝗟𝗘𝗩𝗘𝗟:", summaryLevel);
        // console.log("𝗜𝗡𝗦𝗧𝗥𝗨𝗖𝗧𝗜𝗢𝗡:", instruction);
        // console.log("𝗦𝗧𝗔𝗥𝗧𝗪𝗜𝗧𝗛:", startWith);
        console.log("𝗜𝗡𝗣𝗨𝗧 𝗧𝗘𝗫𝗧:", messagesSummarizedText);
        console.log("𝗦𝗨𝗠𝗠𝗔𝗥𝗬:", summary);
        console.log("𝗠𝗘𝗠𝗢𝗥𝗜𝗘𝗦:", memories || null);
        console.log("----------------");
        console.log("----------------");
        console.log("----------------");

        window.__aiHierarchicalSummaryStuff[threadId].summariesReadyToInject.push({summarizedMessages:messagesToSummarizeFromFinalBlock, lastMessageSummarizedId, summary, memories, level:summaryLevel});
      }
    } catch(e) {
      console.error(e);
    } finally {
      window.__aiHierarchicalSummaryStuff[threadId].alreadyDoingSummary = false;
    }
  })();


