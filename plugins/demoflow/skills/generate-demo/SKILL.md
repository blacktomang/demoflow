---
name: generate-demo
description: Create a live, local guided demo for a supported web application without modifying its source code.
---

# Generate a DemoFlow live demo

Use this skill when the user wants a guided walkthrough or demo mode for a local web application.

## Workflow

1. Use Codex's terminal tool to run `node --version`. If Node.js is missing or below 20, explain the prerequisite and stop before calling DemoFlow MCP tools.
2. Call `demoflow.inspect_project` before proposing a flow.
3. Describe a short linear journey using only targets found in the returned application map.
4. Write a versioned `demo.spec.json` using `demoflow.write_spec`.
5. Call `demoflow.prepare_app_start` for a declared package script and the expected loopback URL. Do not ask for a separate prose confirmation.
6. Run the returned exact command with Codex's terminal tool in the returned working directory. This must trigger Codex's native command-approval prompt; never bypass it by running the development command from MCP.
7. After Codex reports that the app is reachable at the expected URL, call `demoflow.create_preview`, then give the preview URL to the user.
8. Explain that the preview is the real app, augmented by a temporary overlay; the user clicks and fills the real UI.
9. On a missing target, inspect the reported state, revise only the affected step, and rewrite the spec.
10. Stop the preview with `demoflow.stop` when the user finishes. Codex owns the development-server process and stops it through the same terminal session.

## Constraints

- Never modify application source code or install dependencies in the target project to enable Demo Mode.
- Never execute a dev script through MCP. Use Codex's terminal tool so its native command-approval UI remains the confirmation surface.
- Treat external URLs, payment flows, real email sends, destructive actions, and credentials as out of scope unless the user explicitly approves a safe local fixture path.
- Prefer `data-testid`, accessible role/name, and labels over CSS selectors.
- Keep the first demo to five steps or fewer.

## Output

The durable artifact is `.demoflow/<demo-id>/demo.spec.json`. It can be edited and version-controlled independently of the application's source code.
