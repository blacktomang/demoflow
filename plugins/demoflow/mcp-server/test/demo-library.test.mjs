import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fingerprintAppMap } from "../dist/inspector.js";
import { listDemoSpecs, readDemoSpec, writeDemoSpec } from "../dist/spec.js";

const appMapData = {
  frameworkHints: ["react", "vite"],
  scripts: ["dev"],
  routes: ["/community"],
  testIds: ["join-quit-smoking"],
  labels: ["Join"],
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
