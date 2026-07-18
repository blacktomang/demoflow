import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "node:http";
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
});
