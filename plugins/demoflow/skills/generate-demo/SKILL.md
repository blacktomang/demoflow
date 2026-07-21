---
name: generate-demo
description: Create a live, local guided demo for a supported web application without modifying its source code.
---

# Generate a DemoFlow live demo

Use this skill when the user wants a guided walkthrough or demo mode for a local web application.

## Workflow

1. Use Codex's terminal tool to run `node --version`. If Node.js is missing or below 20, explain the prerequisite and stop before calling DemoFlow MCP tools.
2. Call `demoflow.list_demos` first. This lists saved demos without reading application source code.
3. If the developer chooses a saved demo, use its `demo.spec.json` directly; do not call `inspect_project`. Offer `demoflow.check_demo_freshness` only when the developer asks to validate it or when a stale-flow warning is needed. A `current` result can run; a `stale` result needs the developer's choice to run anyway or regenerate; an `unknown` result should offer the same choice.
4. For a new or regenerated demo, call `demoflow.list_environments` before source inspection. If it returns a declared or detected profile, state its app directory, one declared start script, app URL, and API readiness URLs. Ask the developer to choose a profile when more than one is available; do not invent a backend command or edit environment files. For a selected profile, call `demoflow.inspect_project` with its `appDirectory`. Otherwise call `inspect_project` at the workspace root. Its source scan covers React/Next.js `src/`, root `app/`, `pages/`, and `components/`; an app does not need to be running for it to discover static routes and UI controls.
   - When the developer asks to demo the checked-out branch, PR changes, or what changed, call `demoflow.inspect_branch_changes` first. It uses only local Git history and returns the detected base branch, commits, and changed paths.
   - Explain the detected comparison and why each proposed journey is relevant. Offer the developer the proposed journeys **and** a free-form option to state the focus they want. Do not invent a user-facing flow from refactor-only changes; ask what the demo should prove instead.
   - After a branch inspection, let `write_spec` retain the returned branch and commit provenance. Never fetch a PR, change branches, stage, commit, or push.
5. Build a bounded **flow inventory** from the inspected app map before proposing a demo. Treat controls, routes, `requires`, and `transitions` as evidence—not proof that an end-to-end path works. Group controls into distinct customer-facing main flows when their goal, entry control, route, or prerequisite state differs. Do not split a single form into separate main flows merely because it has several fields or buttons.
   - Call `demoflow.suggest_demo_starts` with the developer's requested outcome. Treat its ranking only as an explainable starting-point aid, never as a decision about what to demo.
   - Read the source-relative `controls` summary, render `requires`, and local `transitions` for every proposed flow. In a Next.js project, do not mistake an empty `src/` tree for a project without UI.
   - Never present a control with a known positive prerequisite as the first action of a clean-state demo. Either prepend source-supported actions that reach that state, or say that a safe fixture state is required and ask the developer to choose.
   - If the codebase supports more than one plausible main flow and the developer has not unequivocally named one, present up to three distinct flow choices with their goal, opening action, evidence, and confidence, plus a free-form option. Wait for the developer to choose. Do **not** silently select the highest-ranked control or write a spec.
   - If source inspection cannot establish a usable flow or a required transition, say what is unknown and ask what the demo should prove. Do not start the app or invent a path merely to fill the gap.
   - If a setup action is genuinely necessary to make a local example work, keep it out of the customer-facing walkthrough and state it as pre-demo setup.
   - The live Demo Mode overlay is the runtime verifier for the selected targets. It waits for conditionally rendered React/Next.js UI; do not use browser automation merely to discover or invent a flow.
