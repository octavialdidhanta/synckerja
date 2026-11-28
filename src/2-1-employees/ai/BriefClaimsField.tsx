import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { Claim } from "@/6-1-content-studio/claims/claimsData";
import { claimErrorText, useClaimMutations, useClaims } from "@/6-1-content-studio/claims/useClaims";
import { allowedBriefClaims, approvedNow, BRIEF_CLAIM_MODULE, briefClaimRef } from "./briefClaims";

function Chip({ claim, note, onRemove, busy }: { claim: Claim; note?: string; onRemove?: () => void; busy?: boolean }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] text-green-800">
      <b>{claim.code}</b>
      <span className="truncate">{claim.text}</span>
      {note ? <span className="shrink-0 opacity-70">· {note}</span> : null}
      {onRemove ? (
        <button type="button" className="shrink-0 opacity-70 hover:opacity-100" aria-label={`Lepas ${claim.code}`} disabled={busy} onClick={onRemove}>
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );
}

/**
 * "Klaim yang boleh dipakai" in an AI Employee brief. Only approved claims can be picked; brand-wide claims and the
 * claims behind Fokus angle come along by themselves. The runner gives the model only these facts, and a plan that
 * states anything else is not auto approved.
 */
export function BriefClaimsField({ employeeId, angleIds, disabled }: { employeeId: string; angleIds: string[]; disabled?: boolean }) {
  const claims = useClaims();
  const m = useClaimMutations();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const all = useMemo(() => claims.data ?? [], [claims.data]);
  const { picked, fromAngle, brand, waiting } = allowedBriefClaims(all, employeeId, angleIds);
  const included = new Set([...picked, ...fromAngle, ...brand].map((c) => c.id));
  const choices = all.filter((c) => approvedNow(c) && !included.has(c.id));
  const ref = briefClaimRef(employeeId);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(claimErrorText(err));
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {picked.map((c) => (
          <Chip key={c.id} claim={c} busy={m.linking || disabled} onRemove={disabled ? undefined : () => void run(() => m.unlinkPoint({ claimId: c.id, refId: ref, module: BRIEF_CLAIM_MODULE }))} />
        ))}
        {fromAngle.filter((c) => !picked.includes(c)).map((c) => (
          <Chip key={c.id} claim={c} note="dari angle" />
        ))}
        {brand.filter((c) => !picked.includes(c) && !fromAngle.includes(c)).map((c) => (
          <Chip key={c.id} claim={c} note="brand, otomatis" />
        ))}
        {!included.size && !claims.isPending ? (
          <span className="text-xs text-muted-foreground">Belum ada klaim. AI tidak akan menulis fakta apa pun.</span>
        ) : null}
      </div>
      {waiting.length ? (
        <p className="text-[11px] text-amber-800">
          Belum disetujui, tidak diberikan ke AI: {waiting.map((c) => c.code).join(", ")}.
        </p>
      ) : null}
      {!disabled ? (
        <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setOpen((v) => !v)}>
          {open ? "Tutup" : "+ Pilih klaim (hanya yang disetujui)"}
        </button>
      ) : null}
      {open ? (
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded border border-border p-1.5">
          {choices.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="w-full rounded px-1.5 py-1 text-left text-xs hover:bg-muted"
                disabled={m.linking}
                onClick={() => void run(() => m.linkPoint({ claimId: c.id, refId: ref, label: c.text, module: BRIEF_CLAIM_MODULE }))}
              >
                <b>{c.code}</b> {c.text}
              </button>
            </li>
          ))}
          {!choices.length ? <li className="px-1.5 py-1 text-xs text-muted-foreground">Semua klaim yang disetujui sudah ikut.</li> : null}
        </ul>
      ) : null}
      {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
}
