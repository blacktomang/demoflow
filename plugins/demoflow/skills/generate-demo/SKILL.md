---
name: generate-demo
description: Create a live, local guided demo for a supported web application without modifying its source code.
---

# Generate a DemoFlow live demo

Use this skill when the user wants a guided walkthrough or demo mode for a local web application.

## Workflow

1. Call `demoflow.inspect_project` before proposing a flow.
2. Describe a short linear journey using only targets found in the returned application map.
3. Ask the user to confirm the journey and the development script before starting the app.
4. Write a versioned `demo.spec.json` using `demoflow.write_spec`.
5. Start the approved local app with `demoflow.start_app`.
6. Create a local preview with `demoflow.create_preview`, then give the preview URL to the user.
7. Explain that the preview is the real app, augmented by a temporary overlay; the user clicks and fills the real UI.
8. On a missing target, inspect the reported state, revise only the affected step, and rewrite the spec.
9. Stop DemoFlow-started processes with `demoflow.stop` when the user finishes.

## Constraints

- Never modify application source code or install dependencies in the target project to enable Demo Mode.
- Do not start a dev script without the user's confirmation.
- Treat external URLs, payment flows, real email sends, destructive actions, and credentials as out of scope unless the user explicitly approves a safe local fixture path.
- Prefer `data-testid`, accessible role/name, and labels over CSS selectors.
- Keep the first demo to five steps or fewer.

## Output

The durable artifact is `.demoflow/<demo-id>/demo.spec.json`. It can be edited and version-controlled independently of the application's source code.
