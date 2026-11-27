import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { isMissingRelationError, readAll } from "../shared/catalogQuery";
import { parseShotJob, type ShotJob } from "./shotData";
import type { PromptFields } from "./buildFlowPrompt";

/** The stored job document and its updated_at, kept so a save edits the latest copy. */
export interface StoredShotJob {
  document: Record<string, unknown>;
  updatedAt: string;
}

export interface ShotData {
  fields: PromptFields;
  jobs: ShotJob[];
  /** keyed by job external id */
  stored: Record<string, StoredShotJob>;
  /** New footage linked to a shot by the Agent: job external id → shot id (upper case) → clip count. */
  footage: Record<string, Record<string, number>>;
}

type MatchRow = { shot_job_id: string; shot_id: string };

/** Footage linked to shots (footage_shot_matches). Empty when the table is not deployed yet. */
async function readFootageLinks(org: string): Promise<MatchRow[]> {
  try {
    return await readAll<MatchRow>(supabase, "footage_shot_matches", "id,shot_job_id,shot_id,footage_assets!inner(id)", org);
  } catch (e) {
    if (isMissingRelationError(e)) return [];
    throw e;
  }
}

export function footageByShot(
  jobs: Array<{ id: string; external_id: string }>,
  links: MatchRow[],
): Record<string, Record<string, number>> {
  const ext = new Map(jobs.map((j) => [j.id, j.external_id]));
  const out: Record<string, Record<string, number>> = {};
  for (const l of links) {
    const e = ext.get(l.shot_job_id);
    if (!e) continue;
    const byShot = (out[e] ??= {});
    const k = l.shot_id.toUpperCase();
    byShot[k] = (byShot[k] ?? 0) + 1;
  }
  return out;
}

export const shotDataKey = (organizationId: string | null | undefined) =>
  ["content-studio", "shots", organizationId] as const;

export function useShotData() {
  const { organizationId } = useOrgBootstrapPending();
  return useQuery<ShotData>({
    queryKey: shotDataKey(organizationId),
    enabled: Boolean(organizationId),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const org = organizationId as string;
      const [fieldRows, jobRows, links] = await Promise.all([
        readAll<{ field_key: string; body: string; position: number }>(
          supabase,
          "catalog_prompt_fields",
          "id,field_key,body,position",
          org,
        ),
        readAll<{ id: string; external_id: string; document: Record<string, unknown>; created_at: string; updated_at: string }>(
          supabase,
          "catalog_shot_jobs",
          "id,external_id,document,created_at,updated_at",
          org,
        ),
        readFootageLinks(org),
      ]);
      const fields: PromptFields = {};
      for (const r of fieldRows.sort((a, b) => a.position - b.position)) fields[r.field_key] = r.body;
      const sorted = jobRows.sort((a, b) => a.created_at.localeCompare(b.created_at));
      const jobs = sorted.map((r) => parseShotJob(r.external_id, r.document));
      const stored: Record<string, StoredShotJob> = {};
      for (const r of sorted) stored[r.external_id] = { document: r.document, updatedAt: r.updated_at };
      return { fields, jobs, stored, footage: footageByShot(sorted, links) };
    },
  });
}
