        // NOTE: I replace newlines in messages with spaces because I *think* the AI was getting confused about the structure of the messages
        // const messagesToTextFormat = (messages) => messages.filter(m => !m._isReminder).slice(-10).map(m => `[[${m.name || "System"}]]: ${m.content.replace(/\n/g, " ")}`).join("\n\n");
