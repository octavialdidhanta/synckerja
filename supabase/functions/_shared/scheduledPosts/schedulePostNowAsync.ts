import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  runScheduledPostJob,
  type RunScheduledPostJobOptions,
  type RunScheduledPostJobResult,
} from "./runScheduledPostJob.ts";

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

export type PostNowAsyncResult =
  | { ok: true; processing: true }
  | RunScheduledPostJobResult;

/**
 * Run post_now publish in the background when EdgeRuntime.waitUntil is available.
 * Returns immediately with processing=true so clients can poll schedule status.
 */
export async function runPostNowInBackground(
  admin: SupabaseClient,
  scheduleId: string,
  options?: RunScheduledPostJobOptions,
): Promise<PostNowAsyncResult> {
  const jobPromise = runScheduledPostJob(admin, scheduleId, {
    ...options,
    skipPublishingTransition: true,
  });

  if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
    EdgeRuntime.waitUntil(jobPromise);
    return { ok: true, processing: true };
  }

  return await jobPromise;
}
