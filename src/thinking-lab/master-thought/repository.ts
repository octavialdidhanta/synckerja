import { supabase } from "@/shared/lib/supabaseClient";
import { LAB_WORKSPACE } from "@/thinking-lab/shared/verdict";
import { beliefsMatch, normalizeMasterThoughtFacts, understandPersistMode } from "@/thinking-lab/master-thought/semantic";
import type {
  ConfirmationSource,
  LabMasterThought,
  MasterBeliefInput,
  MasterThoughtFacts,
} from "@/thinking-lab/master-thought/types";

type MasterRow = {
  id: string;
  organization_id: string;
  original_input: string | null;
  prior_belief?: string | null;
  audience?: string | null;
  statement: string;
  root_belief: string | null;
  confirmation_source: string | null;
  confirmed_at: string | null;
  mt_status: string | null;
  status: string;
  canonical_semantic: unknown;
  semantic_fingerprint: string | null;
  last_audit: unknown;
  updated_at: string;
};

const CONFIRM_SOURCES = new Set<ConfirmationSource>(["original", "recommendation", "edited"]);

function mapMaster(row: MasterRow): LabMasterThought {
  const source = CONFIRM_SOURCES.has(row.confirmation_source as ConfirmationSource)
    ? (row.confirmation_source as ConfirmationSource)
    : null;
  const facts =
    row.canonical_semantic && typeof row.canonical_semantic === "object"
      ? normalizeMasterThoughtFacts(row.canonical_semantic, row.original_input ?? row.statement ?? "")
      : null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    originalInput: (row.original_input ?? row.statement ?? "").trim(),
    priorBelief: typeof row.prior_belief === "string" ? row.prior_belief.trim() : "",
    audience: typeof row.audience === "string" ? row.audience.trim() : "",
    statement: row.statement ?? "",
    rootBelief: row.root_belief ?? "",
    confirmationSource: source,
    confirmedAt: row.confirmed_at,
    mtStatus: row.mt_status ?? "raw",
    status: row.status,
    canonicalSemantic: facts,
    semanticFingerprint: row.semantic_fingerprint,
    lastAudit: row.last_audit ?? null,
    updatedAt: row.updated_at,
  };
}

