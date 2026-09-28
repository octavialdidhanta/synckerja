import { supabase } from "@/shared/lib/supabaseClient";
import { normalizeBigThoughtLabel } from "@/thinking-lab/big-thought/label";
import { bigThoughtFingerprint } from "@/thinking-lab/shared/fingerprint";
import { LAB_WORKSPACE } from "@/thinking-lab/shared/verdict";
import { normalizeBigThoughtFacts } from "@/thinking-lab/big-thought/semantic";
import type { BigThoughtFacts, LabBigThought } from "@/thinking-lab/big-thought/types";

type BigThoughtRow = {
  id: string;
  organization_id: string;
  master_thought_id: string;
  code: string;
  title: string | null;
  statement: string;
  status: string;
  sort_order: number;
  canonical_semantic: unknown;
  semantic_fingerprint: string | null;
};

function mapBigThought(row: BigThoughtRow): LabBigThought {
  const status = row.status === "locked" || row.status === "rejected" ? row.status : "candidate";
  const facts =
    row.canonical_semantic && typeof row.canonical_semantic === "object"
      ? normalizeBigThoughtFacts(row.canonical_semantic, row.code)
      : null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    masterThoughtId: row.master_thought_id,
    code: row.code,
    statement: row.statement,
    label: normalizeBigThoughtLabel(row.title ?? ""),
    status,
    sortOrder: row.sort_order ?? 0,
    canonicalSemantic: facts ? { ...facts, code: row.code } : null,
    semanticFingerprint: row.semantic_fingerprint,
  };
}

export function activeBigThoughts(rows: LabBigThought[]): LabBigThought[] {
  return rows.filter((row) => row.status !== "rejected");
}

async function requireLabMaster(organizationId: string, masterThoughtId: string): Promise<void> {
  const { data, error } = await supabase
    .from("thinking_master_thoughts")
    .select("id")
    .eq("id", masterThoughtId)
    .eq("organization_id", organizationId)
    .eq("workspace", LAB_WORKSPACE)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("LAB_MASTER_NOT_FOUND");
}

export async function listLockedLabBigThoughts(organizationId: string): Promise<LabBigThought[]> {
  const { data: masters, error: masterError } = await supabase
    .from("thinking_master_thoughts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("workspace", LAB_WORKSPACE)
    .eq("mt_status", "locked");
  if (masterError) throw masterError;
  const masterIds = (masters ?? []).map((row) => row.id as string);
  if (masterIds.length === 0) return [];
  const { data, error } = await supabase
    .from("thinking_big_thoughts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "locked")
    .in("master_thought_id", masterIds)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as BigThoughtRow[]).map(mapBigThought);
}

export async function listLabBigThoughts(
  organizationId: string,
  masterThoughtId: string,
): Promise<LabBigThought[]> {
  await requireLabMaster(organizationId, masterThoughtId);
  const { data, error } = await supabase
    .from("thinking_big_thoughts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("master_thought_id", masterThoughtId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as BigThoughtRow[]).map(mapBigThought);
}

export async function insertLabBigThought(input: {
  organizationId: string;
  masterThoughtId: string;
  code: string;
  statement: string;
  label?: string;
  sortOrder: number;
  facts: BigThoughtFacts;
  masterFingerprint: string;
}): Promise<LabBigThought> {
  await requireLabMaster(input.organizationId, input.masterThoughtId);
  const fingerprint = bigThoughtFingerprint({
    statement: input.statement,
    masterThoughtFingerprint: input.masterFingerprint,
  });
  const facts = { ...input.facts, code: input.code };
  const { data, error } = await supabase
    .from("thinking_big_thoughts")
    .insert({
      organization_id: input.organizationId,
      master_thought_id: input.masterThoughtId,
      code: input.code,
      title: input.label?.trim() ?? "",
      statement: input.statement.trim(),
      core_belief: "",
      boundary: "",
      axis: "",
      meaning: "",
      ownership_label: "",
      ownership_statement: "",
      reason_slot_label: "",
      reason_slot_explanation: "",
      function_type: "",
      claim_type: "",
      sort_order: input.sortOrder,
      status: "candidate",
      canonical_semantic: facts,
      semantic_fingerprint: fingerprint,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapBigThought(data as BigThoughtRow);
}

export async function updateLabBigThoughtFacts(input: {
  id: string;
  organizationId: string;
  masterThoughtId: string;
  statement: string;
  label?: string;
  facts: BigThoughtFacts;
  masterFingerprint: string;
}): Promise<void> {
  await requireLabMaster(input.organizationId, input.masterThoughtId);
  const fingerprint = bigThoughtFingerprint({
    statement: input.statement,
    masterThoughtFingerprint: input.masterFingerprint,
  });
  const { error } = await supabase
    .from("thinking_big_thoughts")
    .update({
      statement: input.statement.trim(),
      ...(input.label !== undefined ? { title: input.label.trim() } : {}),
      canonical_semantic: input.facts,
      semantic_fingerprint: fingerprint,
    })
    .eq("id", input.id)
    .eq("organization_id", input.organizationId)
    .eq("master_thought_id", input.masterThoughtId)
    .eq("status", "candidate");
  if (error) throw error;
}

export async function updateLabBigThoughtLabels(input: {
  organizationId: string;
  masterThoughtId: string;
  labels: Array<{ id: string; label: string }>;
}): Promise<void> {
  await requireLabMaster(input.organizationId, input.masterThoughtId);
  for (const row of input.labels) {
    const label = normalizeBigThoughtLabel(row.label);
    if (!label) continue;
    const { error } = await supabase
      .from("thinking_big_thoughts")
      .update({ title: label })
      .eq("id", row.id)
      .eq("organization_id", input.organizationId)
      .eq("master_thought_id", input.masterThoughtId);
    if (error) throw error;
  }
}

export async function rejectLabBigThought(
  id: string,
  organizationId: string,
  masterThoughtId: string,
): Promise<void> {
  await requireLabMaster(organizationId, masterThoughtId);
  const { error } = await supabase
    .from("thinking_big_thoughts")
    .update({ status: "rejected" })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("master_thought_id", masterThoughtId);
  if (error) throw error;
}

export async function lockLabBigThoughts(
  ids: string[],
  organizationId: string,
  masterThoughtId: string,
): Promise<void> {
  await requireLabMaster(organizationId, masterThoughtId);
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("thinking_big_thoughts")
    .update({ status: "locked" })
    .in("id", ids)
    .eq("organization_id", organizationId)
    .eq("master_thought_id", masterThoughtId)
    .eq("status", "candidate");
  if (error) throw error;
}

export async function deleteLabBigThought(
  id: string,
  organizationId: string,
  masterThoughtId: string,
): Promise<void> {
  await requireLabMaster(organizationId, masterThoughtId);
  const { error } = await supabase
    .from("thinking_big_thoughts")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("master_thought_id", masterThoughtId);
  if (error) throw error;
}

export async function unlockLabBigThoughts(
  masterThoughtId: string,
  organizationId: string,
): Promise<void> {
  await requireLabMaster(organizationId, masterThoughtId);
  const { error } = await supabase
    .from("thinking_big_thoughts")
    .update({ status: "candidate" })
    .eq("master_thought_id", masterThoughtId)
    .eq("organization_id", organizationId)
    .eq("status", "locked");
  if (error) throw error;
}
