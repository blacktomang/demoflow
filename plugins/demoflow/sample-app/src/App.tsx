import React, { FormEvent, useState } from "react";

type Step = "welcome" | "workspace" | "project" | "invite" | "complete";

export function App() {
  const [step, setStep] = useState<Step>("welcome");
  const [workspace, setWorkspace] = useState("");
  const [project, setProject] = useState("");
  const [email, setEmail] = useState("");

  const submit = (event: FormEvent, next: Step) => {
    event.preventDefault();
    setStep(next);
  };

  return <main>
    <p className="eyebrow">DemoFlow sample app</p>
    {step === "welcome" && <section>
      <h1>Bring your team’s work together</h1>
      <p>Start with a workspace, then make your first project.</p>
      <button data-testid="create-workspace" onClick={() => setStep("workspace")}>Create workspace</button>
    </section>}
    {step === "workspace" && <section>
      <h1>Name your workspace</h1>
      <form onSubmit={(event) => submit(event, "project")}>
        <label>Workspace name<input aria-label="Workspace name" value={workspace} onChange={(event) => setWorkspace(event.target.value)} required /></label>
        <button data-testid="save-workspace" type="submit">Continue to projects</button>
      </form>
    </section>}
    {step === "project" && <section>
      <h1>Create your first project</h1>
      <form onSubmit={(event) => submit(event, "invite")}>
        <label>Project name<input aria-label="Project name" value={project} onChange={(event) => setProject(event.target.value)} required /></label>
        <button data-testid="create-project" type="submit">Create project</button>
      </form>
    </section>}
    {step === "invite" && <section>
      <h1>Invite a teammate</h1>
      <form onSubmit={(event) => submit(event, "complete")}>
        <label>Teammate email<input aria-label="Teammate email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <button data-testid="invite-teammate" type="submit">Send invite</button>
      </form>
    </section>}
    {step === "complete" && <section>
      <h1>Workspace ready</h1>
      <p><strong>{workspace}</strong> now contains <strong>{project}</strong>. Your teammate invitation is ready for {email}.</p>
    </section>}
  </main>;
}
