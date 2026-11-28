import type { SupabaseClient } from "@supabase/supabase-js";

type Session = { userId: string; organizationId: string };

export type ClaimStatus = "needs_proof" | "approved" | "rejected";

export type ClaimScopeView =
  | { scope: "brand" }
  | { scope: "product"; product: string; product_name: string }
  | { scope: "location"; location: string; location_name: string };

export type Claim = {
  code: string;
  text: string;
  status: ClaimStatus;
  proof: string | null;
  has_proof_file: boolean;
  valid_until: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  scopes: ClaimScopeView[];
  uses: number;
};

export type ClaimList = {
  claims: Claim[];
  counts: Record<ClaimStatus, number>;
};

export type ClaimListFilter = { status?: ClaimStatus; product?: string; location?: string; q?: string };

export type ClaimScopeInput =
  | { scope: "brand" }
  | { scope: "product"; product: string }
  | { scope: "location"; location: string };

export type ClaimUpsertInput = {
  code?: string;
  text?: string;
  proof?: string | null;
  valid_until?: string | null;
  scopes?: ClaimScopeInput[];
};

export type ClaimUpsertPreview = {
  is_new: boolean;
  before: Claim | null;
  after: Record<string, unknown>;
  preview_id: string;
  expires_at: string;
};

export type ClaimUpsertSaved = { saved: boolean; is_new: boolean; claim: Claim };

export type ClaimApproveInput = { code: string; decision: "approve" | "reject"; reason?: string };

export type ClaimApproveSaved = { saved: boolean; claim: Claim };

function sessionArgs(ctx: Session): Record<string, unknown> {
  return { p_user_id: ctx.userId, p_organization_id: ctx.organizationId };
}

async function callJson<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(error.message);
  const value = Array.isArray(data) ? data[0] : data;
  if (value == null) throw new Error("not_found");
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

export function listCatalogClaims(admin: SupabaseClient, ctx: Session, filter: ClaimListFilter): Promise<ClaimList> {
  return callJson<ClaimList>(admin, "mcp_list_catalog_claims", { ...sessionArgs(ctx), p_input: filter });
}

export function previewCatalogClaimUpsert(
  admin: SupabaseClient,
  ctx: Session,
  input: ClaimUpsertInput,
): Promise<ClaimUpsertPreview> {
  return callJson<ClaimUpsertPreview>(admin, "mcp_preview_catalog_claim_upsert", { ...sessionArgs(ctx), p_input: input });
}

export function applyCatalogClaimUpsert(admin: SupabaseClient, ctx: Session, previewId: string): Promise<ClaimUpsertSaved> {
  return callJson<ClaimUpsertSaved>(admin, "mcp_apply_catalog_claim_upsert", {
    ...sessionArgs(ctx),
    p_preview_id: previewId,
  });
}

export function approveCatalogClaim(admin: SupabaseClient, ctx: Session, input: ClaimApproveInput): Promise<ClaimApproveSaved> {
  return callJson<ClaimApproveSaved>(admin, "mcp_approve_catalog_claim", { ...sessionArgs(ctx), p_input: input });
}

export type ClaimUseInput = { codes: string[]; module: string; ref_id: string; label: string };

/** Jejak pemakaian. Unknown codes are skipped; a repeated use is kept once. */
export function logCatalogClaimUses(admin: SupabaseClient, ctx: Session, input: ClaimUseInput): Promise<{ logged: number }> {
  return callJson<{ logged: number }>(admin, "mcp_log_catalog_claim_uses", { ...sessionArgs(ctx), p_input: input });
}
