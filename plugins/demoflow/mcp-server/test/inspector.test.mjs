import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { inspectProject } from "../dist/inspector.js";
import { blockedDemoControls, suggestDemoStarts } from "../dist/suggestions.js";

test("discovers Next app-router controls from source without a running app", async () => {
  const workspacePath = await mkdtemp(path.join(os.tmpdir(), "demoflow-next-"));
  await mkdir(path.join(workspacePath, "app"));
  await writeFile(path.join(workspacePath, "package.json"), JSON.stringify({ dependencies: { next: "15", react: "19" }, scripts: { dev: "next dev" } }));
  await writeFile(path.join(workspacePath, "app", "page.tsx"), `
    export default function Page() {
      return <main>
        <button aria-label="Start a new TeachBack lesson">{busy ? "Opening lesson..." : "Preview the lesson"}</button>
        <button>Approve and begin</button>
        <label>Your explanation<textarea /></label>
        <button>{isTransfer ? "Try the new case" : "Teach Nova"}</button>
        <a href="/review">Review evidence</a>
      </main>;
    }
  `);

  const appMap = await inspectProject(workspacePath);
  assert.deepEqual(appMap.routes, ["/", "/review"]);
  assert.ok(appMap.labels.includes("Preview the lesson"));
  assert.ok(appMap.labels.includes("Approve and begin"));
  assert.ok(appMap.labels.includes("Teach Nova"));
  assert.ok(appMap.labels.includes("Try the new case"));
  assert.ok(appMap.labels.includes("Your explanation"));
  assert.ok(appMap.controls.some((control) => control.kind === "button" && control.name === "Preview the lesson" && control.source === "app/page.tsx"));
  assert.ok(appMap.controls.some((control) => control.kind === "button" && control.name === "Start a new TeachBack lesson"));
  assert.ok(appMap.controls.some((control) => control.kind === "label" && control.name === "Your explanation"));
});

test("keeps src-based React control discovery", async () => {
  const workspacePath = await mkdtemp(path.join(os.tmpdir(), "demoflow-src-"));
  await mkdir(path.join(workspacePath, "src"));
  await writeFile(path.join(workspacePath, "package.json"), JSON.stringify({ dependencies: { vite: "5", react: "18" } }));
  await writeFile(path.join(workspacePath, "src", "App.tsx"), `<button data-testid="save">Save</button>`);

  const appMap = await inspectProject(workspacePath);
  assert.deepEqual(appMap.testIds, ["save"]);
  assert.ok(appMap.controls.some((control) => control.kind === "test-id" && control.name === "save"));
  assert.ok(appMap.controls.some((control) => control.kind === "button" && control.name === "Save"));
});

test("carries parent React render guards into child controls and excludes blocked starts", async () => {
  const workspacePath = await mkdtemp(path.join(os.tmpdir(), "demoflow-react-state-"));
  await mkdir(path.join(workspacePath, "src", "components"), { recursive: true });
  await writeFile(path.join(workspacePath, "package.json"), JSON.stringify({ dependencies: { react: "19", vite: "7" } }));
  await writeFile(path.join(workspacePath, "src", "App.tsx"), `
    import { TemplatePicker } from "./components/TemplatePicker";
    import { HabitProtocolSetup } from "./components/HabitProtocolSetup";
    import { ChallengeDashboard } from "./components/ChallengeDashboard";
    export function App() {
      const [session, setSession] = useState();
      const [editingProtocol, setEditingProtocol] = useState(false);
      function start() { setSession({ activeChallenge: true }); }
      return <main>
        {!session?.activeChallenge && <TemplatePicker onStart={start} />}
        {session?.activeChallenge && (!session.habitProtocol || editingProtocol ? <HabitProtocolSetup /> : <ChallengeDashboard />)}
      </main>;
    }
  `);
  await writeFile(path.join(workspacePath, "src", "components", "TemplatePicker.tsx"), `export function TemplatePicker({ onStart }) { return <button onClick={onStart}>Join this habit</button>; }`);
  await writeFile(path.join(workspacePath, "src", "components", "HabitProtocolSetup.tsx"), `export function HabitProtocolSetup() { return <button>Save my protocol</button>; }`);
  await writeFile(path.join(workspacePath, "src", "components", "ChallengeDashboard.tsx"), `export function ChallengeDashboard() { return <button>Edit protocol</button>; }`);

  const appMap = await inspectProject(workspacePath);
  const save = appMap.controls.find((control) => control.name === "Save my protocol");
  const edit = appMap.controls.find((control) => control.name === "Edit protocol");
  assert.ok(save?.requires?.some((fact) => fact.expression === "session?.activeChallenge" && fact.expected));
  assert.ok(edit?.requires?.some((fact) => fact.expression === "session?.activeChallenge" && fact.expected));
  assert.ok(edit?.requires?.some((fact) => fact.expression === "session.habitProtocol" && fact.expected));
  assert.ok(suggestDemoStarts(appMap, "set protocol").some((candidate) => candidate.control.name === "Join this habit"));
  assert.ok(!suggestDemoStarts(appMap, "set protocol").some((candidate) => candidate.control.name === "Save my protocol"));
  assert.ok(blockedDemoControls(appMap).some((control) => control.name === "Save my protocol"));
});

test("surfaces evidence for distinct conditional customer flows", async () => {
  const workspacePath = await mkdtemp(path.join(os.tmpdir(), "demoflow-flow-inventory-"));
  await mkdir(path.join(workspacePath, "src"));
  await writeFile(path.join(workspacePath, "package.json"), JSON.stringify({ dependencies: { react: "19", vite: "7" } }));
  await writeFile(path.join(workspacePath, "src", "App.tsx"), `
    export function App() {
      const [mode, setMode] = useState();
      return <main>
        <button onClick={() => setMode("create")}>Create a workspace</button>
        <button onClick={() => setMode("import")}>Import a workspace</button>
        {mode === "create" && <button>Continue with a blank workspace</button>}
        {mode === "import" && <button>Choose an export file</button>}
      </main>;
    }
  `);

  const appMap = await inspectProject(workspacePath);
  const createContinuation = appMap.controls.find((control) => control.name === "Continue with a blank workspace");
  const importContinuation = appMap.controls.find((control) => control.name === "Choose an export file");

  assert.ok(createContinuation?.requires?.some((fact) => fact.expression === 'mode === "create"' && fact.expected));
  assert.ok(importContinuation?.requires?.some((fact) => fact.expression === 'mode === "import"' && fact.expected));
  assert.deepEqual(suggestDemoStarts(appMap).map((candidate) => candidate.control.name), ["Create a workspace", "Import a workspace"]);
});
