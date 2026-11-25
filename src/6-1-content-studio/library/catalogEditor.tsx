import { useState } from "react";
import { LOCATION_ALWAYS_ON } from "../../../supabase/functions/_shared/describeCatalogLocation";
import { existingMenuForSource, linkedProductName, locationDraftError, parseAliases, productDraftError, unlinkedSources } from "./catalogEdit";
import type { CatalogSource, LocationItem, MenuItem } from "./libraryData";

interface Props {
  kind: "menu" | "lokasi";
  menu: MenuItem | null;
  location: LocationItem | null;
  fields: [string, string][];
  linkMode: "manual" | "item" | "feature";
  sources: CatalogSource[];
  menus: MenuItem[];
  draftFields?: Record<string, string> | null;
  /** Location photo the draft describes. Product drafts leave this empty. */
  draftPhotoId?: string | null;
  saving: boolean;
  error: unknown;
  onCancel: () => void;
  onSaveMenu: (input: {
    id?: string;
    name: string;
    aliases: string[];
    fields: { key: string; position: number; body: string }[];
    defaultPriceId?: string | null;
    featureId?: string | null;
    subServiceId?: string | null;
    fillOnly?: boolean;
  }) => Promise<string>;
  onSaveLocation: (input: {
    id?: string;
    label: string;
    name: string;
    photos?: { id: string; description: string }[];
    sections?: { title: string; body: string }[];
  }) => Promise<string>;
  onSaved: (id: string) => void;
}

function mergeAliases(current: string[], added: string[]): string[] {
  const aliases = [...current];
  for (const alias of added) {
    if (!aliases.some((item) => item.toLowerCase() === alias.toLowerCase())) aliases.push(alias);
  }
  return aliases;
}

function errorText(error: unknown): string {
  if (!error) return "";
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") return error.message;
  return "Gagal menyimpan.";
}

