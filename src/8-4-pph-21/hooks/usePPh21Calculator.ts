import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  BPJS_KESEHATAN_MAX_SALARY,
  BPJS_PENSIUN_MAX_SALARY,
  PTKP_RATES,
  calculatePPh21,
  formatCurrency,
  parseCurrency,
  type CalculatePPh21Result,
} from "../lib/pph21Calculator";
import { exportPPh21ToExcel, exportPPh21ToPdf, type PPh21ExportPayload } from "../lib/pph21Export";

export type PPh21Mode = "gross-to-net" | "net-to-gross";

export function usePPh21Calculator() {
  const [mode, setMode] = useState<PPh21Mode>("gross-to-net");
  const [salary, setSalary] = useState<string>("12500000");
  const [ptkpStatus, setPtkpStatus] = useState<string>("TK/0");
  const [customPtkp, setCustomPtkp] = useState<string>("");
  const [bpjsKesehatan, setBpjsKesehatan] = useState(true);
  const [bpjsPensiun, setBpjsPensiun] = useState(true);
  const [nonTaxableAllowance, setNonTaxableAllowance] = useState<string>("0");
  const [salaryIncrease, setSalaryIncrease] = useState<string>("10");
  const [result, setResult] = useState<CalculatePPh21Result | null>(null);
  const [increaseResult, setIncreaseResult] = useState<CalculatePPh21Result | null>(null);

  const calculateTax = useCallback(
    (grossSalary: number): CalculatePPh21Result =>
      calculatePPh21({
        monthlyGross: grossSalary,
        ptkpStatus: ptkpStatus === "custom" ? undefined : ptkpStatus,
        customPtkpAmount: ptkpStatus === "custom" ? parseCurrency(customPtkp) : undefined,
        includeBpjsKesehatan: bpjsKesehatan,
        includeBpjsPensiun: bpjsPensiun,
        nonTaxableAllowance: parseCurrency(nonTaxableAllowance),
      }),
    [ptkpStatus, customPtkp, bpjsKesehatan, bpjsPensiun, nonTaxableAllowance],
  );

  const calculateGrossFromTakeHome = useCallback(
    (targetTakeHome: number): number => {
      let grossEstimate = targetTakeHome * 1.2;
      const tolerance = 10;
      const maxIterations = 50;

      for (let i = 0; i < maxIterations; i++) {
        const res = calculateTax(grossEstimate);
        const currentTakeHome = res.takeHomePay;
        const error = currentTakeHome - targetTakeHome;

        if (Math.abs(error) < tolerance) {
          return grossEstimate;
        }

        const delta = grossEstimate * 0.001;
        const resultDelta = calculateTax(grossEstimate + delta);
        const takeHomeDelta = resultDelta.takeHomePay;
        const derivative = (takeHomeDelta - currentTakeHome) / delta;

        if (Math.abs(derivative) > 0.001) {
          grossEstimate = grossEstimate - error / derivative;
        } else if (error > 0) {
          grossEstimate *= 0.95;
        } else {
          grossEstimate *= 1.05;
        }

        grossEstimate = Math.max(grossEstimate, targetTakeHome * 0.5);
      }

      return grossEstimate;
    },
    [calculateTax],
  );

  const buildExportPayload = useCallback((): PPh21ExportPayload | null => {
    if (!result) return null;
    return {
      mode,
      salaryInput: salary,
      ptkpStatus,
      customPtkp,
      bpjsKesehatan,
      bpjsPensiun,
      nonTaxableAllowance,
      salaryIncrease,
      result,
      increaseResult,
      generatedAt: new Date(),
    };
  }, [
    result,
    mode,
    salary,
    ptkpStatus,
    customPtkp,
    bpjsKesehatan,
    bpjsPensiun,
    nonTaxableAllowance,
    salaryIncrease,
    increaseResult,
  ]);

  const handleCalculate = useCallback(() => {
    const inputAmount = parseCurrency(salary);
    if (inputAmount <= 0) {
      toast.error("Mohon masukkan nilai yang valid");
      return;
    }

    if (ptkpStatus === "custom" && parseCurrency(customPtkp) <= 0) {
      toast.error("Mohon masukkan PTKP custom yang valid");
      return;
    }

    let grossSalary: number;

    if (mode === "net-to-gross") {
      grossSalary = calculateGrossFromTakeHome(inputAmount);
    } else {
      grossSalary = inputAmount;
    }

    const calculation = calculateTax(grossSalary);
    setResult(calculation);

    const increaseAmount = parseFloat(salaryIncrease) || 0;
    if (increaseAmount > 0) {
      const increasedSalary = grossSalary * (1 + increaseAmount / 100);
      setIncreaseResult(calculateTax(increasedSalary));
    } else {
      setIncreaseResult(null);
    }

    toast.success("Perhitungan berhasil!");
  }, [
    salary,
    ptkpStatus,
    customPtkp,
    mode,
    calculateGrossFromTakeHome,
    calculateTax,
    salaryIncrease,
  ]);

  const handleExportPdf = useCallback(() => {
    const payload = buildExportPayload();
    if (!payload) {
      toast.error("Hitung terlebih dahulu sebelum mengekspor.");
      return;
    }
    try {
      exportPPh21ToPdf(payload);
      toast.success("PDF berhasil diunduh");
    } catch {
      toast.error("Gagal membuat PDF");
    }
  }, [buildExportPayload]);

  const handleExportExcel = useCallback(() => {
    const payload = buildExportPayload();
    if (!payload) {
      toast.error("Hitung terlebih dahulu sebelum mengekspor.");
      return;
    }
    try {
      exportPPh21ToExcel(payload);
      toast.success("Excel berhasil diunduh");
    } catch {
      toast.error("Gagal membuat Excel");
    }
  }, [buildExportPayload]);

  return {
    mode,
    setMode,
    salary,
    setSalary,
    ptkpStatus,
    setPtkpStatus,
    customPtkp,
    setCustomPtkp,
    bpjsKesehatan,
    setBpjsKesehatan,
    bpjsPensiun,
    setBpjsPensiun,
    nonTaxableAllowance,
    setNonTaxableAllowance,
    salaryIncrease,
    setSalaryIncrease,
    result,
    increaseResult,
    handleCalculate,
    handleExportPdf,
    handleExportExcel,
    formatCurrency,
    PTKP_RATES,
    BPJS_KESEHATAN_MAX_SALARY,
    BPJS_PENSIUN_MAX_SALARY,
  };
}
