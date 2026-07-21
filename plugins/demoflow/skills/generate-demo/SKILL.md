---
name: generate-demo
description: Create a live, local guided demo for a supported web application without modifying its source code.
---

# Generate a DemoFlow live demo

Use this skill when the user wants a guided walkthrough or demo mode for a local web application.

## Workflow

1. For a new or regenerated demo, begin with one compact **Demo Brief**. Ask the developer for only these three answers, in one guided message (not a dashboard or raw JSON):
   - **What are you showing?** New feature, PR change, onboarding, or bug fix.
   - **Who is watching?** Engineer, product stakeholder, or customer.
   - **What should they understand by the end?** Free-form outcome.
   Use reasonable values only when the developer already gave all three. Call `demoflow.prepare_demo_brief` with the answers before inspecting source. Do not ask for a duration or estimate.
2. Use Codex's terminal tool to run `node --version`. If Node.js is missing or below 20, explain the prerequisite and stop before calling DemoFlow MCP tools.
3. Call `demoflow.list_demos` first. This lists saved demos without reading application source code.
4. If the developer chooses a saved demo, use its `demo.spec.json` directly; do not call `inspect_project`. Offer `demoflow.check_demo_freshness` only when the developer asks to validate it or when a stale-flow warning is needed. A `current` result can run; a `stale` result needs the developer's choice to run anyway or regenerate; an `unknown` result should offer the same choice.
5. For a new or regenerated demo, call `demoflow.list_environments` before source inspection. If it returns a declared or detected profile, state its app directory, one declared start script, app URL, and API readiness URLs. Ask the developer to choose a profile when more than one is available; do not invent a backend command or edit environment files. For a selected profile, call `demoflow.inspect_project` with its `appDirectory`. Otherwise call `inspect_project` at the workspace root. Its source scan covers React/Next.js `src/`, root `app/`, `pages/`, and `components/`; an app does not need to be running for it to discover static routes and UI controls.
   - When the developer asks to demo the checked-out branch, PR changes, or what changed, call `demoflow.inspect_branch_changes` first. It uses only local Git history and returns the detected base branch, commits, and changed paths.
   - Explain the detected comparison and why each proposed journey is relevant. Offer the developer the proposed journeys **and** a free-form option to state the focus they want. Do not invent a user-facing flow from refactor-only changes; ask what the demo should prove instead.
   - After a branch inspection, let `write_spec` retain the returned branch and commit provenance. Never fetch a PR, change branches, stage, commit, or push.
6. Call `demoflow.suggest_demo_starts` with the Demo Brief outcome, then propose up to three short clean-start journey options using only targets found in the returned application map. Include the free-form option to state another focus.
   - Treat the suggestions as an explainable ranking aid, not a substitute for product judgment. It favors visible user actions and deprioritizes restore/reset/seed/fixture/debug controls.
   - Read `blockedControls`, `requires`, and `transitions` from the app map. Never present a control with a known positive prerequisite as the first action of a clean-state demo. Either prepend a source-supported action that reaches that state, or say an existing fixture state is required and ask the developer to choose.
   - If more than one viable start exists, do **not** silently choose one, draft a storyboard, or write a new spec. Show the developer the distinct product stories and ask which flow they want demonstrated, unless their request explicitly names the desired starting control. A generic request such as “demo the app” is not a choice.
   - If a setup action is genuinely necessary to make a local example work, keep it out of the customer-facing walkthrough and state it as pre-demo setup.
7. After the developer chooses a journey, create a **human-readable storyboard before any spec is written**. It must be a Markdown table with exactly these columns: **Step**, **User action**, **Why it matters**, **Evidence**, and **Confidence**.
   | Step | User action | Why it matters | Evidence | Confidence |
   | --- | --- | --- | --- | --- |
   - Every real click, navigation, or meaningful field interaction must have its own storyboard row in execution order. Do not collapse two button clicks into one row just because they support the same feature.
   - DemoFlow has no maximum step limit. Keep the complete selected flow in one walkthrough.
   - The sole exception is filling a field and clicking its real submit button: show both in one row as a compound action, then use `input-and-click` in the eventual spec.
   - Use source-backed targets only. Supply `title`, `userAction`, `whyItMatters`, and `target` to `demoflow.review_storyboard`; show the returned Markdown table to the developer verbatim.
   - Do not write a spec if the review says it needs revision. Repair unclear targets, missing prerequisites, or unsupported actions first.
   - Ask the developer to confirm or adjust the reviewed storyboard. Do not show a JSON draft, write a spec, start the app, or create a preview until they confirm it.
