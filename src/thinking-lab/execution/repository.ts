import { supabase } from "@/shared/lib/supabaseClient";
import { admitExecution } from "@/thinking-lab/execution/policy";
import { normalizeExecutionFacts } from "@/thinking-lab/execution/semantic";
import { isExecutionPillar, type ExecutionPillar, type ExecutionSemanticFacts } from "@/thinking-lab/execution/types";
import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";

export type LabExecution = {
  id: string;
  organizationId: string;
  ideaId: string;
  pillar: ExecutionPillar;
  statement: string;
  canonicalSemantic: ExecutionSemanticFacts;
  admission: IndividualAdmission;
};

type ExecutionRow = {
  id: string;
  organization_id: string;
  idea_id: string;
  pillar: string;
  statement: string;
  canonical_semantic: unknown;
  admission: string;
};

function asAdmission(value: string): IndividualAdmission {
  if (value === "GENERATE_VALID" || value === "GENERATE_REJECT" || value === "UNRESOLVED") return value;
  return "UNRESOLVED";
}

function mapExecution(row: ExecutionRow): LabExecution | null {
  if (!isExecutionPillar(row.pillar)) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    ideaId: row.idea_id,
    pillar: row.pillar,
    statement: row.statement,
    canonicalSemantic: normalizeExecutionFacts(row.canonical_semantic, row.pillar),
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
  pillar: ExecutionPillar;
  statement: string;
  facts: ExecutionSemanticFacts;
}): Promise<LabExecution> {
  const { data: parent, error: parentError } = await supabase
    .from("thinking_lab_ideas")
    .select("id, status")
    .eq("id", input.ideaId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (parentError) throw parentError;
  if (!parent || (parent as { status?: string }).status !== "locked") throw new Error("PARENT_UNLOCKED");
  const admission = admitExecution(input.facts);
  const facts = { ...input.facts, pillar: input.pillar };
  const { data: existing, error: existingError } = await supabase
    .from("thinking_lab_executions")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("idea_id", input.ideaId)
    .eq("pillar", input.pillar)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing && (existing as { id?: string }).id) {
    const { data, error } = await supabase
      .from("thinking_lab_executions")
      .update({
        statement: input.statement.trim(),
        canonical_semantic: facts,
        admission,
      })
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
      pillar: input.pillar,
      statement: input.statement.trim(),
      canonical_semantic: facts,
      admission,
    })
    .select("*")
    .single();
  if (error) throw error;
  const mapped = mapExecution(data as ExecutionRow);
  if (!mapped) throw new Error("UNRESOLVED");
  return mapped;
}
