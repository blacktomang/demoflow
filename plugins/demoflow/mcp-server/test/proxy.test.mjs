import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createPreview, stopPreview } from "../dist/proxy.js";

let upstream;
let workspacePath;
let baseUrl;
let preview;

before(async () => {
  workspacePath = await mkdtemp(path.join(tmpdir(), "demoflow-test-"));
  await mkdir(path.join(workspacePath, ".demoflow", "onboarding"), { recursive: true });
  await writeFile(path.join(workspacePath, ".demoflow", "onboarding", "demo.spec.json"), JSON.stringify({
    version: 1, id: "onboarding", title: "Test", goal: "Test demo", startPath: "/",
    steps: [{ id: "cta", target: { testId: "cta" }, tooltip: { title: "CTA", body: "Click it" }, advance: { type: "click-target" } }],
  }));
  upstream = createServer((request, response) => {
    if (request.url === "/asset.js") return response.end("window.sampleAsset=true");
    if (request.url === "/style.css") {
      const body = gzipSync(".upstream-style { color: rebeccapurple; }");
      response.writeHead(200, { "content-type": "text/css", "content-encoding": "gzip", "content-length": body.length });
      return response.end(body);
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<html><head><title>Upstream</title></head><body><button data-testid=\"cta\">Go</button><script src=\"/asset.js\"></script></body></html>");
  });
  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const address = upstream.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
  preview = await createPreview({ workspacePath, baseUrl, demoId: "onboarding" });
});

after(async () => {
  await stopPreview(preview.id);
  await new Promise((resolve) => upstream.close(resolve));
  await rm(workspacePath, { recursive: true, force: true });
});

test("injects the overlay while preserving app HTML", async () => {
  const response = await fetch(preview.url);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /__DEMOFLOW_SPEC_URL__/);
  assert.match(html, /data-testid="cta"/);
});

test("serves the spec and overlay from reserved local paths", async () => {
  const spec = await (await fetch(`${preview.url}/__demoflow/spec.json`)).json();
  const overlay = await (await fetch(`${preview.url}/__demoflow/overlay.js`)).text();
  assert.equal(spec.steps[0].id, "cta");
  assert.match(overlay, /__demoflow_root/);
  assert.match(overlay, /Demo complete/);
  assert.match(overlay, /associated form control/);
  assert.match(overlay, /overlapsTarget/);
});

test("forwards decoded compressed stylesheets without stale compression headers", async () => {
  const response = await fetch(`${preview.url}/style.css`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-encoding"), null);
  assert.equal(response.headers.get("content-length"), null);
  assert.equal(await response.text(), ".upstream-style { color: rebeccapurple; }");
});

test("records a structured browser failure without forwarding the status request to the app", async () => {
  const response = await fetch(`${preview.url}/__demoflow/status`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ missingTarget: "cta", failure: { type: "target-unavailable", stepId: "cta", path: "/", target: { testId: "cta" }, occurredAt: "2026-07-20T00:00:00.000Z" }, diagnostic: { kind: "app-alert", path: "/", message: "JSON.parse: unexpected end of data", occurredAt: "2026-07-20T00:00:01.000Z" } }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    missingTargets: ["cta"],
    failures: [{ type: "target-unavailable", stepId: "cta", path: "/", target: { testId: "cta" }, occurredAt: "2026-07-20T00:00:00.000Z" }],
    diagnostics: [{ kind: "app-alert", path: "/", message: "JSON.parse: unexpected end of data", occurredAt: "2026-07-20T00:00:01.000Z" }],
  });
  const unknown = await fetch(`${preview.url}/__demoflow/unknown`);
  assert.equal(unknown.status, 404);
});

test("rejects an unreachable upstream before creating a preview", async () => {
  const unavailable = createServer();
  await new Promise((resolve) => unavailable.listen(0, "127.0.0.1", resolve));
  const address = unavailable.address();
  await new Promise((resolve) => unavailable.close(resolve));
  await assert.rejects(
    createPreview({ workspacePath, baseUrl: `http://127.0.0.1:${address.port}`, demoId: "onboarding" }),
    /DemoFlow cannot reach the app/,
  );
});
