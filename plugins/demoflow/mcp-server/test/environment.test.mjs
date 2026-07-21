import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { discoverDemoEnvironments, prepareDemoEnvironment } from "../dist/environment.js";
import { inspectProject } from "../dist/inspector.js";

test("detects a RawHabit-style Bun workspace with client and API readiness", async () => {
  const workspacePath = await mkdtemp(path.join(os.tmpdir(), "demoflow-environment-"));
  try {
    await mkdir(path.join(workspacePath, "apps", "client", "src"), { recursive: true });
    await mkdir(path.join(workspacePath, "apps", "server"), { recursive: true });
    await writeFile(path.join(workspacePath, "package.json"), JSON.stringify({
      packageManager: "bun@1.2.19",
      workspaces: ["apps/*"],
      scripts: { dev: "bun --filter client --filter server --parallel dev" },
    }));
    await writeFile(path.join(workspacePath, "apps", "client", "package.json"), JSON.stringify({ dependencies: { react: "19", vite: "7" }, scripts: { dev: "vite" } }));
    await writeFile(path.join(workspacePath, "apps", "client", "vite.config.ts"), `export default { server: { proxy: { "/api": "http://localhost:3001", "/health": "http://localhost:3001" } } };`);
    await writeFile(path.join(workspacePath, "apps", "client", "src", "App.tsx"), `<button>Start habit</button>`);
    await writeFile(path.join(workspacePath, "apps", "server", "package.json"), JSON.stringify({ dependencies: { express: "5" }, scripts: { dev: "bun src/index.ts" } }));

    const [profile] = await discoverDemoEnvironments(workspacePath);
    assert.deepEqual(profile, {
      id: "detected-local",
      label: "Detected local full stack (apps/client)",
      source: "detected",
      appDirectory: "apps/client",
      commandDirectory: ".",
      start: { script: "dev" },
      appUrl: "http://localhost:5173",
      readiness: [{ name: "Web app", url: "http://localhost:5173" }, { name: "API", url: "http://localhost:3001/health" }],
    });
    const environment = await prepareDemoEnvironment(workspacePath, profile.id);
    assert.equal(environment.start.displayCommand, "bun run dev");
    assert.equal(environment.start.workspacePath, workspacePath);
    const appMap = await inspectProject(workspacePath, { appDirectory: profile.appDirectory });
    assert.equal(appMap.appDirectory, "apps/client");
    assert.ok(appMap.controls.some((control) => control.name === "Start habit" && control.source === "apps/client/src/App.tsx"));
  } finally {
    await rm(workspacePath, { recursive: true, force: true });
  }
});

test("rejects non-loopback URLs in declared environment profiles", async () => {
  const workspacePath = await mkdtemp(path.join(os.tmpdir(), "demoflow-environment-"));
  try {
    await mkdir(path.join(workspacePath, ".demoflow"));
    await writeFile(path.join(workspacePath, ".demoflow", "environment.json"), JSON.stringify({
      version: 1,
      profiles: {
        unsafe: { appDirectory: ".", start: { script: "dev" }, appUrl: "https://example.com" },
      },
    }));
    await assert.rejects(discoverDemoEnvironments(workspacePath), /loopback HTTP URLs/);
  } finally {
    await rm(workspacePath, { recursive: true, force: true });
  }
});
