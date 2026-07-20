# DemoFlow for Codex — Build Checklist

## Build order

### 1. Project foundation

- [x] Initialize the plugin, MCP server, overlay, and sample-app packages.
- [x] Add a root README describing the local development path.
- [x] Add `.gitignore` entries for `.demoflow/`, `node_modules/`, build output, and local logs.
- [x] Create a small Vite/React sample app with a four-step onboarding journey.
- [x] Ensure every sample-app demo target has an accessible name and stable `data-testid`.

**Done when:** a developer can run the sample app and manually complete onboarding.

### 2. Codex plugin

- [x] Create `.codex-plugin/plugin.json` with valid plugin metadata.
- [x] Create `skills/generate-demo/SKILL.md`.
- [x] Instruct the skill to inspect before acting, write a structured spec, and ask approval before starting a project script.
- [x] Register the local DemoFlow MCP server in the plugin.
- [x] Document installation and supported platform: macOS, Node 20+, Vite/React sample app.

**Done when:** DemoFlow appears as an installed Codex plugin and the skill can call its MCP tools.

### 3. Structured project scanner

- [x] Read `package.json` and return candidate development scripts.
- [x] Detect Vite/React project hints.
- [x] Collect `data-testid` values from `src/`.
- [x] Collect route strings and candidate visible button/label text.
- [x] Write a compact `.demoflow/app-map.json`.
- [x] Keep output bounded; do not send raw source trees or browser DOM streams to the model.

**Done when:** `demoflow.inspect_project` produces a useful, compact map for the sample app.

### 4. Spec generation and validation

- [x] Define TypeScript/Zod schema for `demo.spec.json`.
- [x] Support `testId`, `role/name`, `label`, and CSS target formats.
- [x] Support `click-target`, `path-is`, `element-visible`, and `manual` advance conditions.
- [x] Validate demo IDs and output paths to prevent traversal outside `.demoflow/`.
- [x] Implement `demoflow.write_spec`.
- [x] Create a checked-in onboarding fixture spec for the sample app.

**Done when:** a valid spec is saved and an invalid spec returns a clear error.

### 4.1 Branch-aware demo generation

- [x] Detect a local base branch from `origin/HEAD`, then `main`, `master`, or `develop`, with a developer override.
- [x] Compare `<base>...HEAD` locally and return bounded changed-file and commit metadata.
- [x] Save branch/commit provenance when a spec follows branch inspection.
- [x] Instruct Codex to propose branch-based flows while allowing the developer to provide their own focus.
- [x] Keep branch analysis read-only: no fetch, checkout, staging, commit, or push.

**Done when:** a developer can ask to demo the checked-out branch and receive a reviewable, provenance-stamped local demo spec.

### 5. Native command approval handoff

- [x] Replace `demoflow.start_app` with `demoflow.prepare_app_start`; it validates and returns a declared script without executing it.
- [x] Update the skill so Codex runs that returned command in its own terminal session, triggering Codex's native approval prompt.
- [x] Keep DemoFlow limited to loopback preview proxy lifecycle; Codex owns the target app process.
- [ ] Verify deny, approve, and adjustment paths in the Codex command-approval UI.

**Done when:** the developer sees Codex's native approval UI before the target development script starts, and DemoFlow can create and stop a preview without owning that app process.

### 6. Local preview proxy

- [x] Implement a loopback-only reverse proxy.
- [x] Forward methods, headers, cookies, query strings, status codes, and non-HTML content unchanged.
- [x] Inject the DemoFlow bootstrap script into HTML responses before `</head>`.
- [x] Serve `/__demoflow/overlay.js`, `/__demoflow/spec.json`, and `/__demoflow/status` locally.
- [x] Add `demoflow.create_preview` and `demoflow.open_preview`.
- [x] Verify the app works through the proxy URL.

**Done when:** `http://127.0.0.1:<preview-port>` renders the same sample app plus a temporary injected script.

### 7. Overlay client

- [x] Load the spec from the local proxy endpoint.
- [x] Resolve targets in priority order: test ID, role/name, label, CSS.
- [x] Draw a pointer-transparent dimmer and target highlight.
- [x] Render a tooltip with title, explanation, step count, Restart, Skip, and Exit controls.
- [x] Render an optional product-facing intro card before the first walkthrough action, and show it again on Restart.
- [x] Listen for route changes, clicks, submit events, and DOM mutations.
- [x] Advance only when the configured condition is met.
- [x] Show a non-blocking missing-target state and report it to the local status endpoint.
- [x] Ensure Exit removes the overlay without altering the underlying app.

**Done when:** a user can click through the real sample-app onboarding flow while the overlay advances correctly.

### 8. Verification

- [x] Test a full four-step flow through the proxy.
- [ ] Test Restart, Skip, and Exit controls.
- [ ] Test refresh on a mid-flow route.
- [x] Test a deliberately invalid selector and verify a useful missing-target message.
- [x] Confirm no application source files are modified by a run.
- [x] Confirm all servers bind to `127.0.0.1`.
- [x] Confirm the overlay does not consume clicks intended for the app.
- [x] Confirm demo generation and repair never stage, commit, or push Git changes.

**Done when:** every acceptance test in [SPEC.md](SPEC.md) passes.

### 9. Hackathon submission assets

- [ ] Add architecture diagram and demo GIF/screenshot to README. (Architecture diagram is complete; capture a final Demo Mode screenshot/GIF during recording.)
- [x] Document how Codex and GPT-5.6 were used to build and operate DemoFlow.
- [x] Add a judge path: install plugin → open sample repo → request demo → open local preview URL.
- [ ] Record a public YouTube demo under three minutes with clear audio.
- [ ] Create/update the Devpost project with title, tagline, description, tech stack, repo, and video link. (All but the video link are complete.)
- [ ] Preserve dated commits and the primary Codex `/feedback` session ID.

**Done when:** a judge can understand, install, test, and evaluate the project without a private account or demo-service subscription.

## Out of scope until after the MVP

- [ ] Do not add Playwright automation or video capture.
- [ ] Do not add cloud hosting, accounts, billing, or analytics.
- [ ] Do not support arbitrary frameworks before the Vite/React sample path is stable.
- [ ] Do not modify application source code to enable Demo Mode.
