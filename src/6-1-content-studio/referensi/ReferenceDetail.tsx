/** One reference (video left, analysis right) and the motion graphic bank, ported from katalog.html refDetail() / mgBank(). */
import { useEffect, useRef, useState } from "react";
import type { FolderState } from "../shared/localFolder";
import { referensiFolder } from "./localReferensi";
import { fmtT, motionKinds, type RefBeat, type RefMotion, type Reference } from "./referenceData";

type Folder = { state: FolderState; name: string | null };
export type Jump = { t: number; loop?: [number, number] };

/** Plays a file from the referensi folder; seeks or loops whenever `jump` changes (katalog.html seekR / loopR). */
export function RefVideo({
  file,
  folder,
  onConnect,
  jump,
  onHeight,
}: {
  file: string;
  folder: Folder;
  onConnect: (forcePick?: boolean) => void;
  jump: Jump | null;
  onHeight?: (h: number) => void;
}) {
  const vref = useRef<HTMLVideoElement>(null);
  const loop = useRef<[number, number] | null>(null);
  const [src, setSrc] = useState<{ file: string; url: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (folder.state !== "ready" || !file) return;
    let cancelled = false;
    setErr(null);
    referensiFolder
      .open(file)
      .then((f) => {
        if (cancelled) return;
        setSrc((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { file, url: URL.createObjectURL(f) };
        });
      })
      .catch(() => {
        if (!cancelled) setErr(`File "${file}" nggak ketemu di folder "${folder.name}". Pastikan yang dipilih folder referensi.`);
      });
    return () => {
      cancelled = true;
    };
  }, [folder.state, folder.name, file]);

  useEffect(
    () => () => {
      setSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return null;
      });
    },
    [],
  );

  useEffect(() => {
    const v = vref.current;
    if (!v || !jump || src?.file !== file) return;
    const go = () => {
      loop.current = jump.loop ?? null;
      v.currentTime = jump.t;
      void v.play().catch(() => undefined);
    };
    if (v.readyState >= 1) go();
    else v.onloadedmetadata = go;
  }, [jump, src, file]);

  const ready = folder.state === "ready" && src?.file === file && !err;
  if (!ready) {
    let msg: React.ReactNode = "Membuka video…";
    if (folder.state === "unsupported") msg = "Putar video referensi dari laptop butuh Chrome atau Edge.";
    else if (folder.state === "none")
      msg = (
        <>
          Hubungkan folder <b>referensi</b> di laptop untuk memutar videonya.
          <br />
          <button type="button" className="hb" onClick={() => onConnect(true)}>
            Pilih folder referensi
          </button>
        </>
      );
    else if (folder.state === "needs-permission")
      msg = (
        <>
          Izinkan akses ke folder <b>{folder.name}</b>.
          <br />
          <button type="button" className="hb" onClick={() => onConnect()}>
            Izinkan
          </button>
        </>
      );
    else if (err)
      msg = (
        <>
          {err}
          <br />
          <button type="button" className="hb" onClick={() => onConnect(true)}>
            Pilih ulang folder
          </button>
        </>
      );
    return <div className="rvph">{msg}</div>;
  }
  return (
    <video
      ref={vref}
      src={src!.url}
      controls
      playsInline
      preload="metadata"
      onLoadedMetadata={(e) => onHeight?.(e.currentTarget.offsetHeight)}
      onTimeUpdate={(e) => {
        const v = e.currentTarget;
        if (loop.current && v.currentTime >= loop.current[1]) v.currentTime = loop.current[0];
      }}
    />
  );
}

export function RefDetail({
  r,
  folder,
  onConnect,
  jump,
  setJump,
  beatCard,
  motionCard,
}: {
  r: Reference;
  folder: Folder;
  onConnect: (forcePick?: boolean) => void;
  jump: Jump | null;
  setJump: (j: Jump) => void;
  beatCard: (x: RefBeat) => React.ReactNode;
  motionCard: (x: RefMotion) => React.ReactNode;
}) {
  // katalog.html fitR(): the right column scrolls inside the video's height.
  const [h, setH] = useState<number | null>(null);
  const seek = (t: number) => setJump({ t });
  return (
    <div className="refw">
      <RefVideo file={r.file} folder={folder} onConnect={onConnect} jump={jump} onHeight={(v) => v > 50 && setH(v)} />
      <div className="rcol" style={h ? { maxHeight: h } : undefined}>
        <div className="gt">Struktur</div>
        {r.struktur.map((s, i) => (
          <div key={i} className="rs" onClick={() => seek(s.a)}>
            <span className="rt">
              {fmtT(s.a)}–{fmtT(s.b)}
            </span>
            <b>{s.bagian}</b>
            <br />
            {s.isi}
          </div>
        ))}
        <div className="gt" style={{ marginTop: 12 }}>
          Teks VO {r.vo.length ? "(klik buat lompat ke detiknya)" : ""}
        </div>
        {r.vo.length ? (
          <div className="rvo">
            {r.vo.map((v, i) => (
              <div key={i} onClick={() => seek(v.a)}>
                <span className="rt">{fmtT(v.a)}</span>
                {v.t}
              </div>
            ))}
          </div>
        ) : (
          <div className="hint2">Video ini tanpa VO, cuma musik/suara asli.</div>
        )}
        <div className="gt" style={{ marginTop: 12 }}>
          Kenapa bagus
        </div>
        <ul className="rl">
          {r.kenapa.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
        <div className="gt" style={{ marginTop: 12 }}>
          Gaya editing
        </div>
        <ul className="rl">
          {r.editing.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
        {r.beats.length ? (
          <>
            <div className="gt" style={{ marginTop: 12 }}>
              Visual menarik ({r.beats.length})
            </div>
            {r.beats.map((x) => beatCard(x))}
          </>
        ) : null}
        <div className="gt" style={{ marginTop: 12 }}>
          Motion graphic ({r.mg.length})
        </div>
        {r.mg.length ? (
          r.mg.map((x) => motionCard(x))
        ) : (
          <div className="hint2">
            Belum dianalisa. Minta Claude: <b>"analisa motion graphic referensi ini"</b>.
          </div>
        )}
      </div>
    </div>
  );
}

export function MotionBank({
  all,
  filter,
  setFilter,
  card,
}: {
  all: Array<{ r: Reference; x: RefMotion }>;
  filter: string;
  setFilter: (j: string) => void;
  card: (r: Reference, x: RefMotion) => React.ReactNode;
}) {
  const kinds = motionKinds(all.map((o) => o.x));
  const shown = filter === "Semua" ? all : all.filter((o) => o.x.jenis === filter);
  return (
    <>
      <h2>★ Bank Motion Graphic</h2>
      <div className="sub">
        Semua motion graphic dari referensi: gaya teks, animasi, font, transisi. Klik gambar buat muter momennya berulang.{" "}
        <b>Jadiin standar</b> = masuk ke Gaya baku.
      </div>
      <div className="mgf">
        {[{ jenis: "Semua", n: all.length }, ...kinds].map((k) => (
          <button key={k.jenis} type="button" className={"mini" + (filter === k.jenis ? " on" : "")} onClick={() => setFilter(k.jenis)}>
            {k.jenis} ({k.n})
          </button>
        ))}
      </div>
      {shown.length ? (
        shown.map((o) => card(o.r, o.x))
      ) : (
        <div className="hint2">
          Belum ada. Minta Claude: <b>"analisa motion graphic referensi X"</b>.
        </div>
      )}
    </>
  );
}