8. After confirmation, translate each storyboard row into the equivalent machine-readable `demo.spec.json` step. Keep the spec as the durable artifact; the storyboard is the human review surface.
   - Use the returned source-relative `controls` summary, render `requires`, and local `transitions` to explain which source evidence supports each target. In a Next.js project, do not mistake an empty `src/` tree for a project without UI.
   - The live Demo Mode overlay is the runtime verifier. It resolves the chosen controls after the app starts and waits for conditionally rendered React/Next.js UI; do not add browser automation merely to discover controls.
   - If expanded source scanning still returns no usable controls, ask the developer what the demo should prove. Do not start the app just to search for a flow.
   - Include a concise `intro: { title, body }` by default. It appears before the first action and explains the user-facing value or release change in plain language. Omit it only when the developer explicitly asks for no intro.
   - Every target must resolve to one element. Never use a generic repeated role/name such as `Join` alone.
   - Prefer a `testId`. If a repeated button has no test ID, use a role/name target with `withinText` set to the surrounding card's visible challenge title.
   - If the requested journey intentionally uses the first or another ordered repeated control and no reliable card title is available, record `occurrence` (one-based) in that role/name target. This makes the coding agent's selection explicit and lets the overlay attach to that exact DOM-order match.
   - Default `presentation.theme` to `presenter`: it is the product-facing walkthrough for product, customer, and stakeholder demos. Use `minimal` only when the developer asks for a quieter overlay; reserve `debug` for internal development or selector repair.
   - For a text field, textarea, select, or editable control that takes effect immediately after a value is supplied, use `advance: { type: "input-target", minLength: 1 }`.
   - When the developer must fill a control and then click a real submit button, use `advance: { type: "input-and-click", minLength: 1, submitTarget: { role: "button", name: "…" } }`. Use `manual` only when no safe observable interaction should advance the flow.
   - Make an input-and-click step's tooltip name the real completion action (for example, “Submit the transfer case”), not just the field activity. The overlay will explicitly tell the developer to type and then select the named submit button. The final real action ends at a Demo complete panel rather than silently removing the overlay.
9. Write a versioned `demo.spec.json` using `demoflow.write_spec`; include the validated `brief` exactly as returned by `prepare_demo_brief`, and pass the selected profile's `appDirectory` when present so its saved app map remains tied to the correct frontend package.
10. For a selected environment profile, call `demoflow.prepare_environment`; otherwise call `demoflow.prepare_app_start` for a declared package script and the expected loopback URL. Do not ask for a separate prose confirmation.
11. Run the returned exact command once with Codex's terminal tool in the returned working directory. This must trigger Codex's native command-approval prompt; never bypass it by running the development command from MCP.
12. For a selected environment profile, call `demoflow.check_environment` after the command starts. Do not create a preview until every declared frontend/API readiness service is ready. Otherwise, after Codex reports the app is reachable, take the exact `Local:` URL printed by its development server. Never substitute `127.0.0.1` for `localhost` or the reverse. The preview URL is the completion of this workflow.
13. Explain that the preview is the real app, augmented by a temporary overlay; the user clicks and fills the real UI.
14. Do not open, inspect, or exercise the preview in Codex's in-app browser unless the user explicitly asks for browser testing. Do not poll `open_preview` to decide whether the workflow is complete.
15. If the app process or preview stops, report that it stopped and end the workflow. Never automatically reuse, recreate, or restart a preview or app process. Only make another attempt after the user explicitly asks to retry.
16. When the developer reports a Demo Mode error or asks to repair a demo, call `demoflow.open_preview` with the active preview ID. Read its structured browser failure report and `repairRequest`, revise only the affected step, and rewrite the spec. The preview cannot interrupt a completed Codex task; the developer must paste its repair request or say “Repair this DemoFlow preview.” Do not poll this tool while the developer is using the preview.
17. Stop the preview with `demoflow.stop` when the user finishes. Codex owns the development-server process and stops it through the same terminal session.

## Constraints

- Never modify application source code or install dependencies in the target project to enable Demo Mode.
- Never stage, commit, or push Git changes after generating or repairing a demo. `.demoflow/` artifacts remain local unless the developer explicitly chooses to version-control them.
- Never execute a dev script through MCP. Use Codex's terminal tool so its native command-approval UI remains the confirmation surface.
- An environment profile can describe backend readiness, but it never grants authority to reset data, call external services, run additional commands, or alter `.env` files.
- Never ask for a separate prose permission to create, reuse, or recreate a local preview. The native approval prompt applies only to the target app command.
- A dead preview is a terminal state for the current request, not a reason to retry in a loop.
- Treat external URLs, payment flows, real email sends, destructive actions, and credentials as out of scope unless the user explicitly approves a safe local fixture path.
- Prefer `data-testid`, accessible role/name, and labels over CSS selectors.

## Output

The durable artifact is `.demoflow/<demo-id>/demo.spec.json`. It can be edited and version-controlled independently of the application's source code.
