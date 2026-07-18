import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

await build({
  entryPoints: [path.join(root, "mcp-server", "src", "index.ts")],
  outfile: path.join(root, "runtime", "index.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  sourcemap: false,
  legalComments: "none",
});

console.log("Packaged DemoFlow MCP runtime at plugins/demoflow/runtime/index.js");
