import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { prepareAppStart, type StartCommand } from "./start-command.js";

type PackageJson = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
};

type EnvironmentFile = {
  version: 1;
  profiles: Record<string, {
    label?: string;
    appDirectory: string;
    commandDirectory?: string;
    start: { script: string };
    appUrl: string;
    readiness?: Array<{ name: string; url: string }>;
  }>;
};

export type EnvironmentProfile = {
  id: string;
  label: string;
  source: "declared" | "detected";
  appDirectory: string;
  commandDirectory: string;
  start: { script: string };
  appUrl: string;
  readiness: Array<{ name: string; url: string }>;
};

export type EnvironmentReadiness = {
  name: string;
  url: string;
  status: "ready" | "unavailable";
  statusCode?: number;
  error?: string;
};

async function exists(filePath: string): Promise<boolean> {
  try { await access(filePath); return true; } catch { return false; }
}

async function packageJson(directory: string): Promise<PackageJson> {
  return JSON.parse(await readFile(path.join(directory, "package.json"), "utf8")) as PackageJson;
}

function loopbackUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error(`Environment URLs must be loopback HTTP URLs: ${value}`);
  return url.toString().replace(/\/$/, "");
}

function relativeDirectory(workspacePath: string, value: string, label: string): string {
  if (!value || path.isAbsolute(value)) throw new Error(`${label} must be a non-empty relative directory`);
  const root = path.resolve(workspacePath);
  const resolved = path.resolve(root, value);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) throw new Error(`${label} must stay inside the workspace`);
  return path.relative(root, resolved) || ".";
}

function validateProfile(workspacePath: string, id: string, value: EnvironmentFile["profiles"][string], source: EnvironmentProfile["source"]): EnvironmentProfile {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`Environment profile ID must be kebab-case: ${id}`);
  if (!value || typeof value !== "object" || !value.start?.script || !value.appDirectory || !value.appUrl) throw new Error(`Environment profile ${id} is missing appDirectory, start.script, or appUrl`);
  if (!/^[a-zA-Z0-9:_-]+$/.test(value.start.script)) throw new Error(`Environment profile ${id} has an invalid script name`);
  const appDirectory = relativeDirectory(workspacePath, value.appDirectory, `Environment profile ${id} appDirectory`);
  const commandDirectory = relativeDirectory(workspacePath, value.commandDirectory ?? ".", `Environment profile ${id} commandDirectory`);
  const readiness = (value.readiness ?? [{ name: "Web app", url: value.appUrl }]).map((service) => {
    if (!service?.name || !service?.url) throw new Error(`Environment profile ${id} has an invalid readiness service`);
    return { name: service.name.slice(0, 80), url: loopbackUrl(service.url) };
  });
  const appUrl = loopbackUrl(value.appUrl);
  if (!readiness.some((service) => service.url === appUrl)) readiness.unshift({ name: "Web app", url: appUrl });
  return { id, label: value.label?.slice(0, 100) || id, source, appDirectory, commandDirectory, start: { script: value.start.script }, appUrl, readiness };
}

async function workspacePackageDirectories(workspacePath: string, rootPackage: PackageJson): Promise<string[]> {
  const configured = Array.isArray(rootPackage.workspaces) ? rootPackage.workspaces : rootPackage.workspaces?.packages ?? [];
  const directories = new Set<string>();
  for (const pattern of configured) {
    const match = /^([^*]+)\/\*$/.exec(pattern);
    if (!match) continue;
    const parent = path.join(workspacePath, match[1]);
    for (const entry of await readdir(parent, { withFileTypes: true }).catch(() => [])) {
      if (entry.isDirectory() && await exists(path.join(parent, entry.name, "package.json"))) directories.add(path.join(parent, entry.name));
    }
  }
  return [...directories].sort();
}

function frameworkName(packageJson: PackageJson): "vite" | "next" | null {
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  if ("vite" in dependencies || "@vitejs/plugin-react" in dependencies) return "vite";
  if ("next" in dependencies) return "next";
  return null;
}

