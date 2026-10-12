import type { ValidationIssue } from "../../../shared/contracts";

export class ApiException extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public issues?: ValidationIssue[],
  ) { super(message); }
}

export function getRequestId(request: Request) {
  const supplied = request.headers.get("X-Request-ID");
  return supplied && /^[a-zA-Z0-9._:-]{1,128}$/.test(supplied) ? supplied : crypto.randomUUID();
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export function errorResponse(error: ApiException, requestId: string) {
  const fieldErrors = error.issues?.reduce<Record<string, string[]>>((result, issue) => {
    (result[issue.path] ??= []).push(issue.message);
    return result;
  }, {});
  return json({ error: {
    code: error.code,
    message: error.message,
    requestId,
    ...(fieldErrors && { fieldErrors }),
  } }, error.status);
}

export async function readJson(request: Request, maxBytes = 600 * 1024): Promise<unknown> {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (Number.isFinite(length) && length > maxBytes) throw new ApiException(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  if (!(request.headers.get("Content-Type") ?? "").toLowerCase().startsWith("application/json")) {
    throw new ApiException(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new ApiException(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  try { return JSON.parse(text); } catch { throw new ApiException(400, "INVALID_JSON", "Request body must be valid JSON."); }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
