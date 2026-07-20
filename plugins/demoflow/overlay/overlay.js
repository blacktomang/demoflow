(() => {
  const targetWaitMs = 5_000;
  const state = { spec: null, index: 0, introAcknowledged: false, target: null, markedTarget: null, skippedStep: null, observer: null, reportedFailures: new Set(), reportedDiagnostics: new Set(), waitingKey: null, waitingSince: 0, waitTimer: null, failedTargetKeys: new Set(), filledStepKeys: new Set() };
  const root = document.createElement("div");
  root.id = "__demoflow_root";
  root.innerHTML = `
    <style>
      #__demoflow_root { --df-dim: rgba(38, 31, 25, .24); --df-accent: #a85b3b; --df-accent-soft: rgba(168, 91, 59, .22); --df-card: rgba(255, 252, 247, .96); --df-ink: #29211d; --df-muted: #70645c; --df-rule: rgba(66, 49, 39, .16); --df-shadow: rgba(62, 39, 27, .22); position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
      #__demoflow_root[data-theme="minimal"] { --df-dim: rgba(18, 24, 31, .14); --df-accent: #263846; --df-accent-soft: rgba(38, 56, 70, .16); --df-card: rgba(255, 255, 255, .94); --df-ink: #1d2933; --df-muted: #5f6d75; --df-rule: rgba(29, 41, 51, .13); --df-shadow: rgba(29, 41, 51, .14); }
      #__demoflow_root[data-theme="debug"] { --df-dim: rgba(15, 23, 42, .38); --df-accent: #818cf8; --df-accent-soft: rgba(129, 140, 248, .2); --df-card: #172554; --df-ink: #eef2ff; --df-muted: #c7d2fe; --df-rule: #818cf8; --df-shadow: rgba(15, 23, 42, .4); }
      #__demoflow_dim { position: absolute; inset: 0; background: var(--df-dim); transition: background .24s ease; }
      #__demoflow_halo { position: fixed; border: 2px solid var(--df-accent); border-radius: 9px; box-shadow: 0 0 0 6px var(--df-accent-soft); transition: all .2s ease; }
      #__demoflow_card { position: fixed; width: min(360px, calc(100vw - 32px)); padding: 18px 18px 14px; color: var(--df-ink); background: var(--df-card); border: 1px solid var(--df-rule); border-radius: 14px; box-shadow: 0 22px 64px var(--df-shadow); backdrop-filter: blur(16px); }
      #__demoflow_kicker { margin: 0 0 8px; color: var(--df-accent); font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
      #__demoflow_card h2 { margin: 0 0 7px; color: var(--df-ink); font-family: Georgia, "Times New Roman", serif; font-size: 21px; font-weight: 600; letter-spacing: -.035em; line-height: 1.05; text-wrap: balance; }
      #__demoflow_card p { margin: 0; color: var(--df-muted); font-size: 14px; line-height: 1.5; text-wrap: pretty; }
      #__demoflow_controls { display: flex; gap: 11px; align-items: center; margin-top: 16px; padding-top: 11px; border-top: 1px solid var(--df-rule); pointer-events: auto; }
      #__demoflow_controls button { border: 0; background: transparent; color: var(--df-muted); padding: 3px 0; cursor: pointer; font: inherit; font-size: 12px; transition: color .18s ease, transform .18s ease; }
      #__demoflow_controls button:hover { color: var(--df-ink); }
      #__demoflow_controls button:active { transform: translateY(1px); }
      #__demoflow_controls button:focus-visible { outline: 2px solid var(--df-accent); outline-offset: 3px; border-radius: 2px; }
      #__demoflow_controls button:last-child { margin-left: auto; color: var(--df-ink); font-weight: 600; }
      #__demoflow_progress { color: var(--df-accent); font-size: 11px; font-variant-numeric: tabular-nums; }
      #__demoflow_empty { position: fixed; top: 16px; right: 16px; width: min(320px, calc(100vw - 32px)); padding: 18px; color: #fffaf7; background: #6f2b22; border: 1px solid rgba(255,255,255,.16); border-radius: 14px; box-shadow: 0 18px 50px rgba(56, 17, 12, .28); pointer-events: auto; }
      #__demoflow_empty strong { display: block; margin-bottom: 7px; font-family: Georgia, "Times New Roman", serif; font-size: 19px; letter-spacing: -.025em; }
      #__demoflow_empty p { margin: 0 0 13px; color: rgba(255,250,247,.83); font-size: 14px; line-height: 1.45; }
      #__demoflow_empty button { border: 0; padding: 0; color: #fffaf7; background: transparent; cursor: pointer; font: inherit; font-size: 12px; font-weight: 650; }
      #__demoflow_empty button + button { margin-left: 13px; color: rgba(255,250,247,.72); }
      #__demoflow_intro { position: fixed; inset: 0; display: grid; place-items: center; padding: 16px; pointer-events: auto; }
      #__demoflow_intro_card { width: min(510px, 100%); padding: 30px; color: var(--df-ink); background: var(--df-card); border: 1px solid var(--df-rule); border-radius: 18px; box-shadow: 0 26px 80px var(--df-shadow); }
      #__demoflow_intro_card span { display: block; margin-bottom: 12px; color: var(--df-accent); font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
      #__demoflow_intro_card h1 { margin: 0 0 12px; font-family: Georgia, "Times New Roman", serif; font-size: 31px; line-height: 1.06; letter-spacing: -.04em; }
      #__demoflow_intro_card p { margin: 0 0 22px; color: var(--df-muted); font-size: 16px; line-height: 1.5; }
      #__demoflow_intro_card button { border: 0; border-radius: 8px; padding: 10px 14px; color: #fff; background: var(--df-accent); cursor: pointer; font: inherit; font-weight: 700; }
    </style>
    <div id="__demoflow_dim"></div><div id="__demoflow_halo"></div>
    <aside id="__demoflow_card" role="status"><div id="__demoflow_kicker">Guided walkthrough</div><h2></h2><p></p><div id="__demoflow_controls"><button data-action="restart">Restart</button><button data-action="skip">Skip</button><span id="__demoflow_progress"></span><button data-action="exit">End tour</button></div></aside>`;
  document.documentElement.append(root);

  const card = root.querySelector("#__demoflow_card");
  const halo = root.querySelector("#__demoflow_halo");
  const title = card.querySelector("h2");
  const body = card.querySelector("p");
  const progress = root.querySelector("#__demoflow_progress");

  function normalizedName(value) {
    // Apps often put a purely decorative chevron inside a menu button (for example
    // "1 badge⌄"). Ignore it so a human-friendly target name still finds the control.
    return (value || "").replace(/[\u00a0\s]+/g, " ").replace(/[→↗›»⌄⌃⌵]+\s*$/, "").trim().toLocaleLowerCase();
  }

  function closestContextDistance(node, context) {
    let distance = 0;
    for (let ancestor = node.parentElement; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
      distance += 1;
      if (normalizedName(ancestor.textContent).includes(context)) return distance;
    }
    return Infinity;
  }

  function resolveTarget(target) {
    let candidates = [];
    if (target.testId) candidates = [...document.querySelectorAll(`[data-testid="${CSS.escape(target.testId)}"]`)];
    else if (target.label) candidates = [
      ...[...document.querySelectorAll("label")].filter((node) => node.textContent.trim() === target.label),
      ...document.querySelectorAll(`[aria-label="${CSS.escape(target.label)}"]`),
    ];
    else if (target.role && target.name) {
      const selector = `[role="${CSS.escape(target.role)}"], ${CSS.escape(target.role)}`;
      const expected = normalizedName(target.name);
      candidates = [...document.querySelectorAll(selector)].filter((node) => normalizedName(node.getAttribute("aria-label") || node.textContent) === expected);
      if (target.withinText) {
        const context = normalizedName(target.withinText);
        // A page-level container can include the title and every repeated button. Keep only
        // the candidates whose *closest* containing region carries the requested context.
        const scoped = candidates.map((node) => ({ node, distance: closestContextDistance(node, context) }))
          .filter(({ distance }) => Number.isFinite(distance));
        const closest = Math.min(...scoped.map(({ distance }) => distance));
        candidates = scoped.filter(({ distance }) => distance === closest).map(({ node }) => node);
      }
      if (target.occurrence) candidates = candidates[target.occurrence - 1] ? [candidates[target.occurrence - 1]] : [];
    }
    else if (target.css) candidates = [...document.querySelectorAll(target.css)];
    const unique = [...new Set(candidates)];
    return { target: unique.length === 1 ? unique[0] : null, ambiguous: unique.length > 1 };
  }

  function clearTargetMarker() {
    state.markedTarget?.removeAttribute("data-demoflow-target");
    state.markedTarget = null;
  }

  function markTarget(target, step) {
    if (state.markedTarget === target && target.getAttribute("data-demoflow-target") === step.id) return;
    clearTargetMarker();
    target.setAttribute("data-demoflow-target", step.id);
    state.markedTarget = target;
  }

  function reportFailure(step, reason) {
    const key = `${reason}:${step.id}:${location.pathname}`;
    if (state.reportedFailures.has(key)) return;
    state.reportedFailures.add(key);
    const type = reason === "ambiguous" ? "ambiguous-target" : "target-unavailable";
    fetch("/__demoflow/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        missingTarget: step.id,
        failure: { type, stepId: step.id, path: location.pathname, target: step.target, occurredAt: new Date().toISOString() },
      }),
    }).catch(() => {});
  }

  function safeDiagnostic(message) {
    return String(message || "")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
      .replace(/\b(?:bearer\s+)?[A-Za-z0-9_-]{24,}\b/gi, "[redacted-token]")
      .replace(/[\r\n\t]+/g, " ").trim().slice(0, 280);
  }

  function reportDiagnostic(kind, message) {
    const safeMessage = safeDiagnostic(message);
    if (!safeMessage) return;
    const key = `${kind}:${location.pathname}:${safeMessage}`;
    if (state.reportedDiagnostics.has(key)) return;
    state.reportedDiagnostics.add(key);
    fetch("/__demoflow/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ diagnostic: { kind, path: location.pathname, message: safeMessage, occurredAt: new Date().toISOString() } }),
    }).catch(() => {});
  }

  function reportVisibleAppAlerts() {
    document.querySelectorAll('[role="alert"], .alert, [data-demoflow-error]').forEach((node) => {
      const message = node.textContent?.trim() || "";
      if (/error|failed|unexpected|exception|cannot|invalid|json/i.test(message)) reportDiagnostic("app-alert", message);
    });
  }

  function clearEmpty() { root.querySelector("#__demoflow_empty")?.remove(); }
  function clearIntro() { root.querySelector("#__demoflow_intro")?.remove(); }
  function showIntro() {
    if (root.querySelector("#__demoflow_intro")) return;
    clearEmpty(); clearTargetMarker(); state.target = null;
    root.querySelector("#__demoflow_halo").style.display = "none";
    card.style.display = "none";
    const intro = document.createElement("div"); intro.id = "__demoflow_intro";
    const introCard = document.createElement("section"); introCard.id = "__demoflow_intro_card";
    const kicker = document.createElement("span"); kicker.textContent = "About this demo";
    const introTitle = document.createElement("h1"); introTitle.textContent = state.spec.intro.title;
    const introBody = document.createElement("p"); introBody.textContent = state.spec.intro.body;
    const begin = document.createElement("button"); begin.type = "button"; begin.textContent = "Begin demo";
    begin.onclick = () => { state.introAcknowledged = true; clearIntro(); render(); };
    introCard.append(kicker, introTitle, introBody, begin); intro.append(introCard); root.append(intro);
  }
  function stopWaiting() {
    if (state.waitTimer) clearTimeout(state.waitTimer);
    state.waitTimer = null; state.waitingKey = null; state.waitingSince = 0;
  }

  function showWaiting(step) {
    clearEmpty();
    root.querySelector("#__demoflow_halo").style.display = "none";
    card.style.display = "block";
    card.style.top = "16px"; card.style.left = "16px";
    title.textContent = "Waiting for the next screen";
    body.textContent = `DemoFlow is waiting for “${step.tooltip.title}” to appear.`;
    progress.textContent = `${state.index + 1} / ${state.spec.steps.length}`;
  }

  function waitForTarget(step, reason) {
    clearTargetMarker();
    state.target = null;
    const key = `${state.index}:${step.id}:${location.pathname}`;
    if (state.failedTargetKeys.has(key)) { showEmpty(step, reason); return; }
    if (state.waitingKey !== key) { stopWaiting(); state.waitingKey = key; state.waitingSince = Date.now(); }
    if (Date.now() - state.waitingSince >= targetWaitMs) { state.failedTargetKeys.add(key); stopWaiting(); showEmpty(step, reason); return; }
    showWaiting(step);
    state.waitTimer = setTimeout(render, 100);
  }

  function showEmpty(step, reason = "missing") {
    stopWaiting();
    clearTargetMarker();
    state.target = null;
    root.querySelector("#__demoflow_card").style.display = "none";
    root.querySelector("#__demoflow_halo").style.display = "none";
    const waitingForSkippedStep = state.skippedStep && state.index > 0;
    const panel = document.createElement("div"); panel.id = "__demoflow_empty";
    panel.innerHTML = waitingForSkippedStep
      ? `<strong>Complete the previous action first</strong><p>“${step.tooltip.title}” appears after “${state.skippedStep.tooltip.title}” is completed in the real app. Skipping only hides guidance; it does not perform the action.</p><button>Show previous instruction</button> <button>Exit</button>`
      : reason === "ambiguous"
        ? `<strong>Target needs a clearer label</strong><p>DemoFlow found more than one possible control for “${step.tooltip.title}”. This repair report is ready for Codex.</p><button>Restart demo</button> <button>Exit</button>`
        : `<strong>Target unavailable</strong><p>DemoFlow could not find “${step.id}” on this screen. This repair report is ready for Codex.</p><button>Restart demo</button> <button>Exit</button>`;
    panel.querySelectorAll("button")[0].onclick = () => {
      if (waitingForSkippedStep) { state.index -= 1; state.skippedStep = null; render(); }
      else restart();
    };
    panel.querySelectorAll("button")[1].onclick = exit;
    root.append(panel); reportFailure(step, reason);
  }

  function position(target) {
    const rect = target.getBoundingClientRect();
    halo.style.display = "block";
    halo.style.left = `${rect.left - 5}px`; halo.style.top = `${rect.top - 5}px`;
    halo.style.width = `${rect.width + 4}px`; halo.style.height = `${rect.height + 4}px`;
    const top = Math.min(window.innerHeight - card.offsetHeight - 16, Math.max(16, rect.bottom + 18));
    const left = Math.min(window.innerWidth - card.offsetWidth - 16, Math.max(16, rect.left));
    card.style.top = `${top}px`; card.style.left = `${left}px`;
  }

  function reveal(target) {
    const rect = target.getBoundingClientRect();
    if (rect.top < 16 || rect.bottom > window.innerHeight - 16 || rect.left < 16 || rect.right > window.innerWidth - 16) {
      target.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
    }
  }

  function conditionSatisfied(step, event) {
    if (step.advance.type === "manual") return false;
    if (step.advance.type === "click-target") return event?.target && state.target?.contains(event.target);
    if (step.advance.type === "input-target") {
      if (!event?.target || !state.target?.contains(event.target) || !["input", "change"].includes(event.type)) return false;
      const source = event.target;
      const value = typeof source.value === "string" ? source.value : source.textContent || "";
      return value.trim().length >= (step.advance.minLength || 1);
    }
    if (step.advance.type === "input-and-click") {
      const key = `${state.index}:${step.id}`;
      if (["input", "change"].includes(event?.type) && event?.target && state.target?.contains(event.target)) {
        const value = typeof event.target.value === "string" ? event.target.value : event.target.textContent || "";
        if (value.trim().length >= (step.advance.minLength || 1)) state.filledStepKeys.add(key);
      }
      if (event?.type !== "click" || !state.filledStepKeys.has(key)) return false;
      return resolveTarget(step.advance.submitTarget).target?.contains(event.target);
    }
    if (step.advance.type === "path-is") return location.pathname === step.advance.path;
    if (step.advance.type === "element-visible") return Boolean(resolveTarget(step.advance.target).target);
    return false;
  }

  function advanceIfReady(event) {
    const step = state.spec.steps[state.index];
    if (step && conditionSatisfied(step, event)) { state.index += 1; state.target = null; clearTargetMarker(); stopWaiting(); setTimeout(render, 0); }
  }

  function render() {
    clearEmpty();
    if (!state.spec || state.index >= state.spec.steps.length) return exit();
    if (state.spec.intro && !state.introAcknowledged) return showIntro();
    const step = state.spec.steps[state.index];
    if (step.path && location.pathname !== step.path) { waitForTarget({ ...step, id: `${step.id} (waiting for ${step.path})` }, "missing"); return; }
    const resolved = resolveTarget(step.target);
    if (!resolved.target) { waitForTarget(step, resolved.ambiguous ? "ambiguous" : "missing"); return; }
    const target = resolved.target;
    stopWaiting(); state.target = target; state.skippedStep = null; markTarget(target, step);
    card.style.display = "block"; title.textContent = step.tooltip.title; body.textContent = step.tooltip.body;
    progress.textContent = `${state.index + 1} / ${state.spec.steps.length}`;
    reveal(target); requestAnimationFrame(() => position(target));
  }

  function exit() { stopWaiting(); state.observer?.disconnect(); clearTargetMarker(); root.remove(); }
  function restart() {
    state.index = 0;
    state.introAcknowledged = false;
    state.target = null;
    state.skippedStep = null;
    state.failedTargetKeys.clear();
    state.filledStepKeys.clear();
    clearTargetMarker();
    stopWaiting();

    // Browsers can treat assigning the current URL as a no-op. Re-resolving here
    // makes Restart redraw the halo immediately without relying on a hard refresh.
    if (location.pathname === state.spec.startPath) {
      requestAnimationFrame(render);
      return;
    }
    location.assign(state.spec.startPath);
  }
  root.addEventListener("click", (event) => {
    const action = event.target.closest("button")?.dataset.action;
    if (action === "exit") exit();
    if (action === "skip") { state.skippedStep = state.spec.steps[state.index]; state.index += 1; state.target = null; clearTargetMarker(); stopWaiting(); render(); }
    if (action === "restart") restart();
  });
  document.addEventListener("click", advanceIfReady, true);
  document.addEventListener("input", advanceIfReady, true);
  document.addEventListener("change", advanceIfReady, true);
  document.addEventListener("submit", advanceIfReady, true);
  window.addEventListener("popstate", () => setTimeout(render, 0));
  window.addEventListener("resize", () => state.target && position(state.target));
  window.addEventListener("error", (event) => reportDiagnostic("window-error", event.message));
  window.addEventListener("unhandledrejection", (event) => reportDiagnostic("unhandled-rejection", event.reason?.message || String(event.reason)));

  fetch(window.__DEMOFLOW_SPEC_URL__ || "/__demoflow/spec.json")
    .then((response) => response.json())
    .then((spec) => { state.spec = spec; root.dataset.theme = spec.presentation?.theme || "presenter"; state.observer = new MutationObserver(() => { reportVisibleAppAlerts(); if (state.target && document.contains(state.target)) position(state.target); else render(); }); state.observer.observe(document.body, { childList: true, subtree: true }); reportVisibleAppAlerts(); render(); })
    .catch(exit);
})();
