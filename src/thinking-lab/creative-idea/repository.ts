import { supabase } from "@/shared/lib/supabaseClient";
import { developmentPathPatch, readDevelopmentPaths, upsertDevelopmentPath } from "@/thinking-lab/creative-idea/paths";
import { readCreativeValidation } from "@/thinking-lab/creative-idea/validation";
import type { CreativeFormat, CreativeValidation, DevelopmentPath, LabCreativeIdea } from "@/thinking-lab/creative-idea/types";
import { CREATIVE_FORMATS } from "@/thinking-lab/creative-idea/types";

type CreativeRow = {
  id: string;
  organization_id: string;
  idea_id: string;
  content_pillar_id: string;
  format: string;
  code: string;
  title?: string | null;
  statement: string;
  concept?: string | null;
  mechanism?: string | null;
  value?: string | null;
  validation?: unknown;
  status?: string | null;
};

function asFormat(value: string): CreativeFormat | null {
  return CREATIVE_FORMATS.find((format) => format === value) ?? null;
}

export function mapCreativeIdea(row: CreativeRow): LabCreativeIdea | null {
  const format = asFormat(row.format);
  const statement = row.statement?.trim() ?? "";
  if (!format || !statement) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    ideaId: row.idea_id,
    contentPillarId: row.content_pillar_id,
    format,
    code: row.code,
    title: row.title?.trim() ?? "",
    statement,
    concept: row.concept?.trim() ?? "",
    mechanism: row.mechanism?.trim() ?? "",
    value: row.value?.trim() ?? "",
    validation: readCreativeValidation(row.validation),
    status: row.status === "selected" ? "selected" : "candidate",
  };
}

export function creativeIdeaInsertRow(input: {
  organizationId: string;
  ideaId: string;
  contentPillarId: string;
  format: CreativeFormat;
  code: string;
  title: string;
  statement: string;
  concept: string;
  mechanism: string;
  value: string;
  validation: CreativeValidation;
}): Record<string, unknown> {
  return {
    organization_id: input.organizationId,
    idea_id: input.ideaId,
    content_pillar_id: input.contentPillarId,
    format: input.format,
    code: input.code,
    title: input.title.trim(),
    statement: input.statement.trim(),
    concept: input.concept.trim(),
    mechanism: input.mechanism.trim(),
    value: input.value.trim(),
    validation: input.validation,
    status: "candidate",
  };
}

export async function listLabCreativeIdeas(organizationId: string, ideaId: string): Promise<LabCreativeIdea[]> {
  const { data, error } = await supabase
    .from("thinking_lab_creative_ideas")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("idea_id", ideaId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as CreativeRow[]).flatMap((row) => {
    const mapped = mapCreativeIdea(row);
    return mapped ? [mapped] : [];
  });
}

export async function insertLabCreativeIdea(input: {
  organizationId: string;
  ideaId: string;
  contentPillarId: string;
  format: CreativeFormat;
  code: string;
  title: string;
  statement: string;
  concept: string;
  mechanism: string;
  value: string;
  validation: CreativeValidation;
}): Promise<LabCreativeIdea> {
  const { data, error } = await supabase
    .from("thinking_lab_creative_ideas")
    .insert(creativeIdeaInsertRow(input))
    .select("*")
    .single();
  if (error) throw error;
  const mapped = mapCreativeIdea(data as CreativeRow);
  if (!mapped) throw new Error("UNRESOLVED");
  return mapped;
}

export async function selectLabCreativeIdea(organizationId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from("thinking_lab_creative_ideas")
    .update({ status: "selected" })
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (error) throw error;
}

export async function saveDevelopmentPath(input: {
  organizationId: string;
  ideaId: string;
  path: DevelopmentPath;
}): Promise<DevelopmentPath[]> {
  const { data, error } = await supabase
    .from("thinking_lab_ideas")
    .select("development_paths")
    .eq("id", input.ideaId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (error) throw error;
  const next = upsertDevelopmentPath(
    readDevelopmentPaths((data as { development_paths?: unknown } | null)?.development_paths),
    input.path,
  );
  const { error: updateError } = await supabase
    .from("thinking_lab_ideas")
    .update(developmentPathPatch(next))
    .eq("id", input.ideaId)
    .eq("organization_id", input.organizationId);
  if (updateError) throw updateError;
  return next;
}
