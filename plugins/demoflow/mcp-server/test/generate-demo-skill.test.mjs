import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const skillPath = path.resolve(testDirectory, "../../skills/generate-demo/SKILL.md");

async function readSkill() {
  return readFile(skillPath, "utf8");
}

test("requires a human-readable storyboard before DemoFlow writes a spec", async () => {
  const skill = await readSkill();
  const storyboardHeader = "| Step | User action | Why it matters | Evidence | Confidence |";

  assert.ok(skill.includes(storyboardHeader));
  assert.ok(skill.indexOf(storyboardHeader) < skill.indexOf("8. Write a versioned `demo.spec.json`"));
  assert.match(skill, /Do not show a JSON draft, write a spec, start the app, or create a preview until they do\./);
});

test("requires explicit flow choice and records every independently clickable action", async () => {
  const skill = await readSkill();

  assert.match(skill, /If the codebase supports more than one plausible main flow[\s\S]*?Wait for the developer to choose\./);
  assert.match(skill, /Represent every independently clickable real control as its own storyboard row and its own demo-spec step\./);
  assert.match(skill, /input followed by its real submit button may remain one row and one `input-and-click` step/);
  assert.match(skill, /DemoFlow has no maximum step limit\./);
});
