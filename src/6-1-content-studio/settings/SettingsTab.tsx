import { useState } from "react";
import {
  CatalogMigrationPendingError,
  useAddSceneKind,
  useApplyIndustryTemplate,
  useCatalogSettings,
  useDeleteTagDef,
  useUpsertTagDef,
} from "./useCatalogSettings";

interface Props {
  headLeft: React.ReactNode;
}

export function SettingsTab({ headLeft }: Props) {
  const { data, isPending, error } = useCatalogSettings();
  const apply = useApplyIndustryTemplate();
  const upsertTag = useUpsertTagDef();
  const deleteTag = useDeleteTagDef();
  const addKind = useAddSceneKind();
  const [picked, setPicked] = useState<string>("");
  const [tagKey, setTagKey] = useState("");
  const [tagLabel, setTagLabel] = useState("");
  const [kindKey, setKindKey] = useState("");
  const [kindLabel, setKindLabel] = useState("");
  const current = data?.industry_template_code ?? null;
  const selected = picked || current || data?.templates[0]?.code || "";

  return (
    <>
      <header className="ck-head">{headLeft}</header>
      <div className="pmw">
        <div className="pml">
          <div className="gt" style={{ marginBottom: 8 }}>
            Template industri
          </div>
          {isPending ? <div className="loading">Memuat…</div> : null}
          {error ? (
            <div className="empty">
              {error instanceof CatalogMigrationPendingError || error.message === "catalog_migration_pending"
                ? "Migrasi template industri belum deploy. Merge PR lalu tunggu job deploy."
                : "Gagal memuat. Coba muat ulang."}
            </div>
          ) : null}
          {(data?.templates ?? []).map((t) => (
            <div
              key={t.code}
              className={"it" + (t.code === selected ? " on" : "")}
              onClick={() => setPicked(t.code)}
            >
              <span>{t.label}</span>
              <span className={"st " + (t.code === current ? "ok" : "w")}>
                {t.code === current ? "aktif" : t.code}
              </span>
            </div>
          ))}
        </div>
        <div className="pmr">
          {data ? (
            <>
              <h2>Pengaturan katalog</h2>
              <div className="sub">
                Template menentukan kolom Produk, tag filter Footage, dan jenis scene. Menerapkan template yang
                berbeda menghapus teks kolom di semua produk. Menerapkan template yang sama mempertahankan teks.
                Tag yang kamu tambah sendiri tetap.
              </div>
              <div className="blk">
                <div className="hd">
                  <b>Template aktif</b>
                </div>
                <pre>
                  {current
                    ? `${current}${data.applied_at ? `\napplied ${new Date(data.applied_at).toLocaleString()}` : ""}`
                    : "Belum dipilih"}
                </pre>
              </div>
              <div className="blk">
                <div className="hd">
                  <b>Apply template</b>
                </div>
                <div className="sub" style={{ marginBottom: 8 }}>
                  {(data.templates.find((t) => t.code === selected)?.description ?? "") || selected}
                </div>
                <button
                  type="button"
                  className="hb"
                  disabled={!selected || apply.isPending}
                  onClick={() => {
                    if (!selected) return;
                    if (current && current !== selected) {
                      const ok = window.confirm(
                        `Ganti template dari ${current} ke ${selected}? Teks kolom di semua produk ikut terhapus. Tag dan kolom dari template lama diganti. Tag yang kamu tambah sendiri tetap.`,
                      );
                      if (!ok) return;
                    }
                    apply.mutate(selected);
                  }}
                >
                  {apply.isPending ? "Menerapkan…" : `Terapkan ${selected || "…"}`}
                </button>
                {apply.isError ? (
                  <div className="empty" style={{ marginTop: 8 }}>
                    Gagal apply. Cek migrasi sudah deploy / RLS.
                  </div>
                ) : null}
                {apply.isSuccess ? (
                  <div className="sub" style={{ marginTop: 8 }}>
                    Template diterapkan.
                  </div>
                ) : null}
              </div>
              <div className="gt" style={{ marginTop: 16 }}>
                Kolom produk ({data.menu_field_defs.length})
              </div>
              {data.menu_field_defs.map((f) => (
                <div className="blk" key={f.field_key}>
                  <div className="hd">
                    <b>
                      {f.label} <span style={{ opacity: 0.6 }}>({f.field_key})</span>
                    </b>
                  </div>
                </div>
              ))}
              <div className="gt" style={{ marginTop: 16 }}>
                Tag footage ({data.tag_defs.length})
              </div>
              {data.tag_defs.map((t) => (
                <div className="blk" key={t.key}>
                  <div className="hd" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <b>
                      {t.label}{" "}
                      <span style={{ opacity: 0.6 }}>
                        ({t.key} · {t.value_type})
                      </span>
                    </b>
                    <button
                      type="button"
                      className="hb"
                      disabled={deleteTag.isPending}
                      onClick={() => {
                        if (!t.id) return;
                        if (!window.confirm(`Hapus tag ${t.key}? Hanya jika belum ada nilai.`)) return;
                        deleteTag.mutate(t.id);
                      }}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))}
              <div className="blk">
                <div className="hd">
                  <b>Tambah tag</b>
                </div>
                <div className="sub" style={{ display: "grid", gap: 6, marginBottom: 8 }}>
                  <input
                    placeholder="key (snake_case)"
                    value={tagKey}
                    onChange={(e) => setTagKey(e.target.value)}
                  />
                  <input
                    placeholder="Label"
                    value={tagLabel}
                    onChange={(e) => setTagLabel(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="hb"
                  disabled={!tagKey.trim() || !tagLabel.trim() || upsertTag.isPending}
                  onClick={() => {
                    upsertTag.mutate(
                      { key: tagKey.trim().toLowerCase(), label: tagLabel.trim() },
                      {
                        onSuccess: () => {
                          setTagKey("");
                          setTagLabel("");
                        },
                      },
                    );
                  }}
                >
                  Simpan tag
                </button>
                {upsertTag.isError || deleteTag.isError ? (
                  <div className="empty" style={{ marginTop: 8 }}>
                    Gagal ubah tag (mungkin masih dipakai).
                  </div>
                ) : null}
              </div>
              <div className="gt" style={{ marginTop: 16 }}>
                Jenis scene ({data.scene_kind_defs.length})
              </div>
              {data.scene_kind_defs.map((k) => (
                <div className="blk" key={k.key}>
                  <div className="hd">
                    <b>
                      {k.label} <span style={{ opacity: 0.6 }}>({k.key})</span>
                    </b>
                  </div>
                </div>
              ))}
              <div className="blk">
                <div className="hd">
                  <b>Tambah jenis scene</b>
                </div>
                <div className="sub" style={{ display: "grid", gap: 6, marginBottom: 8 }}>
                  <input
                    placeholder="key (snake_case)"
                    value={kindKey}
                    onChange={(e) => setKindKey(e.target.value)}
                  />
                  <input
                    placeholder="Label"
                    value={kindLabel}
                    onChange={(e) => setKindLabel(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="hb"
                  disabled={!kindKey.trim() || !kindLabel.trim() || addKind.isPending}
                  onClick={() => {
                    addKind.mutate(
                      { key: kindKey.trim().toLowerCase(), label: kindLabel.trim() },
                      {
                        onSuccess: () => {
                          setKindKey("");
                          setKindLabel("");
                        },
                      },
                    );
                  }}
                >
                  Simpan jenis
                </button>
                {addKind.isError ? (
                  <div className="empty" style={{ marginTop: 8 }}>
                    Gagal menambah jenis scene.
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
