# DemoFlow for Codex

Turn a local web application into a live, explainable guided demo with a Codex prompt.

DemoFlow reads a local project to create a versioned `demo.spec.json`, then serves the running app through a loopback-only proxy that injects a temporary walkthrough overlay. The original app remains interactive and its source code is not changed.

## Status

Early Build Week prototype. The initial repository contains the product definition, Codex plugin scaffold, and local MCP runtime scaffold.

## Documents

- [Product requirements](PRD.md)
- [Technical specification](SPEC.md)
- [Build checklist](CHECKLIST.md)

## Intended experience

1. Open a supported app repository in Codex.
2. Ask DemoFlow for a short user journey.
3. Approve the generated `demo.spec.json` and local development script.
4. Open Demo Mode at a second localhost URL.
5. Click through the real application while tooltips explain each feature.

## Development

The current first target is macOS + Node.js 20+ + a Vite/React sample app. The MCP server source is at `plugins/demoflow/mcp-server`.

No application source files are changed to enable Demo Mode. Generated specs are intended to live in `.demoflow/`, which is ignored by Git by default.
