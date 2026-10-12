export type D1Result<T = unknown> = {
  results?: T[];
  success: boolean;
  meta?: { changes?: number };
};

export type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
};

export type D1Database = {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<Array<D1Result<T>>>;
};

export type AssetFetcher = { fetch(request: Request): Promise<Response> };
export type R2Object = {
  size: number;
  httpEtag?: string;
  body?: ReadableStream<Uint8Array>;
};
export type R2Bucket = {
  put(key: string, value: ArrayBuffer, options?: {
    httpMetadata?: { contentType?: string; contentDisposition?: string; cacheControl?: string };
    customMetadata?: Record<string, string>;
    sha256?: ArrayBuffer;
  }): Promise<R2Object | null>;
  head(key: string): Promise<R2Object | null>;
  get(key: string): Promise<R2Object | null>;
  delete(key: string | string[]): Promise<void>;
};
export type AccessIdentity = { email?: string; sub?: string; name?: string };
export type AccessContext = {
  access?: {
    aud?: string | string[];
    getIdentity(): Promise<AccessIdentity | null>;
  };
};

export type AdminEnv = {
  ASSETS: AssetFetcher;
  DB: D1Database;
  MEDIA: R2Bucket;
  DEPLOY_ENV?: string;
  ADMIN_ORIGIN?: string;
  ADMIN_EMAIL?: string;
  ACCESS_AUD?: string;
  ACCESS_TEAM_DOMAIN?: string;
  CSRF_SECRET?: string;
  LOCAL_ADMIN_BYPASS?: string;
  LOCAL_CSRF_TOKEN?: string;
};

export type Actor = { sub: string; email: string; csrfToken: string; local: boolean };
