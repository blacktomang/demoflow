import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { prepareAppStart } from "../dist/start-command.js";

test("prepares a declared script without starting a process", async () => {
  const workspacePath = await mkdtemp(path.join(tmpdir(), "demoflow-start-"));
  try {
    await writeFile(path.join(workspacePath, "package.json"), JSON.stringify({ scripts: { dev: "vite" } }));
    await writeFile(path.join(workspacePath, "bun.lock"), "");
    const start = await prepareAppStart({ workspacePath, scriptName: "dev", baseUrl: "http://127.0.0.1:3000" });
    assert.deepEqual(start, {
      workspacePath,
      scriptName: "dev",
      command: "bun",
      args: ["run", "dev"],
      displayCommand: "bun run dev",
      baseUrl: "http://127.0.0.1:3000",
    });
  } finally {
    await rm(workspacePath, { recursive: true, force: true });
  }
});

test("rejects scripts that are not declared in package.json", async () => {
  const workspacePath = await mkdtemp(path.join(tmpdir(), "demoflow-start-"));
  try {
    await writeFile(path.join(workspacePath, "package.json"), JSON.stringify({ scripts: { dev: "vite" } }));
    await assert.rejects(
      prepareAppStart({ workspacePath, scriptName: "dangerous", baseUrl: "http://127.0.0.1:3000" }),
      /Package script not found: dangerous/,
    );
  } finally {
    await rm(workspacePath, { recursive: true, force: true });
  }
});
