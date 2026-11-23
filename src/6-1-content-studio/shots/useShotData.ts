import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { readAll } from "../shared/catalogQuery";
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
      const [fieldRows, jobRows] = await Promise.all([
        readAll<{ field_key: string; body: string; position: number }>(
          supabase,
          "catalog_prompt_fields",
          "id,field_key,body,position",
          org,
        ),
        readAll<{ external_id: string; document: Record<string, unknown>; created_at: string; updated_at: string }>(
          supabase,
          "catalog_shot_jobs",
          "id,external_id,document,created_at,updated_at",
          org,
        ),
      ]);
      const fields: PromptFields = {};
      for (const r of fieldRows.sort((a, b) => a.position - b.position)) fields[r.field_key] = r.body;
      const sorted = jobRows.sort((a, b) => a.created_at.localeCompare(b.created_at));
      const jobs = sorted.map((r) => parseShotJob(r.external_id, r.document));
      const stored: Record<string, StoredShotJob> = {};
      for (const r of sorted) stored[r.external_id] = { document: r.document, updatedAt: r.updated_at };
      return { fields, jobs, stored };
    },
  });
}
