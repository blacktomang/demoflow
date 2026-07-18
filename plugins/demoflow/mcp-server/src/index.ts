import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { inspectProject } from "./inspector.js";
import { writeDemoSpec, DemoSpecSchema } from "./spec.js";

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
  "write_spec",
  "Validate and save a DemoFlow demo spec under .demoflow/<id>/demo.spec.json.",
  { workspacePath: z.string(), spec: DemoSpecSchema },
  async ({ workspacePath, spec }) => {
    const path = await writeDemoSpec(workspacePath, spec);
    return { content: [{ type: "text", text: `Saved DemoFlow spec: ${path}` }] };
  },
);

await server.connect(new StdioServerTransport());
