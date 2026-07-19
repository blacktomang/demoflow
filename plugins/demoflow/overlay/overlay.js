(() => {
  const state = { spec: null, index: 0, target: null, markedTarget: null, skippedStep: null, observer: null };
  const root = document.createElement("div");
  root.id = "__demoflow_root";
  root.innerHTML = `
    <style>
      #__demoflow_root { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; font-family: ui-sans-serif, system-ui, sans-serif; }
      #__demoflow_dim { position: absolute; inset: 0; background: rgba(15, 23, 42, .38); }
      #__demoflow_halo { position: fixed; border: 3px solid #818cf8; border-radius: 10px; box-shadow: 0 0 0 5px rgba(129, 140, 248, .2); transition: all .18s ease; }
      #__demoflow_card { position: fixed; width: min(340px, calc(100vw - 32px)); padding: 16px; color: #eef2ff; background: #172554; border: 1px solid #818cf8; border-radius: 12px; box-shadow: 0 18px 60px rgba(15, 23, 42, .4); }
      #__demoflow_card h2 { margin: 0 0 6px; font-size: 16px; }
      #__demoflow_card p { margin: 0; color: #c7d2fe; font-size: 14px; line-height: 1.45; }
      #__demoflow_controls { display: flex; gap: 8px; align-items: center; margin-top: 14px; pointer-events: auto; }
      #__demoflow_controls button { border: 0; background: transparent; color: #c7d2fe; padding: 4px 0; cursor: pointer; font: inherit; font-size: 12px; }
      #__demoflow_controls button:last-child { margin-left: auto; color: white; }
      #__demoflow_progress { color: #a5b4fc; font-size: 12px; }
      #__demoflow_empty { position: fixed; top: 16px; right: 16px; width: 280px; padding: 16px; color: white; background: #7f1d1d; border-radius: 12px; pointer-events: auto; }
    </style>
    <div id="__demoflow_dim"></div><div id="__demoflow_halo"></div>
    <aside id="__demoflow_card" role="status"><h2></h2><p></p><div id="__demoflow_controls"><button data-action="restart">Restart</button><button data-action="skip">Skip instruction</button><span id="__demoflow_progress"></span><button data-action="exit">Exit demo</button></div></aside>`;
  document.documentElement.append(root);

  const card = root.querySelector("#__demoflow_card");
  const halo = root.querySelector("#__demoflow_halo");
  const title = card.querySelector("h2");
  const body = card.querySelector("p");
  const progress = root.querySelector("#__demoflow_progress");

  function normalizedName(value) {
    return (value || "").replace(/[\u00a0\s]+/g, " ").replace(/[→↗›»]+\s*$/, "").trim().toLocaleLowerCase();
  }

  function findTarget(target) {
    if (target.testId) return document.querySelector(`[data-testid="${CSS.escape(target.testId)}"]`);
    if (target.label) return [...document.querySelectorAll("label")].find((node) => node.textContent.trim() === target.label) || document.querySelector(`[aria-label="${CSS.escape(target.label)}"]`);
    if (target.role && target.name) {
      const selector = `[role="${CSS.escape(target.role)}"], ${CSS.escape(target.role)}`;
      const expected = normalizedName(target.name);
      return [...document.querySelectorAll(selector)].find((node) => normalizedName(node.getAttribute("aria-label") || node.textContent) === expected);
    }
    if (target.css) return document.querySelector(target.css);
    return null;
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

  function reportMissing(step) {
    fetch("/__demoflow/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ missingTarget: step.id }) }).catch(() => {});
  }

  function clearEmpty() { root.querySelector("#__demoflow_empty")?.remove(); }
  function showEmpty(step) {
    clearTargetMarker();
    root.querySelector("#__demoflow_card").style.display = "none";
    root.querySelector("#__demoflow_halo").style.display = "none";
    const waitingForSkippedStep = state.skippedStep && state.index > 0;
    const panel = document.createElement("div"); panel.id = "__demoflow_empty";
    panel.innerHTML = waitingForSkippedStep
      ? `<strong>Complete the previous action first</strong><p>“${step.tooltip.title}” appears after “${state.skippedStep.tooltip.title}” is completed in the real app. Skipping only hides guidance; it does not perform the action.</p><button>Show previous instruction</button> <button>Exit</button>`
      : `<strong>Target unavailable</strong><p>DemoFlow could not find “${step.id}” on this screen. The flow may need repair.</p><button>Restart demo</button> <button>Exit</button>`;
    panel.querySelectorAll("button")[0].onclick = () => {
      if (waitingForSkippedStep) { state.index -= 1; state.skippedStep = null; render(); }
      else location.assign(state.spec.startPath);
    };
    panel.querySelectorAll("button")[1].onclick = exit;
    root.append(panel); reportMissing(step);
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

  function conditionSatisfied(step, event) {
    if (step.advance.type === "manual") return false;
    if (step.advance.type === "click-target") return event?.target && state.target?.contains(event.target);
    if (step.advance.type === "path-is") return location.pathname === step.advance.path;
    if (step.advance.type === "element-visible") return Boolean(findTarget(step.advance.target));
    return false;
  }

  function advanceIfReady(event) {
    const step = state.spec.steps[state.index];
    if (step && conditionSatisfied(step, event)) { state.index += 1; setTimeout(render, 0); }
  }

  function render() {
    clearEmpty();
    if (!state.spec || state.index >= state.spec.steps.length) return exit();
    const step = state.spec.steps[state.index];
    if (step.path && location.pathname !== step.path) { showEmpty({ ...step, id: `${step.id} (waiting for ${step.path})` }); return; }
    const target = findTarget(step.target);
    if (!target) { showEmpty(step); return; }
    state.target = target; state.skippedStep = null; markTarget(target, step);
    card.style.display = "block"; title.textContent = step.tooltip.title; body.textContent = step.tooltip.body;
    progress.textContent = `${state.index + 1} / ${state.spec.steps.length}`;
    position(target);
  }

  function exit() { state.observer?.disconnect(); clearTargetMarker(); root.remove(); }
  root.addEventListener("click", (event) => {
    const action = event.target.closest("button")?.dataset.action;
    if (action === "exit") exit();
    if (action === "skip") { state.skippedStep = state.spec.steps[state.index]; state.index += 1; render(); }
    if (action === "restart") location.assign(state.spec.startPath);
  });
  document.addEventListener("click", advanceIfReady, true);
  document.addEventListener("submit", advanceIfReady, true);
  window.addEventListener("popstate", () => setTimeout(render, 0));
  window.addEventListener("resize", () => state.target && position(state.target));

  fetch(window.__DEMOFLOW_SPEC_URL__ || "/__demoflow/spec.json")
    .then((response) => response.json())
    .then((spec) => { state.spec = spec; state.observer = new MutationObserver(() => { if (state.target) position(state.target); else render(); }); state.observer.observe(document.body, { childList: true, subtree: true }); render(); })
    .catch(exit);
})();
