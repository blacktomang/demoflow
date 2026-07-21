import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { fingerprintAppMap } from "../dist/inspector.js";
import { DemoSpecSchema, listDemoSpecs, readDemoSpec, writeDemoSpec } from "../dist/spec.js";

const appMapData = {
  frameworkHints: ["react", "vite"],
  scripts: ["dev"],
  routes: ["/community"],
  testIds: ["join-quit-smoking"],
  labels: ["Join"],
  controls: [{ kind: "button", name: "Join", source: "src/Community.tsx" }],
};

test("saves a shareable app-map snapshot and lists the saved demo", async () => {
  const workspacePath = await mkdtemp(path.join(os.tmpdir(), "demoflow-library-"));
  const appMap = { workspacePath, ...appMapData, fingerprint: fingerprintAppMap(appMapData) };
  await writeDemoSpec(workspacePath, {
    version: 1,
    id: "quit-smoking",
    title: "Quit smoking",
    goal: "Join the challenge",
    startPath: "/community",
    steps: [{ id: "join", target: { testId: "join-quit-smoking" }, tooltip: { title: "Join", body: "Join it." }, advance: { type: "click-target" } }],
  }, appMap);

  const [demo] = await listDemoSpecs(workspacePath);
  assert.equal(demo.id, "quit-smoking");
  assert.equal(demo.appFingerprint, appMap.fingerprint);
  assert.equal((await readDemoSpec(workspacePath, "quit-smoking")).metadata?.appFingerprint, appMap.fingerprint);
  const snapshot = JSON.parse(await readFile(path.join(workspacePath, ".demoflow", "quit-smoking", "app-map.json"), "utf8"));
  assert.equal(snapshot.workspacePath, undefined);
  assert.equal(snapshot.fingerprint, appMap.fingerprint);
});

test("accepts an explicit occurrence for an ordered repeated control", async () => {
  const workspacePath = await mkdtemp(path.join(os.tmpdir(), "demoflow-occurrence-"));
  const appMap = { workspacePath, ...appMapData, fingerprint: fingerprintAppMap(appMapData) };
  await writeDemoSpec(workspacePath, {
    version: 1,
    id: "first-join",
    title: "First join",
    goal: "Choose the first visible challenge",
    startPath: "/community",
    presentation: { theme: "presenter" },
    steps: [{ id: "first-join", target: { role: "button", name: "Join", occurrence: 1 }, tooltip: { title: "Join", body: "Choose the first challenge." }, advance: { type: "click-target" } }],
  }, appMap);

  const spec = await readDemoSpec(workspacePath, "first-join");
  assert.equal(spec.steps[0].target.occurrence, 1);
  assert.equal(spec.presentation?.theme, "presenter");
});

test("accepts an input-and-submit step", async () => {
  const workspacePath = await mkdtemp(path.join(os.tmpdir(), "demoflow-input-"));
  const appMap = { workspacePath, ...appMapData, fingerprint: fingerprintAppMap(appMapData) };
  await writeDemoSpec(workspacePath, {
    version: 1,
    id: "write-checkin",
    title: "Write a check-in",
    goal: "Enter a short reflection",
    startPath: "/",
    steps: [{ id: "write", target: { label: "Check-in" }, tooltip: { title: "Write", body: "Add a note, then save it." }, advance: { type: "input-and-click", minLength: 3, submitTarget: { role: "button", name: "Save check-in" } } }],
  }, appMap);

  const spec = await readDemoSpec(workspacePath, "write-checkin");
  assert.equal(spec.steps[0].advance.type, "input-and-click");
  assert.equal(spec.steps[0].advance.minLength, 3);
  assert.deepEqual(spec.steps[0].advance.submitTarget, { role: "button", name: "Save check-in" });
});

