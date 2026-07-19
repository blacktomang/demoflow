#!/bin/sh
# DemoFlow's MCP entrypoint. Do not rely on an internal ChatGPT runtime.

set -eu

if ! command -v node >/dev/null 2>&1; then
  echo "DemoFlow requires Node.js 20 or newer, but 'node' was not found in your PATH." >&2
  echo "Install Node.js from https://nodejs.org/, restart Codex, then try DemoFlow again." >&2
  exit 1
fi

NODE_VERSION="$(node -p 'process.versions.node' 2>/dev/null || true)"
NODE_MAJOR="${NODE_VERSION%%.*}"

case "$NODE_MAJOR" in
  ''|*[!0-9]*)
    echo "DemoFlow could not determine your Node.js version." >&2
    echo "Install Node.js 20 or newer, restart Codex, then try DemoFlow again." >&2
    exit 1
    ;;
esac

if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "DemoFlow requires Node.js 20 or newer; found Node.js $NODE_VERSION." >&2
  echo "Update Node.js at https://nodejs.org/, restart Codex, then try DemoFlow again." >&2
  exit 1
fi

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
exec node "$SCRIPT_DIR/index.js"
