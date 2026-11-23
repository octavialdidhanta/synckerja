import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { parseShotJob } from "./shotData";
import type { ShotDoc } from "./shotDocument";
import { shotDataKey, type ShotData } from "./useShotData";

export type ShotSaveStatus = "idle" | "saving" | "saved" | "error" | "conflict";

// catalog_shot_jobs is newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseClient = any;

/**
 * Saves edits to catalog_shot_jobs.document, one job at a time and in order.
 * Each edit is applied to the latest stored copy. The update only lands when
 * updated_at still matches, so a change made elsewhere (Claude through MCP,
 * another tab) is never overwritten: the list reloads and the edit is reported.
 */
export function useShotSave() {
  const qc = useQueryClient();
  const { organizationId } = useOrgBootstrapPending();
  const queues = useRef(new Map<string, Promise<unknown>>());
  const [status, setStatus] = useState<ShotSaveStatus>("idle");

  const saveJob = useCallback(
    <T = void>(jobId: string, edit: (doc: ShotDoc) => { doc: ShotDoc; result?: T }): Promise<T | undefined> => {
      const org = organizationId;
      const key = shotDataKey(org);
      const run = async (): Promise<T | undefined> => {
        const cur = qc.getQueryData<ShotData>(key)?.stored[jobId];
        if (!org || !cur) throw new Error("job_not_loaded");
        const { doc, result } = edit(cur.document);
        const next: ShotDoc = { ...doc, saved_at: Date.now() };
        setStatus("saving");
        const { data, error } = await (supabase as LooseClient)
          .from("catalog_shot_jobs")
          .update({ document: next })
          .eq("organization_id", org)
          .eq("external_id", jobId)
          .eq("updated_at", cur.updatedAt)
          .select("document,updated_at");
        if (error) {
          setStatus("error");
          throw error;
        }
        const row = (data ?? [])[0] as { document: ShotDoc; updated_at: string } | undefined;
        if (!row) {
          setStatus("conflict");
          await qc.invalidateQueries({ queryKey: key });
          throw new Error("changed_elsewhere");
        }
        qc.setQueryData<ShotData>(key, (old) =>
          old
            ? {
                ...old,
                jobs: old.jobs.map((j) => (j.id === jobId ? parseShotJob(jobId, row.document) : j)),
                stored: { ...old.stored, [jobId]: { document: row.document, updatedAt: row.updated_at } },
              }
            : old,
        );
        setStatus("saved");
        return result;
      };
      const prev = queues.current.get(jobId) ?? Promise.resolve();
      const task = prev.catch(() => undefined).then(run);
      queues.current.set(jobId, task);
      return task;
    },
    [qc, organizationId],
  );

  return { saveJob, status };
}
