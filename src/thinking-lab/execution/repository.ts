import { supabase } from "@/shared/lib/supabaseClient";
import { admitExecution } from "@/thinking-lab/execution/policy";
import { normalizeExecutionFacts } from "@/thinking-lab/execution/semantic";
import { parseVoiceOverScript, type VoiceOverScript } from "@/thinking-lab/execution/script";
import { executionPillarLabel, type ExecutionSemanticFacts } from "@/thinking-lab/execution/types";
import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";

export type LabExecution = {
  id: string;
  organizationId: string;
  ideaId: string;
  pillar: string;
  contentPillarId: string | null;
  pillarName: string;
  statement: string;
  script: VoiceOverScript | null;
  canonicalSemantic: ExecutionSemanticFacts;
  admission: IndividualAdmission;
};

type ExecutionRow = {
  id: string;
  organization_id: string;
  idea_id: string;
  pillar: string;
  content_pillar_id?: string | null;
  pillar_name?: string | null;
  statement: string;
  script?: unknown;
  canonical_semantic: unknown;
  admission: string;
};

function asAdmission(value: string): IndividualAdmission {
  if (value === "GENERATE_VALID" || value === "GENERATE_REJECT" || value === "UNRESOLVED") return value;
  return "UNRESOLVED";
}

export function mapExecution(row: ExecutionRow): LabExecution | null {
  const pillar = row.pillar?.trim();
  if (!pillar) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    ideaId: row.idea_id,
    pillar,
    contentPillarId: row.content_pillar_id ?? null,
    pillarName: executionPillarLabel(pillar, row.pillar_name),
    statement: row.statement,
    script: parseVoiceOverScript(row.script),
    canonicalSemantic: normalizeExecutionFacts(row.canonical_semantic, row.pillar_name?.trim() || pillar),
    admission: asAdmission(row.admission),
  };
}

export async function listLabExecutions(organizationId: string, ideaId: string): Promise<LabExecution[]> {
  const { data, error } = await supabase
    .from("thinking_lab_executions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("idea_id", ideaId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as ExecutionRow[]).flatMap((row) => {
    const mapped = mapExecution(row);
    return mapped ? [mapped] : [];
  });
}

export async function saveLabExecution(input: {
  organizationId: string;
  ideaId: string;
  pillar: string;
  contentPillarId?: string | null;
  pillarName: string;
  statement: string;
  script?: VoiceOverScript | null;
  facts: ExecutionSemanticFacts;
}): Promise<LabExecution> {
  const pillar = input.pillar.trim();
  const statement = input.statement.trim();
  if (!pillar || !statement) throw new Error("UNRESOLVED");
  const { data: parent, error: parentError } = await supabase
    .from("thinking_lab_ideas")
    .select("id, status")
    .eq("id", input.ideaId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (parentError) throw parentError;
  if (!parent || (parent as { status?: string }).status !== "locked") throw new Error("PARENT_UNLOCKED");
  const admission = admitExecution(input.facts);
  const facts = { ...input.facts, pillar: input.pillarName.trim() || pillar };
  const contentPillarId = input.contentPillarId ?? null;
  let existingQuery = supabase
    .from("thinking_lab_executions")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("idea_id", input.ideaId);
  existingQuery = contentPillarId
    ? existingQuery.eq("content_pillar_id", contentPillarId)
    : existingQuery.eq("pillar", pillar);
  const { data: existing, error: existingError } = await existingQuery.maybeSingle();
  if (existingError) throw existingError;
  const payload = {
    pillar,
    content_pillar_id: contentPillarId,
    pillar_name: input.pillarName.trim() || pillar,
    statement,
    script: input.script ?? null,
    canonical_semantic: facts,
    admission,
  };
  if (existing && (existing as { id?: string }).id) {
    const { data, error } = await supabase
      .from("thinking_lab_executions")
      .update(payload)
      .eq("id", (existing as { id: string }).id)
      .eq("organization_id", input.organizationId)
      .select("*")
      .single();
    if (error) throw error;
    const mapped = mapExecution(data as ExecutionRow);
    if (!mapped) throw new Error("UNRESOLVED");
    return mapped;
  }
  const { data, error } = await supabase
    .from("thinking_lab_executions")
    .insert({
      organization_id: input.organizationId,
      idea_id: input.ideaId,
      ...payload,
    })
    .select("*")
    .single();
  if (error) throw error;
  const mapped = mapExecution(data as ExecutionRow);
  if (!mapped) throw new Error("UNRESOLVED");
  return mapped;
}

export async function updateLabExecutionScript(
  organizationId: string,
  id: string,
  script: VoiceOverScript,
): Promise<LabExecution> {
  const { data, error } = await supabase
    .from("thinking_lab_executions")
    .update({ script })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("*")
    .single();
  if (error) throw error;
  const mapped = mapExecution(data as ExecutionRow);
  if (!mapped) throw new Error("UNRESOLVED");
  return mapped;
}

export async function deleteLabExecution(organizationId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from("thinking_lab_executions")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (error) throw error;
}
