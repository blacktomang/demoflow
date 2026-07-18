import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const MAX_FILES = 300;
const SOURCE_EXTENSIONS = new Set([".tsx", ".jsx", ".ts", ".js"]);

export type AppMap = {
  workspacePath: string;
  frameworkHints: string[];
  scripts: string[];
  routes: string[];
  testIds: string[];
  labels: string[];
};

async function filesUnder(root: string, acc: string[] = []): Promise<string[]> {
  if (acc.length >= MAX_FILES) return acc;
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (["node_modules", ".git", "dist", "build", ".next"].includes(entry.name)) continue;
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) await filesUnder(absolute, acc);
    else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) acc.push(absolute);
    if (acc.length >= MAX_FILES) break;
  }
  return acc;
}

function unique(values: Iterable<string>, max = 100): string[] {
  return [...new Set(values)].slice(0, max).sort();
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

  for (const sourcePath of await filesUnder(path.join(workspacePath, "src")).catch(() => [])) {
    const source = await readFile(sourcePath, "utf8");
    for (const match of source.matchAll(/data-testid=["'`]([^"'`]+)["'`]/g)) testIds.push(match[1]);
    for (const match of source.matchAll(/(?:path|to)=["'`]([^"'`]+)["'`]/g)) routes.push(match[1]);
    for (const match of source.matchAll(/<(?:button|label)[^>]*>\s*([^<{]{2,80})\s*</g)) {
      const value = match[1].trim();
      if (!/[>{}()]/.test(value)) labels.push(value);
    }
  }

  const appMap: AppMap = {
    workspacePath,
    frameworkHints,
    scripts: Object.keys(packageJson.scripts ?? {}),
    routes: unique(routes),
    testIds: unique(testIds),
    labels: unique(labels),
  };
  const outputDir = path.join(workspacePath, ".demoflow");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "app-map.json"), JSON.stringify(appMap, null, 2));
  return appMap;
}
