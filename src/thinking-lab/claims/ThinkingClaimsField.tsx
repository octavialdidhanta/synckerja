import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { supabase } from "@/shared/lib/supabaseClient";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { CLAIM_STATUS_LABEL, isClaimExpired, type Claim } from "@/6-1-content-studio/claims/claimsData";
import { claimErrorText, useClaimMutations, useClaims } from "@/6-1-content-studio/claims/useClaims";
import {
  claimsBlockingBrief,
  linkedClaims,
  rankClaimsForNode,
  scopeMenusForNode,
  THINKING_USE_MODULE,
  thinkingRef,
  type ThinkingClaimTarget,
} from "./thinkingClaims";

// catalog_menus is newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function useMenuSubServices() {
  const { organizationId } = useOrgBootstrapPending();
  return useQuery<Map<string, string | null>>({
    queryKey: ["thinking-lab", "claim-menus", organizationId],
    enabled: Boolean(organizationId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await db.from("catalog_menus").select("id,sub_service_id").eq("organization_id", organizationId);
      if (error) return new Map();
      return new Map(((data ?? []) as { id: string; sub_service_id: string | null }[]).map((r) => [r.id, r.sub_service_id]));
    },
  });
}

function tone(c: Claim): string {
  if (c.status === "approved" && !isClaimExpired(c)) return "bg-green-100 text-green-800";
  return "bg-amber-100 text-amber-800";
}

function label(c: Claim): string {
  if (c.status === "approved" && isClaimExpired(c)) return "kedaluwarsa";
  return c.status === "approved" ? "✅ disetujui" : `🟡 ${CLAIM_STATUS_LABEL[c.status].toLowerCase()}`;
}

function ClaimChip({ claim, onRemove, busy }: { claim: Claim; onRemove?: () => void; busy?: boolean }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${tone(claim)}`}>
      <b>{claim.code}</b>
      <span className="truncate">{claim.text}</span>
      <span className="shrink-0">· {label(claim)}</span>
      {onRemove ? (
        <button type="button" className="ml-0.5 shrink-0 opacity-70 hover:opacity-100" aria-label={`Lepas ${claim.code}`} disabled={busy} onClick={onRemove}>
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );
}

/**
 * "Klaim pendukung" on an Angle, or optional proof on a Master Thought: pick claims from the Daftar Klaim
 * (claims of this Master Thought's products and brand claims first) or make a new one (it starts as perlu bukti).
 */
export function ThinkingClaimsField({
  target,
  targetId,
  subServiceIds = [],
}: {
  target: ThinkingClaimTarget;
  targetId: string;
  subServiceIds?: string[];
}) {
  const claims = useClaims();
  const menus = useMenuSubServices();
  const m = useClaimMutations();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [newText, setNewText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ref = thinkingRef(target, targetId);
  const all = useMemo(() => claims.data ?? [], [claims.data]);
  const linked = linkedClaims(all, [ref]);
  const choices = rankClaimsForNode(all, menus.data ?? new Map(), subServiceIds, q).filter((c) => !linked.includes(c));

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(claimErrorText(err));
    }
  };

  const addNew = () =>
    run(async () => {
      const text = newText.trim();
      if (text.length < 3) throw new Error("Kalimat klaim minimal 3 karakter.");
      const productIds = scopeMenusForNode(menus.data ?? new Map(), subServiceIds);
      const id = await m.save({
        claim: null,
        draft: { text, proof: "", validUntil: "", brand: productIds.length === 0, productIds, locationIds: [] },
      });
      await m.linkPoint({ claimId: id, refId: ref, label: text, module: THINKING_USE_MODULE });
      setNewText("");
    });

  const title = target === "angle" ? "Klaim pendukung" : "Bukti keyakinan (opsional)";
  return (
    <div className="space-y-2 rounded-lg border border-border bg-background px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setOpen((v) => !v)}>
          <Plus className="mr-1 h-3 w-3" /> {open ? "Tutup" : "Pilih klaim"}
        </Button>
      </div>
      {claims.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden /> : null}
      {linked.length ? (
        <div className="flex flex-wrap gap-1.5">
          {linked.map((c) => (
            <ClaimChip
              key={c.id}
              claim={c}
              busy={m.linking}
              onRemove={() => void run(() => m.unlinkPoint({ claimId: c.id, refId: ref, module: THINKING_USE_MODULE }))}
            />
          ))}
        </div>
      ) : !claims.isPending ? (
        <p className="text-xs text-muted-foreground">
          {target === "angle" ? "Belum ada klaim. Argumen angle sebaiknya bersandar pada klaim yang disetujui." : "Opsional: keyakinan baru bisa diberi bukti dari Daftar Klaim."}
        </p>
      ) : null}
      {linked.some((c) => claimsBlockingBrief([c]).length) ? (
        <p className="text-[11px] text-amber-800">Klaim 🟡 boleh untuk brainstorming, tapi Execution di bawahnya belum bisa jadi brief sampai disetujui owner/admin.</p>
      ) : null}
      {open ? (
        <div className="space-y-2 border-t border-border pt-2">
          <input
            type="search"
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
            placeholder="Cari klaim atau kode"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {choices.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="w-full rounded px-1.5 py-1 text-left text-xs hover:bg-muted"
                  disabled={m.linking}
                  onClick={() => void run(() => m.linkPoint({ claimId: c.id, refId: ref, label: c.text, module: THINKING_USE_MODULE }))}
                >
                  <b>{c.code}</b> {c.text} <span className="text-muted-foreground">· {label(c)}</span>
                </button>
              </li>
            ))}
            {!choices.length ? <li className="text-xs text-muted-foreground">Tidak ada klaim yang cocok.</li> : null}
          </ul>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">+ Buat klaim baru (masuk Daftar Klaim sebagai perlu bukti)</p>
            <div className="flex gap-1.5">
              <input
                className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
                placeholder="Contoh: Kuah dimasak 8 jam"
                maxLength={500}
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
              />
              <Button type="button" size="sm" className="h-7 px-2 text-xs" disabled={m.busy || m.linking || newText.trim().length < 3} onClick={() => void addNew()}>
                Tambah
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
}

/** On an Idea: the claims its Executions inherit from the Angle and Master Thought, and whether a brief is allowed. */
export function InheritedClaims({ angleId, masterId }: { angleId: string; masterId?: string | null }) {
  const claims = useClaims();
  const refs = [thinkingRef("angle", angleId), ...(masterId ? [thinkingRef("master", masterId)] : [])];
  const linked = linkedClaims(claims.data ?? [], refs);
  if (!linked.length) return null;
  const blocking = claimsBlockingBrief(linked);
  return (
    <div className={`space-y-1.5 rounded-lg border px-3 py-2 ${blocking.length ? "border-amber-300 bg-amber-50" : "border-border bg-background"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Klaim yang diwarisi Execution</p>
      <div className="flex flex-wrap gap-1.5">
        {linked.map((c) => (
          <ClaimChip key={c.id} claim={c} />
        ))}
      </div>
      {blocking.length ? (
        <p className="text-[11px] text-amber-900">
          Belum bisa jadi brief: {blocking.map((c) => c.code).join(", ")} belum disetujui. Setujui di Content Studio → Klaim, atau lepas dari Angle.
        </p>
      ) : (
        <p className="text-[11px] text-green-800">Semua klaim disetujui. Execution boleh lanjut ke brief.</p>
      )}
    </div>
  );
}
