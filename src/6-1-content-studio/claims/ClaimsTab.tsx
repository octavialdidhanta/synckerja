import { useEffect, useMemo, useRef, useState } from "react";
import { useCurrentUserRole } from "@/shared/hooks/useCurrentUserRole";
import { linkedProductName } from "../library/catalogEdit";
import { useLibraryData } from "../library/useLibraryData";
import {
  approveBlocker,
  CLAIM_PROOF_ACCEPT,
  CLAIM_STATUS_CLASS,
  CLAIM_STATUS_LABEL,
  CLAIM_USE_MODULE_LABEL,
  claimDraftError,
  draftFromClaim,
  filterClaims,
  isClaimExpired,
  scopeSummary,
  type Claim,
  type ClaimDraft,
  type ClaimFilter,
} from "./claimsData";
import { claimErrorText, openClaimProof, useClaimMutations, useClaims } from "./useClaims";

interface Props {
  headLeft: React.ReactNode;
}

type Names = { products: Map<string, string>; locations: Map<string, string> };

/** Daftar Klaim: every fact the brand may state, with proof and approval. Owner/admin approve or reject. */
export function ClaimsTab({ headLeft }: Props) {
  const claims = useClaims();
  const library = useLibraryData();
  const role = useCurrentUserRole();
  const canDecide = role.data === "owner" || role.data === "admin";
  const m = useClaimMutations();
  const [filter, setFilter] = useState<ClaimFilter>({ status: "all", scope: "all", q: "" });
  const [sel, setSel] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const all = useMemo(() => claims.data ?? [], [claims.data]);
  const shown = useMemo(() => filterClaims(all, filter), [all, filter]);
  const names = useMemo<Names>(() => {
    const sources = library.data?.sources ?? [];
    return {
      products: new Map((library.data?.menus ?? []).map((x) => [x.id, linkedProductName(x, sources)])),
      locations: new Map((library.data?.locations ?? []).map((x) => [x.id, x.nama])),
    };
  }, [library.data]);

  useEffect(() => {
    if (editing) return;
    if (!shown.length) return;
    if (!sel || !shown.some((c) => c.id === sel)) setSel(shown[0].id);
  }, [shown, sel, editing]);

  const current = all.find((c) => c.id === sel) ?? null;
  const counts = {
    needs_proof: all.filter((c) => c.status === "needs_proof").length,
    approved: all.filter((c) => c.status === "approved").length,
    rejected: all.filter((c) => c.status === "rejected").length,
  };

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(claimErrorText(err));
    }
  };

  return (
    <>
      <header className="ck-head">{headLeft}</header>
      <div className="pmw">
        <div className="pml">
          <div className="list-head">
            <div className="gt">Daftar klaim</div>
            <button
              type="button"
              className="hb"
              onClick={() => {
                setError(null);
                setEditing("new");
              }}
            >
              Tambah klaim
            </button>
          </div>
          <div className="claim-filters">
            {(["all", "needs_proof", "approved", "rejected"] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={"chip" + (filter.status === s ? " on" : "")}
                onClick={() => setFilter((f) => ({ ...f, status: s }))}
              >
                {s === "all" ? `Semua (${all.length})` : `${CLAIM_STATUS_LABEL[s]} (${counts[s]})`}
              </button>
            ))}
          </div>
          <div className="claim-filters">
            <select
              aria-label="Cakupan"
              value={filter.scope}
              onChange={(e) => setFilter((f) => ({ ...f, scope: e.target.value as ClaimFilter["scope"] }))}
            >
              <option value="all">Semua cakupan</option>
              <option value="brand">Brand</option>
              <option value="product">Produk</option>
              <option value="location">Lokasi</option>
            </select>
            <input
              type="search"
              placeholder="Cari kalimat atau kode"
              value={filter.q}
              onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
            />
          </div>
          {claims.isPending ? <div className="loading">Memuat…</div> : null}
          {claims.error ? <div className="empty">Gagal memuat. Coba muat ulang halaman.</div> : null}
          {shown.map((c) => (
            <div
              key={c.id}
              className={"it" + (c.id === sel && editing !== "new" ? " on" : "")}
              onClick={() => {
                setSel(c.id);
                setEditing(null);
                setError(null);
              }}
            >
              <span>
                <b>{c.code}</b> {c.text}
              </span>
              <ClaimChip claim={c} />
            </div>
          ))}
          {claims.data && !shown.length ? (
            <div className="sub">{all.length ? "Tidak ada klaim yang cocok." : "Belum ada klaim."}</div>
          ) : null}
        </div>
        <div className="pmr">
          {editing ? (
            <ClaimEditor
              key={editing}
              claim={editing === "new" ? null : current}
              names={names}
              busy={m.busy}
              canDecide={canDecide}
              onCancel={() => {
                setEditing(null);
                setError(null);
              }}
              onSave={async (draft) => {
                setError(null);
                try {
                  const id = await m.save({ claim: editing === "new" ? null : current, draft });
                  setSel(id);
                  setEditing(null);
                } catch (err) {
                  setError(claimErrorText(err));
                }
              }}
              error={error}
            />
          ) : current ? (
            <ClaimDetail
              claim={current}
              names={names}
              canDecide={canDecide}
              busy={m.busy}
              error={error}
              onEdit={() => {
                setError(null);
                setEditing(current.id);
              }}
              onApprove={() => run(() => m.decide({ claim: current, status: "approved" }))}
              onReject={(reason) => run(() => m.decide({ claim: current, status: "rejected", reason }))}
              onReopen={() => run(() => m.decide({ claim: current, status: "needs_proof" }))}
              onDelete={() =>
                run(async () => {
                  if (!window.confirm(`Hapus klaim ${current.code}? Jejak pemakaiannya ikut terhapus.`)) return;
                  await m.remove(current);
                  setSel(null);
                })
              }
              onAttach={(file) => run(() => m.attachProof({ claim: current, file }))}
              onDetach={() => run(() => m.detachProof(current))}
            />
          ) : claims.data ? (
            <div className="sub">
              Klaim adalah fakta yang boleh disebut di konten, iklan, dan balasan chat. Tambah klaim, lampirkan bukti, lalu
              owner atau admin menyetujuinya.
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

export function ClaimChip({ claim }: { claim: Claim }) {
  if (claim.status === "approved" && isClaimExpired(claim)) return <span className="st w">kedaluwarsa</span>;
  return <span className={"st " + CLAIM_STATUS_CLASS[claim.status]}>{CLAIM_STATUS_LABEL[claim.status].toLowerCase()}</span>;
}

function ClaimDetail({
  claim,
  names,
  canDecide,
  busy,
  error,
  onEdit,
  onApprove,
  onReject,
  onReopen,
  onDelete,
  onAttach,
  onDetach,
}: {
  claim: Claim;
  names: Names;
  canDecide: boolean;
  busy: boolean;
  error: string | null;
  onEdit: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onReopen: () => void;
  onDelete: () => void;
  onAttach: (file: File) => void;
  onDetach: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [openError, setOpenError] = useState<string | null>(null);
  const blocker = approveBlocker(claim);
  return (
    <>
      <div className="list-head">
        <h2 style={{ margin: 0 }}>
          {claim.code} <ClaimChip claim={claim} />
        </h2>
        <span>
          <button type="button" className="hb ghost" disabled={busy} onClick={onEdit}>
            Ubah
          </button>{" "}
          {canDecide ? (
            <button type="button" className="hb ghost" disabled={busy} onClick={onDelete}>
              Hapus
            </button>
          ) : null}
        </span>
      </div>
      {error ? <div className="empty">{error}</div> : null}
      <div className="blk">
        <div className="hd">
          <b>Kalimat klaim</b>
        </div>
        <pre>{claim.text}</pre>
      </div>
      <div className="blk">
        <div className="hd">
          <b>Cakupan</b>
        </div>
        <pre>{scopeSummary(claim, names)}</pre>
      </div>
      <div className="blk">
        <div className="hd">
          <b>Bukti</b>
        </div>
        {claim.proof ? <pre>{claim.proof}</pre> : <div className="emp">Belum ada bukti tertulis.</div>}
        <div className="row-actions">
          {claim.proof_file_path ? (
            <>
              <button
                type="button"
                className="hb ghost"
                onClick={() => {
                  setOpenError(null);
                  openClaimProof(claim.proof_file_path as string).catch((err) => setOpenError(claimErrorText(err)));
                }}
              >
                Buka file bukti
              </button>
              <button type="button" className="hb ghost" disabled={busy} onClick={onDetach}>
                Lepas file
              </button>
            </>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept={CLAIM_PROOF_ACCEPT}
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onAttach(file);
            }}
          />
          <button type="button" className="hb ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
            {claim.proof_file_path ? "Ganti file" : "Lampirkan file (foto/PDF, maks 5 MB)"}
          </button>
        </div>
        {openError ? <div className="empty">{openError}</div> : null}
      </div>
      <div className="blk">
        <div className="hd">
          <b>Status</b>
        </div>
        <pre>
          {CLAIM_STATUS_LABEL[claim.status]}
          {claim.approved_at
            ? ` · ${claim.status === "rejected" ? "ditolak" : "disetujui"} ${new Date(claim.approved_at).toLocaleDateString("id-ID")}`
            : ""}
          {claim.valid_until ? ` · berlaku sampai ${new Date(`${claim.valid_until}T00:00:00`).toLocaleDateString("id-ID")}` : ""}
          {claim.rejection_reason ? `\nAlasan ditolak: ${claim.rejection_reason}` : ""}
        </pre>
        {canDecide ? (
          <div className="row-actions">
            {claim.status !== "approved" ? (
              <button type="button" className="hb" disabled={busy || Boolean(blocker)} title={blocker ?? ""} onClick={onApprove}>
                Setujui
              </button>
            ) : null}
            {claim.status !== "rejected" && !rejecting ? (
              <button type="button" className="hb ghost" disabled={busy} onClick={() => setRejecting(true)}>
                Tolak
              </button>
            ) : null}
            {claim.status !== "needs_proof" ? (
              <button type="button" className="hb ghost" disabled={busy} onClick={onReopen}>
                Kembalikan ke perlu bukti
              </button>
            ) : null}
          </div>
        ) : (
          <div className="sub">Hanya owner atau admin yang bisa menyetujui atau menolak.</div>
        )}
        {canDecide && claim.status !== "approved" && blocker ? <div className="sub">{blocker}</div> : null}
        {rejecting ? (
          <div className="lib-edit">
            <label htmlFor="claim-reject-reason">Alasan ditolak (opsional)</label>
            <input id="claim-reject-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
            <div className="row-actions">
              <button
                type="button"
                className="hb"
                disabled={busy}
                onClick={() => {
                  onReject(reason);
                  setRejecting(false);
                  setReason("");
                }}
              >
                Tolak klaim
              </button>
              <button type="button" className="hb ghost" onClick={() => setRejecting(false)}>
                Batal
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="gt" style={{ margin: "16px 0 6px" }}>
        Jejak pemakaian ({claim.uses.length})
      </div>
      {claim.uses.length ? (
        claim.uses.map((u) => (
          <div key={u.id} className="sub">
            {CLAIM_USE_MODULE_LABEL[u.module] ?? u.module}: {u.label || u.ref_id} ·{" "}
            {new Date(u.created_at).toLocaleDateString("id-ID")}
          </div>
        ))
      ) : (
        <div className="sub">Belum dipakai di konten mana pun.</div>
      )}
    </>
  );
}

function ClaimEditor({
  claim,
  names,
  busy,
  canDecide,
  error,
  onCancel,
  onSave,
}: {
  claim: Claim | null;
  names: Names;
  busy: boolean;
  canDecide: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (draft: ClaimDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ClaimDraft>(() => draftFromClaim(claim));
  const [local, setLocal] = useState<string | null>(null);
  const textChanged = Boolean(claim && claim.status === "approved" && draft.text.trim() !== claim.text);
  const toggle = (key: "productIds" | "locationIds", id: string) =>
    setDraft((d) => ({ ...d, [key]: d[key].includes(id) ? d[key].filter((x) => x !== id) : [...d[key], id] }));
  return (
    <form
      className="lib-edit"
      onSubmit={(event) => {
        event.preventDefault();
        const problem = claimDraftError(draft);
        setLocal(problem);
        if (!problem) void onSave(draft);
      }}
    >
      <h2>{claim ? `Ubah ${claim.code}` : "Klaim baru"}</h2>
      <label htmlFor="claim-text">Kalimat klaim</label>
      <textarea
        id="claim-text"
        value={draft.text}
        maxLength={500}
        placeholder="Contoh: Kuah sop sumsum dimasak 8 jam."
        onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
      />
      <div className="sub">Satu fakta per klaim, ditulis seperti yang boleh diucapkan di konten.</div>
      {textChanged ? <div className="wait">Kalimat berubah: klaim kembali ke perlu bukti dan perlu disetujui lagi.</div> : null}
      <label htmlFor="claim-proof">Bukti</label>
      <textarea
        id="claim-proof"
        value={draft.proof}
        maxLength={2000}
        placeholder="Sumber, angka, nomor sertifikat, atau siapa yang memastikan."
        onChange={(e) => setDraft((d) => ({ ...d, proof: e.target.value }))}
      />
      <div className="sub">File bukti (foto/PDF) bisa dilampirkan setelah klaim disimpan.</div>
      <label htmlFor="claim-valid">Berlaku sampai (opsional)</label>
      <input
        id="claim-valid"
        type="date"
        value={draft.validUntil}
        onChange={(e) => setDraft((d) => ({ ...d, validUntil: e.target.value }))}
      />
      <div className="sub">Lewat tanggal ini, klaim otomatis kembali ke perlu bukti.</div>
      <label>Cakupan</label>
      <label className="claim-check">
        <input type="checkbox" checked={draft.brand} onChange={(e) => setDraft((d) => ({ ...d, brand: e.target.checked }))} />
        Semua produk & lokasi (brand)
      </label>
      {!draft.brand ? (
        <>
          <div className="sub">Produk</div>
          {[...names.products].map(([id, name]) => (
            <label key={id} className="claim-check">
              <input type="checkbox" checked={draft.productIds.includes(id)} onChange={() => toggle("productIds", id)} />
              {name}
            </label>
          ))}
          {!names.products.size ? <div className="sub">Belum ada produk di tab Produk.</div> : null}
          <div className="sub">Lokasi</div>
          {[...names.locations].map(([id, name]) => (
            <label key={id} className="claim-check">
              <input type="checkbox" checked={draft.locationIds.includes(id)} onChange={() => toggle("locationIds", id)} />
              {name}
            </label>
          ))}
          {!names.locations.size ? <div className="sub">Belum ada lokasi di tab Lokasi.</div> : null}
        </>
      ) : null}
      {!claim && !canDecide ? <div className="sub">Klaim baru masuk sebagai perlu bukti sampai owner atau admin menyetujui.</div> : null}
      {local || error ? (
        <div className="empty" style={{ marginTop: 8 }}>
          {local || error}
        </div>
      ) : null}
      <div className="row-actions">
        <button type="submit" className="hb" disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan"}
        </button>
        <button type="button" className="hb ghost" onClick={onCancel} disabled={busy}>
          Batal
        </button>
      </div>
    </form>
  );
}
