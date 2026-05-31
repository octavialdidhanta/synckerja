import { describe, expect, it } from "vitest";
import { calculateEmployeePayroll } from "./calculateEmployeePayroll";
import { calculateOvertimePay } from "./overtimeFromAttendance";
import { calculatePPh21 } from "./pph21Annualized";
import { calculateProrateRatio } from "./prorateWorkingDays";
import { resolveComponentsWithPercentagePass } from "./resolveComponents";

describe("calculatePPh21 golden — OCTA", () => {
  it("matches demo OCTA gross 15.8jt TK/0", () => {
    const result = calculatePPh21({ monthlyGross: 15_800_000, ptkpStatus: "TK/0" });
    expect(Math.round(result.monthlyTax)).toBe(1_070_604);
    expect(Math.round(result.monthlyBpjsKesehatan)).toBe(240_000);
    expect(Math.round(result.monthlyBpjsPensiun)).toBe(89_306);
    expect(Math.round(result.takeHomePay)).toBe(14_400_090);
  });
});

describe("calculatePPh21 golden — Aidah", () => {
  it("matches demo Aidah gross 8.4jt K/1", () => {
    const result = calculatePPh21({ monthlyGross: 8_400_000, ptkpStatus: "K/1" });
    expect(Math.round(result.monthlyTax)).toBe(123_900);
    expect(Math.round(result.takeHomePay)).toBe(8_024_100);
  });
});

describe("calculateEmployeePayroll — OCTA full demo", () => {
  it("produces THP ~14.200.090 with loan deduction", () => {
    const result = calculateEmployeePayroll({
      basicSalary: 15_000_000,
      ptkpStatus: "TK/0",
      taxMethod: "gross",
      payrollPeriodId: "period-1",
      prorateRatio: 1,
      components: [
        {
          component_name: "Tunjangan Transport",
          component_type: "allowance",
          amount: 500_000,
        },
        {
          component_name: "Tunjangan Makan",
          component_type: "allowance",
          amount: 300_000,
        },
        {
          component_name: "Potongan Pinjaman",
          component_type: "deduction",
          amount: 200_000,
          is_taxable: false,
        },
      ],
    });

    expect(result.grossPay).toBe(15_800_000);
    expect(result.takeHomePay).toBe(14_200_090);
    expect(result.lineItems.some((i) => i.item_type === "tax")).toBe(true);
    expect(result.lineItems.some((i) => i.item_category === "bpjs_kesehatan")).toBe(true);
  });
});

describe("resolveComponentsWithPercentagePass", () => {
  it("resolves 10% of basic salary", () => {
    const resolved = resolveComponentsWithPercentagePass(
      [
        {
          component_name: "Tunjangan Jabatan",
          component_type: "allowance",
          amount: 10,
          is_percentage: true,
          percentage_base: "basic_salary",
        },
      ],
      10_000_000,
    );
    expect(resolved[0].calculated_amount).toBe(1_000_000);
  });
});

describe("calculateProrateRatio", () => {
  it("returns half month for mid-month join", () => {
    const result = calculateProrateRatio({
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      workingDays: [1, 2, 3, 4, 5],
      employeeJoinDate: "2026-05-16",
    });
    expect(result.effectiveWorkingDays).toBeLessThan(result.totalWorkingDays);
    expect(result.ratio).toBeGreaterThan(0);
    expect(result.ratio).toBeLessThan(1);
  });
});

describe("calculateEmployeePayroll — penalties", () => {
  it("deducts penalty from THP", () => {
    const base = calculateEmployeePayroll({
      basicSalary: 10_000_000,
      ptkpStatus: "TK/0",
      payrollPeriodId: "p1",
      prorateRatio: 1,
    });
    const withPenalty = calculateEmployeePayroll({
      basicSalary: 10_000_000,
      ptkpStatus: "TK/0",
      payrollPeriodId: "p1",
      prorateRatio: 1,
      penalties: [{ id: "pen-1", penalty_amount: 100_000, penalty_reason: "Late" }],
    });
    expect(withPenalty.takeHomePay).toBe(base.takeHomePay - 100_000);
  });
});

describe("calculateEmployeePayroll — overtime", () => {
  it("adds overtime allowance", () => {
    const result = calculateEmployeePayroll({
      basicSalary: 17_300_000,
      ptkpStatus: "TK/0",
      payrollPeriodId: "p1",
      prorateRatio: 1,
      overtimeEligible: true,
      overtimeRecords: [
        {
          checkInAt: "2026-05-10T08:00:00",
          checkOutAt: "2026-05-10T19:00:00",
          scheduledEndTime: "17:00",
        },
      ],
    });
    expect(result.totalAllowances).toBeGreaterThan(0);
    expect(result.lineItems.some((i) => i.item_category === "overtime")).toBe(true);
  });
});

describe("calculateOvertimePay", () => {
  it("first hour 1.5x subsequent 2x", () => {
    const basic = 17_300_000;
    const result = calculateOvertimePay(basic, [
      {
        checkInAt: "2026-05-10T08:00:00",
        checkOutAt: "2026-05-10T19:00:00",
        scheduledEndTime: "17:00",
      },
    ]);
    expect(result.overtimePay).toBeGreaterThan(0);
  });
});

describe("calculateEmployeePayroll — TER mode", () => {
  it("uses TER tax for high gross", () => {
    const annualized = calculateEmployeePayroll({
      basicSalary: 15_000_000,
      ptkpStatus: "TK/0",
      payrollPeriodId: "p1",
      prorateRatio: 1,
      calculationMode: "annualized",
      components: [{ component_name: "Transport", component_type: "allowance", amount: 800_000 }],
    });
    const ter = calculateEmployeePayroll({
      basicSalary: 15_000_000,
      ptkpStatus: "TK/0",
      payrollPeriodId: "p1",
      prorateRatio: 1,
      calculationMode: "ter",
      employeeTaxStatus: "pegawai_tetap",
      components: [{ component_name: "Transport", component_type: "allowance", amount: 800_000 }],
    });
    expect(ter.calculationDetails.calculationMode).toBe("ter");
    expect(ter.monthlyTax).not.toBe(annualized.monthlyTax);
  });
});
