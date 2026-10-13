export const categories = [
  { value: "design", label: "Design / Packaging" },
  { value: "3d-motion", label: "3D / Motion" },
  { value: "web-app", label: "Web / App / Automation" },
  { value: "other", label: "Other / Still exploring" },
] as const;

export const budgetOptions = [
  { value: "undecided", label: "I haven’t decided yet", detail: "The idea comes first. We can work out the details later." },
  { value: "discuss", label: "Let’s estimate it together", detail: "I’d like to talk through the scope and possibilities." },
  { value: "specified", label: "I have a budget in mind", detail: "Share an amount or a range, if you’d like." },
] as const;

export type ProjectDraft = {
  projectDescription: string;
  projectCategory: "" | typeof categories[number]["value"];
  budgetMode: typeof budgetOptions[number]["value"];
  budgetText: string;
  email: string;
  honeypot: string;
};
export type RequestStatus = "idle" | "validation-error" | "submitting" | "success" | "server-error" | "not-configured";
export type DraftErrors = Partial<Record<"projectDescription" | "budgetText" | "email", string>>;

export function emptyDraft(): ProjectDraft {
  return { projectDescription: "", projectCategory: "", budgetMode: "undecided", budgetText: "", email: "", honeypot: "" };
}

export function validateDraft(draft: ProjectDraft, step: number): DraftErrors {
  const errors: DraftErrors = {};
  if (step === 0 || step === 2) {
    const length = draft.projectDescription.trim().length;
    if (length < 15) errors.projectDescription = "Tell me a little more — at least 15 characters.";
    else if (length > 3000) errors.projectDescription = "Please keep your idea within 3,000 characters.";
  }
  if (draft.budgetMode === "specified" && draft.budgetText.trim().length > 120 && step >= 1) {
    errors.budgetText = "Please keep the budget within 120 characters.";
  }
  if (step === 2 && (draft.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()))) {
    errors.email = "Enter a valid email address so I can reply.";
  }
  return errors;
}

export function budgetSummary(draft: ProjectDraft) {
  return draft.budgetMode === "specified" && draft.budgetText.trim()
    ? `${draft.budgetText.trim()} VND`
    : budgetOptions.find(option => option.value === draft.budgetMode)!.label;
}

export function isRequestConfigured(endpoint: string) {
  return /^(?:(?:https:\/\/[^/?#]+|http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?))?\/api\/v1\/project-requests$/.test(endpoint.trim());
}

export class ProjectRequestError extends Error {
  constructor(public status: "not-configured" | "server-error", message: string) { super(message); }
}

export async function sendProjectRequest(draft: ProjectDraft, endpoint: string, transport: typeof fetch = fetch,
  verification: { requestId?: string; turnstileToken?: string } = {}) {
  if (!isRequestConfigured(endpoint)) {
    throw new ProjectRequestError("not-configured", "Project requests aren’t available just yet. Your draft is still here; please try again later.");
  }
  if (Object.keys(validateDraft(draft, 2)).length || draft.honeypot) {
    throw new ProjectRequestError("server-error", "Your request wasn’t sent. Please review the form and try again.");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await transport(endpoint.trim(), {
      method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
      credentials: "omit", redirect: "error", signal: controller.signal,
      body: JSON.stringify({
        projectDescription: draft.projectDescription.trim(), projectCategory: draft.projectCategory,
        budgetMode: draft.budgetMode, budgetText: draft.budgetMode === "specified" ? draft.budgetText.trim() : "",
        currency: "VND", email: draft.email.trim(), source: "hyperdesigndev-project-launcher",
        _subject: "Hyper D² — New project request", _gotcha: draft.honeypot,
        requestId: verification.requestId ?? crypto.randomUUID(), turnstileToken: verification.turnstileToken ?? '',
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      throw new ProjectRequestError('server-error', body?.error?.message ?? 'Your request could not be sent. Please try again.');
    }
    // The provider's response must be parseable JSON; this rejects an HTML
    // redirect/captcha page while accepting provider-specific success fields.
    const body = await response.json() as { ok?: boolean };
    if (body.ok !== true) throw new Error('Request was not acknowledged.');
  } catch (error) {
    if (error instanceof ProjectRequestError) throw error;
    throw new ProjectRequestError("server-error", "Your request wasn’t confirmed. Your draft is safe here. Check your connection and try again.");
  } finally { clearTimeout(timeout); }
}
