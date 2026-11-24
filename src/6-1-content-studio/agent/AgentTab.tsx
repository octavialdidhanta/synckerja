/** Agent tab: which laptops run the Synckerja Agent for this organization, and its access tokens. */
import { useState } from "react";
import { useCurrentUserRole } from "@/shared/hooks/useCurrentUserRole";
import { supabase } from "@/shared/lib/supabaseClient";
import { ago, deviceLink, JOB_STATUS, sortJobs, tokenState, toolList, visibleDevices } from "./agentData";
import {
  useAgentDevices,
  useAgentJobActions,
  useAgentJobs,
  useAgentTokenActions,
  useAgentTokens,
  type CreatedToken,
} from "./useAgentData";
import type { AgentTokenRow } from "./agentData";

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
  invalid_label: "Isi nama laptop dulu (maks 80 huruf).",
};

function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const hit = Object.keys(ERRORS).find((k) => msg.includes(k));
  return hit ? ERRORS[hit] : "Gagal. Cek koneksi, lalu coba lagi.";
}

const dateText = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—";

/**
 * The Agent repo is private: the browser asks Synckerja (edge function agent-installer) for GitHub's
 * pre-signed link to the latest Synckerja-Office.exe, valid a few minutes, then downloads from there.
 */
function InstallerDownload() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("agent-installer", { body: {} });
      const url = (data as { url?: unknown } | null)?.url;
      if (fnError || typeof url !== "string") throw new Error("no_url");
      window.location.href = url;
    } catch {
      setError("Installer belum bisa diunduh. Coba lagi sebentar.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button type="button" className="hb" disabled={busy} onClick={() => void download()}>
        {busy ? "Menyiapkan…" : "Download installer"}
      </button>
      {error ? <span role="alert">{error}</span> : null}
    </>
  );
}

const TOOL_LABEL: Record<string, string> = {
  anthropic_key: "Anthropic",
  chromium: "Chromium",
  ffmpeg: "FFmpeg",
  ffprobe: "FFprobe",
  fonts: "Font",
  node: "Node",
  onnxruntime: "ONNX",
  remotion: "Remotion",
  rvm: "RVM",
  sam2: "SAM",
  whisper: "Whisper",
};

function toolLabel(key: string): string {
  return TOOL_LABEL[key] ?? key.replace(/_/g, " ");
}

function TokenRow({
  row,
  confirmRevoke,
  onAsk,
  onCancel,
  onRevoke,
  pending,
}: {
  row: AgentTokenRow;
  confirmRevoke: string | null;
  onAsk: (id: string) => void;
  onCancel: () => void;
  onRevoke: (id: string) => void;
  pending: boolean;
}) {
  const st = tokenState(row);
  return (
    <tr className={st === "aktif" ? "" : "off"}>
      <td>{row.label}</td>
      <td>
        <code>sk_agent_{row.token_prefix}_…</code>
      </td>
      <td>
        <span className={st === "aktif" ? "pill-status" : "pill-status off"}>{st}</span>
      </td>
      <td>{ago(row.last_used_at)}</td>
      <td>{dateText(row.expires_at)}</td>
      <td>
        {st === "aktif" &&
          (confirmRevoke === row.id ? (
            <span className="row">
              <button type="button" className="hb danger" disabled={pending} onClick={() => onRevoke(row.id)}>
                Ya, cabut
              </button>
              <button type="button" className="hb ghost" onClick={onCancel}>
                Batal
              </button>
            </span>
          ) : (
            <button type="button" className="hb ghost" onClick={() => onAsk(row.id)}>
              Cabut
            </button>
          ))}
      </td>
    </tr>
  );
}

