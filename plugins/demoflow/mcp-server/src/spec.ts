import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const TargetSchema = z.union([
  z.object({ testId: z.string().min(1) }),
  z.object({ role: z.string().min(1), name: z.string().min(1) }),
  z.object({ label: z.string().min(1) }),
  z.object({ css: z.string().min(1) }),
]);

const AdvanceSchema = z.union([
  z.object({ type: z.literal("click-target") }),
  z.object({ type: z.literal("path-is"), path: z.string().startsWith("/") }),
  z.object({ type: z.literal("element-visible"), target: TargetSchema }),
  z.object({ type: z.literal("manual") }),
]);

export const DemoSpecSchema = z.object({
  version: z.literal(1),
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1),
  goal: z.string().min(1),
  startPath: z.string().startsWith("/"),
  steps: z.array(z.object({
    id: z.string().min(1),
    path: z.string().startsWith("/").optional(),
    target: TargetSchema,
    tooltip: z.object({ title: z.string().min(1), body: z.string().min(1) }),
    advance: AdvanceSchema,
  })).min(1).max(5),
});

export type DemoSpec = z.infer<typeof DemoSpecSchema>;

export async function writeDemoSpec(workspacePath: string, spec: DemoSpec): Promise<string> {
  const outputPath = path.resolve(workspacePath, ".demoflow", spec.id, "demo.spec.json");
  const allowedRoot = path.resolve(workspacePath, ".demoflow") + path.sep;
  if (!outputPath.startsWith(allowedRoot)) throw new Error("Demo spec path must stay inside .demoflow");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(spec, null, 2) + "\n", "utf8");
  return outputPath;
}
