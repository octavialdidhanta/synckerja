import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { CATALOG_MEDIA_BUCKET, readAllOptional } from "../shared/catalogQuery";
import {
  buildClaims,
  claimProofPath,
  draftScopes,
  scopeKey,
  type Claim,
  type ClaimDraft,
  type ClaimRow,
  type ClaimScopeRow,
  type ClaimUseRow,
} from "./claimsData";

// product_claims is newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const CLAIMS_QUERY_KEY = ["content-studio", "claims"] as const;

const ERRORS: Record<string, string> = {
  owner_admin_only: "Hanya owner atau admin yang bisa menyetujui, menolak, atau menghapus klaim.",
  claim_identity_locked: "Kode klaim tidak bisa diubah.",
};

export function claimErrorText(error: unknown): string {
  if (!error) return "";
  const message =
    error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : "";
  for (const [code, text] of Object.entries(ERRORS)) if (message.includes(code)) return text;
  return message || "Gagal menyimpan klaim.";
}

export function useClaims() {
  const { organizationId } = useOrgBootstrapPending();
  return useQuery<Claim[]>({
    queryKey: [...CLAIMS_QUERY_KEY, organizationId],
    enabled: Boolean(organizationId),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const org = organizationId as string;
      const [rows, scopes, uses] = await Promise.all([
        readAllOptional<ClaimRow>(
          supabase,
          "product_claims",
          "id,code,seq,text,proof,proof_file_path,status,rejection_reason,approved_by,approved_at,valid_until,created_at,updated_at",
          org,
        ),
        readAllOptional<ClaimScopeRow>(supabase, "product_claim_scopes", "id,claim_id,scope,menu_id,location_id", org),
        readAllOptional<ClaimUseRow>(supabase, "product_claim_uses", "id,claim_id,module,ref_id,label,created_at", org),
      ]);
      return buildClaims(rows, scopes, uses);
    },
  });
}

interface SaveInput {
  claim: Claim | null;
  draft: ClaimDraft;
}

async function writeScopes(org: string, claimId: string, current: Claim | null, draft: ClaimDraft) {
  const wanted = draftScopes(draft);
  const have = current?.scopes ?? [];
  const wantedKeys = new Set(wanted.map(scopeKey));
  const haveKeys = new Set(have.map(scopeKey));
  const removed = have.filter((s) => !wantedKeys.has(scopeKey(s)));
  const added = wanted.filter((s) => !haveKeys.has(scopeKey(s)));
  for (const s of removed) {
    let q = db.from("product_claim_scopes").delete().eq("organization_id", org).eq("claim_id", claimId).eq("scope", s.scope);
    if (s.scope === "product") q = q.eq("menu_id", s.targetId);
    if (s.scope === "location") q = q.eq("location_id", s.targetId);
    const { error } = await q;
    if (error) throw error;
  }
  if (added.length) {
    const { error } = await db.from("product_claim_scopes").insert(
      added.map((s) => ({
        organization_id: org,
        claim_id: claimId,
        scope: s.scope,
        menu_id: s.scope === "product" ? s.targetId : null,
        location_id: s.scope === "location" ? s.targetId : null,
      })),
    );
    if (error) throw error;
  }
}

export function useClaimMutations() {
  const { organizationId } = useOrgBootstrapPending();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: CLAIMS_QUERY_KEY });
  const org = () => {
    if (!organizationId) throw new Error("Organisasi belum siap.");
    return organizationId;
  };

  const save = useMutation({
    mutationFn: async ({ claim, draft }: SaveInput): Promise<string> => {
      const o = org();
      const values = {
        text: draft.text.trim(),
        proof: draft.proof.trim() || null,
        valid_until: draft.validUntil || null,
      };
      let id = claim?.id;
      if (!id) {
        // seq and code are assigned by the database trigger.
        const { data, error } = await db
          .from("product_claims")
          .insert({ organization_id: o, ...values })
          .select("id")
          .single();
        if (error) throw error;
        id = data.id as string;
      } else {
        const { error } = await db.from("product_claims").update(values).eq("id", id).eq("organization_id", o);
        if (error) throw error;
      }
      await writeScopes(o, id, claim, draft);
      return id;
    },
    onSettled: refresh,
  });

  const decide = useMutation({
    mutationFn: async (input: { claim: Claim; status: "approved" | "rejected" | "needs_proof"; reason?: string }) => {
      const o = org();
      const { error } = await db
        .from("product_claims")
        .update({ status: input.status, rejection_reason: input.status === "rejected" ? input.reason?.trim() || null : null })
        .eq("id", input.claim.id)
        .eq("organization_id", o);
      if (error) throw error;
    },
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: async (claim: Claim) => {
      const o = org();
      const { data, error } = await db.from("product_claims").delete().eq("id", claim.id).eq("organization_id", o).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("owner_admin_only");
      if (claim.proof_file_path) await supabase.storage.from(CATALOG_MEDIA_BUCKET).remove([claim.proof_file_path]);
    },
    onSettled: refresh,
  });

  const attachProof = useMutation({
    mutationFn: async (input: { claim: Claim; file: File }) => {
      const o = org();
      const path = claimProofPath(o, input.claim.id, input.file.name);
      const { error: upErr } = await supabase.storage
        .from(CATALOG_MEDIA_BUCKET)
        .upload(path, input.file, { contentType: input.file.type || undefined, upsert: false });
      if (upErr) throw upErr;
      const { error } = await db
        .from("product_claims")
        .update({ proof_file_path: path })
        .eq("id", input.claim.id)
        .eq("organization_id", o);
      if (error) {
        await supabase.storage.from(CATALOG_MEDIA_BUCKET).remove([path]);
        throw error;
      }
      if (input.claim.proof_file_path) await supabase.storage.from(CATALOG_MEDIA_BUCKET).remove([input.claim.proof_file_path]);
    },
    onSettled: refresh,
  });

  const detachProof = useMutation({
    mutationFn: async (claim: Claim) => {
      const o = org();
      const { error } = await db.from("product_claims").update({ proof_file_path: null }).eq("id", claim.id).eq("organization_id", o);
      if (error) throw error;
      if (claim.proof_file_path) await supabase.storage.from(CATALOG_MEDIA_BUCKET).remove([claim.proof_file_path]);
    },
    onSettled: refresh,
  });

  return {
    save: save.mutateAsync,
    decide: decide.mutateAsync,
    remove: remove.mutateAsync,
    attachProof: attachProof.mutateAsync,
    detachProof: detachProof.mutateAsync,
    busy: save.isPending || decide.isPending || remove.isPending || attachProof.isPending || detachProof.isPending,
  };
}

/** Opens the tab first so the browser does not block it while the link is signed. */
export async function openClaimProof(path: string): Promise<void> {
  const tab = window.open("", "_blank");
  const { data, error } = await supabase.storage.from(CATALOG_MEDIA_BUCKET).createSignedUrl(path, 600);
  if (error || !data?.signedUrl) {
    tab?.close();
    throw error ?? new Error("Gagal membuka file bukti.");
  }
  if (tab) {
    tab.opener = null;
    tab.location.href = data.signedUrl;
  } else {
    window.location.assign(data.signedUrl);
  }
}
