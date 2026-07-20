import assert from "node:assert/strict";
import test from "node:test";
import { suggestDemoStarts } from "../dist/suggestions.js";

const appMap = {
  workspacePath: "/project",
  frameworkHints: ["react", "next"], scripts: ["dev"], routes: ["/"], testIds: [], labels: [], fingerprint: "a".repeat(64),
  controls: [
    { kind: "button", name: "Restore Greenwater lesson", source: "app/page.tsx" },
    { kind: "button", name: "Preview the lesson", source: "app/page.tsx" },
    { kind: "button", name: "Start a new lesson", source: "app/page.tsx" },
    { kind: "label", name: "Lesson title", source: "app/page.tsx" },
  ],
};

test("ranks product actions ahead of restore and setup controls", () => {
  const suggestions = suggestDemoStarts(appMap, "demo an example lesson without an API key");
  assert.equal(suggestions[0].control.name, "Preview the lesson");
  assert.equal(suggestions.at(-1).control.name, "Restore Greenwater lesson");
  assert.equal(suggestions.at(-1).category, "setup-action");
});
