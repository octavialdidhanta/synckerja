/**
 * Daftar Klaim (product_claims). One fact the organization may state, with proof, status and where it applies.
 * The same rows are read by the Klaim tab, the Produk/Lokasi pages, Product Knowledge and the MCP.
 */

export type ClaimStatus = "needs_proof" | "approved" | "rejected";
export type ClaimScopeKind = "brand" | "product" | "location";

export interface ClaimRow {
  id: string;
  code: string;
  seq: number;
  text: string;
  proof: string | null;
  proof_file_path: string | null;
  status: ClaimStatus;
  rejection_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClaimScopeRow {
  id: string;
  claim_id: string;
  scope: ClaimScopeKind;
  menu_id: string | null;
  location_id: string | null;
}

export interface ClaimUseRow {
  id: string;
  claim_id: string;
  module: string;
  ref_id: string;
  label: string | null;
  created_at: string;
}

export interface ClaimScope {
  scope: ClaimScopeKind;
  /** catalog_menus.id or catalog_locations.id; null for brand */
  targetId: string | null;
}

export interface Claim extends ClaimRow {
  scopes: ClaimScope[];
  uses: ClaimUseRow[];
}

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  needs_proof: "Perlu bukti",
  approved: "Disetujui",
  rejected: "Ditolak",
};

/** Status chip class in contentStudio.css. */
export const CLAIM_STATUS_CLASS: Record<ClaimStatus, string> = {
  needs_proof: "w",
  approved: "ok",
  rejected: "no",
};

export const CLAIM_USE_MODULE_LABEL: Record<string, string> = {
  brief: "Brief",
  video: "Video",
  thinking_lab: "Thinking Lab",
  ai_employee: "AI Employee",
  inbox: "Inbox",
  ads: "Iklan",
  product_knowledge: "Product Knowledge",
  other: "Lainnya",
};

export function buildClaims(rows: ClaimRow[], scopes: ClaimScopeRow[], uses: ClaimUseRow[]): Claim[] {
  const scopeBy = new Map<string, ClaimScope[]>();
  for (const s of scopes) {
    const list = scopeBy.get(s.claim_id) ?? [];
    list.push({ scope: s.scope, targetId: s.scope === "product" ? s.menu_id : s.scope === "location" ? s.location_id : null });
    scopeBy.set(s.claim_id, list);
  }
  const useBy = new Map<string, ClaimUseRow[]>();
  for (const u of uses) {
    const list = useBy.get(u.claim_id) ?? [];
    list.push(u);
    useBy.set(u.claim_id, list);
  }
  return [...rows]
    .sort((a, b) => a.seq - b.seq)
    .map((row) => ({
      ...row,
      scopes: scopeBy.get(row.id) ?? [],
      uses: (useBy.get(row.id) ?? []).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    }));
}

/** Today in WIB as YYYY-MM-DD, the same day the database uses for expiry. */
export function todayWib(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

export function isClaimExpired(claim: Pick<ClaimRow, "valid_until">, today: string = todayWib()): boolean {
  return Boolean(claim.valid_until && claim.valid_until < today);
}

export function claimIsBrandWide(claim: Pick<Claim, "scopes">): boolean {
  return claim.scopes.some((s) => s.scope === "brand");
}

/** Claims that apply to one product or location: brand-wide ones plus its own. */
export function claimsFor(claims: Claim[], kind: "product" | "location", targetId: string): Claim[] {
  return claims.filter(
    (claim) => claimIsBrandWide(claim) || claim.scopes.some((s) => s.scope === kind && s.targetId === targetId),
  );
}

export interface ClaimFilter {
  status: ClaimStatus | "all";
  scope: ClaimScopeKind | "all";
  q: string;
}

export function filterClaims(claims: Claim[], filter: ClaimFilter): Claim[] {
  const q = filter.q.trim().toLowerCase();
  return claims.filter((claim) => {
    if (filter.status !== "all" && claim.status !== filter.status) return false;
    if (filter.scope !== "all" && !claim.scopes.some((s) => s.scope === filter.scope)) return false;
    if (q && !claim.text.toLowerCase().includes(q) && !claim.code.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function scopeSummary(
  claim: Pick<Claim, "scopes">,
  names: { products: Map<string, string>; locations: Map<string, string> },
): string {
  if (claimIsBrandWide(claim)) return "Semua produk (brand)";
  const parts = claim.scopes.map((s) =>
    s.scope === "product"
      ? (names.products.get(s.targetId ?? "") ?? "produk terhapus")
      : (names.locations.get(s.targetId ?? "") ?? "lokasi terhapus"),
  );
  return parts.length ? parts.join(", ") : "Belum ada cakupan";
}

export interface ClaimDraft {
  text: string;
  proof: string;
  validUntil: string;
  brand: boolean;
  productIds: string[];
  locationIds: string[];
}

export function draftFromClaim(claim: Claim | null): ClaimDraft {
  if (!claim) return { text: "", proof: "", validUntil: "", brand: true, productIds: [], locationIds: [] };
  return {
    text: claim.text,
    proof: claim.proof ?? "",
    validUntil: claim.valid_until ?? "",
    brand: claimIsBrandWide(claim),
    productIds: claim.scopes.filter((s) => s.scope === "product").map((s) => s.targetId ?? ""),
    locationIds: claim.scopes.filter((s) => s.scope === "location").map((s) => s.targetId ?? ""),
  };
}

export function claimDraftError(draft: ClaimDraft, today: string = todayWib()): string | null {
  const text = draft.text.trim();
  if (text.length < 3) return "Kalimat klaim minimal 3 karakter.";
  if (text.length > 500) return "Kalimat klaim maksimal 500 karakter.";
  if (draft.proof.length > 2000) return "Bukti maksimal 2000 karakter.";
  if (!draft.brand && !draft.productIds.length && !draft.locationIds.length) {
    return "Pilih cakupan: semua produk (brand), atau minimal satu produk atau lokasi.";
  }
  if (draft.validUntil && draft.validUntil < today) return "Masa berlaku tidak boleh di masa lalu.";
  return null;
}

/** Scope rows to store for a draft. Brand-wide replaces any product or location. */
export function draftScopes(draft: ClaimDraft): ClaimScope[] {
  if (draft.brand) return [{ scope: "brand", targetId: null }];
  return [
    ...[...new Set(draft.productIds)].map((id) => ({ scope: "product" as const, targetId: id })),
    ...[...new Set(draft.locationIds)].map((id) => ({ scope: "location" as const, targetId: id })),
  ];
}

export function scopeKey(s: ClaimScope): string {
  return `${s.scope}:${s.targetId ?? ""}`;
}

/** Approve needs proof text or a proof file, and an expiry that has not passed. */
export function approveBlocker(claim: Claim, today: string = todayWib()): string | null {
  if (!claim.proof && !claim.proof_file_path) return "Isi bukti atau lampirkan file dulu sebelum menyetujui.";
  if (isClaimExpired(claim, today)) return "Masa berlaku sudah lewat. Perpanjang dulu.";
  return null;
}

export const CLAIM_PROOF_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

export function claimProofPath(organizationId: string, claimId: string, fileName: string, now: number = Date.now()): string {
  const ext = (fileName.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
  return `${organizationId}/claims/${claimId}-${now}.${ext}`;
}
