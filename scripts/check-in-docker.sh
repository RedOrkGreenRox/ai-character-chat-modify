#!/usr/bin/env bash
set -euo pipefail

IMAGE="accm-tools:latest"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

docker build -f "$ROOT_DIR/Dockerfile.tools" -t "$IMAGE" "$ROOT_DIR"
docker run --rm -v "$ROOT_DIR:/workspace" "$IMAGE" bash -lc '
  set -euo pipefail
  cd /workspace/ai-character-chat-modify
  python3 tools/regression.py
  cd /workspace
  node --check workshop-backend/src/worker.js
  node --check fixed-worker.js
'