export async function listLabMasters(organizationId: string): Promise<LabMasterThought[]> {
  const { data, error } = await supabase
    .from("thinking_master_thoughts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("workspace", LAB_WORKSPACE)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as MasterRow[]).map(mapMaster);
}

function beliefText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function createLabMaster(
  organizationId: string,
  input: MasterBeliefInput,
): Promise<LabMasterThought> {
  const planted = input.planted.trim();
  const priorBelief = input.priorBelief.trim();
  const audience = input.audience.trim();
  if (!planted) throw new Error("EMPTY_INPUT");
  if (!priorBelief) throw new Error("EMPTY_PRIOR");
  if (beliefsMatch(planted, priorBelief)) throw new Error("SAME_BELIEF");
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("thinking_master_thoughts")
    .insert({
      organization_id: organizationId,
      statement: planted,
      original_input: planted,
      prior_belief: priorBelief,
      audience,
      root_belief: "",
      mt_status: "raw",
      status: "draft",
      workspace: LAB_WORKSPACE,
      created_by: userData.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapMaster(data as MasterRow);
}

export async function saveOriginalInput(
  id: string,
  organizationId: string,
  input: MasterBeliefInput,
): Promise<void> {
  const planted = input.planted.trim();
  const priorBelief = input.priorBelief.trim();
  const audience = input.audience.trim();
  if (!planted) throw new Error("EMPTY_INPUT");
  if (priorBelief && beliefsMatch(planted, priorBelief)) throw new Error("SAME_BELIEF");
  const { data: current, error: readError } = await supabase
    .from("thinking_master_thoughts")
    .select("confirmation_source, original_input, prior_belief, audience")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("workspace", LAB_WORKSPACE)
    .maybeSingle();
  if (readError) throw readError;
  const plantedChanged = planted !== beliefText(current?.original_input);
  const priorChanged = priorBelief !== beliefText(current?.prior_belief);
  const audienceChanged = audience !== beliefText(current?.audience);
  if (!plantedChanged && !priorChanged && !audienceChanged) return;
  const confirmed = Boolean(current?.confirmation_source);
  const patch =
    confirmed && !plantedChanged && !priorChanged
      ? { audience }
      : {
          original_input: planted,
          statement: planted,
          prior_belief: priorBelief,
          audience,
          root_belief: "",
          confirmation_source: null,
          confirmed_at: null,
          mt_status: "raw",
          status: "draft",
          canonical_semantic: null,
          semantic_fingerprint: null,
          last_audit: null,
          last_audit_at: null,
        };
  const { error } = await supabase
    .from("thinking_master_thoughts")
    .update(patch)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("workspace", LAB_WORKSPACE)
    .neq("mt_status", "locked");
  if (error) throw error;
}

export async function saveUnderstanding(
  id: string,
  organizationId: string,
  facts: MasterThoughtFacts,
  fingerprint: string,
): Promise<void> {
  const { data: current, error: readError } = await supabase
    .from("thinking_master_thoughts")
    .select("confirmation_source, statement, original_input")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("workspace", LAB_WORKSPACE)
    .maybeSingle();
  if (readError) throw readError;
  const mode = understandPersistMode({
    confirmationSource: current?.confirmation_source ?? null,
    confirmedStatement: current?.statement ?? "",
    storedOriginalInput: current?.original_input ?? "",
    nextOriginalInput: current?.original_input ?? "",
  });
  const patch =
    mode === "display_only"
      ? { canonical_semantic: facts }
      : {
          canonical_semantic: facts,
          semantic_fingerprint: fingerprint,
          root_belief: facts.proposedRootBelief ?? "",
        };
  const { error } = await supabase
    .from("thinking_master_thoughts")
    .update(patch)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("workspace", LAB_WORKSPACE)
    .neq("mt_status", "locked");
  if (error) throw error;
}

export async function confirmMasterThought(
  id: string,
  organizationId: string,
  input: {
    statement: string;
    source: ConfirmationSource;
    facts: MasterThoughtFacts;
    fingerprint: string;
  },
): Promise<void> {
  const statement = input.statement.trim();
  if (!statement) throw new Error("EMPTY_INPUT");
  const { error } = await supabase
    .from("thinking_master_thoughts")
    .update({
      statement,
      root_belief: statement,
      confirmation_source: input.source,
      confirmed_at: new Date().toISOString(),
      mt_status: "confirmed",
      status: "draft",
      canonical_semantic: input.facts,
      semantic_fingerprint: input.fingerprint,
      last_audit: null,
      last_audit_at: null,
    })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("workspace", LAB_WORKSPACE)
    .neq("mt_status", "locked");
  if (error) throw error;
}

export async function saveLabSetRecord(
  id: string,
  organizationId: string,
  lastAudit: unknown,
): Promise<void> {
  const { error } = await supabase
    .from("thinking_master_thoughts")
    .update({
      last_audit: lastAudit,
      last_audit_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("workspace", LAB_WORKSPACE);
  if (error) throw error;
}

export async function lockLabMaster(id: string, organizationId: string): Promise<void> {
  const { error } = await supabase
    .from("thinking_master_thoughts")
    .update({ mt_status: "locked", status: "locked" })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("workspace", LAB_WORKSPACE);
  if (error) throw error;
}

export async function deleteLabMaster(id: string, organizationId: string): Promise<void> {
  const { data, error } = await supabase
    .from("thinking_master_thoughts")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("workspace", LAB_WORKSPACE)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("LAB_MASTER_NOT_FOUND");
}

export async function unlockLabMaster(id: string, organizationId: string): Promise<void> {
  const { error } = await supabase
    .from("thinking_master_thoughts")
    .update({ mt_status: "confirmed", status: "draft" })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("workspace", LAB_WORKSPACE)
    .eq("mt_status", "locked");
  if (error) throw error;
}
