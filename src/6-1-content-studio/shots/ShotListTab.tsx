import { useMemo, useState } from "react";
import { isFilled, type LocationItem, type MenuItem } from "../library/libraryData";
import { useLibraryData } from "../library/useLibraryData";
import {
  allPhotos,
  buildFlowPrompt,
  defaultSelection,
  ftag,
  locationAreas,
  type PromptFields,
  type RefPhoto,
  type Talk,
} from "./buildFlowPrompt";
import { missingMenus, splitJobs, type Shot, type ShotJob } from "./shotData";
import { useShotData } from "./useShotData";

interface Props {
  headLeft: React.ReactNode;
}

const QUICK = "quick";
const key = (j: ShotJob, s: Shot) => `${j.id}|${s.id}`;

/** Working copy of one shot (or the quick shot) while the user adjusts it. Not saved yet. */
interface Draft {
  menuIds: string[];
  locId: string;
  talk: Talk;
  angles: 1 | 2 | 3;
  action: string;
  curArea: string;
  /** null = default selection for the current menus, location, and area */
  sel: Set<string> | null;
}

function draftFromShot(job: ShotJob, s: Shot, menus: MenuItem[], locs: LocationItem[]): Draft {
  const lokExt = s.lokasi || job.lokasi;
  const loc = locs.find((l) => l.externalId === lokExt) ?? locs[0] ?? null;
  const areas = locationAreas(loc);
  const want = (s.pick !== undefined ? s.pick : s.area) || "";
  return {
    menuIds: s.menus.map((id) => menus.find((m) => m.externalId === id)?.id).filter((x): x is string => Boolean(x)),
    locId: loc?.id ?? "",
    talk: s.bicara ? "ngomong" : "diam",
    angles: s.angle,
    action: s.action,
    curArea: areas.includes(want) ? want : "",
    sel: s.fotos ? new Set(s.fotos) : null,
  };
}

export function ShotListTab({ headLeft }: Props) {
  const lib = useLibraryData();
  const shots = useShotData();
  const menus = useMemo(() => lib.data?.menus ?? [], [lib.data]);
  const locs = useMemo(() => lib.data?.locations ?? [], [lib.data]);
  const jobs = useMemo(() => shots.data?.jobs ?? [], [shots.data]);
  const { active, archived } = useMemo(() => splitJobs(jobs), [jobs]);
  const [selKey, setSelKey] = useState<string>(QUICK);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const picked = useMemo(() => {
    for (const j of jobs) for (const s of j.shots) if (key(j, s) === selKey) return { job: j, shot: s };
    return null;
  }, [jobs, selKey]);

  // Each shot (and the quick shot) keeps its own working copy while this page is open.
  const ready = Boolean(lib.data && shots.data);
  const draft: Draft | null = !ready
    ? null
    : (drafts[selKey] ??
      (picked
        ? draftFromShot(picked.job, picked.shot, menus, locs)
        : { menuIds: [], locId: locs[0]?.id ?? "", talk: "diam", angles: 1, action: "", curArea: "", sel: null }));
  const setDraft: React.Dispatch<React.SetStateAction<Draft | null>> = (u) =>
    setDrafts((all) => {
      const cur = all[selKey] ?? draft;
      const next = typeof u === "function" ? u(cur) : u;
      return next ? { ...all, [selKey]: next } : all;
    });

  const loading = lib.isPending || shots.isPending;
  const failed = lib.error || shots.error;

  return (
    <>
      <header className="ck-head">{headLeft}</header>
      <div className="pmw">
        <div className="pml">
          <div className="lh">
            <span>Shot List</span>
          </div>
          <div className={"it si" + (selKey === QUICK ? " on" : "")} onClick={() => setSelKey(QUICK)}>
            <span>⚡ Shot cepat (tanpa job)</span>
          </div>
          {loading ? <div className="loading">Memuat…</div> : null}
          {failed ? <div className="empty">Gagal memuat. Coba muat ulang halaman.</div> : null}
          {shots.data && !active.length ? (
            <div className="hint2">Belum ada job aktif. Minta Claude bikinin shot list dari content plan.</div>
          ) : null}
          {active.map((j) => (
            <JobList key={j.id} job={j} menus={menus} selKey={selKey} onPick={setSelKey} />
          ))}
          {archived.length ? (
            <details className="arsip" open={Boolean(picked?.job.arsip)}>
              <summary>Arsip ({archived.length})</summary>
              {archived.map((j) => (
                <JobList key={j.id} job={j} menus={menus} selKey={selKey} onPick={setSelKey} />
              ))}
            </details>
          ) : null}
        </div>
        <div className="pmr">
          {draft && lib.data && shots.data ? (
            <Rakit
              key={selKey}
              fields={shots.data.fields}
              menus={menus}
              locs={locs}
              photoUrls={lib.data.photos}
              picked={picked}
              draft={draft}
              setDraft={setDraft}
            />
          ) : null}
        </div>
      </div>
    </>
  );
}

