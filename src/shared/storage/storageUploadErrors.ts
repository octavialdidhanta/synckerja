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

/** Wrap a fetch so Storage upload refusals carry the Indonesian message. */
export function withStorageUploadMessages(baseFetch: typeof fetch): typeof fetch {
  return async (input, init) => {
    const response = await baseFetch(input, init);
    if (response.ok || !isStorageUpload(input, init)) return response;
    return rewriteStorageRejection(response, requestUrl(input));
  };
}
