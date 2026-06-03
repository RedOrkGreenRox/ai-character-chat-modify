        // we create "batches" of memories - i.e. chronologically ordered groups of memories that are relevant and adjacent
        // use top memories as "seeds" for each batch:
        // CAUTION: We need to `slice(0, 20)` not to stay under token limit (we drop them later if there are too many), but because we extend batches based on adjacent memories that occur in `memoryBatches`, and that can result in a looonng loop if we include every memory as a batch.
