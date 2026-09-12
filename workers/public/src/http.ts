import type { PublicEnv } from "./types";

export class PublicApiException extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export const json = (body: unknown, status = 200, headers: HeadersInit = {}, cacheControl = "no-store") => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cacheControl, ...headers },
});

export function corsHeaders(request: Request, env: PublicEnv): HeadersInit | null {
  const origin = request.headers.get("Origin");
  if (!origin) return {};
  const allowed = new Set((env.PUBLIC_CORS_ORIGINS ?? "").split(",").map(value => value.trim()).filter(Boolean));
  if (!allowed.has(origin)) return null;
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS", Vary: "Origin" };
}

export function publicError(error: PublicApiException, requestId: string, headers: HeadersInit = {}) {
  return json({ error: { code: error.code, message: error.message, requestId } }, error.status, headers);
}
