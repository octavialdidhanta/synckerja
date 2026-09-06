import { describe, expect, it, vi, beforeEach } from "vitest";

const rematchEmail = vi.fn();
const rematchSms = vi.fn();

vi.mock("@/5-2-customer-visits/checkout/pos-bind", () => ({
  rematchPosReceiptLeadByEmail: (...args: unknown[]) => rematchEmail(...args),
  rematchPosReceiptLead: (...args: unknown[]) => rematchSms(...args),
}));

const fromMock = vi.fn();
const rpcMock = vi.fn();
const invokeMock = vi.fn();
const getUserMock = vi.fn();

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    rpc: (...args: unknown[]) => rpcMock(...args),
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
    auth: { getUser: (...args: unknown[]) => getUserMock(...args) },
  },
}));

import { sendPosDigitalReceipt } from "./sendPosDigitalReceipt";

function chainUpdate(error: unknown = null) {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error }),
    }),
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  };
}

describe("sendPosDigitalReceipt email rematch wiring", () => {
  beforeEach(() => {
    rematchEmail.mockReset();
    rematchSms.mockReset();
    fromMock.mockReset();
    rpcMock.mockReset();
    invokeMock.mockReset();
    getUserMock.mockReset();

    fromMock.mockImplementation((table: string) => {
      if (table === "pos_outlet_receipt_settings") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { share_via_email: true, share_via_sms: true },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "employees") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      return chainUpdate();
    });

    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpcMock.mockResolvedValue({ data: "inv-1", error: null });
    invokeMock.mockResolvedValue({ data: { success: true }, error: null });
  });

  it("calls rematchPosReceiptLeadByEmail and uses rebound leadId for name patch", async () => {
    rematchEmail.mockResolvedValue({
      leadId: "winner-lead",
      rebound: true,
      visitId: null,
    });

    const leadUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const saUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    fromMock.mockImplementation((table: string) => {
      if (table === "pos_outlet_receipt_settings") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { share_via_email: true, share_via_sms: true },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "leads") {
        return { update: leadUpdate };
      }
      if (table === "sales_activities") {
        return { update: saUpdate };
      }
      return chainUpdate();
    });

    const result = await sendPosDigitalReceipt({
      organizationId: "org-1",
      outletId: "outlet-1",
      salesActivityId: "sa-1",
      leadId: "walk-in-lead",
      clientName: "Octa",
      channel: "email",
      email: "octa@mail.com",
      createdByUserId: "user-1",
    });

    expect(result).toEqual({ ok: true });
    expect(rematchEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        currentLeadId: "walk-in-lead",
        email: "octa@mail.com",
        salesActivityId: "sa-1",
      }),
    );
    expect(leadUpdate).toHaveBeenCalledWith({ client: "Octa" });
    const leadEq = leadUpdate.mock.results[0]?.value.eq as ReturnType<typeof vi.fn>;
    expect(leadEq).toHaveBeenCalledWith("id", "winner-lead");
  });

  it("rejects invalid email before rematch", async () => {
    const result = await sendPosDigitalReceipt({
      organizationId: "org-1",
      outletId: "outlet-1",
      salesActivityId: "sa-1",
      leadId: "walk-in-lead",
      channel: "email",
      email: "not-an-email",
    });
    expect(result).toEqual({ ok: false, code: "invalid_email", message: "invalid_email" });
    expect(rematchEmail).not.toHaveBeenCalled();
  });
});