test("accepts a product-facing intro before the walkthrough", async () => {
  const workspacePath = await mkdtemp(path.join(os.tmpdir(), "demoflow-intro-"));
  const appMap = { workspacePath, ...appMapData, fingerprint: fingerprintAppMap(appMapData) };
  await writeDemoSpec(workspacePath, {
    version: 1,
    id: "graduate-badge",
    title: "Graduate badge",
    goal: "Show the badge earned after completing a challenge",
    startPath: "/community",
    intro: { title: "What changed", body: "Completing a challenge now earns a Graduate badge, visible in your profile." },
    provenance: { baseBranch: "main", baseCommit: "a".repeat(40), currentBranch: "feature/graduate-badge", currentCommit: "b".repeat(40) },
    steps: [{ id: "join", target: { testId: "join-quit-smoking" }, tooltip: { title: "Join", body: "Join it." }, advance: { type: "click-target" } }],
  }, appMap);

  const spec = await readDemoSpec(workspacePath, "graduate-badge");
  assert.equal(spec.intro?.title, "What changed");
  assert.equal(spec.provenance?.baseBranch, "main");
});

test("persists each independently clickable action as an ordered step", async () => {
  const workspacePath = await mkdtemp(path.join(os.tmpdir(), "demoflow-clicks-"));
  const appMap = { workspacePath, ...appMapData, fingerprint: fingerprintAppMap(appMapData) };
  await writeDemoSpec(workspacePath, {
    version: 1,
    id: "three-click-flow",
    title: "Three click flow",
    goal: "Perform each required product action",
    startPath: "/",
    steps: [
      { id: "open", target: { testId: "open" }, tooltip: { title: "Open", body: "Open the workflow." }, advance: { type: "click-target" } },
      { id: "choose", target: { testId: "choose" }, tooltip: { title: "Choose", body: "Choose the intended option." }, advance: { type: "click-target" } },
      { id: "confirm", target: { testId: "confirm" }, tooltip: { title: "Confirm", body: "Confirm the change." }, advance: { type: "click-target" } },
    ],
  }, appMap);

  const spec = await readDemoSpec(workspacePath, "three-click-flow");
  assert.deepEqual(spec.steps.map((step) => step.id), ["open", "choose", "confirm"]);
  assert.ok(spec.steps.every((step) => step.advance.type === "click-target"));
});

test("allows a complete walkthrough with more than five ordered steps", async () => {
  const workspacePath = await mkdtemp(path.join(os.tmpdir(), "demoflow-long-flow-"));
  const appMap = { workspacePath, ...appMapData, fingerprint: fingerprintAppMap(appMapData) };
  const steps = ["open", "choose", "configure", "explain", "transfer", "review"].map((id) => ({
    id,
    target: { testId: id },
    tooltip: { title: id, body: `Complete ${id}.` },
    advance: { type: "click-target" },
  }));
  await writeDemoSpec(workspacePath, {
    version: 1,
    id: "complete-loop",
    title: "Complete loop",
    goal: "Complete all six real actions",
    startPath: "/",
    steps,
  }, appMap);

  assert.equal((await readDemoSpec(workspacePath, "complete-loop")).steps.length, 6);
});

test("models required sample-app forms as input plus their real submit click", async () => {
  const testDirectory = path.dirname(fileURLToPath(import.meta.url));
  const fixturePath = path.resolve(testDirectory, "../../sample-app/fixtures/onboarding.demo.spec.json");
  const fixture = DemoSpecSchema.parse(JSON.parse(await readFile(fixturePath, "utf8")));

  const expected = [
    ["save-workspace", "Workspace name", "save-workspace", 3],
    ["create-project", "Project name", "create-project", 3],
    ["invite-teammate", "Teammate email", "invite-teammate", 5],
  ];
  for (const [id, label, submitTestId, minLength] of expected) {
    const step = fixture.steps.find((candidate) => candidate.id === id);
    assert.deepEqual(step?.target, { label });
    assert.deepEqual(step?.advance, { type: "input-and-click", minLength, submitTarget: { testId: submitTestId } });
  }
});
