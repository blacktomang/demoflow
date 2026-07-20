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
4. For a new or regenerated demo, call `demoflow.inspect_project` before proposing a flow.
   - When the developer asks to demo the checked-out branch, PR changes, or what changed, call `demoflow.inspect_branch_changes` first. It uses only local Git history and returns the detected base branch, commits, and changed paths.
   - Explain the detected comparison and why each proposed journey is relevant. Offer the developer the proposed journeys **and** a free-form option to state the focus they want. Do not invent a user-facing flow from refactor-only changes; ask what the demo should prove instead.
   - After a branch inspection, let `write_spec` retain the returned branch and commit provenance. Never fetch a PR, change branches, stage, commit, or push.
5. Describe a short linear journey using only targets found in the returned application map.
   - Include a concise `intro: { title, body }` by default. It appears before the first action and explains the user-facing value or release change in plain language. Omit it only when the developer explicitly asks for no intro.
   - Every target must resolve to one element. Never use a generic repeated role/name such as `Join` alone.
   - Prefer a `testId`. If a repeated button has no test ID, use a role/name target with `withinText` set to the surrounding card's visible challenge title.
   - If the requested journey intentionally uses the first or another ordered repeated control and no reliable card title is available, record `occurrence` (one-based) in that role/name target. This makes the coding agent's selection explicit and lets the overlay attach to that exact DOM-order match.
   - Default `presentation.theme` to `presenter`: it is the product-facing walkthrough for product, customer, and stakeholder demos. Use `minimal` only when the developer asks for a quieter overlay; reserve `debug` for internal development or selector repair.
   - For a text field, textarea, select, or editable control that takes effect immediately after a value is supplied, use `advance: { type: "input-target", minLength: 1 }`.
   - When the developer must fill a control and then click a real submit button, treat that as one step: use `advance: { type: "input-and-click", minLength: 1, submitTarget: { role: "button", name: "…" } }`. Use `manual` only when no safe observable interaction should advance the flow.
6. Write a versioned `demo.spec.json` using `demoflow.write_spec`; it saves a compact app-map snapshot and fingerprint beside the spec.
7. Call `demoflow.prepare_app_start` for a declared package script and the expected loopback URL. Do not ask for a separate prose confirmation.
8. Run the returned exact command once with Codex's terminal tool in the returned working directory. This must trigger Codex's native command-approval prompt; never bypass it by running the development command from MCP.
9. After Codex reports that the app is reachable, take the exact `Local:` URL printed by its development server and pass that unchanged to `demoflow.create_preview`. Never substitute `127.0.0.1` for `localhost` or the reverse. The preview URL is the completion of this workflow.
10. Explain that the preview is the real app, augmented by a temporary overlay; the user clicks and fills the real UI.
11. Do not open, inspect, or exercise the preview in Codex's in-app browser unless the user explicitly asks for browser testing. Do not poll `open_preview` to decide whether the workflow is complete.
12. If the app process or preview stops, report that it stopped and end the workflow. Never automatically reuse, recreate, or restart a preview or app process. Only make another attempt after the user explicitly asks to retry.
13. When the developer reports a Demo Mode error or asks to repair a demo, call `demoflow.open_preview` with the active preview ID. Read its structured browser failure report, revise only the affected step, and rewrite the spec. Do not poll this tool while the developer is using the preview.
14. Stop the preview with `demoflow.stop` when the user finishes. Codex owns the development-server process and stops it through the same terminal session.

## Constraints

- Never modify application source code or install dependencies in the target project to enable Demo Mode.
- Never stage, commit, or push Git changes after generating or repairing a demo. `.demoflow/` artifacts remain local unless the developer explicitly chooses to version-control them.
- Never execute a dev script through MCP. Use Codex's terminal tool so its native command-approval UI remains the confirmation surface.
- Never ask for a separate prose permission to create, reuse, or recreate a local preview. The native approval prompt applies only to the target app command.
- A dead preview is a terminal state for the current request, not a reason to retry in a loop.
- Treat external URLs, payment flows, real email sends, destructive actions, and credentials as out of scope unless the user explicitly approves a safe local fixture path.
- Prefer `data-testid`, accessible role/name, and labels over CSS selectors.
- Keep the first demo to five steps or fewer.

## Output

The durable artifact is `.demoflow/<demo-id>/demo.spec.json`. It can be edited and version-controlled independently of the application's source code.
