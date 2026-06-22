import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Mirrors public.traffic_path_key for client-side comparison. */
export function trafficPathKey(p: string | null | undefined): string {
  if (p == null) return "/";
  let t = String(p).trim().toLowerCase();
  if (t === "" || t === "/") return "/";
  t = t.replace(/^\/+|\/+$/g, "");
  if (t === "") return "/";
  return t.startsWith("/") ? t : `/${t}`;
}

export type ResolvedClickPath = {
  path: string;
  pathClient: string | null;
};

function pathnameFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, "https://placeholder.local");
    const p = parsed.pathname || "/";
    return p.startsWith("/") ? p : `/${p}`;
  } catch {
    return null;
  }
}

/**
 * Resolve click path from active page_view at click time.
 * When client path mismatches, store original in pathClient only for the
 * classic SPA nav bug (client sent destination path while still on source page).
 */
export async function resolveClickPathFromPageView(
  admin: SupabaseClient,
  params: {
    sessionId: string;
    clientPath: string;
    clickAt?: string;
    pageViewId?: string | null;
    targetUrl?: string | null;
  },
): Promise<ResolvedClickPath> {
  const clientPath = String(params.clientPath ?? "/").trim() || "/";
  const clickAt = params.clickAt ?? new Date().toISOString();
  const targetPath = pathnameFromUrl(params.targetUrl);

  const applyResolved = (resolvedPath: string): ResolvedClickPath => {
    if (trafficPathKey(resolvedPath) === trafficPathKey(clientPath)) {
      return { path: clientPath, pathClient: null };
    }
    const clientLooksLikeDestination =
      targetPath != null && trafficPathKey(targetPath) === trafficPathKey(clientPath);
    if (!clientLooksLikeDestination) {
      return { path: clientPath, pathClient: null };
    }
    return { path: resolvedPath, pathClient: clientPath };
  };

  if (params.pageViewId) {
    const { data: pv } = await admin
      .from("analytics_page_views")
      .select("id, path")
      .eq("id", params.pageViewId)
      .eq("session_id", params.sessionId)
      .maybeSingle();

    if (pv?.path != null) {
      return applyResolved(String(pv.path).trim() || "/");
    }
  }

  const { data: pageViews, error } = await admin
    .from("analytics_page_views")
    .select("id, path, started_at")
    .eq("session_id", params.sessionId)
    .lte("started_at", clickAt)
    .order("started_at", { ascending: false })
    .limit(1);

  if (error || !pageViews?.length) {
    return { path: clientPath, pathClient: null };
  }

  const active = pageViews[0];
  return applyResolved(String(active.path ?? "/").trim() || "/");
}
