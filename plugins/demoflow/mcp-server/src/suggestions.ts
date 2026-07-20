import type { AppMap, UiControl } from "./inspector.js";

export type DemoStartSuggestion = {
  control: UiControl;
  target: { role: "button" | "link"; name: string };
  score: number;
  category: "primary-action" | "neutral-action" | "setup-action";
  rationale: string[];
};

const primaryAction = /\b(preview|start|begin|continue|open|view|show|create|join|approve|submit|save|complete|try)\b/i;
const setupAction = /\b(restore|reset|seed|hydrate|fixture|debug|developer|devtools|migration)\b/i;

function intentTerms(intent: string): string[] {
  return [...new Set(intent.toLocaleLowerCase().match(/[a-z0-9]{3,}/g) ?? [])];
}

/**
 * This is deliberately a ranking aid, not an attempt to invent an end-to-end
 * story. Static source can distinguish likely product controls from setup
 * controls, but a developer (or Codex) must still choose the demo's narrative.
 */
export function suggestDemoStarts(appMap: AppMap, intent = ""): DemoStartSuggestion[] {
  const terms = intentTerms(intent);
  const candidates = appMap.controls
    .filter((control): control is UiControl & { kind: "button" | "link" } => control.kind === "button" || control.kind === "link")
    .map((control) => {
      const name = control.name.toLocaleLowerCase();
      const rationale: string[] = [];
      let score = control.kind === "button" ? 2 : 1;
      const isSetup = setupAction.test(name);
      if (isSetup) {
        score -= 40;
        rationale.push("Looks like setup, restore, reset, or developer-only UI");
      }
      if (primaryAction.test(name)) {
        score += 12;
        rationale.push("Looks like a visible user action");
      }
      const matchedTerms = terms.filter((term) => name.includes(term));
      if (matchedTerms.length) {
        score += matchedTerms.length * 4;
        rationale.push(`Matches request: ${matchedTerms.join(", ")}`);
      }
      return {
        control,
        target: { role: control.kind, name: control.name },
        score,
        category: isSetup ? "setup-action" as const : primaryAction.test(name) ? "primary-action" as const : "neutral-action" as const,
        rationale,
      };
    });

  const unique = new Set<string>();
  return candidates
    .sort((a, b) => b.score - a.score || a.control.name.localeCompare(b.control.name) || a.control.source.localeCompare(b.control.source))
    .filter((candidate) => {
      const key = `${candidate.control.kind}\u0000${candidate.control.name}`;
      if (unique.has(key)) return false;
      unique.add(key);
      return true;
    })
    .slice(0, 3);
}
