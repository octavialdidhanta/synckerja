import { sleepMs } from "./scheduledPostRetry.ts";
import type { ScheduledPostRow } from "./scheduledPostTypes.ts";

function dryRunLatencyMs(): number {
  const base = parseInt(Deno.env.get("SCHEDULER_DRY_RUN_LATENCY_MS") ?? "3000", 10);
  const jitter = Math.floor(Math.random() * 2001) - 1000;
  return Math.max(500, (Number.isFinite(base) ? base : 3000) + jitter);
}

export async function executeDryRunScheduledPost(
  schedule: ScheduledPostRow,
): Promise<{ published_url: string; external_post_id: string }> {
  await sleepMs(dryRunLatencyMs());
  const suffix = crypto.randomUUID().slice(0, 8);
  return {
    published_url: `dry-run://${schedule.platform.toLowerCase()}/${schedule.id}/${suffix}`,
    external_post_id: `dry_run_${suffix}`,
  };
}
