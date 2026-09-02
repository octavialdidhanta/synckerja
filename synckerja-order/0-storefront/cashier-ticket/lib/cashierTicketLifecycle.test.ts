import { describe, expect, it } from "vitest";
import {
  isCashierTicketReadOnly,
  resolveCashierTicketUiPhase,
  shouldOpenCashierTicketAsQr,
  shouldShowCashierQrButton,
} from "./cashierTicketLifecycle";

describe("resolveCashierTicketUiPhase", () => {
  it("maps paid from remote flags", () => {
    expect(resolveCashierTicketUiPhase({ ok: true, paid: true, status: "pending" })).toBe("paid");
    expect(resolveCashierTicketUiPhase({ ok: true, status: "paid" })).toBe("paid");
  });

  it("maps expired and claimed", () => {
    expect(resolveCashierTicketUiPhase({ ok: true, status: "expired" })).toBe("expired");
    expect(resolveCashierTicketUiPhase({ ok: true, claimed: true, status: "pending" })).toBe(
      "claimed",
    );
  });

  it("defaults to waiting", () => {
    expect(resolveCashierTicketUiPhase({ ok: true, status: "pending" })).toBe("waiting");
    expect(resolveCashierTicketUiPhase(null)).toBe("waiting");
  });

  it("prefers local paid status when remote lags", () => {
    expect(resolveCashierTicketUiPhase({ ok: true, status: "pending" }, "paid")).toBe("paid");
  });
});

describe("history routing helpers", () => {
  it("read-only for paid and expired", () => {
    expect(isCashierTicketReadOnly("paid")).toBe(true);
    expect(isCashierTicketReadOnly("expired")).toBe(true);
    expect(isCashierTicketReadOnly("cancelled")).toBe(true);
    expect(isCashierTicketReadOnly("pending")).toBe(false);
  });

  it("active QR for pending and claimed", () => {
    expect(shouldOpenCashierTicketAsQr("pending")).toBe(true);
    expect(shouldOpenCashierTicketAsQr("claimed")).toBe(true);
    expect(shouldOpenCashierTicketAsQr("paid")).toBe(false);
  });

  it("show QR button only for waiting and claimed phases", () => {
    expect(shouldShowCashierQrButton("waiting")).toBe(true);
    expect(shouldShowCashierQrButton("claimed")).toBe(true);
    expect(shouldShowCashierQrButton("paid")).toBe(false);
    expect(shouldShowCashierQrButton("expired")).toBe(false);
  });
});