function JobList({
  job,
  menus,
  selKey,
  onPick,
}: {
  job: ShotJob;
  menus: MenuItem[];
  selKey: string;
  onPick: (k: string) => void;
}) {
  const dn = job.shots.filter((s) => s.done).length;
  const n = job.shots.length;
  return (
    <>
      <div className="jh">
        <span className="jt" title={job.judul}>
          {job.judul}
        </span>
        {n ? <span className={"jc" + (dn === n ? " ok" : "")}>{`${dn}/${n}`}</span> : null}
      </div>
      {job.shots.map((s) => {
        const k = key(job, s);
        const mi = missingMenus(s, menus);
        return (
          <div key={k} className={"it si" + (k === selKey ? " on" : "") + (s.done ? " dn" : "")} onClick={() => onPick(k)}>
            <span>
              {s.id} — {s.judul}
            </span>
            {s.done ? (
              <span className="ck">✓</span>
            ) : mi.length ? (
              <span className="wk" title="Produk belum ada di katalog">
                ⚠
              </span>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function Rakit({
  fields,
  menus,
  locs,
  photoUrls,
  picked,
  draft,
  setDraft,
}: {
  fields: PromptFields;
  menus: MenuItem[];
  locs: LocationItem[];
  photoUrls: Record<string, string>;
  picked: { job: ShotJob; shot: Shot } | null;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft | null>>;
}) {
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const shotMenus = draft.menuIds.map((id) => menus.find((m) => m.id === id)).filter((m): m is MenuItem => Boolean(m));
  const loc = locs.find((l) => l.id === draft.locId) ?? null;
  const areas = locationAreas(loc);
  const all = allPhotos(shotMenus, loc);
  const sel = draft.sel ?? defaultSelection(shotMenus, loc, draft.curArea);
  const refs = all.filter((p) => sel.has(p.file));
  const missing = picked ? missingMenus(picked.shot, menus) : [];
  const result = buildFlowPrompt({
    fields,
    menus: shotMenus,
    loc,
    refs,
    action: draft.action,
    talk: draft.talk,
    angles: draft.angles,
    curArea: draft.curArea,
    shotArea: picked?.shot.area,
    missingMenus: missing,
    allMenus: menus,
  });

  const update = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const flash = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(null), 1800);
  };

  // katalog.html shotProd(): the picked product becomes the main one; its photos replace the old product photos.
  const setMainMenu = (id: string) => {
    if (!picked) return update({ menuIds: id ? [id] : [], sel: null });
    const old = draft.menuIds;
    const next = id ? [id, ...old.slice(1).filter((x) => x !== id)] : old.slice(1);
    const oldFiles = new Set(old.flatMap((m) => menus.find((x) => x.id === m)?.fotos.map((f) => f.file) ?? []));
    const newFiles = next.flatMap((m) => menus.find((x) => x.id === m)?.fotos.map((f) => f.file) ?? []);
    const keep = [...sel].filter((f) => !oldFiles.has(f));
    update({ menuIds: next, sel: new Set([...newFiles.slice(0, next.length > 1 ? 3 : 1), ...keep]) });
  };

  // katalog.html shotLok(): keep product photos, add the new location's photos of the current area.
  const setLocation = (id: string) => {
    if (!picked) return update({ locId: id, curArea: "", sel: null });
    const l = locs.find((x) => x.id === id) ?? null;
    const productFiles = new Set(menus.flatMap((m) => m.fotos.map((f) => f.file)));
    const keep = [...sel].filter((f) => productFiles.has(f));
    const add = (l?.fotos ?? []).filter((f) => draft.curArea && (f.area ?? []).includes(draft.curArea)).map((f) => f.file);
    const areasNext = locationAreas(l);
    update({ locId: id, curArea: areasNext.includes(draft.curArea) ? draft.curArea : "", sel: new Set([...keep, ...add]) });
  };

  const toggle = (p: RefPhoto) => {
    const next = new Set(sel);
    if (next.has(p.file)) next.delete(p.file);
    else next.add(p.file);
    update({ sel: next });
  };

  const copyText = async (t: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(t);
      flash(msg);
      return true;
    } catch {
      return false;
    }
  };

  const download = async (p: RefPhoto) => {
    const url = p.storagePath ? photoUrls[p.storagePath] : undefined;
    const name = (p.file || "foto.png").split("/").pop() as string;
    if (url) {
      try {
        const blob = await (await fetch(url)).blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      } catch {
        window.open(url, "_blank", "noopener");
      }
    }
    await copyText(ftag(p), `${ftag(p)} ke-copy. Paste di kolom prompt Flow.`);
  };

  const s = picked?.shot;
  return (
    <div style={{ maxWidth: 980, width: "100%" }}>
      {s && picked ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2>
              {s.id} — {s.judul}
            </h2>
            <div className="sub">
              {picked.job.judul}
              {s.timing ? ` · detik ${s.timing}` : ""}
              {s.vo ? (
                <>
                  <br />
                  <i>VO: {s.vo}</i>
                </>
              ) : null}
            </div>
          </div>
          <div className="sbar">
            <span className={"donel" + (s.done ? " on" : "")}>{s.done ? "✓ Sudah generate" : "Belum generate"}</span>
          </div>
        </div>
      ) : (
        <>
          <h2>Rakit prompt Google Flow</h2>
          <div className="sub">Pilih menu dan lokasi, tulis action-nya, lalu copy. Teks deskripsi dipakai apa adanya.</div>
        </>
      )}
      <div className="note">Perubahan di sini belum tersimpan ke shot list (simpan menyusul). Copy prompt tetap bisa dipakai.</div>

      <div className="fr">
        <div>
          <label>Produk</label>
          <select value={draft.menuIds[0] ?? ""} onChange={(e) => setMainMenu(e.target.value)}>
            <option value="">— tanpa produk (shot lokasi/orang saja) —</option>
            {menus.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nama}
                {isFilled(m) ? "" : " (belum ada deskripsi)"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Lokasi</label>
          <select value={draft.locId} onChange={(e) => setLocation(e.target.value)}>
            {locs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nama}
                {isFilled(l) ? "" : " (belum ada deskripsi)"}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="fr">
        <div>
          <label>Orangnya ngomong?</label>
          <select value={draft.talk} onChange={(e) => update({ talk: e.target.value as Talk })}>
            <option value="diam">Diam — nggak ngomong (default)</option>
            <option value="ngomong">Ngomong — mulut gerak natural</option>
          </select>
        </div>
        <div>
          <label>Angle dalam 1 video</label>
          <select value={String(draft.angles)} onChange={(e) => update({ angles: Number(e.target.value) as 1 | 2 | 3 })}>
            <option value="1">1 angle — satu shot nonstop (default)</option>
            <option value="2">2 angle — ada cut di dalam video</option>
            <option value="3">3 angle — ada cut di dalam video</option>
          </select>
        </div>
      </div>

      <div className="rf">
        {areas.length ? (
          <div className="ach">
            <span>Pilih cepat per area:</span>
            {["", ...areas].map((a) => (
              <button
                key={a || "__all"}
                type="button"
                className={"chip" + (a === draft.curArea ? " on" : "")}
                onClick={() => update({ curArea: a, sel: null })}
              >
                {a || "Semua foto"}
              </button>
            ))}
          </div>
        ) : null}
        {!all.length ? (
          <>
            <div className="gt">Foto referensi untuk Flow</div>
            <div className="hint2">Belum ada foto. Tambahin di tab Produk atau Lokasi.</div>
          </>
        ) : (
          <>
            <div className="gt">
              Foto referensi untuk Flow — {refs.length} dari {all.length} dipakai
            </div>
            <div className="hint2">
              Klik kotak di pojok kiri foto buat <b>pakai / lepas</b>. Prompt otomatis ngikutin foto yang dipakai. Masukin ke
              Flow cuma foto yang dipakai: klik ikon download (nama file asli) → upload/seret ke Flow. <b>@nama-file</b>{" "}
              sekalian ke-copy buat ditempel di prompt.
            </div>
            <div className="rfg">
              {all.map((p) => {
                const on = sel.has(p.file);
                const url = p.storagePath ? photoUrls[p.storagePath] : undefined;
                return (
                  <div key={p.tp + p.id} className={"rfc" + (on ? " on" : " off")}>
                    <button type="button" className="cb" title={on ? "Lepas" : "Pakai"} onClick={() => toggle(p)}>
                      {on ? "✓" : ""}
                    </button>
                    <span className="tp">
                      {p.tp}
                      {p.area?.length ? " · " + p.area.join("/") : ""}
                    </span>
                    {url ? <img src={url} alt="" draggable title="Seret ke Google Flow" /> : <div className="noph">foto belum di-upload</div>}
                    <div className="cap">
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span className="lb" title={p.label}>
                          {p.label || "tanpa label"}
                        </span>
                        <span className="tg" title="Copy nama" onClick={() => void copyText(ftag(p), `${ftag(p)} ke-copy.`)}>
                          {ftag(p)}
                        </span>
                      </span>
                      <button type="button" className="ic" title="Download foto (nama asli) + copy @nama-file" onClick={() => void download(p)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 4v11" />
                          <path d="M7 10l5 5 5-5" />
                          <path d="M5 20h14" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <label className="albl">Action</label>
      <textarea
        className="act"
        value={draft.action}
        onChange={(e) => update({ action: e.target.value })}
        placeholder="Contoh: Close-up 45-degree… A hand slowly lifts one skewer toward the camera…"
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "12px 0 8px", gap: 10 }}>
        <span className="pw">{result.warnings.length ? "⚠ " + result.warnings.join(" · ") : ""}</span>
        <button
          type="button"
          className="pb"
          onClick={async () => {
            if (await copyText(result.text, "Prompt ke-copy.")) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            }
          }}
        >
          {copied ? "Tersalin ✓" : "Copy prompt"}
        </button>
      </div>
      <div className="hint2" style={{ margin: "0 0 8px" }}>
        {loc ? (
          result.noLocationPhoto ? (
            <>
              <b style={{ color: "#e8a33a" }}>Belum ada foto lokasi dicentang</b>: lokasi cuma pakai Scene, Atmosphere, Must
              NOT. Centang minimal 1 foto lokasi biar presisi. · Reference Photos <b>{refs.length}</b> foto
            </>
          ) : (
            <>
              <b>Lokasi yang dipakai:</b> {result.views.join(" + ") || "—"} · Reference Photos <b>{refs.length}</b> foto
            </>
          )
        ) : (
          <>
            Reference Photos <b>{refs.length}</b> foto
          </>
        )}
      </div>
      <pre className="out">{result.text}</pre>
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
