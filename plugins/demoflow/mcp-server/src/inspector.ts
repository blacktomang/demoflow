import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import * as ts from "typescript";

const MAX_FILES = 300;
const MAX_VALUES = 100;
const SOURCE_EXTENSIONS = new Set([".tsx", ".jsx", ".ts", ".js"]);
const UI_ROOTS = ["src", "app", "pages", "components"];

export type UiControl = {
  kind: "button" | "link" | "label" | "test-id";
  name: string;
  source: string;
  requires?: StatePredicate[];
  produces?: StateEffect[];
  confidence?: "exact" | "inferred" | "unknown";
};

export type StatePredicate = {
  expression: string;
  expected: boolean;
  source: string;
};

export type StateEffect = {
  expression: string;
  effect: "set" | "navigate" | "request";
  source: string;
};

export type AppMap = {
  workspacePath: string;
  appDirectory: string;
  frameworkHints: string[];
  scripts: string[];
  routes: string[];
  testIds: string[];
  labels: string[];
  controls: UiControl[];
  stateFacts: StatePredicate[];
  transitions: StateEffect[];
  fingerprint: string;
};

type CollectedControl = UiControl & { component?: string };
type ComponentUsage = { component: string; requires: StatePredicate[] };

async function filesUnder(root: string, acc: string[], seen: Set<string>): Promise<void> {
  if (acc.length >= MAX_FILES) return;
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (["node_modules", ".git", "dist", "build", ".next"].includes(entry.name)) continue;
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) await filesUnder(absolute, acc, seen);
    else if (SOURCE_EXTENSIONS.has(path.extname(entry.name)) && !seen.has(absolute)) {
      seen.add(absolute);
      acc.push(absolute);
    }
    if (acc.length >= MAX_FILES) break;
  }
}

async function sourceFiles(appPath: string): Promise<string[]> {
  const files: string[] = [];
  const seen = new Set<string>();
  for (const root of UI_ROOTS) await filesUnder(path.join(appPath, root), files, seen).catch(() => {});
  return files;
}

function unique(values: Iterable<string>, max = MAX_VALUES): string[] {
  return [...new Set(values)].slice(0, max).sort();
}

