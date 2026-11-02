import { describe, expect, it } from "vitest";
// The builder is plain JavaScript so the edge function can import it.
// @ts-expect-error no declaration file for the shared mjs module
import { buildWorkReportEmail, reportFromHeader } from "../../../supabase/functions/_shared/aiEmployee/workReportEmail.mjs";

describe("work report email", () => {
  it("summarizes only the content planner counts and escapes the KR title", () => {
    const message = buildWorkReportEmail({
      employeeName: "Naya",
      periodStart: "2026-11-02T02:00:00.000Z",
      periodEnd: "2026-11-03T02:00:00.000Z",
      summary: {
        runs_succeeded: 2,
        runs_failed: 1,
        runs_other: 0,
        plans_created: 3,
        jobs_done: 1,
        jobs_rejected: 0,
        jobs_failed: 0,
        key_results: [{ code: "KR1", title: "<script>", current_value: 0, target_value: 90, unit: "%" }],
        payroll_total: 5000000,
      },
    });
    expect(message.subject).toBe("Laporan kerja Naya");
    expect(message.html).toContain("2");
    expect(message.html).toContain("Plan dibuat");
    expect(message.html).toContain("&lt;script&gt;");
    expect(message.html).not.toContain("<script>");
    expect(message.html).not.toContain("payroll_total");
    expect(message.html).not.toContain("5000000");
    expect(message.text).toContain("Run berhasil: 2");
    expect(message.text).toContain("hanya pekerjaan content planner");
  });

  it("names the daily, weekly, and monthly subjects", () => {
    const daily = buildWorkReportEmail({ employeeName: "Naya", senderName: "Octa Vialdi", actionCode: "work_report.daily", periodStart: "2026-11-02T17:00:00.000Z", periodEnd: "2026-11-03T02:00:00.000Z", summary: {} });
    const weekly = buildWorkReportEmail({ employeeName: "Naya", senderName: "Octa Vialdi", actionCode: "work_report.weekly", periodStart: "2026-11-02T02:00:00.000Z", periodEnd: "2026-11-09T02:00:00.000Z", summary: {} });
    const monthly = buildWorkReportEmail({ employeeName: "Naya", senderName: "Octa Vialdi", actionCode: "work_report.monthly", periodStart: "2026-10-31T17:00:00.000Z", periodEnd: "2026-11-30T02:00:00.000Z", summary: {} });
    expect(daily.subject).toBe("Laporan harian Octa Vialdi");
    expect(weekly.subject).toBe("Laporan mingguan Octa Vialdi");
    expect(monthly.subject).toBe("Laporan bulanan Octa Vialdi");
    expect(daily.html.match(/Naya/g)).toEqual(["Naya"]);
    expect(daily.text.match(/Naya/g)).toEqual(["Naya"]);
    expect(daily.text).toContain("dari tengah malam sampai saat kirim");
    expect(weekly.text).toContain("7 hari terakhir");
    expect(weekly.text).toContain("Tanggal terakhir tidak masuk");
    expect(monthly.text).toContain("termasuk tanggal terakhir");
    expect(daily.text).toContain("Di luar cakupan");
  });

  it("uses the profile name as the visible sender and keeps the system address", () => {
    expect(reportFromHeader("reports@synckerja.test", "Octa Vialdi")).toBe("Octa Vialdi <reports@synckerja.test>");
    expect(reportFromHeader("Lama <reports@synckerja.test>", "Octa Vialdi")).toBe("Octa Vialdi <reports@synckerja.test>");
  });
});