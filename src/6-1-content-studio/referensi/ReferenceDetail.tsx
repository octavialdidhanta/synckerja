/** One reference (video left, analysis right) and the motion graphic bank, ported from katalog.html refDetail() / mgBank(). */
import { useEffect, useRef, useState } from "react";
import type { FolderState } from "../shared/localFolder";
import { fmtT, motionKinds, type RefBeat, type RefMotion, type Reference } from "./referenceData";

type Folder = { state: FolderState; name: string | null };
/** `key` forces re-apply when the same segment is clicked again (katalog.html loopR). */
export type Jump = { t: number; loop?: [number, number]; key?: number };

/** True when the playhead should snap back to the loop start (katalog.html timeupdate). */
export function loopSeekTo(currentTime: number, seg: [number, number] | null): number | null {
  if (!seg) return null;
  const [start, end] = seg;
  if (!(end > start)) return null;
  if (currentTime >= end - 0.05) return start;
  return null;
}

/** Plays a file from the referensi folder; seeks or loops whenever `jump` changes (katalog.html seekR / loopR). */
export function RefVideo({
  file,
  folder,
  open,
  onConnect,
  jump,
  onHeight,
}: {
  file: string;
  folder: Folder;
  open: (file: string) => Promise<File>;
  onConnect: (forcePick?: boolean) => void | Promise<void>;
  jump: Jump | null;
  onHeight?: (h: number) => void;
}) {
  const vref = useRef<HTMLVideoElement | null>(null);
  const loop = useRef<[number, number] | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [src, setSrc] = useState<{ file: string; url: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Bumped after "Pilih ulang folder" so we retry open even when the folder name is unchanged.
  const [loadNonce, setLoadNonce] = useState(0);

  const attachVideo = (el: HTMLVideoElement | null) => {
    vref.current = el;
    setVideoEl(el);
  };

  useEffect(() => {
    if (folder.state !== "ready" || !file) return;
    let cancelled = false;
    setErr(null);
    open(file)
      .then((f) => {
        if (cancelled) return;
        setSrc((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { file, url: URL.createObjectURL(f) };
        });
      })
      .catch(() => {
        if (cancelled) return;
        setSrc((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return null;
        });
        setErr(`File "${file}" nggak ketemu di folder "${folder.name}". Pastikan yang dipilih folder referensi.`);
      });
    return () => {
      cancelled = true;
    };
  }, [folder.state, folder.name, file, open, loadNonce]);

  const rePickFolder = () => {
    void Promise.resolve(onConnect(true)).finally(() => {
      setSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return null;
      });
      setErr(null);
      setLoadNonce((n) => n + 1);
    });
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

  // Keep loop range on a ref so the native timeupdate handler always sees the latest segment.
  useEffect(() => {
    loop.current = jump?.loop ?? null;
  }, [jump]);

  // katalog.html loopR / seekR: native timeupdate + seek/play whenever jump (or the <video>) changes.
  useEffect(() => {
    const v = videoEl;
    if (!v || !jump || src?.file !== file) return;

    const onTime = () => {
      const next = loopSeekTo(v.currentTime, loop.current);
      if (next != null) v.currentTime = next;
    };

    const apply = () => {
      loop.current = jump.loop ?? null;
      try {
        v.currentTime = jump.t;
      } catch {
        /* ignore seek errors before ready */
      }
      void v.play().catch(() => undefined);
    };

    v.addEventListener("timeupdate", onTime);
    if (v.readyState >= 1) apply();
    else v.addEventListener("loadedmetadata", apply, { once: true });

    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", apply);
    };
  }, [jump, jump?.key, videoEl, src?.file, file]);

  useEffect(() => {
    if (!onHeight || !videoEl) return;
    const report = () => {
      const h = videoEl.offsetHeight;
      if (h > 50) onHeight(h);
    };
    report();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(report) : null;
    ro?.observe(videoEl);
    window.addEventListener("resize", report);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", report);
    };
  }, [onHeight, videoEl, src?.url]);

  const ready = folder.state === "ready" && src?.file === file && !err;
  if (!ready) {
    let msg: React.ReactNode = "Membuka video…";
    if (folder.state === "unsupported") msg = "Putar video referensi dari laptop butuh Chrome atau Edge.";
    else if (folder.state === "none")
      msg = (
        <>
          Hubungkan folder <b>referensi</b> di laptop untuk memutar videonya.
          <br />
          <button type="button" className="hb" onClick={rePickFolder}>
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
          <button type="button" className="hb" onClick={rePickFolder}>
            Pilih ulang folder
          </button>
        </>
      );
    // One wrapper so the text and button stack inside the flex box instead of becoming columns.
    return (
      <div className="rvph">
        <div>{msg}</div>
      </div>
    );
  }

  return (
    <video
      ref={attachVideo}
      src={src!.url}
      controls
      playsInline
      preload="metadata"
      onLoadedMetadata={(e) => onHeight?.(e.currentTarget.offsetHeight)}
    />
  );
}

export function RefDetail({
  r,
  folder,
  open,
  onConnect,
  jump,
  setJump,
  beatCard,
  motionCard,
}: {
  r: Reference;
  folder: Folder;
  open: (file: string) => Promise<File>;
  onConnect: (forcePick?: boolean) => void | Promise<void>;
  jump: Jump | null;
  setJump: (j: Jump) => void;
  beatCard: (x: RefBeat) => React.ReactNode;
  motionCard: (x: RefMotion) => React.ReactNode;
}) {
  // katalog.html fitR(): the right column scrolls inside the video's height.
  const [h, setH] = useState<number | null>(null);
  /** Seek + loop only that segment until the user picks another (katalog.html loopR). */
  const loopPart = (a: number, b: number) => {
    const end = b > a ? b : a + 2;
    setJump({ t: a, loop: [a, end], key: Date.now() });
  };
  return (
    <div className="refw">
      <RefVideo file={r.file} folder={folder} open={open} onConnect={onConnect} jump={jump} onHeight={(v) => v > 50 && setH(v)} />
      <div className="rcol" style={h ? { maxHeight: h } : undefined}>
        <div className="gt">Struktur</div>
        {r.struktur.map((s, i) => (
          <div key={i} className="rs" onClick={() => loopPart(s.a, s.b)} title="Putar berulang bagian ini">
            <span className="rt">
              {fmtT(s.a)}–{fmtT(s.b)}
            </span>
            <b>{s.bagian}</b>
            <br />
            {s.isi}
          </div>
        ))}
        <div className="gt" style={{ marginTop: 12 }}>
          Teks VO {r.vo.length ? "(klik buat ulang bagian itu)" : ""}
        </div>
        {r.vo.length ? (
          <div className="rvo">
            {r.vo.map((v, i) => {
              const next = r.vo[i + 1];
              const end = v.b > v.a ? v.b : next && next.a > v.a ? next.a : v.a + 2;
              return (
                <div key={i} onClick={() => loopPart(v.a, end)} title="Putar berulang baris ini">
                  <span className="rt">{fmtT(v.a)}</span>
                  {v.t}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rbox">Video ini tanpa VO, cuma musik/suara asli.</div>
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
