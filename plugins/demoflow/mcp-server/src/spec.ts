import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { AppMap } from "./inspector.js";

const TargetSchema = z.union([
  z.object({ testId: z.string().min(1) }),
  z.object({ role: z.string().min(1), name: z.string().min(1), withinText: z.string().min(1).optional(), occurrence: z.number().int().min(1).optional() }),
  z.object({ label: z.string().min(1) }),
  z.object({ css: z.string().min(1) }),
]);

const AdvanceSchema = z.union([
  z.object({ type: z.literal("click-target") }),
  z.object({ type: z.literal("input-target"), minLength: z.number().int().min(1).optional() }),
  z.object({ type: z.literal("input-and-click"), submitTarget: TargetSchema, minLength: z.number().int().min(1).optional() }),
  z.object({ type: z.literal("path-is"), path: z.string().startsWith("/") }),
  z.object({ type: z.literal("element-visible"), target: TargetSchema }),
  z.object({ type: z.literal("manual") }),
]);

const PresentationSchema = z.object({
  theme: z.enum(["presenter", "minimal", "debug"]),
});

const IntroSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
});

export const DemoBriefSchema = z.object({
  showing: z.enum(["new-feature", "pr-change", "onboarding", "bug-fix"]),
  audience: z.enum(["engineer", "product-stakeholder", "customer"]),
  outcome: z.string().trim().min(3).max(280),
});

export type DemoBrief = z.infer<typeof DemoBriefSchema>;

const ProvenanceSchema = z.object({
  baseBranch: z.string().min(1),
  baseCommit: z.string().regex(/^[a-f0-9]{40}$/),
  currentBranch: z.string().min(1),
  currentCommit: z.string().regex(/^[a-f0-9]{40}$/),
});

export const DemoSpecSchema = z.object({
  version: z.literal(1),
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1),
  goal: z.string().min(1),
  startPath: z.string().startsWith("/"),
  brief: DemoBriefSchema.optional(),
  intro: IntroSchema.optional(),
  provenance: ProvenanceSchema.optional(),
  presentation: PresentationSchema.optional(),
  metadata: z.object({
    appFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    savedAt: z.string().datetime(),
    appDirectory: z.string().min(1).optional(),
  }).optional(),
  steps: z.array(z.object({
    id: z.string().min(1),
    path: z.string().startsWith("/").optional(),
    target: TargetSchema,
    tooltip: z.object({ title: z.string().min(1), body: z.string().min(1) }),
    advance: AdvanceSchema,
  })).min(1),
});

export type DemoSpec = z.infer<typeof DemoSpecSchema>;

export type SavedDemo = Pick<DemoSpec, "id" | "title" | "goal"> & { steps: number; savedAt?: string; appFingerprint?: string };

export async function listDemoSpecs(workspacePath: string): Promise<SavedDemo[]> {
  const root = path.join(workspacePath, ".demoflow");
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const demos = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    try {
      const raw = JSON.parse(await readFile(path.join(root, entry.name, "demo.spec.json"), "utf8"));
      const spec = DemoSpecSchema.parse(raw);
      return { id: spec.id, title: spec.title, goal: spec.goal, steps: spec.steps.length, savedAt: spec.metadata?.savedAt, appFingerprint: spec.metadata?.appFingerprint };
    } catch { return null; }
  }));
  const validDemos = demos.filter((demo): demo is Exclude<typeof demo, null> => demo !== null);
  return validDemos.sort((a, b) => (b.savedAt ?? "").localeCompare(a.savedAt ?? ""));
}

export async function readDemoSpec(workspacePath: string, demoId: string): Promise<DemoSpec> {
  const root = path.resolve(workspacePath, ".demoflow");
  const filePath = path.resolve(root, demoId, "demo.spec.json");
  if (!filePath.startsWith(root + path.sep)) throw new Error("Demo spec path must stay inside .demoflow");
  return DemoSpecSchema.parse(JSON.parse(await readFile(filePath, "utf8")));
}

export async function writeDemoSpec(workspacePath: string, spec: DemoSpec, appMap: AppMap): Promise<string> {
  const outputPath = path.resolve(workspacePath, ".demoflow", spec.id, "demo.spec.json");
  const allowedRoot = path.resolve(workspacePath, ".demoflow") + path.sep;
  if (!outputPath.startsWith(allowedRoot)) throw new Error("Demo spec path must stay inside .demoflow");
  await mkdir(path.dirname(outputPath), { recursive: true });
  const savedSpec: DemoSpec = { ...spec, metadata: { appFingerprint: appMap.fingerprint, savedAt: new Date().toISOString(), appDirectory: appMap.appDirectory } };
  await writeFile(outputPath, JSON.stringify(savedSpec, null, 2) + "\n", "utf8");
  const { workspacePath: _workspacePath, ...shareableAppMap } = appMap;
  await writeFile(path.join(path.dirname(outputPath), "app-map.json"), JSON.stringify(shareableAppMap, null, 2) + "\n", "utf8");
  return outputPath;
}
