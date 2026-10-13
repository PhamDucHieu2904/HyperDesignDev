import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCheck, CircleAlert, CircleHelp, FilePlus2, LoaderCircle, Send, ShieldCheck } from "lucide-react";
import { DesktopWindow } from "../desktop/DesktopWindow";
import { projectRequestEndpoint } from "./config";
import { Verification } from './Verification';
import type { RequestPublicConfig } from '../../shared/contracts/analytics';
import { budgetOptions, budgetSummary, categories, emptyDraft, isRequestConfigured, ProjectRequestError,
  sendProjectRequest, validateDraft, type DraftErrors, type ProjectDraft, type RequestStatus } from "./request";

const steps = ["Idea", "Budget", "Contact"];
const headings = ["What would you like to create?", "What investment do you have in mind?", "Where can I get back to you?"];
const descriptions = [
  "You don’t need the right service name or a perfect brief. Tell me about your idea, or a problem you’d like to solve.",
  "No number yet? That’s completely fine. We can explore what’s possible once we’ve talked through the scope.",
  "Leave your email and take a quick look at your idea. This is the beginning of a conversation.",
];

function ProjectSummary({ draft, onEdit }: { draft: ProjectDraft; onEdit?: (step: number) => void }) {
  return <dl className="project-summary">
    <div><dt>Your idea {onEdit && <button type="button" onClick={() => onEdit(0)}>Edit idea</button>}</dt>
      <dd className="project-summary-idea">{draft.projectDescription.trim() || "A little possibility, waiting to take shape."}</dd></div>
    {draft.projectCategory && <div><dt>Context</dt><dd>{categories.find(category => category.value === draft.projectCategory)?.label}</dd></div>}
    <div><dt>Budget {onEdit && <button type="button" onClick={() => onEdit(1)}>Edit budget</button>}</dt><dd>{budgetSummary(draft)}</dd></div>
  </dl>;
}