export function AgentTab({ headLeft }: Props) {
  const devices = useAgentDevices();
  const tokens = useAgentTokens();
  const { create, revoke } = useAgentTokenActions();
  const jobs = useAgentJobs();
  const jobActions = useAgentJobActions();
  const role = useCurrentUserRole();
  const canManage = role.data === "owner" || role.data === "admin";

  const [label, setLabel] = useState("");
  const [days, setDays] = useState(365);
  const [fresh, setFresh] = useState<CreatedToken | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [showRetired, setShowRetired] = useState(false);
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

  const deviceRows = visibleDevices(devices.data ?? []);
  const tokenRows = tokens.data ?? [];
  const activeTokens = tokenRows.filter((t) => tokenState(t) === "aktif");
  const retiredTokens = tokenRows.filter((t) => tokenState(t) !== "aktif");

  return (
    <>
      <header className="ck-head">{headLeft}</header>
      <div className="agent">
        <div className="agent-main">
          <section className="panel">
            {devices.isLoading ? (
              <p className="mut">Memuat…</p>
            ) : devices.isError ? (
              <p className="bad">Gagal memuat daftar laptop.</p>
            ) : deviceRows.length === 0 ? (
              <div className="empty">
                Belum ada laptop yang tersambung.
                <InstallerDownload />
              </div>
            ) : (
              deviceRows.map((row) => {
                const d = row.agent_devices;
                if (!d) return null;
                const link = deviceLink({
                  last_seen_at: row.last_seen_at,
                  token_id: row.token_id,
                  token: row.agent_tokens,
                });
                const online = link === "online";
                const tools = toolList(d.tools);
                const missing = tools.filter((t) => !t.ok);
                return (
                  <div key={row.device_id} className="dev">
                    <div className="dev-top">
                      <div className="dev-id">
                        <span className={online ? "dot on" : "dot"} />
                        <b>{d.name}</b>
                        <span className={online ? "pill-status" : "pill-status off"}>
                          {link === "online" ? "Online" : link === "terputus" ? "Terputus" : "Offline"}
                        </span>
                      </div>
                      <div className="dev-side">
                        <span className="dev-meta" title={d.platform ?? undefined}>
                          {online ? (d.agent_version ? `v${d.agent_version}` : "") : ago(row.last_seen_at)}
                        </span>
                        <InstallerDownload />
                      </div>
                    </div>
                    {tools.length > 0 && (
                      <div className="tools">
                        {tools.map((t) => (
                          <span
                            key={t.key}
                            className={online && t.ok ? "tool ok" : "tool no"}
                            title={online ? (t.detail ?? undefined) : link === "terputus" ? "Laptop terputus" : "Laptop offline"}
                          >
                            {toolLabel(t.key)}
                          </span>
                        ))}
                      </div>
                    )}
                    {missing.length > 0 && (
                      <p className="note">Belum lengkap: {missing.map((t) => toolLabel(t.key)).join(", ")}.</p>
                    )}
                    {d.last_error && <p className="bad">Error terakhir: {d.last_error}</p>}
                  </div>
                );
              })
            )}
          </section>

          <section className="panel fill">
            <div className="panel-h">
              <h2>Token</h2>
              <p>Satu token untuk satu laptop. Cabut kalau tidak dipakai lagi.</p>
            </div>

            {!canManage ? (
              <div className="empty">Cuma owner atau admin yang bisa melihat dan membuat token.</div>
            ) : (
              <>
                <div className="mk">
                  <label className="field">
                    <span>Nama laptop</span>
                    <input
                      placeholder="Ketik nama laptop"
                      maxLength={80}
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Berlaku</span>
                    <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Masa berlaku">
                      {EXPIRY_OPTIONS.map((o) => (
                        <option key={o.days} value={o.days}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="hb" disabled={!label.trim() || create.isPending} onClick={() => void onCreate()}>
                    {create.isPending ? "Membuat…" : "Buat token"}
                  </button>
                </div>

                {fresh && (
                  <div className="fresh">
                    <p>
                      <b>Salin sekarang.</b> Token ini cuma ditampilkan sekali.
                    </p>
                    <code>{fresh.token}</code>
                    <div className="row">
                      <button type="button" className="hb" onClick={() => void copy()}>
                        {copied ? "Tersalin" : "Salin"}
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
                  <>
                    {activeTokens.length === 0 && retiredTokens.length === 0 ? null : (
                      <table className="tok">
                        <colgroup>
                          <col className="c-name" />
                          <col className="c-token" />
                          <col className="c-status" />
                          <col className="c-used" />
                          <col className="c-exp" />
                          <col className="c-act" />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>Nama</th>
                            <th>Token</th>
                            <th>Status</th>
                            <th>Dipakai</th>
                            <th>Berlaku</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {activeTokens.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="blank">
                                Tidak ada token aktif.
                              </td>
                            </tr>
                          ) : (
                            activeTokens.map((t) => (
                              <TokenRow
                                key={t.id}
                                row={t}
                                confirmRevoke={confirmRevoke}
                                onAsk={setConfirmRevoke}
                                onCancel={() => setConfirmRevoke(null)}
                                onRevoke={(id) => void onRevoke(id)}
                                pending={revoke.isPending}
                              />
                            ))
                          )}
                          {retiredTokens.length > 0 && (
                            <tr className="fold">
                              <td colSpan={6}>
                                <button
                                  type="button"
                                  className="fold-btn"
                                  aria-expanded={showRetired}
                                  onClick={() => setShowRetired((open) => !open)}
                                >
                                  {showRetired ? "▾" : "▸"} {retiredTokens.length} token sudah dicabut
                                </button>
                              </td>
                            </tr>
                          )}
                          {showRetired &&
                            retiredTokens.map((t) => (
                              <TokenRow
                                key={t.id}
                                row={t}
                                confirmRevoke={confirmRevoke}
                                onAsk={setConfirmRevoke}
                                onCancel={() => setConfirmRevoke(null)}
                                onRevoke={(id) => void onRevoke(id)}
                                pending={revoke.isPending}
                              />
                            ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}
              </>
            )}
          </section>
        </div>

        <section className="agent-side panel fill">
          <div className="panel-h">
            <h2>Antrian render</h2>
            <p>Video yang selesai masuk ke content plan.</p>
          </div>
          <div className="agent-jobs">
            {jobs.isLoading ? (
              <p className="mut">Memuat…</p>
            ) : (jobs.data ?? []).length === 0 ? (
              <div className="empty">Belum ada job render.</div>
            ) : (
              sortJobs(jobs.data ?? []).map((j) => (
                <div key={j.id} className={"job " + j.status}>
                  <div className="job-top">
                    <b className="job-title">{j.title}</b>
                    <span className={"st " + j.status}>{JOB_STATUS[j.status]}</span>
                  </div>
                  <div className="job-meta">
                    {j.stage && j.status === "running" ? <span>{j.stage}</span> : null}
                    <span>{ago(j.created_at)}</span>
                    {j.attempts > 1 ? <span>percobaan {j.attempts}/{j.max_attempts}</span> : null}
                  </div>
                  {j.status === "running" ? (
                    <div className="bar" aria-label={`progres ${j.progress}%`}>
                      <i style={{ width: `${Math.max(2, j.progress)}%` }} />
                    </div>
                  ) : null}
                  {j.error && j.status !== "done" ? <p className="bad">{j.error}</p> : null}
                  {j.status === "done" && j.result ? (
                    <p className="job-meta">
                      {j.result.version_no ? <span>Versi {j.result.version_no}</span> : null}
                      {j.result.google_drive_link ? (
                        <a href={j.result.google_drive_link} target="_blank" rel="noreferrer">
                          Buka video
                        </a>
                      ) : j.result.output_file ? (
                        <code>{j.result.output_file}</code>
                      ) : null}
                    </p>
                  ) : null}
                  {j.log && (j.status === "failed" || j.status === "done" || j.status === "cancelled") ? (
                    <details className="log">
                      <summary>Log</summary>
                      <pre>{j.log.slice(-4000)}</pre>
                    </details>
                  ) : null}
                  {j.status === "queued" || j.status === "running" || j.status === "failed" || j.status === "cancelled" ? (
                    <div className="row">
                      {j.status === "queued" || j.status === "running" ? (
                        <button type="button" className="hb ghost" disabled={jobActions.cancel.isPending} onClick={() => jobActions.cancel.mutate(j.id)}>
                          Batalkan
                        </button>
                      ) : null}
                      {j.status === "failed" || j.status === "cancelled" ? (
                        <button type="button" className="hb" disabled={jobActions.retry.isPending} onClick={() => jobActions.retry.mutate(j.id)}>
                          Coba lagi
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </>
  );
}
