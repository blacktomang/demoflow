import { z } from "zod";
import type { AppMap, UiControl } from "./inspector.js";
import { TargetSchema } from "./spec.js";

const StoryboardStepSchema = z.object({
    title: z.string().trim().min(2).max(100),
    userAction: z.string().trim().min(2).max(240),
    whyItMatters: z.string().trim().min(2).max(360),
    target: TargetSchema,
});

export const StoryboardSchema = z.object({
    title: z.string().trim().min(2).max(140),
    goal: z.string().trim().min(2).max(360),
    steps: z.array(StoryboardStepSchema).min(1),
});

export type Storyboard = z.infer<typeof StoryboardSchema>;
type StoryboardTarget = z.infer<typeof TargetSchema>;

export type StoryboardReview = {
    ready: boolean;
    markdown: string;
    issues: string[];
};

function escapeCell(value: string): string {
    return value.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function targetText(target: StoryboardTarget): string {
    if ("testId" in target) return `test ID \`${target.testId}\``;
    if ("label" in target) return `label “${target.label}”`;
    if ("css" in target) return `CSS selector \`${target.css}\``;
    const scope = target.withinText ? ` within “${target.withinText}”` : target.occurrence ? ` (match ${target.occurrence})` : "";
    return `${target.role} “${target.name}”${scope}`;
}

function matchingControls(appMap: AppMap, target: StoryboardTarget): UiControl[] {
    if ("testId" in target) return appMap.controls.filter((control) => control.kind === "test-id" && control.name === target.testId);
    if ("label" in target) return appMap.controls.filter((control) => control.kind === "label" && control.name === target.label);
    if ("css" in target) return [];
    return appMap.controls.filter((control) => control.kind === target.role && control.name === target.name);
}

function sourceEvidence(controls: UiControl[]): string {
    return controls.slice(0, 2).map((control) => `\`${control.source}\` ${control.kind} “${control.name}”`).join("; ");
}

function positiveRequirements(controls: UiControl[]): string[] {
    return [...new Set(controls.flatMap((control) => control.requires ?? []).filter((fact) => fact.expected).map((fact) => fact.expression))];
}

/**
 * Reviews the human-facing plan against the bounded source map. It purposely
 * does not invent transitions or claim runtime certainty: the overlay remains
 * the real-DOM verifier after the developer approves the storyboard.
 */
export function reviewStoryboard(appMap: AppMap, storyboard: Storyboard): StoryboardReview {
    const issues: string[] = [];
    const rows = storyboard.steps.map((step, index) => {
        const matches = matchingControls(appMap, step.target);
        const requirements = positiveRequirements(matches);
        const scoped = "role" in step.target && Boolean(step.target.withinText || step.target.occurrence);
        let confidence: "High" | "Medium" | "Low" = "High";
        let evidence: string;

        if ("css" in step.target) {
            confidence = "Low";
            evidence = "CSS selectors are not source-verifiable";
            issues.push(`Step ${index + 1} uses ${targetText(step.target)}. Replace it with a test ID, accessible role/name, or label.`);
        } else if (!matches.length) {
            confidence = "Low";
            evidence = `No matching source control for ${targetText(step.target)}`;
            issues.push(`Step ${index + 1} cannot be supported by the current app map: ${targetText(step.target)}.`);
        } else if (matches.length > 1 && !scoped) {
            confidence = "Low";
            evidence = `${sourceEvidence(matches)}; multiple possible controls`;
            issues.push(`Step ${index + 1} has multiple source matches for ${targetText(step.target)}. Add a test ID, withinText, or occurrence.`);
        } else {
            evidence = sourceEvidence(matches);
            if (matches.length > 1 || requirements.length) confidence = "Medium";
            if (requirements.length) evidence += `; requires ${requirements.join(" and ")}`;
        }

        return `| ${index + 1}. ${escapeCell(step.title)} | ${escapeCell(step.userAction)} | ${escapeCell(step.whyItMatters)} | ${escapeCell(evidence)} | ${confidence} |`;
    });

    const status = issues.length ? "Needs revision before a spec is written" : "Source-backed and ready for developer confirmation";
    const notes = [
        "Every row is one real application action and must become one DemoFlow spec step.",
        "The only allowed compound row is filling a field and selecting its real submit button; it becomes `input-and-click`.",
        "Medium confidence means source proves the control but a conditional prerequisite still needs the preceding journey or runtime verification.",
    ];
    const markdown = [
        `## Storyboard: ${storyboard.title}`,
        "",
        `**Goal:** ${storyboard.goal}`,
        `**Review:** ${status}`,
        "",
        "| Step | User action | Why it matters | Evidence | Confidence |",
        "| --- | --- | --- | --- | --- |",
        ...rows,
        "",
        "### Flow checks",
        ...(issues.length ? issues.map((issue) => `- ${issue}`) : ["- All selected actions have source evidence. Confirm this is the intended story before DemoFlow writes the spec."]),
        "",
        "### Mapping rules",
        ...notes.map((note) => `- ${note}`),
    ].join("\n");

    return { ready: issues.length === 0, markdown, issues };
}
