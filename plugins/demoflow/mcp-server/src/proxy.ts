import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { DemoSpecSchema, type DemoSpec } from "./spec.js";

type Preview = { id: string; url: string; baseUrl: string; workspacePath: string; demoId: string; server: ReturnType<typeof createServer>; status: { missingTargets: string[] } };
const previews = new Map<string, Preview>();
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const overlayDirectoryCandidate = [path.resolve(moduleDirectory, "../overlay"), path.resolve(moduleDirectory, "../../overlay")]
  .find((candidate) => existsSync(path.join(candidate, "overlay.js")));
if (!overlayDirectoryCandidate) throw new Error("DemoFlow overlay bundle is missing");
const overlayDirectory: string = overlayDirectoryCandidate;

function loopbackUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("DemoFlow previews can only proxy loopback HTTP apps");
  return url;
}

function injectedHtml(html: string): string {
  const tag = '<script>window.__DEMOFLOW_SPEC_URL__="/__demoflow/spec.json";</script><script src="/__demoflow/overlay.js" defer></script>';
  return html.includes("</head>") ? html.replace("</head>", `${tag}</head>`) : `${tag}${html}`;
}

function safeHeaders(headers: Headers, modified = false): Headers {
  const output = new Headers(headers);
  output.delete("connection");
  output.delete("transfer-encoding");
  if (modified) { output.delete("content-length"); output.delete("content-encoding"); }
  return output;
}

async function serveReserved(preview: Preview, request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  const pathname = new URL(request.url ?? "/", preview.url).pathname;
  if (!pathname.startsWith("/__demoflow/")) return false;
  if (pathname === "/__demoflow/spec.json") {
    const actualPath = path.join(preview.workspacePath, ".demoflow", preview.demoId, "demo.spec.json");
    const parsed = DemoSpecSchema.parse(JSON.parse(await readFile(actualPath, "utf8"))) as DemoSpec;
    response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(JSON.stringify(parsed));
    return true;
  }
  if (pathname === "/__demoflow/overlay.js") {
    response.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
    response.end(await readFile(path.join(overlayDirectory, "overlay.js")));
    return true;
  }
  if (pathname === "/__demoflow/status") {
    if (request.method === "POST") {
      let body = "";
      for await (const chunk of request) body += chunk;
      try {
        const report = JSON.parse(body) as { missingTarget?: string };
        if (report.missingTarget) preview.status.missingTargets.push(report.missingTarget);
      } catch {
        response.writeHead(400, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "Invalid DemoFlow status payload" }));
        return true;
      }
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(preview.status));
    return true;
  }
  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "Unknown DemoFlow local endpoint" }));
  return true;
}

async function forward(preview: Preview, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const upstream = loopbackUrl(preview.baseUrl);
  const target = new URL(request.url ?? "/", upstream);
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) if (value && !["host", "connection"].includes(key.toLowerCase())) headers.set(key, Array.isArray(value) ? value.join(",") : value);
  const upstreamResponse = await fetch(target, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method ?? "GET") ? undefined : request,
    // Node fetch requires this for streaming request bodies.
    duplex: "half",
  } as RequestInit);
  const contentType = upstreamResponse.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    const body = injectedHtml(await upstreamResponse.text());
    response.writeHead(upstreamResponse.status, Object.fromEntries(safeHeaders(upstreamResponse.headers, true)));
    response.end(body);
    return;
  }
  response.writeHead(upstreamResponse.status, Object.fromEntries(safeHeaders(upstreamResponse.headers)));
  response.end(Buffer.from(await upstreamResponse.arrayBuffer()));
}

export async function createPreview(input: { workspacePath: string; baseUrl: string; demoId: string }): Promise<Pick<Preview, "id" | "url">> {
  loopbackUrl(input.baseUrl);
  const id = randomUUID();
  const preview = { id, baseUrl: input.baseUrl, demoId: input.demoId, workspacePath: input.workspacePath, status: { missingTargets: [] as string[] } } as Preview;
  preview.server = createServer(async (request, response) => {
    try {
      if (await serveReserved(preview, request, response)) return;
      await forward(preview, request, response);
    } catch (error) {
      response.writeHead(502, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });
  await new Promise<void>((resolve) => preview.server.listen(0, "127.0.0.1", resolve));
  const address = preview.server.address();
  if (!address || typeof address === "string") throw new Error("Could not determine DemoFlow preview port");
  preview.url = `http://127.0.0.1:${address.port}`;
  previews.set(id, preview);
  return { id, url: preview.url };
}

export function getPreview(id: string): { id: string; url: string; baseUrl: string; demoId: string; missingTargets: string[] } {
  const preview = previews.get(id);
  if (!preview) throw new Error(`Unknown DemoFlow preview: ${id}`);
  return { id: preview.id, url: preview.url, baseUrl: preview.baseUrl, demoId: preview.demoId, missingTargets: preview.status.missingTargets };
}

export async function stopPreview(id: string): Promise<void> {
  const preview = previews.get(id);
  if (!preview) throw new Error(`Unknown DemoFlow preview: ${id}`);
  previews.delete(id);
  await new Promise<void>((resolve, reject) => preview.server.close((error) => error ? reject(error) : resolve()));
}
