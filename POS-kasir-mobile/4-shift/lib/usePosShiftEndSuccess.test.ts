import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePosShiftEndSuccess } from "./usePosShiftEndSuccess";
import type { PosShiftTotals } from "@/shared/pos-shift";

const endMock = vi.fn();
const sendSilentMock = vi.fn();

vi.mock("@/shared/i18n/useAppTranslation", () => ({
  useAppTranslation: () => ({ language: "en" }),
}));

vi.mock("./usePosCashierShift", () => ({
  usePosCashierShiftActions: () => ({
    end: endMock,
    isEnding: false,
  }),
  buildLiveShiftTotals: vi.fn(),
}));

vi.mock("./sendPosShiftRecapEmail", () => ({
  sendPosShiftRecapEmailSilent: (...args: unknown[]) => sendSilentMock(...args),
}));

describe("usePosShiftEndSuccess", () => {
  const totals: PosShiftTotals = {
    openingCash: 100_000,
    cashSales: 50_000,
    cashRefunds: 0,
    cashIn: 0,
    cashOut: 0,
    cashInOutNet: 0,
    expectedCash: 150_000,
    productsSoldQty: 5,
  };

  beforeEach(() => {
    endMock.mockReset();
    sendSilentMock.mockReset();
    endMock.mockResolvedValue({
      id: "shift-closed-1",
      expected_cash: 155_000,
    });
  });

  it("ends shift and triggers recap email once", async () => {
    const { result } = renderHook(() => usePosShiftEndSuccess("outlet-1"));

    const snapshot = await result.current.endAndNotify({
      shiftId: "shift-open-1",
      countedCash: 151_000,
      totals,
    });

    expect(endMock).toHaveBeenCalledWith("shift-open-1", 151_000);
    expect(sendSilentMock).toHaveBeenCalledTimes(1);
    expect(sendSilentMock).toHaveBeenCalledWith({
      shiftId: "shift-closed-1",
      language: "en",
    });
    expect(snapshot.shift.id).toBe("shift-closed-1");
    expect(snapshot.totals.expectedCash).toBe(155_000);
  });
});
