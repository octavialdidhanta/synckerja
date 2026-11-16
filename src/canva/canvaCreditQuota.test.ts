import { describe, expect, it } from "vitest";
import { isCanvaCreditQuotaMessage, presentCanvaCreditQuota, closeCanvaCreditQuotaDialog, canvaCreditQuotaDialogOpen } from "./canvaCreditQuota";

describe("canvaCreditQuota", () => {
  it("detects cooldown and exceeded messages", () => {
    expect(isCanvaCreditQuotaMessage("Credit quota cooldown is active")).toBe(true);
    expect(isCanvaCreditQuotaMessage("credit_quota_exceeded")).toBe(true);
    expect(isCanvaCreditQuotaMessage("app_credit_quota_exceeded")).toBe(true);
    expect(isCanvaCreditQuotaMessage("canva_failed")).toBe(false);
  });

  it("opens the shared dialog once for a matching error", () => {
    closeCanvaCreditQuotaDialog();
    expect(presentCanvaCreditQuota("Credit quota cooldown is active")).toBe(true);
    expect(canvaCreditQuotaDialogOpen()).toBe(true);
    expect(presentCanvaCreditQuota("Credit quota cooldown is active")).toBe(true);
    expect(canvaCreditQuotaDialogOpen()).toBe(true);
    closeCanvaCreditQuotaDialog();
    expect(canvaCreditQuotaDialogOpen()).toBe(false);
  });
});
