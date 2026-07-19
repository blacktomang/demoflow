import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { inspectProject, type AppMap } from "./inspector.js";
import { writeDemoSpec, DemoSpecSchema, listDemoSpecs, readDemoSpec } from "./spec.js";
import { prepareAppStart } from "./start-command.js";
import { createPreview, getPreview, stopPreview } from "./proxy.js";

const server = new McpServer({ name: "demoflow", version: "0.1.0" });
const lastInspectedAppMaps = new Map<string, AppMap>();

async function inspectAndRemember(workspacePath: string): Promise<AppMap> {
  const appMap = await inspectProject(workspacePath);
  lastInspectedAppMaps.set(workspacePath, appMap);
  return appMap;
}

server.tool(
  "list_demos",
  "List saved DemoFlow specs without inspecting application source code.",
  { workspacePath: z.string() },
  async ({ workspacePath }) => ({ content: [{ type: "text", text: JSON.stringify(await listDemoSpecs(workspacePath), null, 2) }] }),
);

server.tool(
  "check_demo_freshness",
  "Compare a saved demo's app-map fingerprint to the current compact app map. This scans source only when called.",
  { workspacePath: z.string(), demoId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) },
  async ({ workspacePath, demoId }) => {
    const spec = await readDemoSpec(workspacePath, demoId);
    if (!spec.metadata?.appFingerprint) return { content: [{ type: "text", text: JSON.stringify({ demoId, status: "unknown", reason: "This demo was saved before fingerprints were added." }, null, 2) }] };
    const appMap = await inspectAndRemember(workspacePath);
    return { content: [{ type: "text", text: JSON.stringify({ demoId, status: spec.metadata.appFingerprint === appMap.fingerprint ? "current" : "stale", savedFingerprint: spec.metadata.appFingerprint, currentFingerprint: appMap.fingerprint }, null, 2) }] };
  },
);

server.tool(
  "inspect_project",
  "Create a compact local app map with scripts, routes, test IDs, and likely UI labels.",
  { workspacePath: z.string().describe("Absolute path to the local project workspace") },
  async ({ workspacePath }) => {
    const appMap = await inspectAndRemember(workspacePath);
    return { content: [{ type: "text", text: JSON.stringify(appMap, null, 2) }] };
  },
);

server.tool(
  "prepare_app_start",
  "Validate a declared local development script and return the exact command for Codex to run. This tool never starts a process.",
  {
    workspacePath: z.string(),
    scriptName: z.string().regex(/^[a-zA-Z0-9:_-]+$/).describe("User-approved package script name, for example dev"),
    baseUrl: z.string().url().refine((value) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(value), "Must be a loopback HTTP URL"),
  },
  async ({ workspacePath, scriptName, baseUrl }) => {
    const start = await prepareAppStart({ workspacePath, scriptName, baseUrl });
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          ...start,
          instruction: "Run this command with Codex's terminal tool. Codex must show its native command approval before execution. Once the app is reachable at baseUrl, call create_preview.",
        }, null, 2),
      }],
    };
  },
);

server.tool(
  "create_preview",
  "Serve a local app through a loopback proxy and inject the temporary DemoFlow overlay.",
  {
    workspacePath: z.string(),
    baseUrl: z.string().url().refine((value) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(value), "Must be a loopback HTTP URL"),
    demoId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  },
  async ({ workspacePath, baseUrl, demoId }) => {
    const preview = await createPreview({ workspacePath, baseUrl, demoId });
    return { content: [{ type: "text", text: `Demo Mode ready: ${preview.url} (${preview.id})` }] };
  },
);

server.tool(
  "open_preview",
  "Return the active local Demo Mode URL and its status.",
  { previewId: z.string().min(1) },
  async ({ previewId }) => {
    const preview = getPreview(previewId);
    return { content: [{ type: "text", text: JSON.stringify(preview, null, 2) }] };
  },
);

server.tool(
  "stop",
  "Stop a Demo Mode preview. The target app process belongs to Codex and is not controlled by DemoFlow.",
  { previewId: z.string().min(1) },
  async ({ previewId }) => {
    await stopPreview(previewId);
    return { content: [{ type: "text", text: `Stopped preview: ${previewId}` }] };
  },
);

server.tool(
  "write_spec",
  "Validate and save a DemoFlow demo spec under .demoflow/<id>/demo.spec.json.",
  { workspacePath: z.string(), spec: DemoSpecSchema },
  async ({ workspacePath, spec }) => {
    const path = await writeDemoSpec(workspacePath, spec, lastInspectedAppMaps.get(workspacePath) ?? await inspectAndRemember(workspacePath));
    return { content: [{ type: "text", text: `Saved DemoFlow spec: ${path}` }] };
  },
);

await server.connect(new StdioServerTransport());
