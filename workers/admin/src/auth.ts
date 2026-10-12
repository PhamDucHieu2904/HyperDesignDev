import { ApiException } from "./http";
import type { AccessContext, Actor, AdminEnv } from "./types";

const localBypassEnabled = (env: AdminEnv) => env.DEPLOY_ENV === "local" && env.LOCAL_ADMIN_BYPASS === "true";

type AccessJwtHeader = { alg?: unknown; kid?: unknown };
type AccessJwtPayload = {
  aud?: unknown;
  email?: unknown;
  exp?: unknown;
  iss?: unknown;
  nbf?: unknown;
  sub?: unknown;
};
type AccessJwk = JsonWebKey & { kid?: string };
type AccessCerts = { keys?: AccessJwk[] };

let certCache: { domain: string; expiresAt: number; keys: AccessJwk[] } | null = null;

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function signCsrf(secret: string, jwt: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`hyperd-csrf:${jwt}`))));
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(decoded, character => character.charCodeAt(0));
}

function decodeJsonPart<T>(value: string): T {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
  } catch {
    throw new ApiException(401, "AUTH_INVALID", "Cloudflare Access token is invalid.");
  }
}

function normalizedTeamDomain(value: string | undefined) {
  const domain = value?.trim().toLowerCase();
  if (!domain || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain)) {
    throw new ApiException(503, "ADMIN_AUTH_NOT_CONFIGURED", "Admin authentication is not configured.");
  }
  return domain;
}

async function getAccessKeys(domain: string, forceRefresh = false) {
  if (!forceRefresh && certCache?.domain === domain && certCache.expiresAt > Date.now()) return certCache.keys;
  let response: Response;
  try {
    response = await fetch(`https://${domain}/cdn-cgi/access/certs`);
  } catch {
    throw new ApiException(503, "AUTH_KEYS_UNAVAILABLE", "Cloudflare Access verification is temporarily unavailable.");
  }
  if (!response.ok) throw new ApiException(503, "AUTH_KEYS_UNAVAILABLE", "Cloudflare Access verification is temporarily unavailable.");
  const body = await response.json() as AccessCerts;
  const keys = Array.isArray(body.keys) ? body.keys.filter(key => typeof key.kid === "string") : [];
  if (!keys.length) throw new ApiException(503, "AUTH_KEYS_UNAVAILABLE", "Cloudflare Access verification is temporarily unavailable.");
  certCache = { domain, keys, expiresAt: Date.now() + 5 * 60 * 1000 };
  return keys;
}

async function verifyAccessJwt(token: string, env: AdminEnv) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new ApiException(401, "AUTH_INVALID", "Cloudflare Access token is invalid.");
  const header = decodeJsonPart<AccessJwtHeader>(parts[0]);
  const payload = decodeJsonPart<AccessJwtPayload>(parts[1]);
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new ApiException(401, "AUTH_INVALID", "Cloudflare Access token is invalid.");
  }

  const domain = normalizedTeamDomain(env.ACCESS_TEAM_DOMAIN);
  let keys = await getAccessKeys(domain);
  let jwk = keys.find(key => key.kid === header.kid);
  if (!jwk) {
    keys = await getAccessKeys(domain, true);
    jwk = keys.find(key => key.kid === header.kid);
  }
  if (!jwk) throw new ApiException(401, "AUTH_INVALID", "Cloudflare Access token is invalid.");

  try {
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const verified = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      decodeBase64Url(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!verified) throw new Error("Invalid signature");
  } catch {
    throw new ApiException(401, "AUTH_INVALID", "Cloudflare Access token is invalid.");
  }

  const now = Math.floor(Date.now() / 1000);
  const issuer = `https://${domain}`;
  const audiences = typeof payload.aud === "string" ? [payload.aud] : Array.isArray(payload.aud) ? payload.aud : [];
  if (payload.iss !== issuer || !audiences.includes(env.ACCESS_AUD) || typeof payload.exp !== "number" || payload.exp <= now ||
      (typeof payload.nbf === "number" && payload.nbf > now + 60)) {
    throw new ApiException(401, "AUTH_INVALID", "Cloudflare Access token is invalid.");
  }
  return {
    email: typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "",
    sub: typeof payload.sub === "string" ? payload.sub : "",
  };
}

export async function authenticate(request: Request, env: AdminEnv, context: AccessContext): Promise<Actor> {
  if (localBypassEnabled(env)) return {
    sub: "local-owner",
    email: env.ADMIN_EMAIL ?? "local@hyperd.invalid",
    csrfToken: env.LOCAL_CSRF_TOKEN ?? "local-dev-csrf",
    local: true,
  };

  if (!env.ACCESS_AUD || !env.ADMIN_EMAIL || !env.CSRF_SECRET) {
    throw new ApiException(503, "ADMIN_AUTH_NOT_CONFIGURED", "Admin authentication is not configured.");
  }
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) throw new ApiException(401, "AUTH_REQUIRED", "Cloudflare Access token is missing.");
  let identity: { email?: string; sub?: string } | null;
  if (context.access) {
    const audiences = Array.isArray(context.access.aud) ? context.access.aud : [context.access.aud];
    if (!audiences.includes(env.ACCESS_AUD)) throw new ApiException(403, "INVALID_AUDIENCE", "Cloudflare Access audience is not allowed.");
    identity = await context.access.getIdentity();
  } else {
    identity = await verifyAccessJwt(token, env);
  }
  const email = identity?.email?.trim().toLowerCase();
  if (!email || email !== env.ADMIN_EMAIL.trim().toLowerCase()) throw new ApiException(403, "OWNER_REQUIRED", "This identity cannot administer Hyper D.");
  return { sub: identity?.sub || email, email, csrfToken: await signCsrf(env.CSRF_SECRET, token), local: false };
}

export function requireMutationProtection(request: Request, env: AdminEnv, actor: Actor) {
  const expectedOrigin = actor.local ? new URL(request.url).origin : env.ADMIN_ORIGIN;
  if (!expectedOrigin) throw new ApiException(503, "ADMIN_ORIGIN_NOT_CONFIGURED", "Admin origin is not configured.");
  if (request.headers.get("Origin") !== expectedOrigin) throw new ApiException(403, "ORIGIN_NOT_ALLOWED", "Mutation origin is not allowed.");
  if (request.headers.get("X-HyperD-CSRF") !== actor.csrfToken) throw new ApiException(403, "CSRF_INVALID", "CSRF token is missing or invalid.");
}