6. After the developer selects a flow, show a **human-readable storyboard before any JSON or `write_spec` call**. The storyboard is the review artifact; `demo.spec.json` remains the durable machine-readable artifact only after the developer accepts the storyboard. Use this exact Markdown table shape:

   | Step | User action | Why it matters | Evidence | Confidence |
   | --- | --- | --- | --- | --- |

   - Each row must name the real action, its customer-facing outcome, the source evidence (test ID, accessible label, source-relative control, known transition, or stated fixture), and `High`, `Medium`, or `Low` confidence. `High` requires an exact, uniquely targetable control and source-supported state; `Medium` is a source-supported but conditional or inferred transition; `Low` means the source cannot verify the state and requires the developer's confirmation or a safe fixture.
   - Represent every independently clickable real control as its own storyboard row and its own demo-spec step. Never summarize “click A, then B” as one row or one `click-target` step. This prevents a second click from being implied but omitted from the live walkthrough.
   - An input followed by its real submit button may remain one row and one `input-and-click` step only when the button completes that same form action. Name both interactions in `User action` and cite both controls in `Evidence`.
   - Check that the previous row can plausibly expose the next target: use `requires`, `transitions`, routes, and conditional render evidence. If the link is not source-supported, mark it `Medium` or `Low` and state the required assumption instead of presenting it as fact.
   - Include a concise product-facing intro in the eventual spec by default. Keep every independently observable interaction needed for the selected real flow in the storyboard and resulting spec; DemoFlow has no maximum step limit.
   - End by asking the developer to confirm or adjust the storyboard. Do not show a JSON draft, write a spec, start the app, or create a preview until they do.
7. After the developer accepts the storyboard, translate every row into one validated spec step. Every target must resolve to one element. Never use a generic repeated role/name such as `Join` alone.
   - Prefer a `testId`. If a repeated button has no test ID, use a role/name target with `withinText` set to the surrounding card's visible challenge title.
   - If the requested journey intentionally uses the first or another ordered repeated control and no reliable card title is available, record `occurrence` (one-based) in that role/name target. This makes the coding agent's selection explicit and lets the overlay attach to that exact DOM-order match.
   - Default `presentation.theme` to `presenter`: it is the product-facing walkthrough for product, customer, and stakeholder demos. Use `minimal` only when the developer asks for a quieter overlay; reserve `debug` for internal development or selector repair.
   - For a text field, textarea, select, or editable control that takes effect immediately after a value is supplied, use `advance: { type: "input-target", minLength: 1 }`.
   - When the developer must fill a control and then click a real submit button, use `advance: { type: "input-and-click", minLength: 1, submitTarget: { role: "button", name: "…" } }`. Use `manual` only when no safe observable interaction should advance the flow.
   - Make an input-and-click step's tooltip name the real completion action (for example, “Submit the transfer case”), not just the field activity. The overlay will explicitly tell the developer to type and then select the named submit button. The final real action ends at a Demo complete panel rather than silently removing the overlay.
8. Write a versioned `demo.spec.json` using `demoflow.write_spec`; pass the selected profile's `appDirectory` when present so its saved app map remains tied to the correct frontend package.
9. For a selected environment profile, call `demoflow.prepare_environment`; otherwise call `demoflow.prepare_app_start` for a declared package script and the expected loopback URL. Do not ask for a separate prose confirmation.
10. Run the returned exact command once with Codex's terminal tool in the returned working directory. This must trigger Codex's native command-approval prompt; never bypass it by running the development command from MCP.
11. For a selected environment profile, call `demoflow.check_environment` after the command starts. Do not create a preview until every declared frontend/API readiness service is ready. Otherwise, after Codex reports the app is reachable, take the exact `Local:` URL printed by its development server. Never substitute `127.0.0.1` for `localhost` or the reverse. The preview URL is the completion of this workflow.
12. Explain that the preview is the real app, augmented by a temporary overlay; the user clicks and fills the real UI.
13. Do not open, inspect, or exercise the preview in Codex's in-app browser unless the user explicitly asks for browser testing. Do not poll `open_preview` to decide whether the workflow is complete.
14. If the app process or preview stops, report that it stopped and end the workflow. Never automatically reuse, recreate, or restart a preview or app process. Only make another attempt after the user explicitly asks to retry.
15. When the developer reports a Demo Mode error or asks to repair a demo, call `demoflow.open_preview` with the active preview ID. Read its structured browser failure report and `repairRequest`, revise only the affected step, and rewrite the spec. If the repair changes an interaction sequence, show the affected storyboard rows first; otherwise, do not re-plan unrelated flows. The preview cannot interrupt a completed Codex task; the developer must paste its repair request or say “Repair this DemoFlow preview.” Do not poll this tool while the developer is using the preview.
16. Stop the preview with `demoflow.stop` when the user finishes. Codex owns the development-server process and stops it through the same terminal session.

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
