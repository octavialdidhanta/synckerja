import type { StatutoryEscrowAmounts } from "./payrollEscrowTypes.ts";

export function parseStatutoryEscrowAmounts(raw: unknown): StatutoryEscrowAmounts {
  const row = (raw ?? {}) as Record<string, unknown>;
  if (row.success === false) {
    return {
      success: false,
      message: String(row.message ?? "Failed to compute escrow amounts"),
      amount_pph21: 0,
      amount_bpjs_kesehatan: 0,
      amount_bpjs_pensiun: 0,
      amount_total: 0,
    };
  }
  return {
    success: true,
    payroll_run_id: row.payroll_run_id != null ? String(row.payroll_run_id) : undefined,
    organization_id: row.organization_id != null ? String(row.organization_id) : undefined,
    run_status: row.run_status != null ? String(row.run_status) : undefined,
    amount_pph21: Number(row.amount_pph21) || 0,
    amount_bpjs_kesehatan: Number(row.amount_bpjs_kesehatan) || 0,
    amount_bpjs_pensiun: Number(row.amount_bpjs_pensiun) || 0,
    amount_total: Number(row.amount_total) || 0,
  };
}

export function buildEscrowTransferReference(organizationId: string, runId: string): string {
  return `synckerja:${organizationId}:payroll_escrow:${runId}`;
}
