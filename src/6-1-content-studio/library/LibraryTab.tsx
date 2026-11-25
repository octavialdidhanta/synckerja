import { useEffect, useMemo, useState } from "react";
import { CatalogEditor } from "./catalogEditor";
import { linkedProductName } from "./catalogEdit";
import { isFilled, menuHasPhoto, resolveMenuFields, type LibraryPhoto, type LocationItem, type MenuItem } from "./libraryData";
import { useCatalogEdit } from "./useCatalogEdit";
import { useLibraryData } from "./useLibraryData";

type Kind = "menu" | "lokasi";

interface Props {
  kind: Kind;
  headLeft: React.ReactNode;
}

/** Produk and Lokasi tabs. Photos stay as they are; name, alias, label, and template columns can be edited. */
export function LibraryTab({ kind, headLeft }: Props) {
  const { data, isPending, error } = useLibraryData();
  const edit = useCatalogEdit();
  const items = useMemo<(MenuItem | LocationItem)[]>(
    () => (kind === "menu" ? data?.menus : data?.locations) ?? [],
    [data, kind],
  );
  const [sel, setSel] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [describing, setDescribing] = useState(false);
  const [describeError, setDescribeError] = useState<string | null>(null);

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
  const editingMenu = kind === "menu" && editing && editing !== "new" ? (data?.menus.find((item) => item.id === editing) ?? null) : null;
  const editingLocation =
    kind === "lokasi" && editing && editing !== "new" ? (data?.locations.find((item) => item.id === editing) ?? null) : null;
  const takenSlugs = [...(data?.menus ?? []), ...(data?.locations ?? [])].map((item) => item.externalId);
  const sources = data?.sources ?? [];
  const linkMode = data?.industryTemplateCode === "fnb" ? "item" : data?.industryTemplateCode === "software" ? "feature" : "manual";

  const fillFromPhoto = async (menu: MenuItem) => {
    if (!menuHasPhoto(menu) || describing) return;
    setDescribeError(null);
    setDescribing(true);
    try {
      const { describeCatalogProduct } = await import("./describeProduct");
      const fields = await describeCatalogProduct(menu.id);
      setDraft(fields);
      setEditing(menu.id);
    } catch (err) {
      setDescribeError(err instanceof Error && err.message ? err.message : "Gagal membaca foto.");
    } finally {
      setDescribing(false);
    }
  };

  return (
    <>
      <header className="ck-head">{headLeft}</header>
      <div className="pmw">
        <div className="pml">
          <div className="list-head">
            <div className="gt">{kind === "menu" ? "Daftar produk" : "Daftar lokasi"}</div>
            <button
              type="button"
              className="hb"
              onClick={() => {
                edit.reset();
                setEditing("new");
              }}
            >
              {kind === "menu" ? "Tambah produk" : "Tambah lokasi"}
            </button>
          </div>
          {isPending ? <div className="loading">Memuat…</div> : null}
          {error ? <div className="empty">Gagal memuat. Coba muat ulang halaman.</div> : null}
          {items.map((i) => {
            const ok = isFilled(i);
            return (
              <div key={i.id} className={"it" + (i.id === sel ? " on" : "")} onClick={() => setSel(i.id)}>
                <span>{"fields" in i ? linkedProductName(i, sources) : i.nama}</span>
                <span className={"st " + (ok ? "ok" : "w")}>{ok ? "siap" : "menunggu deskripsi"}</span>
              </div>
            );
          })}
        </div>
        <div className="pmr">
          {editing ? (
            <CatalogEditor
              key={`${editing}:${draft ? "draft" : "edit"}`}
              kind={kind}
              menu={editingMenu}
              location={editingLocation}
              fields={menuFields}
              linkMode={linkMode}
              sources={sources}
              menus={data?.menus ?? []}
              draftFields={draft}
              saving={edit.saving}
              error={edit.error}
              onCancel={() => {
                edit.reset();
                setDraft(null);
                setEditing(null);
              }}
              onSaved={(id) => {
                setSel(id);
                setDraft(null);
                setEditing(null);
              }}
              onSaveMenu={(input) => edit.saveMenu({ ...input, takenSlugs })}
              onSaveLocation={(input) => edit.saveLocation({ ...input, takenSlugs })}
            />
          ) : x ? (
            <Detail
              kind={kind}
              x={x}
              sources={sources}
              url={url}
              onZoom={setZoom}
              menuFields={menuFields}
              onEdit={() => {
                edit.reset();
                setDraft(null);
                setDescribeError(null);
                setEditing(x.id);
              }}
              describing={describing}
              describeError={describeError}
              onDescribe={"fields" in x ? () => void fillFromPhoto(x) : undefined}
            />
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
                    <span className="area-meta">Area: {f.area?.length ? f.area.join(", ") : "belum diisi"}</span>
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
  sources,
  url,
  onZoom,
  menuFields,
  onEdit,
  describing,
  describeError,
  onDescribe,
}: {
  kind: Kind;
  x: MenuItem | LocationItem;
  sources: { id: string; name: string }[];
  url: (p: LibraryPhoto) => string | undefined;
  onZoom: (u: string) => void;
  menuFields: [string, string][];
  onEdit: () => void;
  describing?: boolean;
  describeError?: string | null;
  onDescribe?: () => void;
}) {
  const title = "fields" in x ? linkedProductName(x, sources) : x.nama;
  const canDescribe = "fields" in x && menuHasPhoto(x);
  return (
    <>
      <div className="list-head">
        <h2 style={{ margin: 0 }}>{title}</h2>
        <span>
          {onDescribe ? (
            <button type="button" className="hb ghost" disabled={!canDescribe || describing} onClick={onDescribe}>
              {describing ? "Membaca foto…" : "Isi dari foto"}
            </button>
          ) : null}{" "}
          <button type="button" className="hb ghost" onClick={onEdit}>
            Ubah
          </button>
        </span>
      </div>
      {describeError ? <div className="empty">{describeError}</div> : null}
      <div className="sub">
        {kind === "menu"
          ? `Deskripsi produk untuk bagian ${menuFields.find(([key]) => key === "main")?.[1] ?? "Hidangan utama"} di prompt Flow.`
          : `Label untuk Anthropic: ${"label" in x ? x.label : x.nama}. Judul ini untuk prompt Flow.`}
      </div>
      {!isFilled(x) ? (
        <div className="wait">
          {kind === "menu" ? "Kolom visual masih kosong. Isi lewat tombol Ubah." : "Deskripsi lokasi masih kosong."}
        </div>
      ) : null}
      {"fields" in x && x.sourcePhotoUrl ? (
        <div className="ph">
          <figure>
            <img src={x.sourcePhotoUrl} alt="" />
            <figcaption>{x.sourceKind === "subcategory" ? "Foto dari content plan" : "Foto dari Item Library"}</figcaption>
          </figure>
        </div>
      ) : (
        <Photos kind={kind} x={x} url={url} onZoom={onZoom} />
      )}
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
