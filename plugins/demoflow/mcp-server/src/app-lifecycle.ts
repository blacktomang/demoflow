import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

type StartedApp = { id: string; workspacePath: string; scriptName: string; baseUrl: string; process: ChildProcess };
const apps = new Map<string, StartedApp>();

export async function waitForHealth(baseUrl: string, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = "No response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1_500) });
      if (response.ok || response.status < 500) return;
      lastError = `Received HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Local app did not become ready at ${baseUrl}: ${lastError}`);
}

function packageManager(): string {
  const bundledNpm = "/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/npm";
  return process.platform === "darwin" && existsSync(bundledNpm) ? bundledNpm : "npm";
}

export async function startApp(input: { workspacePath: string; scriptName: string; baseUrl: string }): Promise<Pick<StartedApp, "id" | "baseUrl">> {
  const packageJson = JSON.parse(await readFile(path.join(input.workspacePath, "package.json"), "utf8")) as { scripts?: Record<string, string> };
  if (!packageJson.scripts?.[input.scriptName]) throw new Error(`Package script not found: ${input.scriptName}`);
  const manager = packageManager();
  const child = spawn(manager, ["run", input.scriptName], {
    cwd: input.workspacePath,
    shell: true,
    stdio: "pipe",
    env: { ...process.env, HOST: "127.0.0.1" },
  });
  const id = randomUUID();
  const app: StartedApp = { id, ...input, process: child };
  apps.set(id, app);
  try {
    await waitForHealth(input.baseUrl);
    return { id, baseUrl: input.baseUrl };
  } catch (error) {
    await stopApp(id);
    throw error;
  }
}

export async function stopApp(id: string): Promise<void> {
  const app = apps.get(id);
  if (!app) throw new Error(`Unknown DemoFlow app process: ${id}`);
  apps.delete(id);
  if (app.process.exitCode !== null || app.process.killed) return;
  app.process.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => { app.process.kill("SIGKILL"); resolve(); }, 3_000);
    app.process.once("exit", () => { clearTimeout(timeout); resolve(); });
  });
}
