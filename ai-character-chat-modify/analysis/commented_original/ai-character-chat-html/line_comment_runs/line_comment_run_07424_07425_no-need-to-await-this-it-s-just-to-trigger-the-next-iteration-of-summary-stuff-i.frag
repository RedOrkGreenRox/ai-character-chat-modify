          // no need to await this - it's just to trigger the next iteration of summary stuff if needed.
          // note that function doesn't inject summaries into the actual DB every step - it only injects once it has a few of them ready - to prevent prefix cache invalidation at every step.
