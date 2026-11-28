import { ClaimChip } from "./ClaimsTab";
import { claimIsBrandWide, claimsFor } from "./claimsData";
import { useClaims } from "./useClaims";

/** Claims that apply to one product or location (brand-wide plus its own), shown on the Produk and Lokasi pages. */
export function AppliedClaims({ kind, targetId }: { kind: "product" | "location"; targetId: string }) {
  const { data } = useClaims();
  const list = data ? claimsFor(data, kind, targetId) : [];
  return (
    <>
      <div className="list-head" style={{ margin: "16px 0 6px" }}>
        <div className="gt">Klaim yang berlaku ({list.length})</div>
        <span className="area-meta">Kelola di tab Klaim</span>
      </div>
      {list.length ? (
        list.map((claim) => (
          <div key={claim.id} className="it" style={{ cursor: "default" }}>
            <span>
              <b>{claim.code}</b> {claim.text}
              {claimIsBrandWide(claim) ? <span className="area-meta"> · brand</span> : null}
            </span>
            <ClaimChip claim={claim} />
          </div>
        ))
      ) : (
        <div className="sub">Belum ada klaim untuk {kind === "product" ? "produk" : "lokasi"} ini.</div>
      )}
    </>
  );
}