export function CatalogEditor({
  kind,
  menu,
  location,
  fields,
  linkMode,
  sources,
  menus,
  draftFields,
  draftPhotoId,
  saving,
  error,
  onCancel,
  onSaveMenu,
  onSaveLocation,
  onSaved,
}: Props) {
  const linked = Boolean(menu?.defaultPriceId || menu?.featureId || menu?.subServiceId);
  const pickSource = kind === "menu" && !menu && linkMode !== "manual";
  const choices = pickSource ? unlinkedSources(sources, menus) : [];
  const [sourceId, setSourceId] = useState("");
  const [name, setName] = useState(menu ? linkedProductName(menu, sources) : (location?.nama ?? ""));
  const [label, setLabel] = useState(location?.label ?? "");
  const [aliases, setAliases] = useState(menu?.aliases.join(", ") ?? "");
  const [bodies, setBodies] = useState<Record<string, string>>(() => ({ ...(menu?.fields ?? {}), ...(draftFields ?? {}) }));
  const [photoText, setPhotoText] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    for (const photo of location?.fotos ?? []) next[photo.id] = photo.desc ?? "";
    if (draftPhotoId && draftFields?.desc) next[draftPhotoId] = draftFields.desc;
    return next;
  });
  const [sectionText, setSectionText] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    for (const section of LOCATION_ALWAYS_ON) {
      const current = location?.bagian.find((item) => item.judul === section.title)?.isi ?? "";
      next[section.key] = draftFields?.[section.key] ?? current;
    }
    return next;
  });
  const [localError, setLocalError] = useState<string | null>(null);

  const save = async () => {
    setLocalError(null);
    if (kind === "menu") {
      const picked = choices.find((item) => item.id === sourceId) ?? null;
      const productName = picked?.name ?? name;
      if (pickSource && !picked) {
        setLocalError(linkMode === "item" ? "Pilih produk." : "Pilih feature.");
        return;
      }
      const problem = productDraftError(productName);
      if (problem) {
        setLocalError(problem);
        return;
      }
      const parsed = parseAliases(aliases);
      if ("error" in parsed) {
        setLocalError(parsed.error);
        return;
      }
      const target = picked ? existingMenuForSource(picked.name, menus) : null;
      if (target && "error" in target) {
        setLocalError(target.error);
        return;
      }
      const attached = target && "menuId" in target ? menus.find((item) => item.id === target.menuId) : null;
      const nextAliases = attached ? mergeAliases(attached.aliases, parsed.aliases) : parsed.aliases;
      try {
        const id = await onSaveMenu({
          id: attached?.id ?? menu?.id,
          name: productName.trim(),
          aliases: nextAliases,
          fillOnly: Boolean(attached),
          fields: fields.map(([key], index) => ({ key, position: index + 1, body: bodies[key] ?? "" })),
          ...(picked?.kind === "item" ? { defaultPriceId: picked.id } : {}),
          ...(picked?.kind === "feature" ? { featureId: picked.id } : {}),
          ...(picked?.kind === "subcategory" ? { subServiceId: picked.id } : {}),
        });
        onSaved(id);
      } catch (err) {
        setLocalError(errorText(err));
      }
      return;
    }
    const problem = locationDraftError(label, name);
    if (problem) {
      setLocalError(problem);
      return;
    }
    try {
      const id = await onSaveLocation({
        id: location?.id,
        label: label.trim(),
        name: name.trim() || label.trim(),
        ...(location
          ? {
              photos: location.fotos.map((photo) => ({ id: photo.id, description: photoText[photo.id] ?? "" })),
              sections: LOCATION_ALWAYS_ON.map((section) => ({ title: section.title, body: sectionText[section.key] ?? "" })),
            }
          : {}),
      });
      onSaved(id);
    } catch (err) {
      setLocalError(errorText(err));
    }
  };

  const shown = localError || errorText(error);

  return (
    <form
      className="lib-edit"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <h2>{kind === "menu" ? (menu ? "Ubah produk" : "Produk baru") : location ? "Ubah lokasi" : "Lokasi baru"}</h2>
      {kind === "lokasi" ? (
        <>
          <label htmlFor="catalog-label">Label</label>
          <input id="catalog-label" value={label} maxLength={80} onChange={(event) => setLabel(event.target.value)} />
          <div className="sub">Label pendek ini yang boleh ditulis Anthropic pada klip. Contoh: PIK2, Layar.</div>
          <label htmlFor="catalog-name">Judul</label>
          <input id="catalog-name" value={name} maxLength={200} onChange={(event) => setName(event.target.value)} />
          <div className="sub">Judul boleh lebih panjang. Kosongkan kalau sama dengan label.</div>
          {location ? (
            <>
              {location.fotos.map((photo) => (
                <div key={photo.id}>
                  <label htmlFor={`catalog-photo-${photo.id}`}>Deskripsi foto — {photo.label || "tanpa label"}</label>
                  <textarea
                    id={`catalog-photo-${photo.id}`}
                    value={photoText[photo.id] ?? ""}
                    onChange={(event) => setPhotoText((prev) => ({ ...prev, [photo.id]: event.target.value }))}
                  />
                  <div className="sub">Kalimat ini yang dipakai untuk foto ini di prompt.</div>
                </div>
              ))}
              {LOCATION_ALWAYS_ON.map((section) => (
                <div key={section.key}>
                  <label htmlFor={`catalog-section-${section.key}`}>{section.title}</label>
                  <textarea
                    id={`catalog-section-${section.key}`}
                    value={sectionText[section.key] ?? ""}
                    onChange={(event) => setSectionText((prev) => ({ ...prev, [section.key]: event.target.value }))}
                  />
                </div>
              ))}
              <div className="sub">Scene, Atmosphere, dan Must NOT selalu ikut di prompt lokasi.</div>
            </>
          ) : null}
        </>
      ) : (
        <>
          {pickSource ? (
            <>
              <label htmlFor="catalog-source">{linkMode === "item" ? "Produk" : "Feature"}</label>
              <select id="catalog-source" value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
                <option value="">{choices.length ? "Pilih…" : "Tidak ada yang bisa ditautkan"}</option>
                {choices.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <div className="sub">
                {linkMode === "item"
                  ? "Nama dan foto mengikuti Item Library atau subkategori di content plan. Harga dan stok tidak ikut."
                  : "Nama mengikuti feature di rencana konten."}
              </div>
            </>
          ) : (
            <>
              <label htmlFor="catalog-name">Nama</label>
              <input id="catalog-name" value={name} maxLength={200} readOnly={linked} onChange={(event) => setName(event.target.value)} />
            </>
          )}
          <label htmlFor="catalog-aliases">Alias</label>
          <input
            id="catalog-aliases"
            value={aliases}
            onChange={(event) => setAliases(event.target.value)}
            placeholder="pisahkan dengan koma"
          />
          <div className="sub">Nama dan alias ini yang boleh ditulis Anthropic. Kolom di bawah mengikuti template industri.</div>
          {fields.map(([key, fieldLabel]) => (
            <div key={key}>
              <label htmlFor={`catalog-field-${key}`}>{fieldLabel}</label>
              <textarea
                id={`catalog-field-${key}`}
                value={bodies[key] ?? ""}
                onChange={(event) => setBodies((prev) => ({ ...prev, [key]: event.target.value }))}
              />
            </div>
          ))}
        </>
      )}
      {shown ? (
        <div className="empty" style={{ marginTop: 8 }}>
          {shown}
        </div>
      ) : null}
      <div className="row-actions">
        <button type="submit" className="hb" disabled={saving}>
          {saving ? "Menyimpan…" : "Simpan"}
        </button>
        <button type="button" className="hb ghost" onClick={onCancel} disabled={saving}>
          Batal
        </button>
      </div>
    </form>
  );
}
