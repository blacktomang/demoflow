import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const MAX_FILES = 300;
const MAX_VALUES = 100;
const SOURCE_EXTENSIONS = new Set([".tsx", ".jsx", ".ts", ".js"]);
const UI_ROOTS = ["src", "app", "pages", "components"];

export type UiControl = {
  kind: "button" | "link" | "label" | "test-id";
  name: string;
  source: string;
};

export type AppMap = {
  workspacePath: string;
  frameworkHints: string[];
  scripts: string[];
  routes: string[];
  testIds: string[];
  labels: string[];
  controls: UiControl[];
  fingerprint: string;
};

async function filesUnder(root: string, acc: string[], seen: Set<string>): Promise<void> {
  if (acc.length >= MAX_FILES) return;
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (["node_modules", ".git", "dist", "build", ".next"].includes(entry.name)) continue;
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) await filesUnder(absolute, acc, seen);
    else if (SOURCE_EXTENSIONS.has(path.extname(entry.name)) && !seen.has(absolute)) {
      seen.add(absolute);
      acc.push(absolute);
    }
    if (acc.length >= MAX_FILES) break;
  }
}

async function sourceFiles(workspacePath: string): Promise<string[]> {
  const files: string[] = [];
  const seen = new Set<string>();
  for (const root of UI_ROOTS) await filesUnder(path.join(workspacePath, root), files, seen).catch(() => {});
  return files;
}

function unique(values: Iterable<string>, max = MAX_VALUES): string[] {
  return [...new Set(values)].slice(0, max).sort();
}

function uniqueControls(controls: UiControl[]): UiControl[] {
  const seen = new Set<string>();
  return controls.filter((control) => {
    const key = `${control.kind}\u0000${control.name}\u0000${control.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_VALUES).sort((a, b) => a.source.localeCompare(b.source) || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}

function controlText(content: string): string[] {
  const names: string[] = [];
  const withoutTags = content.replace(/<[^>]+>/g, " ");
  for (const match of withoutTags.matchAll(/["'`]([^"'`]{2,80})["'`]/g)) names.push(match[1].trim());
  const directText = withoutTags.replace(/\{[^{}]*\}/g, " ").replace(/\s+/g, " ").trim();
  if (directText.length >= 2 && directText.length <= 80 && !/[<>{}]/.test(directText)) names.push(directText);
  return unique(names);
}

function nextRoute(workspacePath: string, sourcePath: string): string | null {
  const relative = path.relative(path.join(workspacePath, "app"), sourcePath).split(path.sep);
  const file = relative.pop();
  if (!file || !/^page\.(tsx|jsx|ts|js)$/.test(file)) return null;
  const segments = relative
    .filter((segment) => !/^\(.+\)$/.test(segment) && !segment.startsWith("@"))
    .map((segment) => segment.replace(/^\[\.\.\.(.+)\]$/, ":$1*").replace(/^\[(.+)\]$/, ":$1"));
  return `/${segments.join("/")}`.replace(/\/$/, "") || "/";
}

function inspectSource(source: string, sourcePath: string, workspacePath: string, routes: string[], testIds: string[], labels: string[], controls: UiControl[]) {
  const relativeSource = path.relative(workspacePath, sourcePath);
  const route = nextRoute(workspacePath, sourcePath);
  if (route) routes.push(route);
  for (const match of source.matchAll(/(?:path|to|href)=["'`]([^"'`]+)["'`]/g)) {
    if (match[1].startsWith("/")) routes.push(match[1]);
  }
  for (const match of source.matchAll(/data-testid=["'`]([^"'`]+)["'`]/g)) {
    const name = match[1].trim();
    testIds.push(name); controls.push({ kind: "test-id", name, source: relativeSource });
  }
  for (const match of source.matchAll(/<(button|a|label)\b([^>]*)>/g)) {
    const kind = match[1] === "a" ? "link" : match[1] as "button" | "label";
    for (const aria of match[2].matchAll(/aria-label=["'`]([^"'`]+)["'`]/g)) {
      const name = aria[1].trim();
      labels.push(name); controls.push({ kind, name, source: relativeSource });
    }
  }
  for (const match of source.matchAll(/<(button|a|label)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
    const kind = match[1] === "a" ? "link" : match[1] as "button" | "label";
    for (const name of controlText(match[2])) {
      labels.push(name); controls.push({ kind, name, source: relativeSource });
    }
  }
}

export function fingerprintAppMap(appMap: Omit<AppMap, "workspacePath" | "fingerprint">): string {
  return createHash("sha256").update(JSON.stringify({
    frameworkHints: appMap.frameworkHints,
    scripts: appMap.scripts,
    routes: appMap.routes,
    testIds: appMap.testIds,
    labels: appMap.labels,
    controls: appMap.controls,
  })).digest("hex");
}

export async function inspectProject(workspacePath: string): Promise<AppMap> {
  const packagePath = path.join(workspacePath, "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  const frameworkHints = ["react", "vite", "next", "@remix-run/react"].filter((name) => name in dependencies);
  const routes: string[] = [];
  const testIds: string[] = [];
  const labels: string[] = [];
  const controls: UiControl[] = [];

  for (const sourcePath of await sourceFiles(workspacePath)) {
    inspectSource(await readFile(sourcePath, "utf8"), sourcePath, workspacePath, routes, testIds, labels, controls);
  }

  const appMapBase = {
    workspacePath,
    frameworkHints,
    scripts: Object.keys(packageJson.scripts ?? {}),
    routes: unique(routes),
    testIds: unique(testIds),
    labels: unique(labels),
    controls: uniqueControls(controls),
  };
  const appMap: AppMap = { ...appMapBase, fingerprint: fingerprintAppMap(appMapBase) };
  const outputDir = path.join(workspacePath, ".demoflow");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "app-map.json"), JSON.stringify(appMap, null, 2));
  return appMap;
}