// Keep this component mounted across shell views. Only its visible window is removed,
// so the draft and pending request survive minimizing without browser persistence.
export function ProjectLauncher({ active, covered, onClose, onPortfolio }: {
  active: boolean; covered: boolean; onClose: () => void; onPortfolio: () => void;
}) {
  const [draft, setDraft] = useState<ProjectDraft>(emptyDraft);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [status, setStatus] = useState<RequestStatus>("idle");
  const [message, setMessage] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const submittingRef = useRef(false);
  const mountedRef = useRef(true);
  const [connection, setConnection] = useState<{ endpoint: string; config: RequestPublicConfig } | null>(null);
  const [token, setToken] = useState(''); const [verificationReset, setVerificationReset] = useState(0);
  const requestIdRef = useRef<string | null>(null);
  const endpoint = projectRequestEndpoint || connection?.endpoint || '';
  const configured = isRequestConfigured(endpoint) && (Boolean(projectRequestEndpoint) || connection?.config.enabled === true);
  useEffect(() => {
    if (!active || !/^https?:$/.test(window.location.protocol)) return;
    const controller = new AbortController();
    const url = new URL(projectRequestEndpoint || './api/v1/project-requests', document.baseURI);
    void fetch(`${url.href}/config`, { signal: controller.signal }).then(async response => {
      if (!response.ok) return; const config = await response.json() as RequestPublicConfig;
      if (!controller.signal.aborted) setConnection({ endpoint: url.href, config });
    }).catch(() => {});
    return () => controller.abort();
  }, [active]);
  const busy = status === "submitting";

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  useEffect(() => {
    if (!active) { setHelpOpen(false); return; }
    openerRef.current = document.activeElement as HTMLElement | null;
    return () => {
      const opener = openerRef.current;
      const fallback = document.querySelector<HTMLButtonElement>('[data-open-project]');
      // A removed launcher tile falls back to the permanent dock entry.
      // Do not steal focus from another app when the user switches directly to it.
      if (document.activeElement === document.body) (opener?.isConnected ? opener : fallback)?.focus();
    };
  }, [active]);
  useEffect(() => {
    if (!active || covered) return;
    titleRef.current?.focus();
    formRef.current?.querySelector('.project-scroll')?.scrollTo?.({ top: 0 });
  }, [active, covered, step, status === "success"]);
  useEffect(() => {
    formRef.current?.querySelector('.project-scroll')?.scrollTo?.({ top: 0 });
  }, [helpOpen]);

  const update = <K extends keyof ProjectDraft>(field: K, value: ProjectDraft[K]) => {
    requestIdRef.current = null;
    setDraft(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: undefined }));
    if (status !== "submitting") { setStatus("idle"); setMessage(""); }
  };
  const edit = (next: number) => { setStep(next); setErrors({}); setStatus("idle"); setMessage(""); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const nextErrors = validateDraft(draft, step);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors); setStatus("validation-error");
      if (nextErrors.projectDescription && step !== 0) setStep(0);
      else if (nextErrors.budgetText && step !== 1) setStep(1);
      else formRef.current?.querySelector<HTMLElement>(`[name="${Object.keys(nextErrors)[0]}"]`)?.focus();
      return;
    }
    if (step < 2) { edit(step + 1); return; }
    submittingRef.current = true;
    setErrors({}); setMessage(""); setStatus("submitting");
    try {
      requestIdRef.current ??= crypto.randomUUID();
      await sendProjectRequest(draft, endpoint, fetch, { requestId: requestIdRef.current, turnstileToken: token });
      if (mountedRef.current) { setDraft(current => ({ ...current, email: current.email.trim() })); setStatus("success"); }
    } catch (error) {
      if (mountedRef.current) {
        setStatus(error instanceof ProjectRequestError ? error.status : "server-error");
        setMessage(error instanceof ProjectRequestError ? error.message : "Your request wasn’t sent. Please try again.");
      }
    } finally { submittingRef.current = false; setToken(''); setVerificationReset(value => value + 1); }
  };

  if (!active) return null;
  return <DesktopWindow className="project-window" label="Hyper D² / new-project" icon={FilePlus2} onClose={onClose} inert={covered}
    headerActions={status !== "success" && <button type="button" className="icon-button project-help-toggle"
      aria-label="Project request help" title={helpOpen ? "Hide help" : "Project request help"}
      aria-expanded={helpOpen} aria-controls="project-help" onClick={() => setHelpOpen(current => !current)}>
      <CircleHelp aria-hidden="true" />
    </button>}>
    {status === "success" ? <div className="project-success" role="status">
      <span className="project-success-mark"><CheckCheck aria-hidden="true" /></span>
      <span className="project-eyebrow">Project request received</span>
      <h1 ref={titleRef} tabIndex={-1}>Your idea is on its way.</h1>
      <p>Thank you for sharing a little of what you have in mind. I’ll personally review your idea and get back to you at <strong>{draft.email}</strong>.</p>
      <p>In the meantime, make yourself at home in the portfolio. Have a lovely day!</p>
      <code>request.status = "received"</code>
      <div className="project-success-actions">
        <button type="button" className="project-primary" onClick={onPortfolio}>Back to Portfolio <ArrowRight aria-hidden="true" /></button>
        <button type="button" className="project-secondary" onClick={() => { requestIdRef.current = null; setDraft(emptyDraft()); edit(0); }}>Start another idea</button>
      </div>
    </div> : <form ref={formRef} className="project-form" onSubmit={submit} noValidate aria-busy={busy}>
      <ol className="project-stepper" aria-label="Project request progress">
        {steps.map((name, index) => <li key={name} aria-current={step === index ? "step" : undefined} data-complete={step > index || undefined}>
          <span aria-hidden="true">{step > index ? <Check /> : `0${index + 1}`}</span><span>{name}</span>
        </li>)}
      </ol>
      <div className="project-scroll">
        <div className={`project-columns ${helpOpen ? "project-columns-help" : ""} ${step === 2 ? "project-columns-review" : ""}`}>
          <div className="project-step" key={step}>
            <span className="project-eyebrow">A new collaboration / 0{step + 1}</span>
            <h1 ref={titleRef} tabIndex={-1}>{headings[step]}</h1>
            <p className="project-description">{descriptions[step]}</p>
            <fieldset disabled={busy} className="project-fields">
              <legend className="project-sr-only">{steps[step]}</legend>
              {step === 0 && <>
                <label className="project-field-label" htmlFor="project-idea">Your idea <span>Required</span></label>
                <textarea id="project-idea" name="projectDescription" value={draft.projectDescription} maxLength={3000} rows={5}
                  placeholder="I’m thinking of new packaging for a drink… or a website to show my products…"
                  aria-invalid={!!errors.projectDescription} aria-describedby="project-idea-help project-idea-error"
                  onChange={event => update("projectDescription", event.target.value)} />
                <div className="project-field-help" id="project-idea-help"><span>A few sentences is a great start.</span><span>{draft.projectDescription.length.toLocaleString("en")} / 3,000</span></div>
                <p className="project-error" id="project-idea-error" role="alert">{errors.projectDescription}</p>
                <div className="project-context" role="group" aria-label="Optional project context">
                  <span className="project-field-label">A little context <span>Optional</span></span>
                  <div className="project-chips">{categories.map(category => <button type="button" key={category.value}
                    aria-pressed={draft.projectCategory === category.value}
                    onClick={() => update("projectCategory", draft.projectCategory === category.value ? "" : category.value)}>{category.label}</button>)}</div>
                </div>
              </>}
              {step === 1 && <>
                <div className="project-budget-options">{budgetOptions.map(option => <label key={option.value} className="project-budget-option">
                  <input type="radio" name="budgetMode" value={option.value} checked={draft.budgetMode === option.value}
                    onChange={() => update("budgetMode", option.value)} />
                  <span><strong>{option.label}</strong><small>{option.detail}</small></span>
                </label>)}</div>
                {draft.budgetMode === "specified" && <div className="project-budget-input">
                  <label className="project-field-label" htmlFor="project-budget">Estimated budget in VND <span>Optional</span></label>
                  <input id="project-budget" name="budgetText" type="text" maxLength={120} value={draft.budgetText}
                    placeholder="e.g. 5,000,000 – 10,000,000" aria-invalid={!!errors.budgetText} aria-describedby="project-budget-error"
                    onChange={event => update("budgetText", event.target.value)} />
                  <p className="project-error" id="project-budget-error" role="alert">{errors.budgetText}</p>
                </div>}
                <button type="button" className="project-text-button" onClick={() => { update("budgetMode", "undecided"); edit(2); }}>Skip budget for now <ArrowRight aria-hidden="true" /></button>
              </>}
              {step === 2 && <>
                <label className="project-field-label" htmlFor="project-email">Your email <span>Required</span></label>
                <input id="project-email" name="email" type="email" autoComplete="email" inputMode="email" maxLength={254}
                  placeholder="you@example.com" value={draft.email} aria-invalid={!!errors.email} aria-describedby="project-email-error"
                  onChange={event => update("email", event.target.value)} onBlur={() => update("email", draft.email.trim())} />
                <p className="project-error" id="project-email-error" role="alert">{errors.email}</p>
                <ProjectSummary draft={draft} onEdit={edit} />
                <p className="project-privacy"><ShieldCheck aria-hidden="true" />Your details are only used to review and respond to this request.</p>
                {connection?.config.turnstileSiteKey && <Verification siteKey={connection.config.turnstileSiteKey} reset={verificationReset} onToken={setToken} />}
              </>}
            </fieldset>
            <div className="project-honeypot" aria-hidden="true"><label htmlFor="project-website">Leave this empty</label>
              <input id="project-website" name="_gotcha" tabIndex={-1} autoComplete="off" value={draft.honeypot} onChange={event => update("honeypot", event.target.value)} /></div>
            {step === 2 && !configured && !message && <p className="project-notice"><CircleAlert aria-hidden="true" />Project requests aren’t available just yet. You can prepare your idea here, but it can’t be sent at the moment.</p>}
            {message && <p className="project-notice" role="alert"><CircleAlert aria-hidden="true" />{message}</p>}
          </div>
          {helpOpen && <aside id="project-help" className="project-preview" aria-label="Project request help">
            <div className="project-preview-label">
              <FilePlus2 className="project-preview-icon" aria-hidden="true" />
              <span className="project-eyebrow">Your next chapter</span>
            </div>
            <h2>Good work starts with a conversation.</h2>
            <p>An early thought. A tricky problem. Something you’ve been meaning to make.</p>
            {step < 2 && <ProjectSummary draft={draft} />}
            <span className="project-preview-note">Let’s give it a place to begin.</span>
          </aside>}
        </div>
      </div>
      <footer className="project-footer">
        <span>{step === 2 ? "Sending a request doesn’t commit you to hiring." : "A little idea is enough to begin."}</span>
        <div>
          {step > 0 && <button type="button" className="project-secondary" disabled={busy} onClick={() => edit(step - 1)}><ArrowLeft aria-hidden="true" />Back</button>}
          <button type="submit" className="project-primary" disabled={busy}>
            {busy ? <><LoaderCircle className="project-spinner" aria-hidden="true" />Sending…</>
              : step === 2 ? <>Send request <Send aria-hidden="true" /></> : <>Continue <ArrowRight aria-hidden="true" /></>}
          </button>
        </div>
      </footer>
    </form>}
  </DesktopWindow>;
}
