import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_CHANGED_FILES = 100;
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export type BranchChange = {
  status: "added" | "modified" | "deleted" | "renamed";
  path: string;
  previousPath?: string;
};

export type BranchComparison = {
  repositoryRoot: string;
  baseBranch: string;
  baseCommit: string;
  currentBranch: string;
  currentCommit: string;
  changedFiles: BranchChange[];
  truncated: boolean;
};

async function git(workspacePath: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", workspacePath, ...args], { maxBuffer: 1024 * 1024 });
  return stdout.trim();
}

function assertSafeRef(ref: string) {
  if (!SAFE_REF.test(ref) || ref.startsWith("-")) throw new Error("Base branch contains unsupported characters");
}

async function refExists(workspacePath: string, ref: string): Promise<boolean> {
  try {
    await git(workspacePath, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    return true;
  } catch { return false; }
}

async function detectBaseBranch(workspacePath: string): Promise<string> {
  try {
    const remoteHead = await git(workspacePath, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
    if (remoteHead && await refExists(workspacePath, remoteHead)) return remoteHead;
  } catch { /* origin/HEAD is optional */ }

  for (const candidate of ["main", "master", "develop", "origin/main", "origin/master", "origin/develop"]) {
    if (await refExists(workspacePath, candidate)) return candidate;
  }
  throw new Error("Could not detect a base branch. Pass baseBranch explicitly (for example main, master, or develop).");
}

function parseChangedFiles(output: string): BranchChange[] {
  if (!output) return [];
  const changes: BranchChange[] = [];
  for (const line of output.split("\n").slice(0, MAX_CHANGED_FILES)) {
    const [status, firstPath, secondPath] = line.split("\t");
    if (!status || !firstPath) continue;
    if (status.startsWith("R") || status.startsWith("C")) {
      changes.push({ status: "renamed", previousPath: firstPath, path: secondPath || firstPath });
      continue;
    }
    const mapped = status === "A" ? "added" : status === "D" ? "deleted" : "modified";
    changes.push({ status: mapped, path: firstPath });
  }
  return changes;
}

export async function inspectBranchChanges(workspacePath: string, requestedBaseBranch?: string): Promise<BranchComparison> {
  const repositoryRoot = await git(workspacePath, ["rev-parse", "--show-toplevel"])
    .catch(() => { throw new Error("DemoFlow PR-aware mode requires a local Git repository."); });
  const baseBranch = requestedBaseBranch ?? await detectBaseBranch(repositoryRoot);
  assertSafeRef(baseBranch);
  if (!await refExists(repositoryRoot, baseBranch)) throw new Error(`Base branch \"${baseBranch}\" does not exist locally.`);
  const [baseCommit, currentCommit, currentBranch, rawChangedFiles] = await Promise.all([
    git(repositoryRoot, ["rev-parse", `${baseBranch}^{commit}`]),
    git(repositoryRoot, ["rev-parse", "HEAD"]),
    git(repositoryRoot, ["branch", "--show-current"]),
    git(repositoryRoot, ["diff", "--name-status", "--find-renames", `${baseBranch}...HEAD`]),
  ]);
  const allChanges = rawChangedFiles ? rawChangedFiles.split("\n") : [];
  return {
    repositoryRoot,
    baseBranch,
    baseCommit,
    currentBranch: currentBranch || "HEAD (detached)",
    currentCommit,
    changedFiles: parseChangedFiles(rawChangedFiles),
    truncated: allChanges.length > MAX_CHANGED_FILES,
  };
}