function uniqueControls(controls: UiControl[]): UiControl[] {
  const seen = new Set<string>();
  return controls.filter((control) => {
    const key = `${control.kind}\u0000${control.name}\u0000${control.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_VALUES).sort((a, b) => a.source.localeCompare(b.source) || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}

function uniquePredicates(facts: StatePredicate[]): StatePredicate[] {
  const seen = new Set<string>();
  return facts.filter((fact) => {
    const key = `${fact.expression}\u0000${fact.expected}\u0000${fact.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_VALUES).sort((a, b) => a.expression.localeCompare(b.expression) || a.source.localeCompare(b.source));
}

function uniqueEffects(effects: StateEffect[]): StateEffect[] {
  const seen = new Set<string>();
  return effects.filter((effect) => {
    const key = `${effect.expression}\u0000${effect.effect}\u0000${effect.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_VALUES).sort((a, b) => a.expression.localeCompare(b.expression) || a.effect.localeCompare(b.effect) || a.source.localeCompare(b.source));
}

function controlText(content: string): string[] {
  const names: string[] = [];
  const withoutTags = content.replace(/<[^>]+>/g, " ");
  for (const match of withoutTags.matchAll(/["'`]([^"'`]{2,80})["'`]/g)) names.push(match[1].trim());
  const directText = withoutTags.replace(/\{[^{}]*\}/g, " ").replace(/\s+/g, " ").trim();
  if (directText.length >= 2 && directText.length <= 80 && !/[<>{}]/.test(directText)) names.push(directText);
  return unique(names);
}

function nextRoute(appPath: string, sourcePath: string): string | null {
  const relative = path.relative(path.join(appPath, "app"), sourcePath).split(path.sep);
  const file = relative.pop();
  if (!file || !/^page\.(tsx|jsx|ts|js)$/.test(file)) return null;
  const segments = relative
    .filter((segment) => !/^\(.+\)$/.test(segment) && !segment.startsWith("@"))
    .map((segment) => segment.replace(/^\[\.\.\.(.+)\]$/, ":$1*").replace(/^\[(.+)\]$/, ":$1"));
  return `/${segments.join("/")}`.replace(/\/$/, "") || "/";
}

function expressionText(node: ts.Expression): string {
  return node.getText().replace(/\s+/g, " ").trim().slice(0, 160);
}

function conditionFacts(node: ts.Expression, source: string, expected = true): StatePredicate[] {
  if (ts.isParenthesizedExpression(node)) return conditionFacts(node.expression, source, expected);
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) return conditionFacts(node.operand, source, !expected);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && expected) {
    return [...conditionFacts(node.left, source, true), ...conditionFacts(node.right, source, true)];
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.BarBarToken && !expected) {
    // !(a || b) is the one useful bounded De Morgan case: both alternatives
    // must be false for JSX's ternary false branch to render.
    return [...conditionFacts(node.left, source, false), ...conditionFacts(node.right, source, false)];
  }
  const text = expressionText(node);
  if (!text) return [];
  return [{ expression: text, expected, source }];
}

function jsxAttribute(element: ts.JsxOpeningLikeElement, name: string): ts.JsxAttribute | undefined {
  return element.attributes.properties.find((property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && ts.isIdentifier(property.name) && property.name.text === name);
}

function staticAttribute(attribute: ts.JsxAttribute | undefined): string | undefined {
  if (!attribute?.initializer) return undefined;
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
  if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression && ts.isStringLiteral(attribute.initializer.expression)) return attribute.initializer.expression.text;
  return undefined;
}

function jsxNames(node: ts.JsxElement | ts.JsxSelfClosingElement): string[] {
  const names: string[] = [];
  const visit = (current: ts.Node) => {
    if (ts.isJsxText(current)) {
      const value = current.getText().replace(/\s+/g, " ").trim();
      if (value.length >= 2 && value.length <= 80) names.push(value);
    }
    if (ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current)) {
      if (current.text.length >= 2 && current.text.length <= 80) names.push(current.text.trim());
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return unique(names);
}

function componentName(node: ts.SourceFile): string | undefined {
  let found: string | undefined;
  const visit = (current: ts.Node) => {
    if (!found && ts.isFunctionDeclaration(current) && current.name && /^[A-Z]/.test(current.name.text)) found = current.name.text;
    if (!found && ts.isVariableDeclaration(current) && ts.isIdentifier(current.name) && /^[A-Z]/.test(current.name.text)
      && current.initializer && (ts.isArrowFunction(current.initializer) || ts.isFunctionExpression(current.initializer))) found = current.name.text;
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

function handlerEffects(sourceFile: ts.SourceFile, source: string): Map<string, StateEffect[]> {
  const setters = new Map<string, string>();
  const handlers = new Map<string, StateEffect[]>();
  const relative = source;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) && node.name.elements.length >= 2) {
      const [state, setter] = node.name.elements;
      if (ts.isBindingElement(state) && ts.isBindingElement(setter) && ts.isIdentifier(state.name) && ts.isIdentifier(setter.name)) setters.set(setter.name.text, state.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  const effectsFor = (body: ts.ConciseBody): StateEffect[] => {
    const effects: StateEffect[] = [];
    const inspect = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        if (ts.isIdentifier(node.expression) && setters.has(node.expression.text)) effects.push({ expression: setters.get(node.expression.text)!, effect: "set", source: relative });
        if (ts.isPropertyAccessExpression(node.expression) && ["push", "replace"].includes(node.expression.name.text)) effects.push({ expression: "route", effect: "navigate", source: relative });
        if (ts.isIdentifier(node.expression) && ["fetch", "mutate", "getJson"].includes(node.expression.text)) effects.push({ expression: "remote state", effect: "request", source: relative });
      }
      ts.forEachChild(node, inspect);
    };
    inspect(body);
    return uniqueEffects(effects);
  };
  const collect = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) handlers.set(node.name.text, effectsFor(node.body));
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) handlers.set(node.name.text, effectsFor(node.initializer.body));
    ts.forEachChild(node, collect);
  };
  collect(sourceFile);
  return handlers;
}

function inspectSource(source: string, sourcePath: string, workspacePath: string, appPath: string, routes: string[], testIds: string[], labels: string[], controls: CollectedControl[], usages: ComponentUsage[], stateFacts: StatePredicate[], transitions: StateEffect[]) {
  const relativeSource = path.relative(workspacePath, sourcePath);
  const route = nextRoute(appPath, sourcePath);
  if (route) routes.push(route);
  for (const match of source.matchAll(/(?:path|to|href)=["'`]([^"'`]+)["'`]/g)) {
    if (match[1].startsWith("/")) routes.push(match[1]);
  }
  for (const match of source.matchAll(/data-testid=["'`]([^"'`]+)["'`]/g)) {
    const name = match[1].trim();
    testIds.push(name); controls.push({ kind: "test-id", name, source: relativeSource });
  }
  const sourceFile = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true, sourcePath.endsWith(".tsx") || sourcePath.endsWith(".jsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const owner = componentName(sourceFile);
  const handlers = handlerEffects(sourceFile, relativeSource);
  const walk = (node: ts.Node, inherited: StatePredicate[]) => {
    if (ts.isJsxExpression(node) && node.expression) return walk(node.expression, inherited);
    if (ts.isParenthesizedExpression(node)) return walk(node.expression, inherited);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      walk(node.right, [...inherited, ...conditionFacts(node.left, relativeSource)]);
      return;
    }
    if (ts.isConditionalExpression(node)) {
      walk(node.whenTrue, [...inherited, ...conditionFacts(node.condition, relativeSource)]);
      const falseFacts = conditionFacts(node.condition, relativeSource, false);
      walk(node.whenFalse, [...inherited, ...falseFacts]);
      return;
    }
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const tag = opening.tagName.getText();
      if (/^[A-Z]/.test(tag)) usages.push({ component: tag, requires: inherited });
      if (["button", "a", "label"].includes(tag)) {
        const kind = tag === "a" ? "link" : tag as "button" | "label";
        const names = [staticAttribute(jsxAttribute(opening, "aria-label")), ...jsxNames(node)].filter((name): name is string => Boolean(name));
        const onClick = jsxAttribute(opening, "onClick");
        const handler = onClick?.initializer && ts.isJsxExpression(onClick.initializer) && onClick.initializer.expression && ts.isIdentifier(onClick.initializer.expression) ? onClick.initializer.expression.text : undefined;
        const produces = handler ? handlers.get(handler) : undefined;
        for (const name of unique(names)) {
          labels.push(name);
          controls.push({ kind, name, source: relativeSource, requires: inherited.length ? uniquePredicates(inherited) : undefined, produces: produces?.length ? produces : undefined, confidence: inherited.length ? "exact" : produces?.length ? "inferred" : "unknown", component: owner });
        }
      }
    }
    ts.forEachChild(node, (child) => walk(child, inherited));
  };
  walk(sourceFile, []);
  stateFacts.push(...controls.filter((control) => control.source === relativeSource).flatMap((control) => control.requires ?? []));
  transitions.push(...controls.filter((control) => control.source === relativeSource).flatMap((control) => control.produces ?? []));
}

export function fingerprintAppMap(appMap: Omit<AppMap, "workspacePath" | "fingerprint">): string {
  return createHash("sha256").update(JSON.stringify({
    appDirectory: appMap.appDirectory,
    frameworkHints: appMap.frameworkHints,
    scripts: appMap.scripts,
    routes: appMap.routes,
    testIds: appMap.testIds,
    labels: appMap.labels,
    controls: appMap.controls,
  })).digest("hex");
}

export async function inspectProject(workspacePath: string, input: { appDirectory?: string } = {}): Promise<AppMap> {
  const root = path.resolve(workspacePath);
  const appPath = path.resolve(root, input.appDirectory ?? ".");
  if (appPath !== root && !appPath.startsWith(root + path.sep)) throw new Error("appDirectory must stay inside the workspace");
  const appDirectory = path.relative(root, appPath) || ".";
  const packagePath = path.join(appPath, "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  const frameworkHints = ["react", "vite", "next", "@remix-run/react"].filter((name) => name in dependencies);
  const routes: string[] = [];
  const testIds: string[] = [];
  const labels: string[] = [];
  const controls: CollectedControl[] = [];
  const usages: ComponentUsage[] = [];
  const stateFacts: StatePredicate[] = [];
  const transitions: StateEffect[] = [];

  for (const sourcePath of await sourceFiles(appPath)) {
    inspectSource(await readFile(sourcePath, "utf8"), sourcePath, root, appPath, routes, testIds, labels, controls, usages, stateFacts, transitions);
  }

  // A control frequently lives in a child component while the real state guard
  // is on the parent's <Child /> render. Carry that parent guard into the child
  // control without attempting unbounded whole-program data-flow analysis.
  for (const control of controls) {
    if (!control.component) continue;
    const inherited = usages.filter((usage) => usage.component === control.component).flatMap((usage) => usage.requires);
    if (inherited.length) {
      control.requires = uniquePredicates([...(control.requires ?? []), ...inherited]);
      control.confidence = "exact";
    }
    delete control.component;
  }
  stateFacts.push(...controls.flatMap((control) => control.requires ?? []));
  transitions.push(...controls.flatMap((control) => control.produces ?? []));

  const appMapBase = {
    workspacePath: root,
    appDirectory,
    frameworkHints,
    scripts: Object.keys(packageJson.scripts ?? {}),
    routes: unique(routes),
    testIds: unique(testIds),
    labels: unique(labels),
    controls: uniqueControls(controls),
    stateFacts: uniquePredicates(stateFacts),
    transitions: uniqueEffects(transitions),
  };
  const appMap: AppMap = { ...appMapBase, fingerprint: fingerprintAppMap(appMapBase) };
  const outputDir = path.join(root, ".demoflow");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "app-map.json"), JSON.stringify(appMap, null, 2));
  return appMap;
}
