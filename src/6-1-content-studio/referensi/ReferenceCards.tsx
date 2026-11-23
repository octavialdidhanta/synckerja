/** Visual (beat) and motion graphic cards, ported from katalog.html beatCard() and mgCard(). */
import { useState } from "react";
import type { LocationItem, MenuItem } from "../library/libraryData";
import type { ShotJob } from "../shots/shotData";
import { fmtT, type RefBeat, type RefMotion, type Reference } from "./referenceData";

export function BeatCard({
  reference: r,
  beat: x,
  image,
  showSource,
  menus,
  locs,
  jobs,
  onSeek,
  onUse,
  onNoJob,
}: {
  reference: Reference;
  beat: RefBeat;
  image?: string;
  showSource: boolean;
  menus: MenuItem[];
  locs: LocationItem[];
  /** active Shot List jobs a visual can go into */
  jobs: ShotJob[];
  onSeek: () => void;
  onUse: (job: ShotJob) => void;
  onNoJob: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const [jobId, setJobId] = useState("");
  const m = x.sate.produk ? menus.find((q) => q.externalId === x.sate.produk) : null;
  const l = locs.find((q) => q.externalId === x.sate.lokasi);
  const role = x.hook && x.peran !== "Hook" ? `${x.peran} · HOOK` : x.peran;

  const use = () => {
    if (!jobs.length) return onNoJob();
    if (jobs.length === 1) return onUse(jobs[0]);
    setJobId(jobs[0]?.id ?? "");
    setPicking(true);
  };

  return (
    <div className="bt">
      {image ? (
        <img src={image} alt="" onClick={onSeek} title="Putar berulang bagian ini" />
      ) : (
        <div className="noimg" onClick={onSeek} title="Putar berulang bagian ini" />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span className={"tg" + (x.hook ? " hk" : "")}>{role}</span>
        {x.jenis ? <span className="tg">{x.jenis}</span> : null}
        <span className="rt">
          {fmtT(x.a)}–{fmtT(x.b)}
        </span>
        {showSource ? <span className="hint2 inl">· {r.judul}</span> : null}
        <div style={{ marginTop: 4 }}>{x.visual}</div>
        <div className="hint2 tight">Kenapa: {x.kenapa}</div>
        <div className="sa">
          <b>Buat Sate Sultan:</b> {x.sate.ide}
          <br />
          <span className="hint2 inl">
            {m ? m.nama : "tanpa produk"} · {l ? l.nama : ""} · {x.sate.area}
          </span>
          <details>
            <summary>Action prompt (Flow)</summary>
            <pre>{x.sate.action}</pre>
          </details>
          {picking ? (
            <div className="pick">
              <span>Masukin ke job:</span>
              <select value={jobId} onChange={(e) => setJobId(e.target.value)}>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.judul}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="mini"
                onClick={() => {
                  const j = jobs.find((q) => q.id === jobId);
                  if (j) onUse(j);
                  setPicking(false);
                }}
              >
                Masukin
              </button>
              <button type="button" className="mini" onClick={() => setPicking(false)}>
                Batal
              </button>
            </div>
          ) : (
            <button type="button" className="mini" onClick={use}>
              ＋ Pakai di Shot List
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function MotionCard({
  reference: r,
  motion: x,
  image,
  sample,
  showSource,
  onLoop,
  onStandard,
}: {
  reference: Reference;
  motion: RefMotion;
  image?: string;
  sample?: string;
  showSource: boolean;
  onLoop: () => void;
  onStandard: () => void;
}) {
  const f = x.font;
  return (
    <div className="bt mgc">
      {image ? (
        <img src={image} alt="" onClick={onLoop} title="Putar berulang di momen ini" />
      ) : (
        <div className="noimg" onClick={onLoop} title="Putar berulang di momen ini" />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span className="tg hk">{x.jenis}</span>
        <span className="rt">
          {fmtT(x.a)}–{fmtT(x.b)}
        </span>
        {showSource ? <span className="hint2 inl">· {r.judul}</span> : null}
        <div style={{ marginTop: 4 }}>
          <b>{x.nama}</b>
        </div>
        <div style={{ marginTop: 2 }}>{x.deskripsi}</div>
        <div className="anim">
          <b>Animasi:</b> {x.animasi}
        </div>
        {f ? (
          <div className="fnt">
            <b>Font:</b> {f.asli} → mirip <b>{f.mirip.join(" / ")}</b> (gratis)
            {f.warna.map((c) => (
              <span key={c} className="sw" style={{ background: c }} title={c} />
            ))}
            {f.catatan ? (
              <>
                <br />
                <span className="hint2 inl">{f.catatan}</span>
              </>
            ) : null}
          </div>
        ) : null}
        <div className="hint2 tight">Kenapa: {x.kenapa}</div>
        {x.cara ? (
          <div className="anim">
            <b>Cara bikin:</b> {x.cara}
          </div>
        ) : null}
        <div className="sa" style={{ display: "flex", gap: 10 }}>
          {sample ? <img className="smp" src={sample} alt="" onClick={() => window.open(sample, "_blank", "noopener")} title="Contoh versi Sate Sultan" /> : null}
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>Buat Sate Sultan:</b> {x.sate}
            <br />
            <span className="hint2 inl">
              {sample ? "Gambar kiri = contoh versi Sate Sultan." : "Contoh gerak (demo Remotion) dibikin kalau lo tandain."}
            </span>
            <div style={{ marginTop: 6 }}>
              <button type="button" className="mini" onClick={onStandard}>
                ★ Jadiin standar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
