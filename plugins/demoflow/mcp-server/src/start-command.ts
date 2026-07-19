import { access, readFile } from "node:fs/promises";
import path from "node:path";

type PackageJson = {
  packageManager?: string;
  scripts?: Record<string, string>;
};

export type StartCommand = {
  workspacePath: string;
  scriptName: string;
  command: string;
  args: string[];
  displayCommand: string;
  baseUrl: string;
};

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function detectPackageManager(workspacePath: string, packageJson: PackageJson): Promise<string> {
  const declared = packageJson.packageManager?.split("@")[0];
  if (declared && ["npm", "pnpm", "yarn", "bun"].includes(declared)) return declared;
  if (await exists(path.join(workspacePath, "bun.lockb")) || await exists(path.join(workspacePath, "bun.lock"))) return "bun";
  if (await exists(path.join(workspacePath, "pnpm-lock.yaml"))) return "pnpm";
  if (await exists(path.join(workspacePath, "yarn.lock"))) return "yarn";
  return "npm";
}

export async function prepareAppStart(input: { workspacePath: string; scriptName: string; baseUrl: string }): Promise<StartCommand> {
  const packagePath = path.join(input.workspacePath, "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8")) as PackageJson;
  if (!packageJson.scripts?.[input.scriptName]) throw new Error(`Package script not found: ${input.scriptName}`);

  const manager = await detectPackageManager(input.workspacePath, packageJson);
  const args = manager === "yarn" ? [input.scriptName] : ["run", input.scriptName];
  return {
    workspacePath: input.workspacePath,
    scriptName: input.scriptName,
    command: manager,
    args,
    displayCommand: [manager, ...args].join(" "),
    baseUrl: input.baseUrl,
  };
}
