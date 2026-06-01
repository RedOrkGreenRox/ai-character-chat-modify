        // note that we can't just remove the last two instruction summaries here - they aren't necessarily the same as the summaries from the `exampleBlocksForStartWith` because they may have been 'compressed' into a higher level, so there can actually be no overlap at all.
        // so we need to pop the instructionSummaries off based on the ones that are actually in the example blocks:
