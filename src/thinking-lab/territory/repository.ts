import { supabase } from "@/shared/lib/supabaseClient";
import type { AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import { territoryFingerprint } from "@/thinking-lab/shared/fingerprint";
import { LAB_WORKSPACE } from "@/thinking-lab/shared/verdict";
import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";
import { evaluateTerritoryParent, type TerritoryParentDenial } from "@/thinking-lab/territory/eligibility";
import { normalizeTerritoryFacts } from "@/thinking-lab/territory/semantic";
import { emptyTerritorySetRecord, readTerritorySetRecord, type TerritorySetRecord } from "@/thinking-lab/territory/setAudit";
import type { TerritorySemanticFacts } from "@/thinking-lab/territory/types";

export type LabTerritory = {
  id: string;
  organizationId: string;
  bigThoughtId: string;
  code: string;
  statement: string;
  sortOrder: number;
  canonicalSemantic: TerritorySemanticFacts;
  admission: IndividualAdmission;
  status: "candidate" | "locked";
  semanticFingerprint: string | null;
};

export type TerritoryParentGate =
  | {
      ok: true;
      parent: { id: string; code: string; statement: string; ancestors: AncestorStake[]; audience: string };
    }
  | { ok: false; reason: TerritoryParentDenial };

type TerritoryRow = {
  id: string;
  organization_id: string;
  big_thought_id: string;
  code: string;
  statement: string;
  sort_order: number;
  canonical_semantic: unknown;
  admission: string;
  status?: string;
  semantic_fingerprint?: string | null;
};

type ParentJoinRow = {
  id: string;
  code: string;
  statement: string;
  status: string;
  semantic_fingerprint: string | null;
  thinking_master_thoughts:
    | { workspace: string; statement?: string | null; original_input?: string | null; audience?: string | null }
    | { workspace: string; statement?: string | null; original_input?: string | null; audience?: string | null }[]
    | null;
};

function asAdmission(value: string): IndividualAdmission {
  if (value === "GENERATE_VALID" || value === "GENERATE_REJECT" || value === "UNRESOLVED") return value;
  return "UNRESOLVED";
}

function mapTerritory(row: TerritoryRow): LabTerritory {
  return {
    id: row.id,
    organizationId: row.organization_id,
    bigThoughtId: row.big_thought_id,
    code: row.code,
    statement: row.statement,
    sortOrder: row.sort_order ?? 0,
    canonicalSemantic: normalizeTerritoryFacts(row.canonical_semantic, row.code),
    admission: asAdmission(row.admission),
    status: row.status === "locked" ? "locked" : "candidate",
    semanticFingerprint: row.semantic_fingerprint ?? null,
  };
}

function masterJoin(row: ParentJoinRow) {
  const joined = row.thinking_master_thoughts;
  if (!joined) return null;
  return Array.isArray(joined) ? (joined[0] ?? null) : joined;
}

function labWorkspace(row: ParentJoinRow): string | null {
  return masterJoin(row)?.workspace ?? null;
}

export async function loadTerritoryParentGate(input: {
  organizationId: string;
  bigThoughtId: string;
  masterThoughtFingerprint: string | null;
}): Promise<TerritoryParentGate> {
  const { data, error } = await supabase
    .from("thinking_big_thoughts")
    .select(
      "id, code, statement, status, semantic_fingerprint, thinking_master_thoughts!thinking_big_thoughts_master_same_org_fkey!inner(workspace, statement, original_input, audience)",
    )
    .eq("id", input.bigThoughtId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (error) throw error;
  const row = data as ParentJoinRow | null;
  if (!row || labWorkspace(row) !== LAB_WORKSPACE) return { ok: false, reason: "PARENT_MISSING" };
  const gate = evaluateTerritoryParent(
    {
      status: row.status,
      statement: row.statement,
      semanticFingerprint: row.semantic_fingerprint,
    },
    input.masterThoughtFingerprint,
  );
  if (gate.ok === false) return gate;
  const master = masterJoin(row);
  const masterStatement = (master?.statement || master?.original_input || "").trim();
  return {
    ok: true,
    parent: {
      id: row.id,
      code: row.code,
      statement: row.statement,
      ancestors: masterStatement ? [{ label: "Master Thought", statement: masterStatement }] : [],
      audience: (master?.audience ?? "").trim(),
    },
  };
}

export async function listLabTerritories(organizationId: string, bigThoughtIds: string[]): Promise<LabTerritory[]> {
  if (bigThoughtIds.length === 0) return [];
  const { data, error } = await supabase
    .from("thinking_lab_territories")
    .select("*")
    .eq("organization_id", organizationId)
    .in("big_thought_id", bigThoughtIds)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as TerritoryRow[]).map(mapTerritory);
}

export async function insertLabTerritory(input: {
  organizationId: string;
  bigThoughtId: string;
  masterThoughtFingerprint: string | null;
  code: string;
  statement: string;
  sortOrder: number;
  facts: TerritorySemanticFacts;
  admission: IndividualAdmission;
}): Promise<LabTerritory> {
  const gate = await loadTerritoryParentGate({
    organizationId: input.organizationId,
    bigThoughtId: input.bigThoughtId,
    masterThoughtFingerprint: input.masterThoughtFingerprint,
  });
  if (gate.ok === false) throw new Error(gate.reason);
  if (input.admission !== "GENERATE_VALID" && input.admission !== "GENERATE_REJECT" && input.admission !== "UNRESOLVED") {
    throw new Error("UNRESOLVED");
  }
  const facts = { ...input.facts, code: input.code };
  const { data, error } = await supabase
    .from("thinking_lab_territories")
    .insert({
      organization_id: input.organizationId,
      big_thought_id: gate.parent.id,
      code: input.code,
      statement: input.statement.trim(),
      sort_order: input.sortOrder,
      canonical_semantic: facts,
      admission: input.admission,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapTerritory(data as TerritoryRow);
}

export async function loadTerritorySet(organizationId: string, bigThoughtId: string): Promise<TerritorySetRecord> {
  const { data, error } = await supabase
    .from("thinking_big_thoughts")
    .select("territory_set")
    .eq("id", bigThoughtId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw error;
  return readTerritorySetRecord((data as { territory_set?: unknown } | null)?.territory_set);
}

export async function saveTerritorySet(input: {
  organizationId: string;
  bigThoughtId: string;
  record: TerritorySetRecord;
}): Promise<void> {
  const { error } = await supabase
    .from("thinking_big_thoughts")
    .update({ territory_set: input.record })
    .eq("id", input.bigThoughtId)
    .eq("organization_id", input.organizationId);
  if (error) throw error;
}

export async function lockLabTerritories(input: {
  organizationId: string;
  bigThoughtId: string;
  bigThoughtFingerprint: string;
  ids: string[];
}): Promise<void> {
  if (input.ids.length === 0) return;
  const { data, error } = await supabase
    .from("thinking_lab_territories")
    .select("id, statement")
    .eq("organization_id", input.organizationId)
    .eq("big_thought_id", input.bigThoughtId)
    .in("id", input.ids);
  if (error) throw error;
  for (const row of (data ?? []) as Array<{ id: string; statement: string }>) {
    const { error: updateError } = await supabase
      .from("thinking_lab_territories")
      .update({
        status: "locked",
        semantic_fingerprint: territoryFingerprint({
          statement: row.statement,
          bigThoughtFingerprint: input.bigThoughtFingerprint,
        }),
      })
      .eq("id", row.id)
      .eq("organization_id", input.organizationId)
      .eq("big_thought_id", input.bigThoughtId);
    if (updateError) throw updateError;
  }
}

export async function deleteLabTerritory(input: {
  organizationId: string;
  bigThoughtId: string;
  id: string;
}): Promise<void> {
  const { error } = await supabase
    .from("thinking_lab_territories")
    .delete()
    .eq("id", input.id)
    .eq("organization_id", input.organizationId)
    .eq("big_thought_id", input.bigThoughtId);
  if (error) throw error;
}

export async function replaceLabTerritory(input: {
  organizationId: string;
  bigThoughtId: string;
  id: string;
  statement: string;
  facts: TerritorySemanticFacts;
  admission: IndividualAdmission;
}): Promise<void> {
  const { error } = await supabase
    .from("thinking_lab_territories")
    .update({
      statement: input.statement.trim(),
      canonical_semantic: { ...input.facts, code: input.facts.code },
      admission: input.admission,
      status: "candidate",
      semantic_fingerprint: null,
    })
    .eq("id", input.id)
    .eq("organization_id", input.organizationId)
    .eq("big_thought_id", input.bigThoughtId)
    .eq("status", "candidate");
  if (error) throw error;
}

export { emptyTerritorySetRecord };
