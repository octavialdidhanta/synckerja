/** One Graph Batch API sub-request result. `body` is a JSON string. */
export type GraphBatchItemResult = {
  code?: number;
  body?: string;
};

export type FetchGraphObjectsByIdsArgs = {
  graphVersion: string;
  accessToken: string;
  ids: string[];
  fields: string;
};

/** `GET /{id}?fields=...` relative to the version root. Not the removed `/?ids=` lookup. */
export function objectFieldRelativeUrl(id: string, fields: string): string {
  return `${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}`;
}

function isSuccessObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && !("error" in value);
}

/** Map a batch response onto the requested ids. Failed items are omitted. */
export function graphObjectsFromBatchItems(
  ids: string[],
  items: GraphBatchItemResult[],
): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < ids.length; i++) {
    const item = items[i];
    const code = item?.code;
    if (typeof code !== "number" || code < 200 || code >= 300) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(item?.body ?? "");
    } catch {
      continue;
    }
    if (!isSuccessObject(parsed)) continue;
    map.set(ids[i], parsed);
  }
  return map;
}

function batchErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object" || Array.isArray(data)) return fallback;
  const message = (data as { error?: { message?: string } }).error?.message;
  return message?.trim() || fallback;
}

/**
 * Load one chunk of Graph objects by id.
 * Callers slice to at most 50 ids (Meta's batch cap). An empty chunk does not call Meta.
 * A failed item is dropped. A failed batch HTTP call throws.
 */
export async function fetchGraphObjectsByIds(
  args: FetchGraphObjectsByIdsArgs,
): Promise<Map<string, Record<string, unknown>>> {
  const ids = args.ids.map((id) => String(id).trim()).filter(Boolean);
  if (ids.length === 0) return new Map();

  const version = args.graphVersion.trim().replace(/\/+$/, "");
  const res = await fetch(`https://graph.facebook.com/${version}/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      access_token: args.accessToken,
      batch: JSON.stringify(ids.map((id) => ({
        method: "GET",
        relative_url: objectFieldRelativeUrl(id, args.fields),
      }))),
    }).toString(),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(batchErrorMessage(data, `Graph batch error ${res.status}`));
  }
  if (!Array.isArray(data)) {
    throw new Error(batchErrorMessage(data, "Graph batch response was not an array"));
  }
  return graphObjectsFromBatchItems(ids, data as GraphBatchItemResult[]);
}
