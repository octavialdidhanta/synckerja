import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  DEFAULT_SCHEDULER_CONFIG,
  type SchedulerConfig,
} from "./schedulerConfigTypes.ts";

function parseEnvInt(name: string, fallback: number, min: number, max: number): number {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function applyEnvOverrides(base: SchedulerConfig): SchedulerConfig {
  return {
    batch_size: parseEnvInt("SCHEDULER_BATCH_SIZE", base.batch_size, 1, 100),
    per_org_per_tick: parseEnvInt(
      "SCHEDULER_PER_ORG_PER_TICK",
      base.per_org_per_tick,
      1,
      20,
    ),
    resume_batch_size: parseEnvInt(
      "SCHEDULER_RESUME_BATCH_SIZE",
      base.resume_batch_size,
      1,
      50,
    ),
    tick_concurrency: parseEnvInt(
      "SCHEDULER_TICK_CONCURRENCY",
      base.tick_concurrency,
      1,
      20,
    ),
    tick_time_budget_ms: parseEnvInt(
      "SCHEDULER_TICK_TIME_BUDGET_MS",
      base.tick_time_budget_ms,
      5000,
      120000,
    ),
    tiktok_global_in_flight: parseEnvInt(
      "SCHEDULER_TIKTOK_GLOBAL_IN_FLIGHT",
      base.tiktok_global_in_flight,
      1,
      50,
    ),
    youtube_global_in_flight: parseEnvInt(
      "SCHEDULER_YOUTUBE_GLOBAL_IN_FLIGHT",
      base.youtube_global_in_flight,
      1,
      50,
    ),
    instagram_global_in_flight: parseEnvInt(
      "SCHEDULER_INSTAGRAM_GLOBAL_IN_FLIGHT",
      base.instagram_global_in_flight,
      1,
      50,
    ),
    linkedin_global_in_flight: parseEnvInt(
      "SCHEDULER_LINKEDIN_GLOBAL_IN_FLIGHT",
      base.linkedin_global_in_flight,
      1,
      50,
    ),
  };
}

export function isSchedulerDryRunEnvEnabled(): boolean {
  return Deno.env.get("SCHEDULER_PUBLISH_DRY_RUN") === "true";
}

export async function loadSchedulerConfig(
  admin: SupabaseClient,
): Promise<SchedulerConfig> {
  const { data, error } = await admin.rpc("get_social_media_scheduler_config");
  if (error || !data) {
    console.warn("loadSchedulerConfig: using defaults", error?.message);
    return applyEnvOverrides(DEFAULT_SCHEDULER_CONFIG);
  }

  const row = data as Record<string, unknown>;
  const fromDb: SchedulerConfig = {
    batch_size: Number(row.batch_size ?? DEFAULT_SCHEDULER_CONFIG.batch_size),
    per_org_per_tick: Number(row.per_org_per_tick ?? DEFAULT_SCHEDULER_CONFIG.per_org_per_tick),
    resume_batch_size: Number(row.resume_batch_size ?? DEFAULT_SCHEDULER_CONFIG.resume_batch_size),
    tick_concurrency: Number(row.tick_concurrency ?? DEFAULT_SCHEDULER_CONFIG.tick_concurrency),
    tick_time_budget_ms: Number(row.tick_time_budget_ms ?? DEFAULT_SCHEDULER_CONFIG.tick_time_budget_ms),
    tiktok_global_in_flight: Number(
      row.tiktok_global_in_flight ?? DEFAULT_SCHEDULER_CONFIG.tiktok_global_in_flight,
    ),
    youtube_global_in_flight: Number(
      row.youtube_global_in_flight ?? DEFAULT_SCHEDULER_CONFIG.youtube_global_in_flight,
    ),
    instagram_global_in_flight: Number(
      row.instagram_global_in_flight ?? DEFAULT_SCHEDULER_CONFIG.instagram_global_in_flight,
    ),
    linkedin_global_in_flight: Number(
      row.linkedin_global_in_flight ?? DEFAULT_SCHEDULER_CONFIG.linkedin_global_in_flight,
    ),
  };

  return applyEnvOverrides(fromDb);
}
