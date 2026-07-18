# DemoFlow for Codex — Build Checklist

## Build order

### 1. Project foundation

- [x] Initialize the plugin, MCP server, and sample-app TypeScript packages (overlay package is next).
- [x] Add a root README describing the local development path.
- [x] Add `.gitignore` entries for `.demoflow/`, `node_modules/`, build output, and local logs.
- [x] Create a small Vite/React sample app with a four-step onboarding journey.
- [x] Ensure every sample-app demo target has an accessible name and stable `data-testid`.

**Done when:** a developer can run the sample app and manually complete onboarding.

### 2. Codex plugin

- [x] Create `.codex-plugin/plugin.json` with valid plugin metadata.
- [x] Create `skills/generate-demo/SKILL.md`.
- [ ] Instruct the skill to inspect before acting, write a structured spec, and ask approval before starting a project script.
- [x] Register the local DemoFlow MCP server in the plugin.
- [ ] Document installation and supported platform: macOS, Node 20+, Vite/React sample app.

**Done when:** DemoFlow appears as an installed Codex plugin and the skill can call its MCP tools.

### 3. Structured project scanner

- [x] Read `package.json` and return candidate development scripts.
- [x] Detect Vite/React project hints.
- [x] Collect `data-testid` values from `src/`.
- [x] Collect route strings and candidate visible button/label text.
- [x] Write a compact `.demoflow/app-map.json`.
- [ ] Keep output bounded; do not send raw source trees or browser DOM streams to the model.

**Done when:** `demoflow.inspect_project` produces a useful, compact map for the sample app.

### 4. Spec generation and validation

- [x] Define TypeScript/Zod schema for `demo.spec.json`.
- [x] Support `testId`, `role/name`, `label`, and CSS target formats.
- [x] Support `click-target`, `path-is`, `element-visible`, and `manual` advance conditions.
- [x] Validate demo IDs and output paths to prevent traversal outside `.demoflow/`.
- [x] Implement `demoflow.write_spec`.
- [ ] Create a checked-in onboarding fixture spec for the sample app.

**Done when:** a valid spec is saved and an invalid spec returns a clear error.

### 5. Safe local app lifecycle

- [ ] Implement `demoflow.start_app` with an explicit, user-approved package script only.
- [ ] Bind to local development URLs only.
- [ ] Poll a health URL with timeout and helpful failure output.
- [ ] Record only processes started by DemoFlow.
- [ ] Implement `demoflow.stop` with graceful shutdown.

**Done when:** the sample app starts, returns a URL, and is reliably cleaned up.

### 6. Local preview proxy

- [ ] Implement a loopback-only reverse proxy.
- [ ] Forward methods, headers, cookies, query strings, status codes, and non-HTML content unchanged.
- [ ] Inject the DemoFlow bootstrap script into HTML responses before `</head>`.
- [ ] Serve `/__demoflow/overlay.js`, `/__demoflow/overlay.css`, `/__demoflow/spec.json`, and `/__demoflow/status` locally.
- [ ] Add `demoflow.create_preview` and `demoflow.open_preview`.
- [ ] Verify the app works through the proxy URL.

**Done when:** `http://127.0.0.1:<preview-port>` renders the same sample app plus a temporary injected script.

### 7. Overlay client

- [ ] Load the spec from the local proxy endpoint.
- [ ] Resolve targets in priority order: test ID, role/name, label, CSS.
- [ ] Draw a pointer-transparent dimmer and target highlight.
- [ ] Render a tooltip with title, explanation, step count, Back, Skip, and Exit controls.
- [ ] Listen for route changes, clicks, submit events, and DOM mutations.
- [ ] Advance only when the configured condition is met.
- [ ] Show a non-blocking missing-target state and report it to the local status endpoint.
- [ ] Ensure Exit removes the overlay without altering the underlying app.

**Done when:** a user can click through the real sample-app onboarding flow while the overlay advances correctly.

### 8. Verification

- [ ] Test a full four-step flow through the proxy.
- [ ] Test Back, Skip, and Exit controls.
- [ ] Test refresh on a mid-flow route.
- [ ] Test a deliberately invalid selector and verify a useful missing-target message.
- [ ] Confirm no application source files are modified by a run.
- [ ] Confirm all servers bind to `127.0.0.1`.
- [ ] Confirm the overlay does not consume clicks intended for the app.

**Done when:** every acceptance test in [SPEC.md](SPEC.md) passes.

### 9. Hackathon submission assets

- [ ] Add architecture diagram and demo GIF/screenshot to README.
- [ ] Document how Codex and GPT-5.6 were used to build and operate DemoFlow.
- [ ] Add a judge path: install plugin → open sample repo → request demo → open local preview URL.
- [ ] Record a public YouTube demo under three minutes with clear audio.
- [ ] Create/update the Devpost project with title, tagline, description, tech stack, repo, and video link.
- [ ] Preserve dated commits and the primary Codex `/feedback` session ID.

**Done when:** a judge can understand, install, test, and evaluate the project without a private account or demo-service subscription.

## Out of scope until after the MVP

- [ ] Do not add Playwright automation or video capture.
- [ ] Do not add cloud hosting, accounts, billing, or analytics.
- [ ] Do not support arbitrary frameworks before the Vite/React sample path is stable.
- [ ] Do not modify application source code to enable Demo Mode.
