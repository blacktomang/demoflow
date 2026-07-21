import assert from "node:assert/strict";
import test from "node:test";
import { reviewStoryboard } from "../dist/storyboard.js";

const appMap = {
  workspacePath: "/project", appDirectory: ".", frameworkHints: ["react"], scripts: ["dev"], routes: ["/"], testIds: ["create-workspace"], labels: ["Workspace name"], fingerprint: "a".repeat(64), stateFacts: [], transitions: [],
  controls: [
    { kind: "test-id", name: "create-workspace", source: "src/App.tsx" },
    { kind: "button", name: "Create workspace", source: "src/App.tsx" },
    { kind: "label", name: "Workspace name", source: "src/WorkspaceForm.tsx" },
    { kind: "button", name: "Invite teammate", source: "src/Invite.tsx", requires: [{ expression: "workspace", expected: true, source: "src/Invite.tsx" }] },
  ],
};

test("renders a source-backed human-readable storyboard before a spec", () => {
  const review = reviewStoryboard(appMap, {
    title: "Workspace collaboration", goal: "Show how a team starts collaborating",
    steps: [
      { title: "Create workspace", userAction: "Select Create workspace", whyItMatters: "Creates the shared home.", target: { testId: "create-workspace" } },
      { title: "Name workspace", userAction: "Enter a safe name", whyItMatters: "Shows intentional setup.", target: { label: "Workspace name" } },
      { title: "Invite teammate", userAction: "Select Invite teammate", whyItMatters: "Shows collaboration.", target: { role: "button", name: "Invite teammate" } },
    ],
  });

  assert.equal(review.ready, true);
  assert.match(review.markdown, /\| Step \| User action \| Why it matters \| Evidence \| Confidence \|/);
  assert.match(review.markdown, /Create workspace/);
  assert.match(review.markdown, /src\/App\.tsx/);
  assert.match(review.markdown, /requires workspace/);
  assert.match(review.markdown, /\| Medium \|/);
});

test("blocks an ambiguous storyboard target until it is scoped", () => {
  const review = reviewStoryboard({ ...appMap, controls: [
    { kind: "button", name: "Join", source: "src/ChallengeA.tsx" },
    { kind: "button", name: "Join", source: "src/ChallengeB.tsx" },
  ] }, {
    title: "Join a challenge", goal: "Show joining a challenge",
    steps: [{ title: "Join", userAction: "Select Join", whyItMatters: "Starts the challenge.", target: { role: "button", name: "Join" } }],
  });

  assert.equal(review.ready, false);
  assert.match(review.markdown, /multiple source matches/);
  assert.match(review.markdown, /Add a test ID, withinText, or occurrence/);
});
