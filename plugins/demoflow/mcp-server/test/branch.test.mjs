import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { inspectBranchChanges } from "../dist/branch.js";

const run = promisify(execFile);
async function git(workspacePath, args) { await run("git", ["-C", workspacePath, ...args]); }

test("detects master when origin/HEAD is unavailable and reports local branch changes", async () => {
  const workspacePath = await mkdtemp(path.join(os.tmpdir(), "demoflow-branch-"));
  await git(workspacePath, ["init"]);
  await git(workspacePath, ["checkout", "-b", "master"]);
  await git(workspacePath, ["config", "user.email", "demo@example.test"]);
  await git(workspacePath, ["config", "user.name", "DemoFlow test"]);
  await writeFile(path.join(workspacePath, "App.tsx"), "export const App = () => null;\n");
  await git(workspacePath, ["add", "App.tsx"]);
  await git(workspacePath, ["commit", "-m", "base"]);
  await git(workspacePath, ["checkout", "-b", "feature/profile-badge"]);
  await writeFile(path.join(workspacePath, "ProfileSheet.tsx"), "export const ProfileSheet = () => null;\n");
  await git(workspacePath, ["add", "ProfileSheet.tsx"]);
  await git(workspacePath, ["commit", "-m", "add profile badge"]);

  const comparison = await inspectBranchChanges(workspacePath);
  assert.equal(comparison.baseBranch, "master");
  assert.equal(comparison.currentBranch, "feature/profile-badge");
  assert.deepEqual(comparison.changedFiles, [{ status: "added", path: "ProfileSheet.tsx" }]);
  assert.equal(comparison.baseCommit.length, 40);
  assert.equal(comparison.currentCommit.length, 40);
});
