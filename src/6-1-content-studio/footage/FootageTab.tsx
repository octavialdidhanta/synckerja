import { useEffect, useMemo, useRef, useState } from "react";
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
import { footagePlayUrl, probeAgent, probeFootage, type AgentLink } from "./localPlay";

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
  const [agent, setAgent] = useState<AgentLink>("checking");
  const [open, setOpen] = useState<{ row: FootageRow; onlySeg: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAgent("checking");
    void probeAgent().then((ok) => {
      if (!cancelled) setAgent(ok ? "on" : "off");
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const tagDefs = useMemo(() => data?.tagDefs ?? [], [data]);
  const groups = useMemo(() => filterGroups(tagDefs), [tagDefs]);
  const opts = useMemo(() => (data ? filterOptions(data) : null), [data]);
  const L = useMemo(() => visibleRows(rows, F, q, view), [rows, F, q, view]);

  useEffect(() => {
    setF(emptyFilters(tagDefs));
  }, [organizationId, tagDefs]);

  const laptopLive =
    agent === "on" ? (
      <span className="livok" title="Video diputar dari folder yang dipilih di Siapkan Synckerja">
        ● Laptop
      </span>
    ) : agent === "off" ? (
      <span className="livno">Agent off</span>
    ) : null;

  const headerRight = (
    <>
      <span className="cnt">{data ? countLabel(L, view) : ""}</span>
      <div className="top-r">
        <span className="live">{laptopLive}</span>
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

  const openRow = (row: FootageRow, onlySeg: boolean) => {
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
          organizationId={organizationId}
          agent={agent}
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
  organizationId,
  agent,
  onSetBan,
  onCheckTags,
  onClose,
}: {
  rows: FootageRow[];
  initial: { row: FootageRow; onlySeg: boolean };
  thumbs: Record<string, string>;
  organizationId: string | null | undefined;
  agent: AgentLink;
  onSetBan: (sceneId: string, reason: string | null) => Promise<boolean>;
  onCheckTags: (assetId: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [d, setD] = useState(initial.row);
  const [seg, setSeg] = useState<[number, number] | null>(initial.onlySeg ? [initial.row.a, initial.row.b] : null);
  const [src, setSrc] = useState<{ f: string; url: string } | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
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

  // Ask the Agent on this laptop for the original file. The page does not pick a folder.
  useEffect(() => {
    let cancelled = false;
    setFileErr(null);
    setSrc(null);
    if (agent !== "on" || !organizationId) {
      return () => {
        cancelled = true;
      };
    }
    const url = footagePlayUrl(organizationId, d.f);
    void probeFootage(organizationId, d.f).then((result) => {
      if (cancelled) return;
      if (result === "ok") setSrc({ f: d.f, url });
      else if (result === "missing") setFileErr("File tidak ada di folder laptop");
      else if (result === "other-org") setFileErr("Laptop ini bukan untuk organisasi ini");
      else if (result === "pending") setFileErr("Agent belum tersambung ke organisasi ini");
      else setFileErr("Agent belum jalan");
    });
    return () => {
      cancelled = true;
    };
  }, [agent, organizationId, d.f]);

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
  const ready = Boolean(src?.f === d.f && src.url && !fileErr);

  let notice: React.ReactNode = null;
  if (!ready) {
    if (fileErr) notice = <>{fileErr}</>;
    else if (agent === "off") notice = <>Agent belum jalan</>;
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
          <div className="mph">
            <video
              ref={vref}
              src={src!.url}
              crossOrigin="anonymous"
              controls
              muted
              playsInline
              onTimeUpdate={onTime}
            />
          </div>
        ) : ready && d.img ? (
          <img className="mimg" src={src!.url} alt="" />
        ) : (
          <div className="mph">
            {thumb ? <img className="mimg" src={thumb} alt="" /> : <div className="mimg" style={{ width: 300, aspectRatio: "9/16" }} />}
            <div className="msg">{notice}</div>
          </div>
        )}
        <div className="mi">
          <p className="lead">{d.isi}</p>
          {d.img ? (
            <div className="row">
              <b>Tipe</b>
              <span>gambar</span>
            </div>
          ) : (
            <div className="row">
              <b>Scene</b>
              <span>
                {d.sc} dari {sc.length} · {fmt(d.a, 2)}–{fmt(d.b, 2)}s
              </span>
            </div>
          )}
          <div className="row">
            <b>Isi klip</b>
            <span>{d.klip}</span>
          </div>
          <div className="row">
            <b>Lokasi</b>
            <span>{d.lok}</span>
          </div>
          <div className="row">
            <b>Produk</b>
            <span>{d.prod.join(", ") || "—"}</span>
          </div>
          <div className="row">
            <b>Hijab</b>
            <span>{d.hijab}</span>
          </div>
          <div className="row">
            <b>Watermark/UI</b>
            <span>{d.wm}</span>
          </div>
          <div className="row">
            <b>Scene ini</b>
            <span>{d.sp.length ? `dipakai ${d.sp.length}x: ${d.sp.join(", ")}` : "belum pernah dipakai"}</span>
          </div>
          <div className="row">
            <b>Klip ini</b>
            <span>{d.pakai || "belum dipakai"}</span>
          </div>
          {d.cat ? (
            <div className="row">
              <b>Catatan</b>
              <span>{d.cat}</span>
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
                ? "Agent baru memasukkan klip ini. Tag AI otomatis menyusul jika Agent punya API key Claude; bisa juga ditag lewat Claude chat / MCP."
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
