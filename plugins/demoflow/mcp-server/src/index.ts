import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { inspectProject, type AppMap } from "./inspector.js";
import { writeDemoSpec, DemoSpecSchema, listDemoSpecs, readDemoSpec } from "./spec.js";
import { prepareAppStart } from "./start-command.js";
import { createPreview, getPreview, stopPreview } from "./proxy.js";
import { inspectBranchChanges } from "./branch.js";
import { blockedDemoControls, suggestDemoStarts } from "./suggestions.js";
import { checkDemoEnvironment, discoverDemoEnvironments, prepareDemoEnvironment } from "./environment.js";
import path from "node:path";

const server = new McpServer({ name: "demoflow", version: "0.1.0" });
const lastInspectedAppMaps = new Map<string, AppMap>();
const lastBranchComparisons = new Map<string, Awaited<ReturnType<typeof inspectBranchChanges>>>();

function appMapKey(workspacePath: string, appDirectory?: string): string {
  return `${path.resolve(workspacePath)}\u0000${appDirectory ?? "."}`;
}

async function inspectAndRemember(workspacePath: string, appDirectory?: string): Promise<AppMap> {
  const appMap = await inspectProject(workspacePath, { appDirectory });
  lastInspectedAppMaps.set(appMapKey(workspacePath, appDirectory), appMap);
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
    const appMap = await inspectAndRemember(workspacePath, spec.metadata?.appDirectory);
    return { content: [{ type: "text", text: JSON.stringify({ demoId, status: spec.metadata.appFingerprint === appMap.fingerprint ? "current" : "stale", savedFingerprint: spec.metadata.appFingerprint, currentFingerprint: appMap.fingerprint }, null, 2) }] };
  },
);

server.tool(
  "inspect_project",
  "Create a compact local app map with scripts, routes, test IDs, and likely UI labels. appDirectory supports a frontend package inside a monorepo.",
  { workspacePath: z.string().describe("Absolute path to the local project workspace"), appDirectory: z.string().optional().describe("Optional frontend package directory relative to workspacePath, for example apps/web") },
  async ({ workspacePath, appDirectory }) => {
    const appMap = await inspectAndRemember(workspacePath, appDirectory);
    return { content: [{ type: "text", text: JSON.stringify(appMap, null, 2) }] };
  },
);

server.tool(
  "suggest_demo_starts",
  "Rank up to three likely customer-facing clean-start controls from the inspected local app map. Controls with known positive state prerequisites are returned separately as blocked controls, never proposed as standalone starts. This tool does not create a demo spec.",
  { workspacePath: z.string(), appDirectory: z.string().optional(), intent: z.string().optional().describe("The developer's requested demo outcome, used only to rank source-discovered controls") },
  async ({ workspacePath, appDirectory, intent }) => {
    const appMap = lastInspectedAppMaps.get(appMapKey(workspacePath, appDirectory)) ?? await inspectAndRemember(workspacePath, appDirectory);
    return { content: [{ type: "text", text: JSON.stringify({ intent: intent ?? "", candidates: suggestDemoStarts(appMap, intent), blockedControls: blockedDemoControls(appMap) }, null, 2) }] };
  },
);

server.tool(
  "inspect_branch_changes",
  "Compare the checked-out Git branch with its detected or developer-specified base branch. Use this before proposing a PR-aware demo flow; it only reads local Git metadata and diffs.",
  { workspacePath: z.string().describe("Absolute path to the local project workspace"), baseBranch: z.string().optional().describe("Optional local base branch override, such as main, master, develop, or origin/main") },
  async ({ workspacePath, baseBranch }) => {
    const comparison = await inspectBranchChanges(workspacePath, baseBranch);
    lastBranchComparisons.set(workspacePath, comparison);
    return { content: [{ type: "text", text: JSON.stringify(comparison, null, 2) }] };
  },
);

server.tool(
  "list_environments",
  "Discover declared or safely inferred local Demo Environment profiles. These describe a frontend package, one declared start script, and loopback readiness checks; this tool never starts a process.",
  { workspacePath: z.string().describe("Absolute repository workspace path") },
  async ({ workspacePath }) => ({ content: [{ type: "text", text: JSON.stringify({ profiles: await discoverDemoEnvironments(workspacePath) }, null, 2) }] }),
);

server.tool(
  "prepare_environment",
  "Validate a Demo Environment profile and return the one declared local command that Codex may ask to run. This tool never starts a process.",
  { workspacePath: z.string(), profileId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) },
  async ({ workspacePath, profileId }) => {
    const environment = await prepareDemoEnvironment(workspacePath, profileId);
    return { content: [{ type: "text", text: JSON.stringify({
      ...environment,
      instruction: "Run start.displayCommand with Codex's terminal tool in start.workspacePath. Codex must show its native command approval. After it starts, call check_environment and create_preview only when every required service is ready.",
    }, null, 2) }] };
  },
);

server.tool(
  "check_environment",
  "Check whether every declared loopback frontend or API readiness URL in a Demo Environment profile is reachable. This is read-only and never starts, stops, or resets services.",
  { workspacePath: z.string(), profileId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) },
  async ({ workspacePath, profileId }) => ({ content: [{ type: "text", text: JSON.stringify(await checkDemoEnvironment(workspacePath, profileId), null, 2) }] }),
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
  "Return the active local Demo Mode URL, including structured browser failure reports and a copyable repair request for a coding-agent repair turn.",
  { previewId: z.string().min(1) },
  async ({ previewId }) => {
    const preview = getPreview(previewId);
    const repairRequest = preview.failures.length || preview.diagnostics.length
      ? `Repair DemoFlow preview ${preview.id}. Read its browser failure report with demoflow.open_preview, then revise only the affected step in demo ${preview.demoId}; do not change application source code.`
      : undefined;
    return { content: [{ type: "text", text: JSON.stringify({ ...preview, repairRequest }, null, 2) }] };
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
  { workspacePath: z.string(), appDirectory: z.string().optional(), spec: DemoSpecSchema },
  async ({ workspacePath, appDirectory, spec }) => {
    const branch = lastBranchComparisons.get(workspacePath);
    const specWithProvenance = spec.provenance || !branch ? spec : {
      ...spec,
      provenance: {
        baseBranch: branch.baseBranch,
        baseCommit: branch.baseCommit,
        currentBranch: branch.currentBranch,
        currentCommit: branch.currentCommit,
      },
    };
    const path = await writeDemoSpec(workspacePath, specWithProvenance, lastInspectedAppMaps.get(appMapKey(workspacePath, appDirectory)) ?? await inspectAndRemember(workspacePath, appDirectory));
    return { content: [{ type: "text", text: `Saved DemoFlow spec: ${path}` }] };
  },
);

await server.connect(new StdioServerTransport());
