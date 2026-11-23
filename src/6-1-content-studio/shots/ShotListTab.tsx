import { useEffect, useMemo, useRef, useState } from "react";
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
import { draftFromShot, draftToPatch, type Draft } from "./shotDraft";
import {
  addShot,
  applyShotFields,
  deleteShot,
  duplicateShot,
  editShotMeta,
  resetShot,
  setJobArchived,
  setShotDone,
  type ShotDoc,
  type ShotMetaPatch,
} from "./shotDocument";
import { useShotData } from "./useShotData";
import { useShotSave, type ShotSaveStatus } from "./useShotSave";

interface Props {
  headLeft: React.ReactNode;
}

const QUICK = "quick";
const key = (j: ShotJob, s: Shot) => `${j.id}|${s.id}`;

const SAVE_DELAY_MS = 500;

export function ShotListTab({ headLeft }: Props) {
  const lib = useLibraryData();
  const shots = useShotData();
  const { saveJob, status } = useShotSave();
  const menus = useMemo(() => lib.data?.menus ?? [], [lib.data]);
  const locs = useMemo(() => lib.data?.locations ?? [], [lib.data]);
  const jobs = useMemo(() => shots.data?.jobs ?? [], [shots.data]);
  const { active, archived } = useMemo(() => splitJobs(jobs), [jobs]);
  const [selKey, setSelKey] = useState<string>(QUICK);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const find = (all: ShotJob[], k: string) => {
    for (const j of all) for (const s of j.shots) if (key(j, s) === k) return { job: j, shot: s };
    return null;
  };
  const picked = useMemo(() => find(jobs, selKey), [jobs, selKey]);

  // Each shot (and the quick shot) keeps its own working copy while this page is open.
  const ready = Boolean(lib.data && shots.data);
  const draft: Draft | null = !ready
    ? null
    : (drafts[selKey] ??
      (picked
        ? draftFromShot(picked.job, picked.shot, menus, locs)
        : { menuIds: [], locId: locs[0]?.id ?? "", talk: "diam", angles: 1, action: "", curArea: "", sel: null }));

  // Latest values for the save timers, which outlive the render that scheduled them.
  const latest = useRef({ drafts, jobs, menus, locs });
  latest.current = { drafts, jobs, menus, locs };
  const timers = useRef(new Map<string, number>());

  const dropDrafts = (match: (k: string) => boolean) => {
    for (const [k, t] of timers.current) if (match(k)) {
      window.clearTimeout(t);
      timers.current.delete(k);
    }
    setDrafts((all) => Object.fromEntries(Object.entries(all).filter(([k]) => !match(k))));
  };

  const reportError = (jobId: string, e: unknown) => {
    if (e instanceof Error && e.message === "changed_elsewhere") {
      dropDrafts((k) => k.startsWith(jobId + "|"));
      setNotice("Shot list ini barusan diubah di tempat lain (Claude atau tab lain). Data terbaru udah dimuat, ulangi perubahan terakhir.");
    } else {
      setNotice("Gagal simpan. Cek koneksi, lalu ubah lagi.");
    }
  };

  const run = <T,>(jobId: string, edit: (doc: ShotDoc) => { doc: ShotDoc; result?: T }) => {
    setNotice(null);
    return saveJob<T>(jobId, edit).catch((e: unknown) => {
      reportError(jobId, e);
      return undefined;
    });
  };

  // katalog.html saveSoon(): field edits are saved half a second after the last change.
  const flush = (k: string) => {
    const t = timers.current.get(k);
    if (t !== undefined) window.clearTimeout(t);
    timers.current.delete(k);
    const st = latest.current;
    const hit = find(st.jobs, k);
    const d = st.drafts[k];
    if (!hit || !d) return;
    const patch = draftToPatch(draftFromShot(hit.job, hit.shot, st.menus, st.locs), d, st.menus, st.locs);
    if (!Object.keys(patch).length) return;
    void run(hit.job.id, (doc) => ({ doc: applyShotFields(doc, hit.shot.id, patch) }));
  };
  const schedule = (k: string) => {
    const t = timers.current.get(k);
    if (t !== undefined) window.clearTimeout(t);
    timers.current.set(k, window.setTimeout(() => flush(k), SAVE_DELAY_MS));
  };

  // Leaving the tab saves whatever is still waiting.
  useEffect(
    () => () => {
      for (const k of [...timers.current.keys()]) flush(k);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const setDraft: React.Dispatch<React.SetStateAction<Draft | null>> = (u) => {
    setDrafts((all) => {
      const cur = all[selKey] ?? draft;
      const next = typeof u === "function" ? u(cur) : u;
      return next ? { ...all, [selKey]: next } : all;
    });
    if (selKey !== QUICK) schedule(selKey);
  };

  const actions: ShotActions | null = picked
    ? {
        setDone: (v) => void run(picked.job.id, (doc) => ({ doc: setShotDone(doc, picked.shot.id, v) })),
        editMeta: (m) => void run(picked.job.id, (doc) => ({ doc: editShotMeta(doc, picked.shot.id, m) })),
        reset: () => {
          dropDrafts((k) => k === selKey);
          void run(picked.job.id, (doc) => ({ doc: resetShot(doc, picked.shot.id) }));
        },
        duplicate: async () => {
          flush(selKey);
          const id = await run<string>(picked.job.id, (doc) => {
            const r = duplicateShot(doc, picked.shot.id);
            return { doc: r.doc, result: r.id };
          });
          if (id) setSelKey(`${picked.job.id}|${id}`);
        },
        remove: () => {
          dropDrafts((k) => k === selKey);
          setSelKey(QUICK);
          void run(picked.job.id, (doc) => ({ doc: deleteShot(doc, picked.shot.id) }));
        },
      }
    : null;

  const jobActions = {
    add: async (job: ShotJob, judul: string) => {
      const id = await run<string>(job.id, (doc) => {
        const r = addShot(doc, judul);
        return { doc: r.doc, result: r.id };
      });
      if (id) setSelKey(`${job.id}|${id}`);
    },
    archive: (job: ShotJob, arsip: boolean) => {
      if (arsip && picked?.job.id === job.id) setSelKey(QUICK);
      void run(job.id, (doc) => ({ doc: setJobArchived(doc, arsip) }));
    },
  };

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
            <JobList key={j.id} job={j} menus={menus} selKey={selKey} onPick={setSelKey} actions={jobActions} />
          ))}
          {archived.length ? (
            <details className="arsip" open={Boolean(picked?.job.arsip)}>
              <summary>Arsip ({archived.length})</summary>
              {archived.map((j) => (
                <JobList key={j.id} job={j} menus={menus} selKey={selKey} onPick={setSelKey} actions={jobActions} />
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
              actions={actions}
              status={status}
              notice={notice}
            />
          ) : null}
        </div>
      </div>
    </>
  );
}

interface ShotActions {
  setDone: (v: boolean) => void;
  editMeta: (m: ShotMetaPatch) => void;
  reset: () => void;
  duplicate: () => void;
  remove: () => void;
}

interface JobActions {
  add: (job: ShotJob, judul: string) => void;
  archive: (job: ShotJob, arsip: boolean) => void;
}

function JobList({
  job,
  menus,
  selKey,
  onPick,
  actions,
}: {
  job: ShotJob;
  menus: MenuItem[];
  selKey: string;
  onPick: (k: string) => void;
  actions: JobActions;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const dn = job.shots.filter((s) => s.done).length;
  const n = job.shots.length;
  const submit = () => {
    const v = title.trim();
    if (!v) return;
    actions.add(job, v);
    setTitle("");
    setAdding(false);
  };
  return (
    <>
      <div className="jh">
        <span className="jt" title={job.judul}>
          {job.judul}
        </span>
        {n ? <span className={"jc" + (dn === n ? " ok" : "")}>{`${dn}/${n}`}</span> : null}
        {job.arsip ? null : (
          <button type="button" className="ib" title="Tambah shot" onClick={() => setAdding((v) => !v)}>
            ＋
          </button>
        )}
        {job.tetap ? null : (
          <button
            type="button"
            className="ib"
            title={job.arsip ? "Keluarin dari arsip" : "Arsipkan"}
            onClick={() => actions.archive(job, !job.arsip)}
          >
            {job.arsip ? "↩" : "🗄"}
          </button>
        )}
      </div>
      {adding ? (
        <div className="addf">
          <input
            autoFocus
            value={title}
            placeholder="Judul shot baru"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") setAdding(false);
            }}
          />
          <button type="button" className="mini" onClick={submit} disabled={!title.trim()}>
            Tambah
          </button>
          <button type="button" className="mini" onClick={() => setAdding(false)}>
            Batal
          </button>
        </div>
      ) : null}
      {job.shots.map((s) => {
        const k = key(job, s);
        const mi = missingMenus(s, menus);
        return (
          <div key={k} className={"it si" + (k === selKey ? " on" : "") + (s.done ? " dn" : "")} onClick={() => onPick(k)}>
            <span>
              {s.id} — {s.judul}
            </span>
            {s.done ? (
              <span className="okm">✓</span>
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
  actions,
  status,
  notice,
}: {
  fields: PromptFields;
  menus: MenuItem[];
  locs: LocationItem[];
  photoUrls: Record<string, string>;
  picked: { job: ShotJob; shot: Shot } | null;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft | null>>;
  actions: ShotActions | null;
  status: ShotSaveStatus;
  notice: string | null;
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
    menuFieldDefs: lib.data?.menuFieldDefs,
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
          {actions ? <ShotBar shot={s} actions={actions} /> : null}
        </div>
      ) : (
        <>
          <h2>Rakit prompt Google Flow</h2>
          <div className="sub">Pilih menu dan lokasi, tulis action-nya, lalu copy. Teks deskripsi dipakai apa adanya.</div>
        </>
      )}
      {notice ? <div className="note">{notice}</div> : null}
      {s ? (
        <div className={"ssb " + status}>{SAVE_LABEL[status]}</div>
      ) : (
        <div className="hint2">Shot cepat nggak disimpan. Copy prompt tetap bisa dipakai.</div>
      )}

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
              <b className="warn">Belum ada foto lokasi dicentang</b>: lokasi cuma pakai Scene, Atmosphere, Must
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

const SAVE_LABEL: Record<ShotSaveStatus, string> = {
  idle: "Perubahan kesimpen otomatis ke shot list.",
  saving: "Menyimpan…",
  saved: "Tersimpan ✓",
  error: "Gagal simpan.",
  conflict: "Dimuat ulang karena ada perubahan dari tempat lain.",
};

/** katalog.html shot header: Sudah generate, Ubah judul/VO, Duplikat, Reset ke default, Hapus. */
function ShotBar({ shot, actions }: { shot: Shot; actions: ShotActions }) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"reset" | "hapus" | null>(null);
  const [meta, setMeta] = useState<ShotMetaPatch>({ judul: shot.judul, timing: shot.timing, vo: shot.vo });
  const openEdit = () => {
    setMeta({ judul: shot.judul, timing: shot.timing, vo: shot.vo });
    setConfirm(null);
    setEditing(true);
  };
  return (
    <div className="sbarw">
      <div className="sbar">
        <label className={"donel" + (shot.done ? " on" : "")}>
          <input type="checkbox" checked={shot.done} onChange={(e) => actions.setDone(e.target.checked)} /> Sudah generate
        </label>
        <button type="button" className="mini" onClick={openEdit}>
          Ubah judul/VO
        </button>
        <button type="button" className="mini" onClick={() => actions.duplicate()}>
          Duplikat
        </button>
        <button type="button" className="mini" onClick={() => setConfirm("reset")}>
          Reset ke default
        </button>
        <button type="button" className="mini del" onClick={() => setConfirm("hapus")}>
          Hapus
        </button>
      </div>
      {confirm ? (
        <div className="cfm">
          <span>
            {confirm === "reset"
              ? "Balikin shot ini ke isi awal (action, produk, foto, ngomong, angle)?"
              : `Hapus shot ${shot.id} — ${shot.judul}?`}
          </span>
          <button
            type="button"
            className={"mini" + (confirm === "hapus" ? " del" : "")}
            onClick={() => {
              if (confirm === "reset") actions.reset();
              else actions.remove();
              setConfirm(null);
            }}
          >
            {confirm === "reset" ? "Ya, reset" : "Ya, hapus"}
          </button>
          <button type="button" className="mini" onClick={() => setConfirm(null)}>
            Batal
          </button>
        </div>
      ) : null}
      {editing ? (
        <div className="metaf">
          <label>
            Judul shot
            <input value={meta.judul} onChange={(e) => setMeta({ ...meta, judul: e.target.value })} />
          </label>
          <label>
            Detik (misal 21–25), boleh kosong
            <input value={meta.timing} onChange={(e) => setMeta({ ...meta, timing: e.target.value })} />
          </label>
          <label>
            VO (boleh kosong)
            <input value={meta.vo} onChange={(e) => setMeta({ ...meta, vo: e.target.value })} />
          </label>
          <div>
            <button
              type="button"
              className="pb"
              onClick={() => {
                actions.editMeta(meta);
                setEditing(false);
              }}
            >
              Simpan
            </button>
            <button type="button" className="mini" onClick={() => setEditing(false)}>
              Batal
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
