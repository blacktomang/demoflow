# DemoFlow — 2-Minute Build Week Demo Script

## 0:00–0:15 — Problem

“Interactive demo tools usually start with a manual recording. They are difficult to update when the product changes. DemoFlow uses Codex and a local codebase to create a live, guided demo mode instead.”

Show the DemoFlow repository README architecture diagram.

## 0:15–0:35 — Show the real artifact

Open `plugins/demoflow/sample-app/fixtures/onboarding.demo.spec.json`.

“Codex creates this small, editable specification. It targets semantic UI elements and describes why each feature matters. It is not a recording and it does not clone the application.”

## 0:35–1:05 — Show Codex reasoning

In Codex, open a supported local project and enter:

```text
Use DemoFlow to create a guided demo for onboarding: create a workspace,
create a project, and invite a teammate.
```

Show the compact application map and proposed four-step demo plan. Explain that DemoFlow uses local project routes, labels, and test IDs, rather than sending a stream of screenshots or DOM dumps to the model.

Optional branch-aware variation: ask “Demo what changed in this branch.” Show the local base branch, changed files, and a proposed release journey before choosing the flow to present.

## 1:05–1:35 — Show Demo Mode

Approve the `dev` script and open the local Demo Mode URL.

“This is the real application, running locally through a loopback proxy. The opening card tells a product audience what changed; DemoFlow then injects temporary guidance, so it never changes the app source.”

Dismiss the opening card, then click through the four steps. Highlight that each click and form submission is handled by the actual app.

## 1:35–1:50 — Show editability

Change one tooltip in `demo.spec.json`, refresh Demo Mode, and show the revised explanation.

“The durable output is a version-controlled demo specification, not a vendor-locked capture.”

## 1:50–2:00 — Close

“DemoFlow makes Codex a demo layer for any local codebase: describe the user journey, then let the real app explain itself.”

## Recording checklist

- Keep the final video under three minutes and include clear audio.
- Do not show secrets, production credentials, private repositories, or copyrighted background music.
- Show Codex, the local sample app, and the final Demo Mode overlay.
- Upload publicly to YouTube, then add the URL to the existing Devpost project before submission.
