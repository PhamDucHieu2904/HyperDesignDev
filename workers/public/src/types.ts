export type D1Result<T = unknown> = { results?: T[]; success: boolean; meta?: { changes?: number } };
export type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
};
export type D1Database = { prepare(query: string): D1Statement };
export type AssetFetcher = { fetch(request: Request): Promise<Response> };
export type R2Object = { size: number; httpEtag?: string; body?: ReadableStream<Uint8Array> };
export type R2Bucket = {
  get(key: string): Promise<R2Object | null>;
  head(key: string): Promise<R2Object | null>;
};

export type PublicEnv = {
  ASSETS: AssetFetcher;
  DB: D1Database;
  MEDIA: R2Bucket;
  DEPLOY_ENV?: string;
  PUBLIC_CORS_ORIGINS?: string;
};
