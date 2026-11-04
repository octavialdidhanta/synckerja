
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function countOf(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function formatWhen(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)} WIB`;
}

function line(label, value) {
  return `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${escapeHtml(label)}</td><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`;
}

function reportKind(actionCode) {
  if (actionCode === "work_report.daily") return "harian";
  if (actionCode === "work_report.weekly") return "mingguan";
  if (actionCode === "work_report.monthly") return "bulanan";
  return "kerja";
}

function periodDefinition(kind) {
  if (kind === "harian") {
    return "Laporan harian menghitung satu hari kerja yang sudah selesai: dari tengah malam sampai tengah malam, dan dikirim besoknya pada jam yang dipilih. Hari yang dipakai laporan mingguan atau tanggal terakhir tidak masuk.";
  }
  if (kind === "mingguan") {
    return "Laporan mingguan menghitung pekerjaan sejak kiriman mingguan sebelumnya. Kiriman pertama memakai 7 hari terakhir. Tanggal terakhir tidak masuk bila laporan bulanan aktif.";
  }
  if (kind === "bulanan") {
    return "Laporan bulanan menghitung pekerjaan sejak kiriman bulanan sebelumnya. Kiriman pertama mulai dari awal bulan berjalan, termasuk tanggal terakhir.";
  }
  return "";
}

const SCOPE = "Yang dihitung hanya pekerjaan content planner ini: run berhasil, gagal, dan lain; plan yang dibuat; tugas selesai, ditolak, dan gagal; serta KR1 sampai KR5. Di luar cakupan: absensi, cuti, payroll, rekrutmen, iklan, keuangan, CRM, dan karyawan lain.";

export function reportFromHeader(fromEmail, senderName) {
  const raw = String(fromEmail ?? "").trim();
  const match = raw.match(/<([^>]+)>/);
  const address = (match ? match[1] : raw).trim();
  const name = String(senderName ?? "").replace(/["<>]/g, "").trim().slice(0, 80) || "Synckerja";
  const shown = /[",;]/.test(name) ? `"${name.replace(/["\\]/g, "")}"` : name;
  return `${shown} <${address}>`;
}

export function buildWorkReportEmail(input) {
  const employee = String(input?.employeeName || "Karyawan AI").trim().slice(0, 80) || "Karyawan AI";
  const sender = String(input?.senderName || employee).trim().slice(0, 80) || employee;
  const kind = reportKind(input?.actionCode);
  const definition = periodDefinition(kind);
  const summary = input?.summary && typeof input.summary === "object" ? input.summary : {};
  const results = Array.isArray(summary.key_results) ? summary.key_results : [];
  const krRows = results
    .filter((row) => row && typeof row === "object" && ["KR1", "KR2", "KR3", "KR4", "KR5"].includes(String(row.code)))
    .map((row) => {
      const current = row.current_value ?? "—";
      const target = row.target_value ?? "—";
      const unit = row.unit ? ` ${row.unit}` : "";
      return `<li>${escapeHtml(row.code)} ${escapeHtml(row.title || "")}: ${escapeHtml(current)} / ${escapeHtml(target)}${escapeHtml(unit)}</li>`;
    })
    .join("");
  const subject = `Laporan ${kind} ${sender}`;
  const period = `${formatWhen(input?.periodStart)} – ${formatWhen(input?.periodEnd)}`;
  const intro = `Pekerjaan yang dihitung adalah pekerjaan ${employee} sebagai content planner.`;
  const html = `<div style="font-family:sans-serif;color:#0f172a">
<p>Halo,</p>
<p>${escapeHtml(intro)}</p>
${definition ? `<p>${escapeHtml(definition)}</p>` : ""}
<p>Periode: ${escapeHtml(period)}</p>
<table>${line("Run berhasil", countOf(summary.runs_succeeded))}${line("Run gagal", countOf(summary.runs_failed))}${line("Run lain", countOf(summary.runs_other))}${line("Plan dibuat", countOf(summary.plans_created))}${line("Tugas selesai", countOf(summary.jobs_done))}${line("Tugas ditolak", countOf(summary.jobs_rejected))}${line("Tugas gagal", countOf(summary.jobs_failed))}</table>
${krRows ? `<p>KPI</p><ul>${krRows}</ul>` : ""}
<p style="color:#64748b">${escapeHtml(SCOPE)}</p>
</div>`;
  const text = [
    `Laporan ${kind} ${sender}`,
    intro,
    definition,
    `Periode: ${period}`,
    `Run berhasil: ${countOf(summary.runs_succeeded)}`,
    `Run gagal: ${countOf(summary.runs_failed)}`,
    `Run lain: ${countOf(summary.runs_other)}`,
    `Plan dibuat: ${countOf(summary.plans_created)}`,
    `Tugas selesai: ${countOf(summary.jobs_done)}`,
    `Tugas ditolak: ${countOf(summary.jobs_rejected)}`,
    `Tugas gagal: ${countOf(summary.jobs_failed)}`,
    SCOPE,
  ].filter(Boolean).join("\n");
  return { subject, html, text };
}
