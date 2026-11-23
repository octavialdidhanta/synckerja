/** Gaya baku: the five style boxes, editable, as in katalog.html (Referensi → ★ Gaya baku). */
import { useEffect, useRef, useState } from "react";
import { STYLE_BOXES, useStyleData, useStyleHistory, useStyleSave, type StyleVersion } from "./useStyleData";

export function StyleBoxes({
  edit,
  setEdit,
  onSaved,
}: {
  edit: { key: string; text: string } | null;
  setEdit: (e: { key: string; text: string } | null) => void;
  onSaved: (msg: string) => void;
}) {
  const style = useStyleData();
  const history = useStyleHistory();
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const { save, saving } = useStyleSave();
  const versions = (key: string) => (history.data ?? []).filter((v) => v.field_key === key);
  const body = (key: string) => style.data?.find((s) => s.field_key === key)?.body ?? "";

  const submit = async () => {
    if (!edit) return;
    if (!edit.text.trim()) return onSaved("Kotak gaya nggak boleh kosong.");
    if (edit.text.length > 4000) return onSaved("Maksimal 4000 karakter per kotak.");
    try {
      const res = await save(edit.key, edit.text);
      if (res === "saved") {
        setEdit(null);
        onSaved("Gaya baku tersimpan");
      } else {
        onSaved("Gaya ini barusan diubah di tempat lain (mungkin Claude). Udah dimuat ulang, cek lalu edit lagi.");
        setEdit(null);
      }
    } catch {
      onSaved("Gagal simpan. Cek koneksi, lalu coba lagi.");
    }
  };

  return (
    <>
      <h2>★ Gaya baku</h2>
      <div className="sub">
        Aturan gaya Sate Sultan. Claude wajib baca ini tiap bikin naskah, shot list &amp; video. Kalau beda sama aturan lain,
        yang di sini yang menang. Boleh lo edit.
      </div>
      {style.isPending ? <div className="loading">Memuat…</div> : null}
      {STYLE_BOXES.map(({ key, label }) => {
        const editing = edit?.key === key;
        return (
          <div key={key} className="blk">
            <div className="hd">
              <b>{label}</b>
              <span>
                {versions(key).length ? (
                  <button type="button" className="mini" onClick={() => setOpenHistory(openHistory === key ? null : key)}>
                    {openHistory === key ? "Tutup riwayat" : `Riwayat (${versions(key).length})`}
                  </button>
                ) : null}
                <button type="button" className="mini" onClick={() => setEdit(editing ? null : { key, text: body(key) })}>
                  {editing ? "Batal" : "Edit"}
                </button>
              </span>
            </div>
            {editing ? (
              <>
                <StyleEditor label={label} value={edit.text} onChange={(text) => setEdit({ key, text })} />
                <div style={{ marginTop: 6 }}>
                  <button type="button" className="pb" disabled={saving} onClick={() => void submit()}>
                    {saving ? "Menyimpan…" : "Simpan"}
                  </button>
                </div>
              </>
            ) : (
              <pre>{body(key) || "—"}</pre>
            )}
            {openHistory === key ? (
              <StyleHistory
                versions={versions(key)}
                onRestore={(v) => {
                  setOpenHistory(null);
                  setEdit({ key, text: v.body });
                  onSaved("Versi lama dibuka di editor. Cek dulu, lalu Simpan buat balikin.");
                }}
              />
            ) : null}
          </div>
        );
      })}
    </>
  );
}

/** Opens scrolled into view and focused, as katalog.html mgStd() does after adding a line. */
function StyleEditor({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const el = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    el.current?.scrollIntoView?.({ block: "center" });
    el.current?.focus();
  }, []);
  return <textarea ref={el} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />;
}

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Versions this box had before each change, newest first. Restoring opens it in the editor; nothing is saved until Simpan. */
function StyleHistory({ versions, onRestore }: { versions: StyleVersion[]; onRestore: (v: StyleVersion) => void }) {
  const [shown, setShown] = useState<string | null>(null);
  return (
    <div className="hist">
      <div className="hint2">Versi sebelum tiap perubahan (maks. 50 terakhir). Tanggal = kapan versi itu diganti.</div>
      {versions.map((v) => (
        <div key={v.id} className="hv">
          <div className="hh">
            <span>Dipakai sampai {fmtWhen(v.replaced_at)}</span>
            <span>
              <button type="button" className="mini" onClick={() => setShown(shown === v.id ? null : v.id)}>
                {shown === v.id ? "Sembunyikan" : "Lihat"}
              </button>
              <button type="button" className="mini" onClick={() => onRestore(v)}>
                Balikin ke versi ini
              </button>
            </span>
          </div>
          {shown === v.id ? <pre>{v.body}</pre> : null}
        </div>
      ))}
    </div>
  );
}
