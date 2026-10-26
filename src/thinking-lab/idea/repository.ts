import { supabase } from "@/shared/lib/supabaseClient";
import type { AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import { LAB_WORKSPACE } from "@/thinking-lab/shared/verdict";
import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";
import { evaluateIdeaParent, type IdeaParentDenial } from "@/thinking-lab/idea/eligibility";
import { emptyIdeaSetRecord, readIdeaSetRecord, type IdeaSetRecord } from "@/thinking-lab/idea/setAudit";
import { normalizeIdeaFacts } from "@/thinking-lab/idea/semantic";
import type { IdeaSemanticFacts } from "@/thinking-lab/idea/types";
import { readDevelopmentPaths } from "@/thinking-lab/creative-idea/paths";
import type { DevelopmentPath } from "@/thinking-lab/creative-idea/types";
import { readIdeaValidation, withAuditHistory, type IdeaValidation } from "@/thinking-lab/idea/validation";
import { ideaFingerprint } from "@/thinking-lab/shared/fingerprint";

export type LabIdea = {
  id: string;
  organizationId: string;
  angleId: string;
  code: string;
  statement: string;
  sortOrder: number;
  parentAngleFingerprint: string;
  parentIdeaId: string | null;
  canonicalSemantic: IdeaSemanticFacts;
  validation: IdeaValidation | null;
  admission: IndividualAdmission;
  status: "candidate" | "locked";
  semanticFingerprint: string | null;
  createdAt: string | null;
  developmentPaths: DevelopmentPath[];
};

export type IdeaParentGate =
  | { ok: true; parent: { id: string; code: string; statement: string; angleFingerprint: string; ancestors: AncestorStake[] } }
  | { ok: false; reason: IdeaParentDenial };

type IdeaRow = {
  id: string;
  organization_id: string;
  angle_id: string;
  code: string;
  statement: string;
  sort_order: number;
  parent_angle_fingerprint: string;
  parent_idea_id?: string | null;
  canonical_semantic: unknown;
  validation?: unknown;
  admission: string;
  status?: string;
  semantic_fingerprint?: string | null;
  created_at?: string | null;
  development_paths?: unknown;
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

type TerritoryJoin = {
  id: string;
  statement: string;
  status: string;
  semantic_fingerprint: string | null;
  big_thought_id: string;
  thinking_big_thoughts: BigThoughtJoin | BigThoughtJoin[] | null;
};

type AngleJoinRow = {
  id: string;
  code: string;
  statement: string;
  status: string;
  semantic_fingerprint: string | null;
  territory_id: string;
  thinking_lab_territories: TerritoryJoin | TerritoryJoin[] | null;
};

function asAdmission(value: string): IndividualAdmission {
  if (value === "GENERATE_VALID" || value === "GENERATE_REJECT" || value === "UNRESOLVED") return value;
  return "UNRESOLVED";
}

function mapIdea(row: IdeaRow): LabIdea {
  return {
    id: row.id,
    organizationId: row.organization_id,
    angleId: row.angle_id,
    code: row.code,
    statement: row.statement,
    sortOrder: row.sort_order ?? 0,
    parentAngleFingerprint: row.parent_angle_fingerprint,
    parentIdeaId: row.parent_idea_id ?? null,
    canonicalSemantic: normalizeIdeaFacts(row.canonical_semantic, row.code),
    validation: readIdeaValidation(row.validation),
    admission: asAdmission(row.admission),
    status: row.status === "locked" ? "locked" : "candidate",
    semanticFingerprint: row.semantic_fingerprint ?? null,
    createdAt: row.created_at ?? null,
    developmentPaths: readDevelopmentPaths(row.development_paths),
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

export async function loadIdeaParentGate(input: {
  organizationId: string;
  angleId: string;
  masterThoughtFingerprint: string | null;
  expectedTerritoryId?: string;
}): Promise<IdeaParentGate> {
  const { data, error } = await supabase
    .from("thinking_lab_angles")
    .select(
      "id, code, statement, status, semantic_fingerprint, territory_id, thinking_lab_territories!thinking_lab_angles_territory_same_org_fkey!inner(id, statement, status, semantic_fingerprint, big_thought_id, thinking_big_thoughts!thinking_lab_territories_big_thought_same_org_fkey!inner(id, statement, status, semantic_fingerprint, thinking_master_thoughts!thinking_big_thoughts_master_same_org_fkey!inner(workspace, statement, original_input)))",
    )
    .eq("id", input.angleId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (error) throw error;
  const row = data as AngleJoinRow | null;
  const territory = one(row?.thinking_lab_territories ?? null);
  const bigThought = one(territory?.thinking_big_thoughts ?? null);
  if (!row || !territory || labWorkspace(bigThought) !== LAB_WORKSPACE) return { ok: false, reason: "PARENT_MISSING" };
  const gate = evaluateIdeaParent({
    angle: {
      id: row.id,
      status: row.status,
      statement: row.statement,
      semanticFingerprint: row.semantic_fingerprint,
      territoryId: row.territory_id,
    },
    territory: {
      id: territory.id,
      status: territory.status,
      statement: territory.statement,
      semanticFingerprint: territory.semantic_fingerprint,
      bigThoughtId: territory.big_thought_id,
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
    expectedAngleId: input.angleId,
    expectedTerritoryId: input.expectedTerritoryId,
  });
  if (gate.ok === false) return gate;
  return {
    ok: true,
    parent: {
      id: row.id,
      code: row.code,
      statement: row.statement,
      angleFingerprint: gate.angleFingerprint,
      ancestors: [
        ...(territory.statement.trim() ? [{ label: "Territory", statement: territory.statement.trim() }] : []),
        ...(bigThought?.statement.trim() ? [{ label: "Big Thought", statement: bigThought.statement.trim() }] : []),
        ...((masterOf(bigThought)?.statement || masterOf(bigThought)?.original_input || "").trim()
          ? [
              {
                label: "Master Thought",
                statement: (masterOf(bigThought)?.statement || masterOf(bigThought)?.original_input || "").trim(),
              },
            ]
          : []),
      ],
    },
  };
}

export async function listLabIdeas(organizationId: string, angleIds: string[]): Promise<LabIdea[]> {
  if (angleIds.length === 0) return [];
  const { data, error } = await supabase
    .from("thinking_lab_ideas")
    .select("*")
    .eq("organization_id", organizationId)
    .in("angle_id", angleIds)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as IdeaRow[]).map(mapIdea);
}

export async function listIdeaFailureMemory(organizationId: string, angleId: string): Promise<LabIdea[]> {
  const { data: angle, error } = await supabase
    .from("thinking_lab_angles")
    .select("territory_id")
    .eq("id", angleId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw error;
  const territoryId = (angle as { territory_id?: string } | null)?.territory_id;
  if (!territoryId) return [];
  const { data: angles, error: angleError } = await supabase
    .from("thinking_lab_angles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("territory_id", territoryId);
  if (angleError) throw angleError;
  const ids = ((angles ?? []) as Array<{ id: string }>).map((row) => row.id);
  if (ids.length === 0) return [];
  const { data, error: ideaError } = await supabase
    .from("thinking_lab_ideas")
    .select("*")
    .eq("organization_id", organizationId)
    .in("angle_id", ids)
    .order("created_at", { ascending: false });
  if (ideaError) throw ideaError;
  return ((data ?? []) as IdeaRow[]).map(mapIdea);
}

export async function loadIdeaComparisonHistory(
  organizationId: string,
  angleId: string,
): Promise<{ historyAvailable: boolean; ideas: LabIdea[] }> {
  try {
    return { historyAvailable: true, ideas: await listIdeaFailureMemory(organizationId, angleId) };
  } catch {
    return { historyAvailable: false, ideas: [] };
  }
}

async function validationWithHistory(input: {
  organizationId: string;
  angleId: string;
  id: string;
  validation: IdeaValidation;
  statement?: string;
}): Promise<IdeaValidation> {
  const { data, error } = await supabase
    .from("thinking_lab_ideas")
    .select("validation, statement")
    .eq("id", input.id)
    .eq("organization_id", input.organizationId)
    .eq("angle_id", input.angleId)
    .maybeSingle();
  if (error) throw error;
  const row = data as { validation?: unknown; statement?: string } | null;
  const previous = readIdeaValidation(row?.validation);
  const statement = input.validation.statement || input.statement || row?.statement || "";
  return withAuditHistory(previous, { ...input.validation, statement });
}

export async function saveIdeaValidation(input: {
  organizationId: string;
  angleId: string;
  id: string;
  validation: IdeaValidation;
  admission: IndividualAdmission;
}): Promise<void> {
  const validation = await validationWithHistory(input);
  const { error } = await supabase
    .from("thinking_lab_ideas")
    .update({
      validation,
      admission: input.admission,
    })
    .eq("id", input.id)
    .eq("organization_id", input.organizationId)
    .eq("angle_id", input.angleId);
  if (error) throw error;
}

export async function insertLabIdea(input: {
  organizationId: string;
  angleId: string;
  expectedTerritoryId?: string;
  masterThoughtFingerprint: string | null;
  code: string;
  statement: string;
  sortOrder: number;
  facts: IdeaSemanticFacts;
  admission: IndividualAdmission;
  validation?: IdeaValidation | null;
  parentIdeaId?: string | null;
}): Promise<LabIdea> {
  const gate = await loadIdeaParentGate({
    organizationId: input.organizationId,
    angleId: input.angleId,
    masterThoughtFingerprint: input.masterThoughtFingerprint,
    expectedTerritoryId: input.expectedTerritoryId,
  });
  if (gate.ok === false) throw new Error(gate.reason);
  if (input.admission !== "GENERATE_VALID" && input.admission !== "GENERATE_REJECT" && input.admission !== "UNRESOLVED") {
    throw new Error("UNRESOLVED");
  }
  const facts = { ...input.facts, code: input.code };
  const { data, error } = await supabase
    .from("thinking_lab_ideas")
    .insert({
      organization_id: input.organizationId,
      angle_id: gate.parent.id,
      code: input.code,
      statement: input.statement.trim(),
      sort_order: input.sortOrder,
      parent_angle_fingerprint: gate.parent.angleFingerprint,
      canonical_semantic: facts,
      admission: input.admission,
      status: "candidate",
      semantic_fingerprint: null,
      parent_idea_id: input.parentIdeaId ?? null,
      validation: input.validation ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapIdea(data as IdeaRow);
}

export async function replaceLabIdea(input: {
  organizationId: string;
  angleId: string;
  id: string;
  statement: string;
  facts: IdeaSemanticFacts;
  admission: IndividualAdmission;
  validation?: IdeaValidation | null;
}): Promise<void> {
  const validation =
    input.validation === undefined
      ? undefined
      : await validationWithHistory({ ...input, statement: input.statement });
  const { error } = await supabase
    .from("thinking_lab_ideas")
    .update({
      statement: input.statement.trim(),
      canonical_semantic: { ...input.facts, code: input.facts.code },
      admission: input.admission,
      status: "candidate",
      semantic_fingerprint: null,
      ...(validation !== undefined ? { validation } : {}),
    })
    .eq("id", input.id)
    .eq("organization_id", input.organizationId)
    .eq("angle_id", input.angleId)
    .eq("status", "candidate");
  if (error) throw error;
}

export async function loadIdeaSet(organizationId: string, angleId: string): Promise<IdeaSetRecord> {
  const { data, error } = await supabase
    .from("thinking_lab_angles")
    .select("idea_set")
    .eq("id", angleId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw error;
  return readIdeaSetRecord((data as { idea_set?: unknown } | null)?.idea_set);
}

export async function saveIdeaSet(input: {
  organizationId: string;
  angleId: string;
  record: IdeaSetRecord;
}): Promise<void> {
  const { error } = await supabase
    .from("thinking_lab_angles")
    .update({ idea_set: input.record })
    .eq("id", input.angleId)
    .eq("organization_id", input.organizationId);
  if (error) throw error;
}

export async function deleteLabIdea(input: {
  organizationId: string;
  angleId: string;
  id: string;
}): Promise<void> {
  const { error } = await supabase
    .from("thinking_lab_ideas")
    .delete()
    .eq("id", input.id)
    .eq("organization_id", input.organizationId)
    .eq("angle_id", input.angleId);
  if (error) throw error;
}

export async function lockLabIdeas(input: {
  organizationId: string;
  angleId: string;
  angleFingerprint: string;
  ids: string[];
}): Promise<void> {
  if (input.ids.length === 0) return;
  const { data, error } = await supabase
    .from("thinking_lab_ideas")
    .select("id, statement")
    .eq("organization_id", input.organizationId)
    .eq("angle_id", input.angleId)
    .in("id", input.ids);
  if (error) throw error;
  for (const row of (data ?? []) as Array<{ id: string; statement: string }>) {
    const { error: updateError } = await supabase
      .from("thinking_lab_ideas")
      .update({
        status: "locked",
        semantic_fingerprint: ideaFingerprint({
          statement: row.statement,
          angleFingerprint: input.angleFingerprint,
        }),
      })
      .eq("id", row.id)
      .eq("organization_id", input.organizationId)
      .eq("angle_id", input.angleId);
    if (updateError) throw updateError;
  }
}

export { emptyIdeaSetRecord };
