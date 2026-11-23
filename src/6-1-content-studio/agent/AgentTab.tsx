/** Agent tab: which laptops run the Synckerja Agent for this organization, and its access tokens. */
import { useState } from "react";
import { useCurrentUserRole } from "@/shared/hooks/useCurrentUserRole";
import { ago, isOnline, tokenState, toolList } from "./agentData";
import { useAgentDevices, useAgentTokenActions, useAgentTokens, type CreatedToken } from "./useAgentData";

interface Props {
  headLeft: React.ReactNode;
}

const EXPIRY_OPTIONS = [
  { days: 90, label: "3 bulan" },
  { days: 180, label: "6 bulan" },
  { days: 365, label: "1 tahun" },
];

const ERRORS: Record<string, string> = {
  not_owner_or_admin: "Cuma owner/admin yang bisa bikin atau cabut token.",
  too_many_tokens: "Maksimal 20 token aktif. Cabut yang sudah nggak dipakai dulu.",
  invalid_label: "Isi nama device dulu (maks 80 huruf).",
};

function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const hit = Object.keys(ERRORS).find((k) => msg.includes(k));
  return hit ? ERRORS[hit] : "Gagal. Cek koneksi, lalu coba lagi.";
}

const dateText = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—";

export function AgentTab({ headLeft }: Props) {
  const devices = useAgentDevices();
  const tokens = useAgentTokens();
  const { create, revoke } = useAgentTokenActions();
  const role = useCurrentUserRole();
  const canManage = role.data === "owner" || role.data === "admin";

  const [label, setLabel] = useState("");
  const [days, setDays] = useState(365);
  const [fresh, setFresh] = useState<CreatedToken | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onCreate = async () => {
    setErr(null);
    setCopied(false);
    try {
      setFresh(await create.mutateAsync({ label: label.trim(), days }));
      setLabel("");
    } catch (e) {
      setErr(errorText(e));
    }
  };

  const onRevoke = async (id: string) => {
    setErr(null);
    try {
      await revoke.mutateAsync(id);
      setConfirmRevoke(null);
    } catch (e) {
      setErr(errorText(e));
    }
  };

  const copy = async () => {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh.token);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const deviceRows = devices.data ?? [];
  const tokenRows = tokens.data ?? [];

  return (
    <>
      <header className="ck-head">{headLeft}</header>
      <div className="agent">
        <section>
          <h2>Laptop yang menjalankan Agent</h2>
          <p className="mut">
            Agent adalah program di laptop yang jaga folder footage, render video, dan upload hasilnya ke content plan.
            Status diperbarui tiap menit.
          </p>
          {devices.isLoading ? (
            <p className="mut">Memuat…</p>
          ) : devices.isError ? (
            <p className="bad">Gagal memuat daftar device.</p>
          ) : deviceRows.length === 0 ? (
            <div className="empty">Belum ada Agent yang tersambung ke organisasi ini.</div>
          ) : (
            deviceRows.map((row) => {
              const d = row.agent_devices;
              if (!d) return null;
              const online = isOnline(row.last_seen_at);
              const tools = toolList(d.tools);
              const missing = tools.filter((t) => !t.ok);
              return (
                <div key={row.device_id} className="dev">
                  <div className="dev-top">
                    <span className={online ? "dot on" : "dot"} />
                    <b>{d.name}</b>
                    <span className={online ? "livok" : "mut"}>
                      {online ? "online" : `offline · terakhir ${ago(row.last_seen_at)}`}
                    </span>
                    <span className="mut">
                      {[d.agent_version && `v${d.agent_version}`, d.platform].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  {tools.length > 0 && (
                    <div className="tools">
                      {tools.map((t) => (
                        <span key={t.key} className={t.ok ? "tool ok" : "tool no"} title={t.detail ?? undefined}>
                          {t.ok ? "✓" : "✕"} {t.key}
                        </span>
                      ))}
                    </div>
                  )}
                  {missing.length > 0 && (
                    <p className="bad">Belum lengkap: {missing.map((t) => t.key).join(", ")}. Fitur yang butuh ini belum bisa jalan.</p>
                  )}
                  {d.last_error && <p className="bad">Error terakhir: {d.last_error}</p>}
                </div>
              );
            })
          )}
        </section>

        <section>
          <h2>Token Agent</h2>
          <p className="mut">
            Satu token per laptop. Token cuma bisa akses katalog footage dan antrian render organisasi ini, dan bisa
            dicabut kapan saja. Simpan di file <code>.env</code> Agent, jangan dibagikan.
          </p>

          {!canManage ? (
            <div className="empty">Cuma owner/admin yang bisa melihat dan membuat token.</div>
          ) : (
            <>
              <div className="mk">
                <input
                  className="q"
                  placeholder="Nama device, contoh: Laptop Aldi"
                  maxLength={80}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
                <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Masa berlaku">
                  {EXPIRY_OPTIONS.map((o) => (
                    <option key={o.days} value={o.days}>
                      Berlaku {o.label}
                    </option>
                  ))}
                </select>
                <button type="button" className="hb" disabled={!label.trim() || create.isPending} onClick={() => void onCreate()}>
                  {create.isPending ? "Membuat…" : "Buat token"}
                </button>
              </div>

              {fresh && (
                <div className="fresh">
                  <p>
                    <b>Salin sekarang.</b> Token ini cuma ditampilkan sekali. Kalau hilang, buat token baru.
                  </p>
                  <code>{fresh.token}</code>
                  <div className="row">
                    <button type="button" className="hb" onClick={() => void copy()}>
                      {copied ? "Tersalin ✓" : "Salin"}
                    </button>
                    <button type="button" className="hb ghost" onClick={() => setFresh(null)}>
                      Sudah disimpan
                    </button>
                  </div>
                </div>
              )}

              {err && <p className="bad">{err}</p>}

              {tokens.isLoading ? (
                <p className="mut">Memuat…</p>
              ) : tokenRows.length === 0 ? (
                <div className="empty">Belum ada token.</div>
              ) : (
                <table className="tok">
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>Token</th>
                      <th>Status</th>
                      <th>Terakhir dipakai</th>
                      <th>Berlaku sampai</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {tokenRows.map((t) => {
                      const st = tokenState(t);
                      return (
                        <tr key={t.id} className={st === "aktif" ? "" : "off"}>
                          <td>{t.label}</td>
                          <td>
                            <code>sk_agent_{t.token_prefix}_…</code>
                          </td>
                          <td className={st === "aktif" ? "livok" : "mut"}>{st}</td>
                          <td>{ago(t.last_used_at)}</td>
                          <td>{dateText(t.expires_at)}</td>
                          <td>
                            {st === "aktif" &&
                              (confirmRevoke === t.id ? (
                                <span className="row">
                                  <button
                                    type="button"
                                    className="hb danger"
                                    disabled={revoke.isPending}
                                    onClick={() => void onRevoke(t.id)}
                                  >
                                    Ya, cabut
                                  </button>
                                  <button type="button" className="hb ghost" onClick={() => setConfirmRevoke(null)}>
                                    Batal
                                  </button>
                                </span>
                              ) : (
                                <button type="button" className="hb ghost" onClick={() => setConfirmRevoke(t.id)}>
                                  Cabut
                                </button>
                              ))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
