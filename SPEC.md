# DemoFlow for Codex — MVP Technical Specification

## 1. Scope

This specification implements the first DemoFlow experience: a Codex plugin that creates a live guided-demo overlay for a locally running React/Vite application.

It deliberately excludes Playwright, autonomous clicking, screenshots, and video recording. A developer interacts with the real application manually while DemoFlow explains each step.

## 2. End-to-end interaction

1. The developer opens a repository in Codex and asks for a demo flow.
2. The DemoFlow skill inspects local source files and writes `.demoflow/<demo-id>/demo.spec.json`.
3. The MCP server validates a declared project development script and returns its exact command, working directory, and likely loopback URL without executing it.
4. Codex runs that command in its terminal session. Codex displays its native approval prompt, so the developer can approve, deny, or give feedback before the app starts.
5. Once the app is running, the MCP server starts a DemoFlow proxy on another local port.
6. The developer opens the proxy URL, for example `http://127.0.0.1:4173`.
7. The proxy fetches the original app HTML, injects the prebuilt overlay client, and forwards all app requests.
8. The overlay resolves the current step target in the real DOM, highlights it, and displays a tooltip.
9. The developer clicks and types in the real application. The overlay observes events and route changes, then advances when the step condition is met.
10. The developer exits Demo Mode or stops the preview; the original app is unaffected. Codex owns the app process.

## 3. Repository layout

```text
demoflow/
  .codex-plugin/
    plugin.json
  skills/
    generate-demo/
      SKILL.md
  mcp-server/
    src/
      index.ts
      start-command.ts
      proxy.ts
      spec.ts
      inspector.ts
  overlay/
    src/
      index.ts
      renderer.ts
      target.ts
      progression.ts
      styles.css
  sample-app/
  README.md
```

## 4. Plugin and MCP contract

The plugin skill must produce a reviewable `demo.spec.json` before opening the preview. The local MCP server exposes only typed, narrow tools:

| Tool | Input | Result |
| --- | --- | --- |
| `demoflow.inspect_project` | workspace path | framework, scripts, route/component/test-id summary |
| `demoflow.write_spec` | demo ID + validated spec | saved path |
| `demoflow.prepare_app_start` | declared package script | exact command, working directory, and likely local base URL; no process is started |
| `demoflow.create_preview` | base URL + spec path | proxy preview URL |
| `demoflow.open_preview` | preview ID | URL and current status |
| `demoflow.stop` | preview ID | proxy shutdown confirmation |

No generic shell-command tool is exposed to the model. The MCP server never executes a target-project command. After `prepare_app_start`, Codex runs the returned command in its own terminal session so its native approve / deny / explain prompt remains the security boundary.

### Preview lifecycle

Creating a preview is a one-shot handoff: once `create_preview` returns its URL, Codex gives that URL to the developer and finishes the request. Codex must not use an in-app browser or repeated `open_preview` calls as a completion check. If either the target app or preview exits, DemoFlow reports the stopped state and waits for an explicit developer request before trying again. It never silently recreates a preview or asks for a separate prose permission to do so.

## 5. Specification format

```ts
type DemoSpec = {
  version: 1;
  id: string;
  title: string;
  goal: string;
  startPath: string;
  steps: DemoStep[];
};

type DemoStep = {
  id: string;
  path?: string;
  target: Target;
  tooltip: { title: string; body: string };
  advance: AdvanceCondition;
};

type Target =
  | { testId: string }
  | { role: string; name: string }
  | { label: string }
  | { css: string };

type AdvanceCondition =
  | { type: "click-target" }
  | { type: "path-is"; path: string }
  | { type: "element-visible"; target: Target }
  | { type: "manual" };
```

Target resolution priority is `testId`, `role/name`, `label`, then CSS. Generated CSS selectors must be avoided unless no semantic target is available.

## 6. Local proxy behavior

The proxy listens only on loopback (`127.0.0.1`) and forwards requests to the local app base URL.

For HTML responses only, it injects before `</head>`:

```html
<script src="/__demoflow/overlay.js" defer></script>
<script>window.__DEMOFLOW_SPEC_URL__ = "/__demoflow/spec.json";</script>
```

The proxy owns these reserved paths:

```text
/__demoflow/overlay.js
/__demoflow/overlay.css
/__demoflow/spec.json
/__demoflow/status
```

All other paths, methods, headers, cookies, query parameters, and response status codes are forwarded to the upstream app. WebSocket forwarding is a stretch requirement; the MVP sample app must work without it.

The proxy must not modify upstream JavaScript bundles, API responses, static assets, or project files.

## 7. Overlay behavior

The overlay has three layers:

1. A dimmer with a transparent cutout around the active target.
2. A tooltip anchored beside the target.
3. A compact control bar: Restart, Skip, Exit, and step count.

The dimmer and target highlight use `pointer-events: none`; the real app stays interactive. The control bar alone uses `pointer-events: auto`. Restart returns to the configured `startPath`; it never attempts to undo arbitrary application state step by step.

The overlay listens for `click`, `input`, `submit`, `popstate`, and URL changes. It resolves the next step after the configured `advance` condition becomes true. A `MutationObserver` retries target lookup for up to five seconds after navigation or a condition change.

When a target cannot be found, show a non-blocking "Target unavailable" panel with Exit and Skip controls, and report the target ID/path to the MCP status endpoint.

## 8. Local source inspection

The first implementation uses a deterministic scanner before asking Codex to write the final flow:

- detect `package.json` scripts and framework hints
- collect route files and route strings
- collect `data-testid` values
- collect visible button/label text from JSX/TSX where safe
- list existing Playwright/Cypress test names without executing them

The scanner writes a compact `.demoflow/app-map.json`. Codex receives this map and selected source snippets, not a full browser DOM or continuous visual stream.

## 9. Security and privacy

- Bind servers to loopback only.
- Never expose preview URLs on a LAN by default.
- Do not upload project source, DOM snapshots, recordings, or artifacts to DemoFlow infrastructure; none exists in MVP.
- Require Codex's native command approval before executing a dev script.
- Block non-local target URLs by default.
- Never persist cookies, form values, or credentials in `demo.spec.json`.
- Do not inject into production URLs.

## 10. Acceptance tests

The included Vite sample app must pass these manual checks:

1. `prepare_app_start` returns a declared script, working directory, and a valid local URL hint without starting a process.
2. Codex displays its native command approval before starting the sample app.
3. `create_preview` returns a separate local URL.
4. Opening the preview displays an overlay over the real sample app.
5. Clicking the highlighted real button changes the app state and advances the overlay.
6. Navigating to another route preserves the overlay and displays the next step.
7. Exit removes the overlay without stopping or altering the source app.
8. Stopping DemoFlow stops only the proxy; Codex owns the app process.
9. `git diff` after a run contains only ignored `.demoflow/` artifacts.

## 11. Deferred work

- Browser extension packaging
- WebSocket/HMR proxy support for every dev server
- Automatic code repair when selectors change
- Playwright auto-run, recording, screenshots, and exports
- Hosted sharing and analytics
