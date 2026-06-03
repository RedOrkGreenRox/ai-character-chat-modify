        // Note: It may seem brittle to choose an *index* to inject the summary at, but we also check to ensure the previous message matches.
        // And if the text has since been edited, that's fine - the summary just gets thrown away and we re-do it next time the send button is clicked.
