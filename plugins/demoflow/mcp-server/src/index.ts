import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { inspectProject } from "./inspector.js";
import { writeDemoSpec, DemoSpecSchema } from "./spec.js";
import { startApp, stopApp } from "./app-lifecycle.js";
import { createPreview, getPreview, stopPreview } from "./proxy.js";

const server = new McpServer({ name: "demoflow", version: "0.1.0" });

server.tool(
  "inspect_project",
  "Create a compact local app map with scripts, routes, test IDs, and likely UI labels.",
  { workspacePath: z.string().describe("Absolute path to the local project workspace") },
  async ({ workspacePath }) => {
    const appMap = await inspectProject(workspacePath);
    return { content: [{ type: "text", text: JSON.stringify(appMap, null, 2) }] };
  },
);

server.tool(
  "start_app",
  "Start a user-approved local development script and wait for its local health URL.",
  {
    workspacePath: z.string(),
    scriptName: z.string().regex(/^[a-zA-Z0-9:_-]+$/).describe("User-approved package script name, for example dev"),
    baseUrl: z.string().url().refine((value) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(value), "Must be a loopback HTTP URL"),
  },
  async ({ workspacePath, scriptName, baseUrl }) => {
    const app = await startApp({ workspacePath, scriptName, baseUrl });
    return { content: [{ type: "text", text: `App ready: ${app.baseUrl} (${app.id})` }] };
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
  "Stop a DemoFlow app process or Demo Mode preview that was started by this MCP server.",
  { kind: z.enum(["app", "preview"]), id: z.string().min(1) },
  async ({ kind, id }) => {
    if (kind === "app") await stopApp(id);
    else await stopPreview(id);
    return { content: [{ type: "text", text: `Stopped ${kind}: ${id}` }] };
  },
);

server.tool(
  "write_spec",
  "Validate and save a DemoFlow demo spec under .demoflow/<id>/demo.spec.json.",
  { workspacePath: z.string(), spec: DemoSpecSchema },
  async ({ workspacePath, spec }) => {
    const path = await writeDemoSpec(workspacePath, spec);
    return { content: [{ type: "text", text: `Saved DemoFlow spec: ${path}` }] };
  },
);

await server.connect(new StdioServerTransport());
