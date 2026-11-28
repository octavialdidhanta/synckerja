/**
 * Supabase Storage refuses uploads over a bucket's size limit or outside its file types with an English error.
 * The Office client rewrites those error bodies into one clear Indonesian sentence (with the bucket's limit), so every
 * screen that already shows `error.message` from an upload shows it without per-screen changes.
 */
import { bucketFromStorageUrl, storageRejection, storageRejectionMessage } from "./bucketLimits";

function requestUrl(input: RequestInfo | URL): string {
  return typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  return String(init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
}

/** True for Storage object uploads (POST / PUT to /storage/v1/object/...). */
export function isStorageUpload(input: RequestInfo | URL, init?: RequestInit): boolean {
  const method = requestMethod(input, init);
  return (method === "POST" || method === "PUT") && requestUrl(input).includes("/storage/v1/object/");
}

/** Same response, or one whose JSON `message` explains the size / type refusal in Indonesian. */
export async function rewriteStorageRejection(response: Response, url: string): Promise<Response> {
  if (response.ok) return response;
  let body: Record<string, unknown>;
  try {
    body = (await response.clone().json()) as Record<string, unknown>;
  } catch {
    return response;
  }
  const kind = storageRejection(response.status, body);
  if (!kind) return response;
  const message = storageRejectionMessage(kind, bucketFromStorageUrl(url));
  const headers = new Headers(response.headers);
  headers.set("content-type", "application/json");
  headers.delete("content-length");
  return new Response(JSON.stringify({ ...body, message }), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isRlsRefusal(body: Record<string, unknown>): boolean {
  const text = `${String(body.error ?? "")} ${String(body.message ?? "")}`.toLowerCase();
  return text.includes("row-level security") || text.includes("row level security");
}

function formatGb(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${(gb >= 10 ? Math.round(gb) : Math.round(gb * 10) / 10).toString().replace(".", ",")} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}

/**
 * An upload refused by RLS may be the storage quota (policy storage_quota_block_insert). Ask get_storage_usage with the
 * same credentials; when the organization is full, say so instead of the RLS text.
 */
export async function rewriteQuotaRefusal(
  response: Response,
  url: string,
  init: RequestInit | undefined,
  baseFetch: typeof fetch,
): Promise<Response> {
  if (response.ok) return response;
  let body: Record<string, unknown>;
  try {
    body = (await response.clone().json()) as Record<string, unknown>;
  } catch {
    return response;
  }
  if (!isRlsRefusal(body)) return response;
  const root = url.split("/storage/v1/")[0];
  const source = new Headers(init?.headers);
  const headers = new Headers({ "content-type": "application/json" });
  for (const name of ["authorization", "apikey"]) {
    const value = source.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const usageRes = await baseFetch(`${root}/rest/v1/rpc/get_storage_usage`, { method: "POST", headers, body: "{}" });
    if (!usageRes.ok) return response;
    const usage = (await usageRes.json()) as { status?: string; used_bytes?: number; quota_bytes?: number };
    if (usage?.status !== "full") return response;
    const message = `Penyimpanan organisasi penuh (${formatGb(Number(usage.used_bytes) || 0)} dari ${formatGb(
      Number(usage.quota_bytes) || 0,
    )}). Hapus file lama atau upgrade paket di menu Langganan.`;
    const out = new Headers(response.headers);
    out.set("content-type", "application/json");
    out.delete("content-length");
    return new Response(JSON.stringify({ ...body, error: "storage_quota_full", message }), {
      status: response.status,
      statusText: response.statusText,
      headers: out,
    });
  } catch {
    return response;
  }
}

/** Wrap a fetch so Storage upload refusals (size, type, quota) carry an Indonesian message. */
export function withStorageUploadMessages(baseFetch: typeof fetch): typeof fetch {
  return async (input, init) => {
    const response = await baseFetch(input, init);
    if (response.ok || !isStorageUpload(input, init)) return response;
    const url = requestUrl(input);
    const rewritten = await rewriteStorageRejection(response, url);
    if (rewritten !== response) return rewritten;
    return rewriteQuotaRefusal(response, url, init, baseFetch);
  };
}
