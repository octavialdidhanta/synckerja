import { supabase } from "@/shared/lib/supabaseClient";
import type { AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import { angleFingerprint } from "@/thinking-lab/shared/fingerprint";
import { LAB_WORKSPACE } from "@/thinking-lab/shared/verdict";
import { emptyAngleSetRecord, readAngleSetRecord, type AngleSetRecord } from "@/thinking-lab/angle/setAudit";
import { readIdeaSetRecord, type IdeaSetRecord } from "@/thinking-lab/idea/setAudit";
import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";
import { evaluateAngleParent, type AngleParentDenial } from "@/thinking-lab/angle/eligibility";
import { normalizeAngleFacts } from "@/thinking-lab/angle/semantic";
import type { AngleSemanticFacts } from "@/thinking-lab/angle/types";

export type LabAngle = {
  id: string;
  organizationId: string;
  territoryId: string;
  code: string;
  statement: string;
  sortOrder: number;
  parentTerritoryFingerprint: string;
  canonicalSemantic: AngleSemanticFacts;
  admission: IndividualAdmission;
  status: "candidate" | "locked";
  semanticFingerprint: string | null;
  ideaSet: IdeaSetRecord;
};

export type AngleParentGate =
  | {
      ok: true;
      parent: { id: string; code: string; statement: string; territoryFingerprint: string; ancestors: AncestorStake[] };
    }
  | { ok: false; reason: AngleParentDenial };

type AngleRow = {
  id: string;
  organization_id: string;
  territory_id: string;
  code: string;
  statement: string;
  sort_order: number;
  parent_territory_fingerprint: string;
  canonical_semantic: unknown;
  admission: string;
  status?: string;
  semantic_fingerprint?: string | null;
  idea_set?: unknown;
};

type BigThoughtJoin = {
  id: string;
  statement: string;
  status: string;
  semantic_fingerprint: string | null;
  thinking_master_thoughts:
    | { workspace: string; statement?: string | null; original_input?: string | null }
    | { workspace: string; statement?: string | null; original_input?: string | null }[]
    | null;
};

type TerritoryJoinRow = {
  id: string;
  code: string;
  statement: string;
  status: string;
  semantic_fingerprint: string | null;
  big_thought_id: string;
  thinking_big_thoughts: BigThoughtJoin | BigThoughtJoin[] | null;
};

function asAdmission(value: string): IndividualAdmission {
  if (value === "GENERATE_VALID" || value === "GENERATE_REJECT" || value === "UNRESOLVED") return value;
  return "UNRESOLVED";
}

function mapAngle(row: AngleRow): LabAngle {
  return {
    id: row.id,
    organizationId: row.organization_id,
    territoryId: row.territory_id,
    code: row.code,
    statement: row.statement,
    sortOrder: row.sort_order ?? 0,
    parentTerritoryFingerprint: row.parent_territory_fingerprint,
    canonicalSemantic: normalizeAngleFacts(row.canonical_semantic, row.code),
    admission: asAdmission(row.admission),
    status: row.status === "locked" ? "locked" : "candidate",
    semanticFingerprint: row.semantic_fingerprint ?? null,
    ideaSet: readIdeaSetRecord(row.idea_set),
  };
}

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function masterOf(bigThought: BigThoughtJoin | null) {
  if (!bigThought) return null;
  const joined = bigThought.thinking_master_thoughts;
  if (!joined) return null;
  return Array.isArray(joined) ? (joined[0] ?? null) : joined;
}

function labWorkspace(bigThought: BigThoughtJoin | null): string | null {
  return masterOf(bigThought)?.workspace ?? null;
}

function ancestorStakes(bigThought: BigThoughtJoin | null): AncestorStake[] {
  const master = masterOf(bigThought);
  const masterStatement = (master?.statement || master?.original_input || "").trim();
  const stakes: AncestorStake[] = [];
  if (bigThought?.statement.trim()) stakes.push({ label: "Big Thought", statement: bigThought.statement.trim() });
  if (masterStatement) stakes.push({ label: "Master Thought", statement: masterStatement });
  return stakes;
}

export async function loadAngleParentGate(input: {
  organizationId: string;
  territoryId: string;
  masterThoughtFingerprint: string | null;
  expectedBigThoughtId?: string;
}): Promise<AngleParentGate> {
  const { data, error } = await supabase
    .from("thinking_lab_territories")
    .select(
      "id, code, statement, status, semantic_fingerprint, big_thought_id, thinking_big_thoughts!thinking_lab_territories_big_thought_same_org_fkey!inner(id, statement, status, semantic_fingerprint, thinking_master_thoughts!thinking_big_thoughts_master_same_org_fkey!inner(workspace, statement, original_input))",
    )
    .eq("id", input.territoryId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (error) throw error;
  const row = data as TerritoryJoinRow | null;
  const bigThought = one(row?.thinking_big_thoughts ?? null);
  if (!row || labWorkspace(bigThought) !== LAB_WORKSPACE) return { ok: false, reason: "PARENT_MISSING" };
  const gate = evaluateAngleParent({
    territory: {
      id: row.id,
      status: row.status,
      statement: row.statement,
      semanticFingerprint: row.semantic_fingerprint,
      bigThoughtId: row.big_thought_id,
    },
    bigThought: bigThought
      ? {
          id: bigThought.id,
          status: bigThought.status,
          statement: bigThought.statement,
          semanticFingerprint: bigThought.semantic_fingerprint,
        }
      : null,
    masterThoughtFingerprint: input.masterThoughtFingerprint,
    expectedTerritoryId: input.territoryId,
    expectedBigThoughtId: input.expectedBigThoughtId,
  });
  if (gate.ok === false) return gate;
  return {
    ok: true,
    parent: {
      id: row.id,
      code: row.code,
      statement: row.statement,
      territoryFingerprint: gate.territoryFingerprint,
      ancestors: ancestorStakes(bigThought),
    },
  };
}

export async function listLabAngles(organizationId: string, territoryIds: string[]): Promise<LabAngle[]> {
  if (territoryIds.length === 0) return [];
  const { data, error } = await supabase
    .from("thinking_lab_angles")
    .select("*")
    .eq("organization_id", organizationId)
    .in("territory_id", territoryIds)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as AngleRow[]).map(mapAngle);
}

export async function insertLabAngle(input: {
  organizationId: string;
  territoryId: string;
  expectedBigThoughtId?: string;
  masterThoughtFingerprint: string | null;
  code: string;
  statement: string;
  sortOrder: number;
  facts: AngleSemanticFacts;
  admission: IndividualAdmission;
}): Promise<LabAngle> {
  const gate = await loadAngleParentGate({
    organizationId: input.organizationId,
    territoryId: input.territoryId,
    masterThoughtFingerprint: input.masterThoughtFingerprint,
    expectedBigThoughtId: input.expectedBigThoughtId,
  });
  if (gate.ok === false) throw new Error(gate.reason);
  if (input.admission !== "GENERATE_VALID" && input.admission !== "GENERATE_REJECT" && input.admission !== "UNRESOLVED") {
    throw new Error("UNRESOLVED");
  }
  const facts = { ...input.facts, code: input.code };
  const { data, error } = await supabase
    .from("thinking_lab_angles")
    .insert({
      organization_id: input.organizationId,
      territory_id: gate.parent.id,
      code: input.code,
      statement: input.statement.trim(),
      sort_order: input.sortOrder,
      parent_territory_fingerprint: gate.parent.territoryFingerprint,
      canonical_semantic: facts,
      admission: input.admission,
      status: "candidate",
      semantic_fingerprint: null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapAngle(data as AngleRow);
}

export async function loadAngleSet(organizationId: string, territoryId: string): Promise<AngleSetRecord> {
  const { data, error } = await supabase
    .from("thinking_lab_territories")
    .select("angle_set")
    .eq("id", territoryId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw error;
  return readAngleSetRecord((data as { angle_set?: unknown } | null)?.angle_set);
}

export async function saveAngleSet(input: {
  organizationId: string;
  territoryId: string;
  record: AngleSetRecord;
}): Promise<void> {
  const { error } = await supabase
    .from("thinking_lab_territories")
    .update({ angle_set: input.record })
    .eq("id", input.territoryId)
    .eq("organization_id", input.organizationId);
  if (error) throw error;
}

export async function lockLabAngles(input: {
  organizationId: string;
  territoryId: string;
  territoryFingerprint: string;
  ids: string[];
}): Promise<void> {
  if (input.ids.length === 0) return;
  const { data, error } = await supabase
    .from("thinking_lab_angles")
    .select("id, statement")
    .eq("organization_id", input.organizationId)
    .eq("territory_id", input.territoryId)
    .in("id", input.ids);
  if (error) throw error;
  for (const row of (data ?? []) as Array<{ id: string; statement: string }>) {
    const { error: updateError } = await supabase
      .from("thinking_lab_angles")
      .update({
        status: "locked",
        semantic_fingerprint: angleFingerprint({
          statement: row.statement,
          territoryFingerprint: input.territoryFingerprint,
        }),
      })
      .eq("id", row.id)
      .eq("organization_id", input.organizationId)
      .eq("territory_id", input.territoryId);
    if (updateError) throw updateError;
  }
}

export async function replaceLabAngle(input: {
  organizationId: string;
  territoryId: string;
  id: string;
  statement: string;
  facts: AngleSemanticFacts;
  admission: IndividualAdmission;
}): Promise<void> {
  const { error } = await supabase
    .from("thinking_lab_angles")
    .update({
      statement: input.statement.trim(),
      canonical_semantic: { ...input.facts, code: input.facts.code },
      admission: input.admission,
      status: "candidate",
      semantic_fingerprint: null,
    })
    .eq("id", input.id)
    .eq("organization_id", input.organizationId)
    .eq("territory_id", input.territoryId)
    .eq("status", "candidate");
  if (error) throw error;
}

export { emptyAngleSetRecord };
