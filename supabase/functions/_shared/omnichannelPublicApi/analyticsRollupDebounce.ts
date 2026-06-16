import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Debounce rollup refresh: max 1x per web_id per 60 detik. */
const debounceMap = new Map<string, number>();
const DEBOUNCE_MS = 60_000;

function todayWibDateStr(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

export function scheduleAnalyticsRollupRefresh(admin: SupabaseClient, webId: string): void {
  const key = webId.trim().toLowerCase();
  const now = Date.now();
  const last = debounceMap.get(key) ?? 0;
  if (now - last < DEBOUNCE_MS) return;
  debounceMap.set(key, now);

  void refreshRollupsForToday(admin, key).catch((e) => {
    console.error("scheduleAnalyticsRollupRefresh:", e);
  });
}

async function refreshRollupsForToday(admin: SupabaseClient, webId: string): Promise<void> {
  const day = todayWibDateStr();

  const { error: e1 } = await admin.rpc("refresh_analytics_rollups", {
    p_web_id: webId,
    p_from: day,
    p_to: day,
  });
  if (e1) console.warn("refresh_analytics_rollups:", e1.message);

  const { error: e2 } = await admin.rpc("refresh_analytics_daily_rollups", {
    p_from: day,
    p_to: day,
    p_web_id: webId,
  });
  if (e2) console.warn("refresh_analytics_daily_rollups:", e2.message);
}
