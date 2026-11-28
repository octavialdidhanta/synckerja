import { useMemo, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { CLAIM_STATUS_LABEL, filterClaims, isClaimExpired, type ClaimFilter } from "./claimsData";
import { useClaims } from "./useClaims";

/** Read-only Daftar Klaim for the Product Knowledge page. Same rows as Content Studio → Klaim, not a copy. */
export function ClaimsRegistryButton() {
  const [open, setOpen] = useState(false);
  const { data: claims = [], isPending } = useClaims();
  const [filter, setFilter] = useState<ClaimFilter>({ status: "all", scope: "all", q: "" });
  const shown = useMemo(() => filterClaims(claims, filter), [claims, filter]);
  const waiting = claims.filter((c) => c.status === "needs_proof").length;
  return (
    <>
      <Button variant="outline" size="sm" className="ml-2 shrink-0" onClick={() => setOpen(true)}>
        Daftar Klaim{claims.length ? ` (${claims.length})` : ""}
        {waiting ? <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-[11px] text-amber-800">{waiting} perlu bukti</span> : null}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Daftar Klaim</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-600">
            Fakta yang boleh disebut di konten, iklan, dan balasan chat. Hanya klaim <b>disetujui</b> yang boleh dipakai sebagai
            fakta. Tambah, ubah, dan setujui di Content Studio → Klaim.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["all", "needs_proof", "approved", "rejected"] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={`rounded-full border px-3 py-0.5 text-xs ${filter.status === s ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300"}`}
                onClick={() => setFilter((f) => ({ ...f, status: s }))}
              >
                {s === "all" ? "Semua" : CLAIM_STATUS_LABEL[s]}
              </button>
            ))}
            <input
              type="search"
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
              placeholder="Cari kalimat atau kode"
              value={filter.q}
              onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
            />
          </div>
          <div className="mt-3 flex-1 overflow-y-auto">
            {isPending ? <div className="text-sm text-gray-500">Memuat…</div> : null}
            {!isPending && !shown.length ? <div className="text-sm text-gray-500">Belum ada klaim.</div> : null}
            <table className="w-full text-sm">
              <tbody>
                {shown.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100 align-top">
                    <td className="py-2 pr-3 font-semibold whitespace-nowrap">{c.code}</td>
                    <td className="py-2 pr-3">
                      {c.text}
                      {c.proof ? <div className="text-xs text-gray-500">Bukti: {c.proof}</div> : null}
                    </td>
                    <td className="py-2 whitespace-nowrap text-xs">
                      {c.status === "approved" && isClaimExpired(c) ? "kedaluwarsa" : CLAIM_STATUS_LABEL[c.status]}
                      {c.uses.length ? <div className="text-gray-500">{c.uses.length}× dipakai</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
