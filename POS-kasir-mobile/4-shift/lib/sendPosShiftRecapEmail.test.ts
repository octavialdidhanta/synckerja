import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendPosShiftRecapEmail } from "./sendPosShiftRecapEmail";

const rpcMock = vi.fn();
const invokeMock = vi.fn();

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

describe("sendPosShiftRecapEmail", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    invokeMock.mockReset();
    rpcMock.mockResolvedValue({ error: null });
    invokeMock.mockResolvedValue({ error: null });
  });

  it("updates language and invokes dispatch edge function", async () => {
    const result = await sendPosShiftRecapEmail({
      shiftId: "shift-1",
      language: "en",
    });

    expect(result).toEqual({ ok: true });
    expect(rpcMock).toHaveBeenCalledWith("update_pos_shift_email_dispatch_language", {
      p_shift_id: "shift-1",
      p_language: "en",
    });
    expect(invokeMock).toHaveBeenCalledWith("dispatch-pos-shift-recap", {
      body: { shiftId: "shift-1" },
    });
  });

  it("defaults non-en language to id", async () => {
    await sendPosShiftRecapEmail({ shiftId: "shift-2", language: "fr" });

    expect(rpcMock).toHaveBeenCalledWith("update_pos_shift_email_dispatch_language", {
      p_shift_id: "shift-2",
      p_language: "id",
    });
  });
});
