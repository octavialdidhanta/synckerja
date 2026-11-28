import { useState } from "react";
import { parseAdvantagePoints, pointRef, PK_USE_MODULE } from "./advantagePoints";
import { CLAIM_STATUS_LABEL, isClaimExpired, pointIsBacked, type Claim } from "./claimsData";
import { claimErrorText, useClaimMutations, useClaims } from "./useClaims";

function statusTone(claim: Claim): string {
  if (claim.status === "approved" && !isClaimExpired(claim)) return "bg-green-100 text-green-800";
  if (claim.status === "rejected") return "bg-gray-100 text-gray-500 line-through";
  return "bg-amber-100 text-amber-800";
}

function statusText(claim: Claim): string {
  if (claim.status === "approved" && isClaimExpired(claim)) return "kedaluwarsa";
  return CLAIM_STATUS_LABEL[claim.status].toLowerCase();
}

/**
 * Competitive advantage points of one Product Knowledge row, each linked to supporting claims.
 * A point without an approved claim is marked "belum ada bukti".
 */
export function AdvantageClaims({ productKnowledgeId, competitiveAdvantage }: { productKnowledgeId: string; competitiveAdvantage: unknown }) {
  const { data: claims = [], isPending } = useClaims();
  const m = useClaimMutations();
  const [error, setError] = useState<string | null>(null);
  const points = parseAdvantagePoints(competitiveAdvantage);

  if (!points.length) return null;

  const linkedTo = (ref: string) =>
    claims.filter((c) => c.uses.some((u) => u.module === PK_USE_MODULE && u.ref_id === ref));

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(claimErrorText(err));
    }
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="text-sm font-semibold text-gray-800">Bukti tiap poin (Daftar Klaim)</div>
      {isPending ? <div className="text-xs text-gray-500">Memuat klaim…</div> : null}
      {points.map((point) => {
        const ref = pointRef(productKnowledgeId, point);
        const linked = linkedTo(ref);
        const choices = claims.filter((c) => c.status !== "rejected" && !linked.includes(c));
        return (
          <div key={ref} className="rounded border border-gray-200 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm text-gray-800">{point}</div>
              {!pointIsBacked(linked) ? (
                <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">belum ada bukti</span>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {linked.map((c) => (
                <span key={c.id} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${statusTone(c)}`}>
                  <b>{c.code}</b> {c.text.length > 50 ? `${c.text.slice(0, 50)}…` : c.text} · {statusText(c)}
                  <button
                    type="button"
                    className="ml-1 text-gray-500 hover:text-gray-900"
                    aria-label={`Lepas ${c.code}`}
                    disabled={m.linking}
                    onClick={() => run(() => m.unlinkPoint({ claimId: c.id, refId: ref }))}
                  >
                    ×
                  </button>
                </span>
              ))}
              {choices.length ? (
                <select
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                  value=""
                  disabled={m.linking}
                  aria-label="Tautkan klaim"
                  onChange={(e) => {
                    const claimId = e.target.value;
                    if (claimId) void run(() => m.linkPoint({ claimId, refId: ref, label: point }));
                  }}
                >
                  <option value="">+ Tautkan klaim…</option>
                  {choices.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.text.length > 60 ? `${c.text.slice(0, 60)}…` : c.text} ({statusText(c)})
                    </option>
                  ))}
                </select>
              ) : !claims.length && !isPending ? (
                <span className="text-xs text-gray-500">Belum ada klaim. Tambah di Content Studio → Klaim.</span>
              ) : null}
            </div>
          </div>
        );
      })}
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
    </div>
  );
}
