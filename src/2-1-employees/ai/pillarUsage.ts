import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/shared/lib/supabaseClient";

export type PillarUsage = { count: number; titles: string[] };
export type PillarFunnel = "top" | "middle" | "bottom";

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Current month in Asia/Jakarta as a UTC range [start, end).
 * Same month rule the AI run uses when it rotates pillars.
 */
export function jakartaMonthRange(now: Date = new Date()): { start: string; end: string } {
  const local = new Date(now.getTime() + JAKARTA_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1) - JAKARTA_OFFSET_MS).toISOString(),
    end: new Date(Date.UTC(year, month + 1, 1) - JAKARTA_OFFSET_MS).toISOString(),
  };
}

export function summarizePillarUsage(
  rows: ReadonlyArray<{ content_pillar_id?: string | null; title?: string | null }>,
): Record<string, PillarUsage> {
  const usage: Record<string, PillarUsage> = {};
  for (const row of rows) {
    const id = row.content_pillar_id ?? "";
    if (!id) continue;
    const current = usage[id] ?? { count: 0, titles: [] };
    current.count += 1;
    const title = (row.title ?? "").replace(/\s+/g, " ").trim();
    if (title && current.titles.length < 3) current.titles.push(title);
    usage[id] = current;
  }
  return usage;
}

function funnelOf(value: unknown): PillarFunnel | null {
  return value === "top" || value === "middle" || value === "bottom" ? value : null;
}

/**
 * Plans per pillar this month for the brief's catalog (all catalogs when none is picked),
 * plus each pillar's funnel stage.
 */
export function useBriefPillarUsage(
  organizationId: string | null | undefined,
  serviceId: string | null | undefined,
  pillarIds: string[],
): {
  usage: Record<string, PillarUsage>;
  funnel: Record<string, PillarFunnel>;
  loading: boolean;
  reload: () => void;
} {
  const [usage, setUsage] = useState<Record<string, PillarUsage>>({});
  const [funnel, setFunnel] = useState<Record<string, PillarFunnel>>({});
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const pillarKey = [...pillarIds].sort().join(",");

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    const { start, end } = jakartaMonthRange();
    setLoading(true);
    let plans = supabase
      .from("social_media_plans")
      .select("content_pillar_id, title")
      .eq("organization_id", organizationId)
      .not("content_pillar_id", "is", null)
      .gte("post_date", start)
      .lt("post_date", end);
    if (serviceId) plans = plans.eq("service_id", serviceId);
    void plans.order("post_date", { ascending: false }).limit(1000).then(({ data, error }) => {
      if (cancelled) return;
      setUsage(error || !data ? {} : summarizePillarUsage(data));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId, serviceId, tick]);

  useEffect(() => {
    const ids = pillarKey ? pillarKey.split(",") : [];
    if (ids.length === 0) return;
    let cancelled = false;
    void supabase
      .from("content_pillars")
      .select("id, funnel_stage")
      .in("id", ids)
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const next: Record<string, PillarFunnel> = {};
        for (const row of data as Array<{ id: string; funnel_stage: unknown }>) {
          const stage = funnelOf(row.funnel_stage);
          if (stage) next[row.id] = stage;
        }
        setFunnel(next);
      });
    return () => {
      cancelled = true;
    };
  }, [pillarKey]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { usage, funnel, loading, reload };
}
