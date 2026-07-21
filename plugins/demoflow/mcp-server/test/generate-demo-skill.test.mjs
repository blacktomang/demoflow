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
  assert.ok(skill.indexOf(storyboardHeader) < skill.indexOf("9. Write a versioned `demo.spec.json`"));
  assert.match(skill, /Do not show a JSON draft, write a spec, start the app, or create a preview until they confirm it\./);
});

test("requires explicit flow choice and records every independently clickable action", async () => {
  const skill = await readSkill();

  assert.match(skill, /If more than one viable start exists,[\s\S]*?ask which flow they want demonstrated/);
  assert.match(skill, /Every real click, navigation, or meaningful field interaction must have its own storyboard row in execution order\./);
  assert.match(skill, /The sole exception is filling a field and clicking its real submit button: show both in one row as a compound action, then use `input-and-click` in the eventual spec\./);
  assert.match(skill, /DemoFlow has no maximum step limit\./);
});
