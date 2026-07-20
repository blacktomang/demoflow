# DemoFlow for Codex — MVP Technical Specification

## 1. Scope

This specification implements the first DemoFlow experience: a Codex plugin that creates a live guided-demo overlay for a locally running React/Vite application.

It deliberately excludes Playwright, autonomous clicking, screenshots, and video recording. A developer interacts with the real application manually while DemoFlow explains each step.

## 2. End-to-end interaction

1. The developer opens a repository in Codex and asks for a demo flow.
2. For a new demo, the DemoFlow skill inspects local source files and writes `.demoflow/<demo-id>/demo.spec.json` plus a compact app-map snapshot. A saved demo can run directly without this inspection.
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
| `demoflow.list_demos` | workspace path | saved demo titles, goals, steps, and saved fingerprints without a source scan |
| `demoflow.check_demo_freshness` | workspace path + demo ID | `current`, `stale`, or `unknown` after an on-demand compact scan |
| `demoflow.inspect_project` | workspace path | framework, scripts, route, test-ID, and source-relative UI-control summary |
| `demoflow.suggest_demo_starts` | workspace path + optional requested outcome | up to three ranked customer-facing source controls; a choice aid, not a generated spec |
| `demoflow.inspect_branch_changes` | workspace path + optional base branch | local base/current branches, commit SHAs, and changed-file summary for a branch-aware demo |
| `demoflow.write_spec` | demo ID + validated spec | saved path, demo-local app-map snapshot, and fingerprint |
| `demoflow.prepare_app_start` | declared package script | exact command, working directory, and likely local base URL; no process is started |
| `demoflow.create_preview` | base URL + spec path | proxy preview URL |
| `demoflow.open_preview` | preview ID | URL and current status |
| `demoflow.stop` | preview ID | proxy shutdown confirmation |

No generic shell-command tool is exposed to the model. The MCP server never executes a target-project command. After `prepare_app_start`, Codex runs the returned command in its own terminal session so its native approve / deny / explain prompt remains the security boundary.

### Preview lifecycle

Creating a preview is a one-shot handoff: once `create_preview` returns its URL, Codex gives that URL to the developer and finishes the request. Codex must not use an in-app browser or repeated `open_preview` calls as a completion check. Browser failures are retained as structured local reports; the failure panel offers a copyable repair request. On the developer's explicit “repair” request, Codex reads the report through `open_preview` and fixes only the failed step. MCP cannot wake or message an already-completed Codex task, so DemoFlow never silently retries or recreates a preview.

## 5. Specification format

```ts
type DemoSpec = {
  version: 1;
  id: string;
  title: string;
  goal: string;
  startPath: string;
  intro?: { title: string; body: string };
  provenance?: { baseBranch: string; baseCommit: string; currentBranch: string; currentCommit: string };
  presentation?: { theme: "presenter" | "minimal" | "debug" };
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
  | { role: string; name: string; withinText?: string; occurrence?: number }
  | { label: string }
  | { css: string };

type AdvanceCondition =
  | { type: "click-target" }
  | { type: "input-target"; minLength?: number }
  | { type: "input-and-click"; minLength?: number; submitTarget: Target }
  | { type: "path-is"; path: string }
  | { type: "element-visible"; target: Target }
  | { type: "manual" };
```

Target resolution priority is `testId`, `role/name`, `label`, then CSS. A target must resolve to exactly one element. For repeated controls such as `Join`, the spec should use a stable test ID or include `withinText` with the visible card title. `withinText` resolves against the closest containing card, not a page-wide ancestor. When the intended journey explicitly calls for the first (or another ordered) repeated control and no reliable card title exists, Codex records a one-based `occurrence` to make that choice deterministic. Generated CSS selectors must be avoided unless no semantic target is available.

`presentation.theme` controls only the temporary overlay: `presenter` is the default, product-facing warm-neutral walkthrough; `minimal` is a quieter neutral treatment; `debug` retains a high-contrast engineering surface for selector repair. Themes never alter the host application.

## 6. Local proxy behavior

The proxy listens only on loopback (`127.0.0.1`) and forwards requests to the local app base URL. Before creating a preview, it fetches the supplied upstream once. If that fails, DemoFlow returns a clear MCP error and no preview URL. The upstream must keep the exact hostname printed by the target dev server because `localhost` and `127.0.0.1` can bind differently.

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

All other paths, methods, cookies, query parameters, and response status codes are forwarded to the upstream app. Response headers are preserved except hop-by-hop headers and stale `content-encoding`/`content-length` metadata, because the local fetch client decodes compressed upstream bodies before forwarding them. WebSocket forwarding is a stretch requirement; the MVP sample app must work without it.

The proxy must not modify upstream JavaScript bundles, API responses, static assets, or project files.

## 7. Overlay behavior

When present, `intro` is rendered before step one as a centered, product-facing card with a **Begin demo** action. It gives the audience release context (for example, “What changed”) without modifying or blocking the host app after it is dismissed. Restart returns to this intro before replaying the walkthrough.

