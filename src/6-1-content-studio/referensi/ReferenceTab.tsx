/** Referensi tab, ported from katalog.html refList() / refDetail() / bankView() / mgBank() / Gaya baku. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLibraryData } from "../library/useLibraryData";
import type { FolderState } from "../shared/localFolder";
import { addShotFromReference } from "../shots/shotDocument";
import { splitJobs, type ShotJob } from "../shots/shotData";
import { useShotData } from "../shots/useShotData";
import { useShotSave } from "../shots/useShotSave";
import { BeatCard, MotionCard } from "./ReferenceCards";
import { referensiFolder } from "./localReferensi";
import {
  fmtT,
  PERAN,
  standardLine,
  unanalyzedFiles,
  type RefBeat,
  type RefMotion,
  type Reference,
} from "./referenceData";
import { StyleBoxes } from "./StyleBoxes";
import { useReferenceData } from "./useReferenceData";
import { useStyleData } from "./useStyleData";
import { MotionBank, RefDetail, RefVideo, type Jump } from "./ReferenceDetail";

interface Props {
  headLeft: React.ReactNode;
}

type Sel = { kind: "gaya" } | { kind: "mg" } | { kind: "bank" } | { kind: "ref"; id: string } | { kind: "new"; file: string };

export function ReferenceTab({ headLeft }: Props) {
  const data = useReferenceData();
  const lib = useLibraryData();
  const shots = useShotData();
  const style = useStyleData();
  const teks = style.data?.find((s) => s.field_key === "teks")?.body ?? "";
  const { saveJob } = useShotSave();
  const refs = useMemo(() => data.data?.refs ?? [], [data.data]);
  const images = data.data?.images ?? {};
  const menus = lib.data?.menus ?? [];
  const locs = lib.data?.locations ?? [];
  const activeJobs = useMemo(() => splitJobs(shots.data?.jobs ?? []).active.filter((j) => !j.tetap), [shots.data]);

  const [sel, setSel] = useState<Sel>({ kind: "gaya" });
  const [jump, setJump] = useState<Jump | null>(null);
  const [mgFilter, setMgFilter] = useState("Semua");
  const [styleEdit, setStyleEdit] = useState<{ key: string; text: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [folder, setFolder] = useState<{ state: FolderState; name: string | null }>({ state: "none", name: null });
  const [files, setFiles] = useState<string[]>([]);

  const flash = useCallback((t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => {
    void referensiFolder.load().then(setFolder);
  }, []);
  useEffect(() => {
    if (folder.state === "ready") void referensiFolder.listFiles().then(setFiles).catch(() => setFiles([]));
  }, [folder.state, folder.name]);
  const connect = useCallback(async (forcePick = false) => {
    setFolder(await referensiFolder.connect(forcePick));
  }, []);

  const pending = useMemo(() => unanalyzedFiles(files, refs), [files, refs]);
  const allBeats = useMemo(() => refs.flatMap((r) => r.beats.map((x) => ({ r, x }))), [refs]);
  const allMg = useMemo(() => refs.flatMap((r) => r.mg.map((x) => ({ r, x }))), [refs]);
  const current = sel.kind === "ref" ? (refs.find((r) => r.id === sel.id) ?? null) : null;

  const openRef = (r: Reference, j: Jump) => {
    setSel({ kind: "ref", id: r.id });
    setJump(j);
  };

  // katalog.html beatPakai(): the visual becomes a new shot in an active Shot List job.
  const pakaiBeat = async (r: Reference, x: RefBeat, job: ShotJob) => {
    const m = x.sate.produk ? menus.find((q) => q.externalId === x.sate.produk) : null;
    const l = locs.find((q) => q.externalId === x.sate.lokasi);
    const fotos = [
      ...(m?.fotos[0] ? [m.fotos[0].file] : []),
      ...(l?.fotos ?? [])
        .filter((f) => (f.area ?? []).includes(x.sate.area))
        .slice(0, 1)
        .map((f) => f.file),
    ];
    try {
      const id = await saveJob<string>(job.id, (doc) => {
        const res = addShotFromReference(doc, {
          judul: `${x.peran} — ${x.sate.ide.slice(0, 48)}`,
          action: x.sate.action,
          menu: x.sate.produk,
          area: x.sate.area,
          lokasi: x.sate.lokasi,
          fotos,
          dari: `${r.id}#${x.index}`,
        });
        return { doc: res.doc, result: res.id };
      });
      flash(`Masuk ke ${job.judul} sebagai ${id}`);
    } catch (e) {
      flash(
        e instanceof Error && e.message === "changed_elsewhere"
          ? "Shot list barusan diubah di tempat lain. Udah dimuat ulang, klik Pakai lagi."
          : "Gagal masukin ke Shot List. Cek koneksi, lalu coba lagi.",
      );
    }
  };

  // katalog.html mgStd(): open the Gaya teks box with the new line added, for the user to clean up and save.
  const makeStandard = (r: Reference, m: RefMotion) => {
    setSel({ kind: "gaya" });
    setStyleEdit({ key: "teks", text: `${teks}\n${standardLine(r, m)}` });
    flash("Baris baru ditambah di Gaya teks. Hapus baris lama yang bentrok, lalu Simpan");
  };

  const beatCard = (r: Reference, x: RefBeat, inBank: boolean) => (
    <BeatCard
      key={`${r.id}-b${x.index}`}
      reference={r}
      beat={x}
      image={x.thumbPath ? images[x.thumbPath] : undefined}
      showSource={inBank}
      menus={menus}
      locs={locs}
      jobs={activeJobs}
      onSeek={() => openRef(r, { t: x.a })}
      onUse={(job) => void pakaiBeat(r, x, job)}
      onNoJob={() => flash("Belum ada job aktif di Shot List")}
    />
  );
  const motionCard = (r: Reference, x: RefMotion, inBank: boolean) => (
    <MotionCard
      key={`${r.id}-m${x.index}`}
      reference={r}
      motion={x}
      image={x.thumbPath ? images[x.thumbPath] : undefined}
      sample={x.samplePath ? images[x.samplePath] : undefined}
      showSource={inBank}
      onLoop={() => openRef(r, { t: x.a, loop: [x.a, x.b] })}
      onStandard={() => makeStandard(r, x)}
    />
  );

  const isOn = (s: Sel) => JSON.stringify(s) === JSON.stringify(sel);

  return (
    <>
      <header className="ck-head">
        {headLeft}
        <div className="top-r">
          <span className="live">
            {folder.state === "ready" ? (
              <span className="livok" title={`Video diputar langsung dari folder "${folder.name}" di laptop`}>
                ● Laptop: {folder.name}
              </span>
            ) : folder.state === "unsupported" ? (
              <span className="livno">Putar video butuh Chrome/Edge</span>
            ) : folder.state === "needs-permission" ? (
              <button type="button" className="hb" onClick={() => void connect()}>
                Izinkan folder {folder.name}
              </button>
            ) : (
              <button type="button" className="hb" onClick={() => void connect(true)}>
                Hubungkan folder referensi
              </button>
            )}
          </span>
        </div>
      </header>
      <div className="pmw ref">
        <div className="pml">
          <div className="lh">
            <span>Referensi</span>
          </div>
          <div className={"it" + (isOn({ kind: "gaya" }) ? " on" : "")} onClick={() => setSel({ kind: "gaya" })}>
            <span>
              <b>★ Gaya baku</b>
              <br />
              <span className="hint2 inl">rangkuman semua referensi</span>
            </span>
          </div>
          <div className={"it" + (isOn({ kind: "mg" }) ? " on" : "")} onClick={() => setSel({ kind: "mg" })}>
            <span>
              <b>★ Bank Motion Graphic</b>
              <br />
              <span className="hint2 inl">{allMg.length} motion graphic dari semua referensi</span>
            </span>
          </div>
          <div className={"it" + (isOn({ kind: "bank" }) ? " on" : "")} onClick={() => setSel({ kind: "bank" })}>
            <span>
              <b>★ Bank Visual</b>
              <br />
              <span className="hint2 inl">{allBeats.length} visual dari semua referensi</span>
            </span>
          </div>
          {data.isPending ? <div className="loading">Memuat…</div> : null}
          {data.error ? <div className="empty">Gagal memuat. Coba muat ulang halaman.</div> : null}
          {refs.map((r) => (
            <div key={r.id} className={"it" + (isOn({ kind: "ref", id: r.id }) ? " on" : "")} onClick={() => openRef(r, { t: 0 })}>
              <span>
                {r.judul}
                <br />
                <span className="hint2 inl">
                  {fmtT(r.durasi)} · {r.adaVo ? "ada VO" : "tanpa VO"} · {r.bahasa}
                </span>
              </span>
            </div>
          ))}
          {pending.map((f) => (
            <div key={f} className={"it" + (isOn({ kind: "new", file: f }) ? " on" : "")} onClick={() => setSel({ kind: "new", file: f })}>
              <span>
                {f}
                <br />
                <span className="badge-new">belum dianalisa</span>
              </span>
            </div>
          ))}
          <div className="hint2" style={{ marginTop: 12 }}>
            Taruh video baru di folder <b>referensi</b>, terus minta Claude: <b>"analisa referensi baru"</b>.
          </div>
        </div>
        <div className="pmr">
          {sel.kind === "gaya" ? (
            <StyleBoxes edit={styleEdit} setEdit={setStyleEdit} onSaved={flash} />
          ) : sel.kind === "bank" ? (
            <>
              <h2>★ Bank Visual</h2>
              <div className="sub">
                Semua visual menarik dari referensi, dikelompokkan per peran. Klik gambar buat lihat di videonya, klik{" "}
                <b>Pakai di Shot List</b> buat masukin ke job.
              </div>
              {!activeJobs.length ? <div className="hint2">Belum ada job aktif di Shot List, jadi tombol Pakai belum bisa dipakai.</div> : null}
              {PERAN.map((p) => [p, allBeats.filter((o) => o.x.peran === p)] as const)
                .filter(([, v]) => v.length)
                .map(([p, v]) => (
                  <div key={p}>
                    <div className="gt" style={{ marginTop: 14 }}>
                      {p} ({v.length})
                    </div>
                    {v.map((o) => beatCard(o.r, o.x, true))}
                  </div>
                ))}
            </>
          ) : sel.kind === "mg" ? (
            <MotionBank all={allMg} filter={mgFilter} setFilter={setMgFilter} card={(r, x) => motionCard(r, x, true)} />
          ) : sel.kind === "new" ? (
            <>
              <h2>{sel.file}</h2>
              <div className="sub">Belum dianalisa. Minta Claude: <b>"analisa referensi baru"</b>.</div>
              <div className="refw">
                <RefVideo file={sel.file} folder={folder} onConnect={connect} jump={null} />
              </div>
            </>
          ) : current ? (
            <>
              <h2>{current.judul}</h2>
              <div className="sub">
                {current.kreator} · {fmtT(current.durasi)} · {current.adaVo ? "ada VO" : "tanpa VO"}
              </div>
              <RefDetail
                r={current}
                folder={folder}
                onConnect={connect}
                jump={jump}
                setJump={setJump}
                beatCard={(x) => beatCard(current, x, false)}
                motionCard={(x) => motionCard(current, x, false)}
              />
            </>
          ) : (
            <div className="sub">Pilih referensi di kiri.</div>
          )}
          {toast ? <div className="toast">{toast}</div> : null}
        </div>
      </div>
    </>
  );
}
