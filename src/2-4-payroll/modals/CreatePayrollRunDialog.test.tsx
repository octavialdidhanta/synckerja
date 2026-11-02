import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CreatePayrollRunDialog } from "./CreatePayrollRunDialog";
import { PayrollRunsOverview } from "../components/overview/PayrollRunsOverview";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  insert: vi.fn(),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    rpc: mocks.rpc,
    from: (table: string) => {
      const result =
        table === "payroll_periods"
          ? {
              data: [
                {
                  id: "period-1",
                  period_name: "November 2026",
                  start_date: "2026-11-01",
                  end_date: "2026-11-30",
                  status: "draft",
                },
              ],
              error: null,
            }
          : table === "payroll_runs"
            ? {
                data: [
                  {
                    id: "run-null",
                    run_name: "Draft kosong",
                    status: "draft",
                    created_at: "2026-11-02T00:00:00.000Z",
                    total_employees: null,
                    total_gross_pay: null,
                    total_net_pay: null,
                    total_deductions: null,
                    payroll_periods: { period_name: "November 2026" },
                  },
                  {
                    id: "run-zero",
                    run_name: "Draft nol",
                    status: "draft",
                    created_at: "2026-11-01T00:00:00.000Z",
                    total_employees: 0,
                    total_gross_pay: 0,
                    total_net_pay: 0,
                    total_deductions: 0,
                    payroll_periods: { period_name: "November 2026" },
                  },
                ],
                error: null,
              }
            : { data: [], error: null };

      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      for (const method of ["select", "eq", "in", "order", "limit", "not"]) {
        builder[method] = chain;
      }
      builder.insert = (rows: unknown) => {
        mocks.insert(rows);
        return builder;
      };
      builder.single = async () => ({ data: { id: "run-new" }, error: null });
      builder.maybeSingle = async () => ({ data: null, error: null });
      builder.then = (
        onFulfilled: (value: { data: unknown; error: null }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(result).then(onFulfilled, onRejected);
      return builder;
    },
  },
}));

vi.mock("@/shared/auth/contexts/CentralizedUserDataContext", () => ({
  useCentralizedUserData: () => ({ organization: { id: "org-1" } }),
}));

vi.mock("../lib/ensureTaxConfiguration", () => ({
  ensureTaxConfigurationId: vi.fn(async () => "tax-1"),
}));

vi.mock("sonner", () => ({
  toast: mocks.toast,
}));

function renderWithQuery(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.insert.mockReset();
  mocks.toast.success.mockReset();
  mocks.toast.error.mockReset();
  mocks.toast.warning.mockReset();
});

describe("CreatePayrollRunDialog", () => {
  it("creates a draft run without calling calculate_payroll_run_totals", async () => {
    renderWithQuery(<CreatePayrollRunDialog />);

    fireEvent.click(screen.getByRole("button", { name: /new payroll run/i }));

    fireEvent.change(screen.getByLabelText(/run name/i), {
      target: { value: "Payroll November" },
    });

    const periodTrigger = screen.getAllByRole("combobox")[0];
    fireEvent.pointerDown(periodTrigger, { button: 0, pointerType: "mouse" });
    fireEvent.click(periodTrigger);

    const periodOption = await screen.findByRole("option", { name: /november 2026/i });
    fireEvent.click(periodOption);

    fireEvent.click(screen.getByRole("button", { name: /create payroll run/i }));

    await waitFor(() => {
      expect(mocks.toast.success).toHaveBeenCalledWith("Payroll run created successfully");
    });

    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.toast.warning).not.toHaveBeenCalled();
    expect(mocks.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        run_name: "Payroll November",
        payroll_period_id: "period-1",
        organization_id: "org-1",
        status: "draft",
        tax_configuration_id: "tax-1",
      }),
    ]);
    expect(screen.queryByText(/totals belum dihitung/i)).toBeNull();
  });
});

describe("PayrollRunsOverview empty totals", () => {
  it("shows Rp 0 for null and zero payroll totals", async () => {
    renderWithQuery(<PayrollRunsOverview />);

    expect(await screen.findByText("Draft kosong")).toBeTruthy();
    expect(screen.getByText("Draft nol")).toBeTruthy();
    expect(
      screen.getAllByText((_, element) => element?.textContent?.replace(/[\s\u00a0\u202f]/g, "") === "Rp0"),
    ).toHaveLength(6);
    expect(document.body.textContent).not.toMatch(/null|NaN/);
  });
});
