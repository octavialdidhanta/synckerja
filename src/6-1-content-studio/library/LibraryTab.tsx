import { useEffect, useMemo, useState } from "react";
import { isFilled, resolveMenuFields, type LibraryPhoto, type LocationItem, type MenuItem } from "./libraryData";
import { useLibraryData } from "./useLibraryData";

type Kind = "menu" | "lokasi";

interface Props {
  kind: Kind;
  headLeft: React.ReactNode;
}

/** Read-only port of katalog.html list() + detail() for the Produk and Lokasi tabs. */
export function LibraryTab({ kind, headLeft }: Props) {
  const { data, isPending, error } = useLibraryData();
  const items = useMemo<(MenuItem | LocationItem)[]>(
    () => (kind === "menu" ? data?.menus : data?.locations) ?? [],
    [data, kind],
  );
  const [sel, setSel] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    if (!items.length) return;
    if (!sel || !items.some((x) => x.id === sel)) setSel(items[0].id);
  }, [items, sel]);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoom(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoom]);

  const x = items.find((i) => i.id === sel) ?? null;
  const url = (p: LibraryPhoto) => (p.storagePath ? data?.photos[p.storagePath] : undefined);
  const menuFields = resolveMenuFields(data?.menuFieldDefs);

  return (
    <>
      <header className="ck-head">{headLeft}</header>
      <div className="pmw">
        <div className="pml">
          <div className="gt" style={{ marginBottom: 8 }}>
            {kind === "menu" ? "Daftar produk" : "Daftar lokasi"}
          </div>
          {isPending ? <div className="loading">Memuat…</div> : null}
          {error ? <div className="empty">Gagal memuat. Coba muat ulang halaman.</div> : null}
          {items.map((i) => {
            const ok = isFilled(i);
            return (
              <div key={i.id} className={"it" + (i.id === sel ? " on" : "")} onClick={() => setSel(i.id)}>
                <span>{i.nama}</span>
                <span className={"st " + (ok ? "ok" : "w")}>{ok ? "siap" : "menunggu deskripsi"}</span>
              </div>
            );
          })}
        </div>
        <div className="pmr">
          {x ? (
            <Detail kind={kind} x={x} url={url} onZoom={setZoom} menuFields={menuFields} />
          ) : data && !items.length ? (
            <div className="sub">{kind === "menu" ? "Belum ada produk." : "Belum ada lokasi."}</div>
          ) : null}
        </div>
      </div>
      {zoom ? (
        <div className="zoom" onClick={() => setZoom(null)}>
          <img src={zoom} alt="" />
        </div>
      ) : null}
    </>
  );
}

function Photos({
  kind,
  x,
  url,
  onZoom,
}: {
  kind: Kind;
  x: MenuItem | LocationItem;
  url: (p: LibraryPhoto) => string | undefined;
  onZoom: (u: string) => void;
}) {
  return (
    <>
      <div className="gt">Foto referensi ({x.fotos.length})</div>
      <div className="ph">
        {x.fotos.map((f) => {
          const u = url(f);
          return (
            <figure key={f.id}>
              {u ? <img src={u} alt="" onClick={() => onZoom(u)} /> : <div className="noph">foto belum di-upload</div>}
              <figcaption>
                {f.label || "tanpa label"}
                {kind === "lokasi" ? (
                  <>
                    <br />
                    <span style={{ color: "var(--acc)" }}>Area: {f.area?.length ? f.area.join(", ") : "belum diisi"}</span>
                  </>
                ) : null}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </>
  );
}

function Block({ label, val, thumb, onZoom }: { label: string; val?: string; thumb?: string; onZoom?: (u: string) => void }) {
  return (
    <div className="blk">
      <div className="hd">
        <b>{label}</b>
      </div>
      {thumb ? <img className="bth" src={thumb} alt="" onClick={() => onZoom?.(thumb)} /> : null}
      {val ? <pre>{val}</pre> : <div className="emp">Belum diisi.</div>}
      {thumb ? <div style={{ clear: "both" }} /> : null}
    </div>
  );
}

function Detail({
  kind,
  x,
  url,
  onZoom,
  menuFields,
}: {
  kind: Kind;
  x: MenuItem | LocationItem;
  url: (p: LibraryPhoto) => string | undefined;
  onZoom: (u: string) => void;
  menuFields: [string, string][];
}) {
  return (
    <>
      <h2>{x.nama}</h2>
      <div className="sub">
        {kind === "menu"
          ? "Deskripsi produk untuk bagian Main Subject di prompt Flow."
          : "Deskripsi lokasi untuk bagian Location di prompt Flow."}
      </div>
      {!isFilled(x) ? (
        <div className="wait">
          Deskripsi belum ada. Tambahin foto referensinya, terus bilang ke Claude:{" "}
          <b>
            "isi deskripsi {kind} {x.nama}"
          </b>
          .
        </div>
      ) : null}
      <Photos kind={kind} x={x} url={url} onZoom={onZoom} />
      {"fields" in x ? (
        menuFields.map(([k, l]) => <Block key={k} label={l} val={x.fields[k]} />)
      ) : (
        <>
          <div className="hint2" style={{ margin: "14px 0 4px" }}>
            Tiap foto punya <b>deskripsi sendiri</b>. Di prompt, bagian lokasi cuma berisi deskripsi foto yang dicentang di
            shot, ditambah Scene, Atmosphere dan Must NOT yang selalu ikut.
          </div>
          <div className="gt" style={{ margin: "16px 0 6px" }}>
            Deskripsi per foto
          </div>
          {x.fotos.map((f) => (
            <Block key={f.id} label={f.label || f.file} val={f.desc} thumb={url(f)} onZoom={onZoom} />
          ))}
          <div className="gt" style={{ margin: "16px 0 6px" }}>
            Selalu ikut
          </div>
          {x.bagian.map((b) => (
            <Block key={b.judul} label={b.area.length ? `${b.judul} · Area: ${b.area.join(", ")}` : b.judul} val={b.isi} />
          ))}
        </>
      )}
    </>
  );
}
