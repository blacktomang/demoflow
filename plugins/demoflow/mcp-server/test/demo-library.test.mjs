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
