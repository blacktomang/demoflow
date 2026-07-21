# Repository Guidelines

## Project Structure & Module Organization

DemoFlow is a local Codex plugin. Its primary implementation lives in `plugins/demoflow/mcp-server/src/`: `index.ts` registers MCP tools, while modules such as `inspector.ts`, `proxy.ts`, and `spec.ts` own focused behavior. Node test files live in `plugins/demoflow/mcp-server/test/` and exercise compiled output. The injected browser UI is `plugins/demoflow/overlay/overlay.js`; keep it dependency-free and compatible with proxy injection. `plugins/demoflow/runtime/` contains the committed bundled runtime used in releases. Use `plugins/demoflow/sample-app/` to manually verify walkthrough behavior. Product and implementation context is in `PRD.md`, `SPEC.md`, and `CHECKLIST.md`.

## Build, Test, and Development Commands

Run commands from each package directory:

```bash
cd plugins/demoflow/mcp-server
pnpm test            # compile TypeScript, then run node:test suites
pnpm build           # write compiled server files to dist/
pnpm package-plugin  # build the distributable plugin bundle
pnpm dev             # watch and run the MCP server during development

cd ../sample-app
pnpm dev             # start the Vite verification app
pnpm build           # type-check and produce a production build
```

Use Node.js 20 or newer. Install dependencies with `pnpm install` only in a contributor checkout.

## Coding Style & Naming Conventions

Write strict TypeScript using ESM imports and explicit types where inference is unclear. Follow the existing four-space indentation, semicolons, double-quoted strings, and concise single-purpose functions. Use `camelCase` for variables and functions, `PascalCase` for types, and kebab-case for demo IDs (for example, `onboarding-flow`). Keep MCP tool names and JSON fields stable; they are part of the plugin contract. No separate formatter or linter is configured, so match nearby code and rely on `pnpm build` for type checks.

## Testing Guidelines

Add or update a `.test.mjs` file in `mcp-server/test/` for behavior changes. Name tests with clear outcomes, such as `test("rejects non-loopback URLs", ...)`. Tests import from `../dist/`, so run `pnpm test` rather than invoking an individual test before compiling. Cover success paths and meaningful validation or recovery cases; no coverage threshold is configured. For overlay or proxy work, also run the sample app and complete the affected walkthrough manually.

## Commit & Pull Request Guidelines

Recent commits use short imperative subjects without conventional-commit prefixes, such as `Improve DemoFlow guidance and recovery`. Keep each commit focused and describe the user-visible change. Pull requests should summarize behavior changes, list commands run, link the relevant issue or requirement when available, and include screenshots or a short recording for overlay/UI changes. Do not commit generated `dist/`, `node_modules/`, or local `.demoflow/` artifacts unless a release workflow explicitly requires them.
