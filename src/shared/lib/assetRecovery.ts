/**
 * Recovery when a code chunk fails to load after a deploy.
 *
 * 26 Nov 2026: /assets/* answered 404 with "immutable, max-age=1 year" during a deploy, so Chrome kept the 404.
 * A plain reload reads that 404 from the HTTP cache again, and the old guard was cleared by any lazy module that
 * did load, so the app reloaded every 2–3 s. Now: (1) the failed chunk and the chunks it imports are fetched again
 * past the HTTP cache (cache: "reload" overwrites a stored 404), (2) at most MAX_RELOADS reloads per WINDOW_MS.
 */
export const ASSET_RELOADS_KEY = "sj-asset-reloads";
export const MAX_RELOADS = 2;
export const WINDOW_MS = 5 * 60 * 1000;

/** Reload times kept in sessionStorage (JSON array of epoch ms). */
export function parseReloads(raw: string | null): number[] {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.filter((n): n is number => typeof n === "number" && Number.isFinite(n)) : [];
  } catch {
    return [];
  }
}

/** True when another reload is allowed; never more than MAX_RELOADS inside WINDOW_MS, so it can never loop. */
export function canReloadAt(times: number[], now: number): boolean {
  return times.filter((t) => now - t < WINDOW_MS).length < MAX_RELOADS;
}

/** The chunk URL named in "Failed to fetch dynamically imported module: <url>" (or any /assets/ URL in the text). */
export function failedChunkUrl(message: string): string | null {
  const m = /(https?:\/\/[^\s"']+\/assets\/[^\s"']+\.(?:js|css))/.exec(message);
  return m ? m[1]! : null;
}

/** Sibling chunks a built chunk imports ("./x-Hash.js"), as absolute URLs next to it. */
export function importedChunkUrls(chunkUrl: string, code: string, limit = 300): string[] {
  const base = chunkUrl.slice(0, chunkUrl.lastIndexOf("/") + 1);
  const out = new Set<string>();
  for (const m of code.matchAll(/["'`]\.\/([\w.-]+\.(?:js|css))["'`]/g)) {
    out.add(base + m[1]);
    if (out.size >= limit) break;
  }
  return [...out];
}

/** Fetch the failed chunk and its imports past the HTTP cache, so a stored 404 is replaced. Never throws. */
export async function refreshChunkCache(url: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  try {
    const res = await fetchImpl(url, { cache: "reload" });
    if (!res.ok || !url.endsWith(".js")) return;
    const deps = importedChunkUrls(url, await res.text());
    for (let i = 0; i < deps.length; i += 16) {
      await Promise.all(deps.slice(i, i + 16).map((d) => fetchImpl(d, { cache: "reload" }).catch(() => undefined)));
    }
  } catch {
    // offline or blocked: the reload below still runs
  }
}