The overlay has three layers:

1. A dimmer with a transparent cutout around the active target.
2. A tooltip anchored beside the target.
3. A compact control bar: Restart, Skip, Exit, and step count.

The dimmer and target highlight use `pointer-events: none`; the real app stays interactive. The control bar alone uses `pointer-events: auto`. If an exact target is outside the viewport, the overlay scrolls it into view before positioning the tooltip beside it. Restart returns to the configured `startPath`; it never attempts to undo arbitrary application state step by step.

The overlay listens for `click`, `input`, `submit`, `popstate`, and URL changes. A label target is resolved to its associated input, textarea, select, or editable control when one exists, so `input-and-click` steps highlight and observe the actual interactive field. Its placement engine prefers a tooltip above the active control, then below or beside it only when its rendered rectangle does not intersect the control; the real button or input stays visible and clickable. It resolves the next step after the configured `advance` condition becomes true. For a next-step target that is not yet mounted, it shows a neutral waiting state and retries after DOM mutations and on a short timer for up to five seconds. Only then does it show and report a target failure. This supports React and Next.js conditional rendering, client transitions, and asynchronous state updates without treating them as immediate errors. After the final advance condition, it shows a Demo complete panel with Restart and Close controls; it never silently removes the walkthrough.

Use `input-target` for a form control when typed or selected content should move the walkthrough forward. It advances only when the event belongs to the highlighted target and its value has the configured `minLength` (default: one non-whitespace character).

Use `input-and-click` when filling a control and clicking its real submit button form one product action. The overlay waits until the highlighted control contains the configured minimum content, then advances only after the declared `submitTarget` receives the real click.

When a target cannot be found, show a non-blocking "Target unavailable" panel with Restart, Copy repair request, and Exit controls, and report a structured local failure to the MCP status endpoint: failure type, step ID, current path, intended target, and timestamp. The overlay also reports window errors, unhandled rejections, and diagnostic text from explicit app alert elements (`[role=alert]`, `.alert`, or `[data-demoflow-error]`). Messages are capped at 280 characters and redact email addresses and token-like values; no arbitrary DOM, form values, cookies, or credentials are collected. When more than one control matches without an explicit `occurrence`, show a "Target needs a clearer label" panel rather than choosing an arbitrary element.

## 8. Local source inspection

The first implementation uses a deterministic scanner before asking Codex to write the final flow. It does not require the app to be running:

- detect `package.json` scripts and framework hints
- scan conventional React/Next.js roots (`src/`, root `app/`, `pages/`, and `components/`) with de-duplicated bounded traversal
- derive Next.js App Router paths from `app/**/page.*`, including `/` for `app/page.*`
- collect `data-testid` values
- collect source-relative static button, link, label, and `aria-label` control summaries from JSX/TSX where safe, including literal alternatives in conditional JSX
- list existing Playwright/Cypress test names without executing them

The scanner writes a compact `.demoflow/app-map.json`. When a demo is saved, DemoFlow also writes a shareable snapshot at `.demoflow/<demo-id>/app-map.json` and stores its SHA-256 fingerprint in the demo spec. The demo-local snapshot excludes machine-specific workspace paths. Codex receives this map and selected source snippets, not a full browser DOM or continuous visual stream. The proxy overlay remains the runtime verifier for chosen targets, including conditionally mounted UI. If static scanning finds no usable controls after checking all supported roots, Codex asks what the demo should prove instead of starting the app merely to discover UI. Opening a saved demo does not rescan source; a freshness check is explicit and returns only `current`, `stale`, or `unknown` to Codex.

For a new demo, `suggest_demo_starts` ranks source-discovered buttons and links. It gives a small boost to a control matching the developer's requested outcome, favors visible product verbs such as Preview, Start, Open, and Join, and sharply deprioritizes Restore, Reset, Seed, Fixture, and Debug controls. The score is an explainable selection aid only. When more than one viable start remains and the developer has not named one, Codex presents up to three journeys and waits for a choice before writing a spec.

### Branch-aware inspection

When the developer asks to demo the checked-out branch, `inspect_branch_changes` reads only the local Git repository. It selects `origin/HEAD` when available, otherwise tries `main`, `master`, then `develop`; the developer can supply an explicit base branch. It returns the merge-base comparison `base...HEAD`, current/base commit SHAs, and up to 100 changed paths (including rename information). Codex uses this evidence plus the compact app map to propose user-facing journeys, but must offer the developer a choice or free-form focus before writing the spec. DemoFlow never fetches a PR, switches branches, stages, commits, or pushes.

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
9. `git diff` after a run contains only ignored `.demoflow/` artifacts; DemoFlow never stages, commits, or pushes Git changes.

## 11. Deferred work

- Browser extension packaging
- WebSocket/HMR proxy support for every dev server
- Automatic code repair when selectors change
- Playwright auto-run, recording, screenshots, and exports
- Hosted sharing and analytics