async function inferredReadiness(appDirectory: string, appUrl: string): Promise<Array<{ name: string; url: string }>> {
  const readiness = [{ name: "Web app", url: appUrl }];
  const configFiles = ["vite.config.ts", "vite.config.js", "vite.config.mts", "vite.config.mjs"];
  for (const file of configFiles) {
    const source = await readFile(path.join(appDirectory, file), "utf8").catch(() => "");
    const health = source.match(/["']\/health["']\s*:\s*["'](http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?)["']/);
    if (health?.[1]) readiness.push({ name: "API", url: loopbackUrl(`${health[1]}/health`) });
  }
  return readiness;
}

async function detectProfile(workspacePath: string): Promise<EnvironmentProfile[]> {
  const rootPackage = await packageJson(workspacePath);
  const packages = await workspacePackageDirectories(workspacePath, rootPackage);
  const frontend = (await Promise.all(packages.map(async (directory) => ({ directory, packageJson: await packageJson(directory) })))).filter(({ packageJson }) => frameworkName(packageJson));
  if (frontend.length !== 1 || !rootPackage.scripts?.dev) return [];
  const app = frontend[0];
  const framework = frameworkName(app.packageJson);
  const appUrl = framework === "next" ? "http://localhost:3000" : "http://localhost:5173";
  const relativeApp = path.relative(workspacePath, app.directory);
  return [{
    id: "detected-local",
    label: `Detected local full stack (${relativeApp})`,
    source: "detected",
    appDirectory: relativeApp,
    commandDirectory: ".",
    start: { script: "dev" },
    appUrl,
    readiness: await inferredReadiness(app.directory, appUrl),
  }];
}

export async function discoverDemoEnvironments(workspacePath: string): Promise<EnvironmentProfile[]> {
  const configPath = path.join(workspacePath, ".demoflow", "environment.json");
  if (await exists(configPath)) {
    const config = JSON.parse(await readFile(configPath, "utf8")) as EnvironmentFile;
    if (config.version !== 1 || !config.profiles || typeof config.profiles !== "object") throw new Error(".demoflow/environment.json must contain version 1 and a profiles object");
    return Object.entries(config.profiles).map(([id, profile]) => validateProfile(workspacePath, id, profile, "declared"));
  }
  return detectProfile(workspacePath);
}

export async function prepareDemoEnvironment(workspacePath: string, profileId: string): Promise<{ profile: EnvironmentProfile; start: StartCommand }> {
  const profile = (await discoverDemoEnvironments(workspacePath)).find((candidate) => candidate.id === profileId);
  if (!profile) throw new Error(`Demo environment profile not found: ${profileId}`);
  const commandPath = path.resolve(workspacePath, profile.commandDirectory);
  const start = await prepareAppStart({ workspacePath: commandPath, scriptName: profile.start.script, baseUrl: profile.appUrl });
  return { profile, start };
}

export async function checkDemoEnvironment(workspacePath: string, profileId: string): Promise<{ profile: EnvironmentProfile; services: EnvironmentReadiness[] }> {
  const profile = (await discoverDemoEnvironments(workspacePath)).find((candidate) => candidate.id === profileId);
  if (!profile) throw new Error(`Demo environment profile not found: ${profileId}`);
  const services = await Promise.all(profile.readiness.map(async (service): Promise<EnvironmentReadiness> => {
    try {
      const response = await fetch(service.url, { signal: AbortSignal.timeout(2_000) });
      return response.ok ? { ...service, status: "ready", statusCode: response.status } : { ...service, status: "unavailable", statusCode: response.status, error: `HTTP ${response.status}` };
    } catch (error) {
      return { ...service, status: "unavailable", error: error instanceof Error ? error.message.slice(0, 160) : String(error).slice(0, 160) };
    }
  }));
  return { profile, services };
}
