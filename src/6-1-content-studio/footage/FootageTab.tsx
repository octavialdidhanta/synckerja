import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  emptyFilters,
  filterGroups,
  NM,
  countLabel,
  filterOptions,
  label,
  optionCount,
  usageCount,
  visibleRows,
  type FilterKey,
  type Filters,
  type FootageRow,
  type TagDefRecord,
  type ViewMode,
} from "./footageRows";
import { useFootageData } from "./useFootageData";
import { useFootageBan, useFootageTagCheck } from "./useFootageBan";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { connectBank, loadBankState, openBankFile, type BankState } from "./localBank";

interface Props {
  /** Title and studio tabs, shown at the left of the header. */
  headLeft: React.ReactNode;
}

const fmt = (n: number, d = 1) => n.toFixed(d);

export function FootageTab({ headLeft }: Props) {
  const { data, isPending, error } = useFootageData();
  const { setBan } = useFootageBan();
  const checkTags = useFootageTagCheck();
  const { organizationId } = useOrgBootstrapPending();
  const [F, setF] = useState<Filters>(() => emptyFilters());
  const [view, setView] = useState<ViewMode>("scene");
  const [q, setQ] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [bank, setBank] = useState<{ state: BankState; name: string | null }>({ state: "none", name: null });
  const [open, setOpen] = useState<{ row: FootageRow; onlySeg: boolean } | null>(null);

  // The bank-footage folder is remembered per organization; switching org loads that org's folder.
  useEffect(() => {
    setBank({ state: "none", name: null });
    void loadBankState(organizationId).then(setBank);
  }, [organizationId]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const tagDefs = useMemo(() => data?.tagDefs ?? [], [data]);
  const groups = useMemo(() => filterGroups(tagDefs), [tagDefs]);
  const opts = useMemo(() => (data ? filterOptions(data) : null), [data]);
  const L = useMemo(() => visibleRows(rows, F, q, view), [rows, F, q, view]);

  useEffect(() => {
    setF(emptyFilters(tagDefs));
  }, [organizationId, tagDefs]);

  const connect = useCallback(
    async (forcePick = false) => {
      setBank(await connectBank(organizationId, forcePick));
    },
    [organizationId],
  );
  const openFile = useCallback((fileKey: string) => openBankFile(organizationId, fileKey), [organizationId]);

  const headerRight = (
    <>
      <span className="cnt">{data ? countLabel(L, view) : ""}</span>
      <div className="top-r">
        <span className="live">
          {bank.state === "ready" ? (
            <span className="livok" title={`Video diputar langsung dari folder "${bank.name}" di laptop`}>
              ● Laptop: {bank.name}
            </span>
          ) : bank.state === "unsupported" ? (
            <span className="livno">Putar video butuh Chrome/Edge</span>
          ) : bank.state === "needs-permission" ? (
            <button type="button" className="hb" onClick={() => void connect()}>
              Izinkan folder {bank.name}
            </button>
          ) : (
            <button type="button" className="hb" onClick={() => void connect(true)}>
              Hubungkan folder bank-footage
            </button>
          )}
        </span>
        <button type="button" className="fb" onClick={() => setShowFilters((v) => !v)}>
          Filter
        </button>
        <input
          className="q"
          placeholder="Cari: gigit, keju, cocol, bakar, sumsum…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="seg">
          {(["scene", "klip"] as ViewMode[]).map((o) => (
            <button key={o} type="button" className={"chip" + (view === o ? " on" : "")} onClick={() => setView(o)}>
              Per {o}
            </button>
          ))}
        </span>
      </div>
    </>
  );

  const active = (Object.keys(F) as FilterKey[]).filter((k) => F[k] !== null);
  const setKey = (k: FilterKey, v: string | null) => setF((prev) => ({ ...prev, [k]: v }));

  const openRow = async (row: FootageRow, onlySeg: boolean) => {
    if (bank.state === "needs-permission") setBank(await connectBank(organizationId));
    setOpen({ row, onlySeg });
  };

  return (
    <>
    <header className="ck-head">
      {headLeft}
      {headerRight}
    </header>
    <div className={"wrap" + (showFilters ? " showf" : "")}>
      <aside className="side">
        {opts &&
          groups.map(({ key, title }) => (
            <div className="grp" key={key}>
              <div className="gt">{title}</div>
              <div className="opts">
                {[null, ...(opts[key] ?? [])].map((o) => {
                  const on = F[key] === o;
                  const n = optionCount(rows, F, q, view, key, o);
                  const text = o === null ? "Semua" : label(key, o, tagDefs);
                  return (
                    <button
                      key={o ?? "__all"}
                      type="button"
                      title={text}
                      className={"chip" + (on ? " on" : "") + (n === 0 && !on ? " zero" : "")}
                      onClick={() => setKey(key, o)}
                    >
                      <span>{text}</span>
                      <span className="n">{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
      </aside>
      <div className="content">
        {active.length || q.trim() ? (
          <div className="bar">
            {q.trim() ? (
              <span className="pill">
                Cari: {q.trim()}{" "}
                <button type="button" onClick={() => setQ("")}>
                  ×
                </button>
              </span>
            ) : null}
            {active.map((k) => (
              <span className="pill" key={k}>
                {label(k, F[k] as string, tagDefs)}{" "}
                <button type="button" onClick={() => setKey(k, null)}>
                  ×
                </button>
              </span>
            ))}
            {active.length + (q.trim() ? 1 : 0) > 1 ? (
              <button
                type="button"
                className="reset"
                onClick={() => {
                  setF(emptyFilters(tagDefs));
                  setQ("");
                }}
              >
                Reset semua
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="grid">
          {isPending ? <div className="loading">Memuat footage…</div> : null}
          {error ? <div className="empty">Gagal memuat footage. Coba muat ulang halaman.</div> : null}
          {data && !L.length ? <div className="empty">Nggak ada yang cocok.</div> : null}
          {data &&
            L.map((d) => (
              <Card
                key={d.id}
                d={d}
                view={view}
                tagDefs={tagDefs}
                thumb={d.thumbPath ? data.thumbs[d.thumbPath] : undefined}
                onOpen={openRow}
              />
            ))}
        </div>
      </div>
      {open && data ? (
        <PlayerModal
          rows={rows}
          initial={open}
          thumbs={data.thumbs}
          bank={bank}
          openFile={openFile}
          onConnect={connect}
          onSetBan={setBan}
          onCheckTags={checkTags}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
    </>
  );
}

function Card({
  d,
  view,
  thumb,
  tagDefs,
  onOpen,
}: {
  d: FootageRow;
  view: ViewMode;
  thumb?: string;
  tagDefs: TagDefRecord[];
  onOpen: (d: FootageRow, onlySeg: boolean) => void;
}) {
  const n = usageCount(d, view);
  const tm = d.img ? "🖼 gambar" : view === "scene" ? `${fmt(d.a)}–${fmt(d.b)}s` : "klip";
  const tagLabel = (key: string) => tagDefs.find((t) => t.key === key)?.label ?? key.replace(/_/g, " ");
  return (
    <div className={"c" + (d.ban ? " ban" : "")} onClick={() => onOpen(d, view === "scene")}>
      {thumb ? <img loading="lazy" src={thumb} alt="" /> : <div className="noimg">tanpa thumbnail</div>}
      <span className="tm">{tm}</span>
      {d.baru ? <span className="nw">BARU</span> : null}
      {d.ban ? <span className="bn">JANGAN DIPAKAI</span> : null}
      {d.tag !== "dicek" ? (
        <span className="ai" title={d.tag === "belum" ? "Belum ditag" : "Tag dari AI, belum dicek orang"}>
          {d.tag === "belum" ? "BELUM DITAG" : "AI · CEK"}
        </span>
      ) : null}
      <div className="b">
        <div className="s">{view === "scene" ? d.isi : d.klip}</div>
        <div className="tg">
          <i>{d.lok}</i>
          <i>{NM.jenis[d.jenis] ?? d.jenis}</i>
          {Object.entries(d.tags).map(([key, val]) => {
            if (val !== true && val !== "ya" && val !== "true") {
              if (key === "lengkuas" && (val === false || val === "tidak")) return <i key={key}>tanpa lengkuas</i>;
              if (typeof val === "string" && val && val !== "tidak" && val !== "false") {
                return (
                  <i key={key} className="w">
                    {tagLabel(key)}: {val}
                  </i>
                );
              }
              return null;
            }
            const text =
              key === "hijab"
                ? "ada hijab"
                : key === "watermark_ui"
                  ? "watermark/UI"
                  : key === "meja_biru"
                    ? "meja biru"
                    : tagLabel(key).toLowerCase();
            return (
              <i key={key} className="w">
                {text}
              </i>
            );
          })}
          {n ? <i className="k">dipakai {n}x</i> : <i className="k fresh">belum dipakai</i>}
        </div>
      </div>
    </div>
  );
}

function PlayerModal({
  rows,
  initial,
  thumbs,
  bank,
  openFile,
  onConnect,
  onSetBan,
  onCheckTags,
  onClose,
}: {
  rows: FootageRow[];
  initial: { row: FootageRow; onlySeg: boolean };
  thumbs: Record<string, string>;
  bank: { state: BankState; name: string | null };
  openFile: (fileKey: string) => Promise<File>;
  onConnect: (forcePick?: boolean) => Promise<void>;
  onSetBan: (sceneId: string, reason: string | null) => Promise<boolean>;
  onCheckTags: (assetId: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [d, setD] = useState(initial.row);
  const [seg, setSeg] = useState<[number, number] | null>(initial.onlySeg ? [initial.row.a, initial.row.b] : null);
  const [src, setSrc] = useState<{ f: string; url: string } | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
  // Bumped after "Pilih ulang folder" so we retry open even when the folder name is unchanged.
  const [loadNonce, setLoadNonce] = useState(0);
  const [banBusy, setBanBusy] = useState(false);
  const vref = useRef<HTMLVideoElement>(null);
  const sc = useMemo(() => rows.filter((x) => x.f === d.f), [rows, d.f]);

  // Keep the open scene in sync when the footage cache updates (ban / unban from this modal).
  useEffect(() => {
    const latest = rows.find((r) => r.id === d.id);
    if (!latest) return;
    setD((prev) =>
      prev.id === latest.id && prev.ban === latest.ban && prev.tag === latest.tag
        ? prev
        : { ...prev, ban: latest.ban, tag: latest.tag },
    );
  }, [rows, d.id]);

  // Load the original file from the laptop folder once per clip (or after re-pick).
  useEffect(() => {
    if (bank.state !== "ready") return;
    let cancelled = false;
    setFileErr(null);
    openFile(d.f)
      .then((file) => {
        if (cancelled) return;
        setSrc((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { f: d.f, url: URL.createObjectURL(file) };
        });
      })
      .catch(() => {
        if (cancelled) return;
        setSrc((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return null;
        });
        setFileErr(`File nggak ketemu di folder "${bank.name}". Pastikan yang dipilih folder bank-footage.`);
      });
    return () => {
      cancelled = true;
    };
  }, [bank.state, bank.name, d.f, openFile, loadNonce]);

  const rePickFolder = () => {
    void (async () => {
      await onConnect(true);
      setSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return null;
      });
      setFileErr(null);
      setLoadNonce((n) => n + 1);
    })();
  };

  useEffect(
    () => () => {
      setSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return null;
      });
    },
    [],
  );

  // Jump to the scene start whenever the scene or source changes.
  useEffect(() => {
    const v = vref.current;
    if (!v || !src || src.f !== d.f || d.img) return;
    const go = () => {
      v.currentTime = d.a;
      void v.play().catch(() => undefined);
    };
    if (v.readyState >= 1) go();
    else v.onloadedmetadata = go;
  }, [src, d]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onTime = () => {
    const v = vref.current;
    if (v && seg && v.currentTime >= seg[1] - 0.03) v.currentTime = seg[0];
  };

  const thumb = d.thumbPath ? thumbs[d.thumbPath] : undefined;
  const ready = bank.state === "ready" && src?.f === d.f && !fileErr;

  let notice: React.ReactNode = null;
  if (!ready) {
    if (bank.state === "unsupported") notice = <>Putar video asli dari laptop butuh Chrome atau Edge.</>;
    else if (bank.state === "none")
      notice = (
        <>
          Hubungkan folder <b>bank-footage</b> di laptop untuk memutar video asli.
          <br />
          <button type="button" className="hb" onClick={rePickFolder}>
            Pilih folder bank-footage
          </button>
        </>
      );
    else if (bank.state === "needs-permission")
      notice = (
        <>
          Izinkan akses ke folder <b>{bank.name}</b>.
          <br />
          <button type="button" className="hb" onClick={() => void onConnect()}>
            Izinkan
          </button>
        </>
      );
    else if (fileErr)
      notice = (
        <>
          {fileErr}
          <br />
          <button type="button" className="hb" onClick={rePickFolder}>
            Pilih ulang folder
          </button>
        </>
      );
    else notice = <>Membuka file…</>;
  }

  const pickScene = (x: FootageRow | "all") => {
    if (x === "all") {
      setD(sc[0]);
      setSeg(null);
    } else {
      setD(x);
      setSeg([x.a, x.b]);
    }
  };

  const markBan = () => {
    const reason = window.prompt("Alasan scene ini nggak boleh dipakai? (opsional)", "");
    if (reason === null) return;
    setBanBusy(true);
    void onSetBan(d.id, reason.trim() || "tidak sesuai")
      .then((ok) => {
        if (ok) setD((prev) => ({ ...prev, ban: reason.trim() || "tidak sesuai" }));
      })
      .finally(() => setBanBusy(false));
  };

  const clearBan = () => {
    setBanBusy(true);
    void onSetBan(d.id, null)
      .then((ok) => {
        if (ok) setD((prev) => ({ ...prev, ban: null }));
      })
      .finally(() => setBanBusy(false));
  };

  return (
    <div className="m" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <button type="button" className="x" onClick={onClose}>
        ×
      </button>
      <div className="mb">
        {ready && !d.img ? (
          <video ref={vref} src={src!.url} controls muted playsInline onTimeUpdate={onTime} />
        ) : ready && d.img ? (
          <img className="mimg" src={src!.url} alt="" />
        ) : (
          <div className="mph">
            {thumb ? <img className="mimg" src={thumb} alt="" /> : <div className="mimg" style={{ width: 300, aspectRatio: "9/16" }} />}
            <div className="msg">{notice}</div>
          </div>
        )}
        <div className="mi">
          <div style={{ fontSize: 15, marginBottom: 8 }}>{d.isi}</div>
          {d.img ? (
            <div>
              <b>Tipe</b>gambar
            </div>
          ) : (
            <div>
              <b>Scene</b>
              {d.sc} dari {sc.length} · {fmt(d.a, 2)}–{fmt(d.b, 2)}s
            </div>
          )}
          <div>
            <b>Isi klip</b>
            {d.klip}
          </div>
          <div>
            <b>Lokasi</b>
            {d.lok}
          </div>
          <div>
            <b>Produk</b>
            {d.prod.join(", ") || "—"}
          </div>
          <div>
            <b>Hijab</b>
            {d.hijab}
          </div>
          <div>
            <b>Watermark/UI</b>
            {d.wm}
          </div>
          <div>
            <b>Scene ini</b>
            {d.sp.length ? `dipakai ${d.sp.length}x: ${d.sp.join(", ")}` : "belum pernah dipakai"}
          </div>
          <div>
            <b>Klip ini</b>
            {d.pakai || "belum dipakai"}
          </div>
          {d.cat ? (
            <div>
              <b>Catatan</b>
              {d.cat}
            </div>
          ) : null}
          {!d.img ? (
            <div className="sl">
              {sc.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  className={x.sc === d.sc && seg ? "on" : ""}
                  onClick={() => pickScene(x)}
                >
                  s{x.sc} {fmt(x.a)}s
                </button>
              ))}
              <button type="button" className={seg ? "" : "on"} onClick={() => pickScene("all")}>
                Putar semua
              </button>
            </div>
          ) : null}
          {d.tag !== "dicek" ? (
            <div className="ai-note">
              <b>{d.tag === "belum" ? "Belum ditag" : "Tag dari AI"}</b>
              {d.tag === "belum"
                ? "Agent baru memasukkan klip ini. Tag AI menyusul otomatis."
                : "Cek isi, lokasi, produk, hijab & watermark. Kalau ada yang salah, ubah lewat Claude; kalau sudah benar, klik tombol di bawah."}
              {d.tag === "perlu_dicek" ? (
                <button type="button" className="btn" onClick={() => void onCheckTags(d.assetId)}>
                  ✓ Tag sudah benar
                </button>
              ) : null}
            </div>
          ) : null}
          {d.ban ? (
            <div className="ban-note">
              <b>Jangan dipakai</b>
              {d.ban}
            </div>
          ) : null}
          <div className="act">
            {d.ban ? (
              <button type="button" className="btn g" disabled={banBusy} onClick={clearBan}>
                Batalkan tanda
              </button>
            ) : (
              <button type="button" className="btn" disabled={banBusy} onClick={markBan}>
                🚫 Tandai jangan dipakai
              </button>
            )}
          </div>
          <div style={{ marginTop: 12 }}>
            <code>{d.f}</code>
          </div>
        </div>
      </div>
    </div>
  );
}
