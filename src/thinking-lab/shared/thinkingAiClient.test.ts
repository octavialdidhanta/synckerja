import { describe, expect, it } from "vitest";
import { isThinkingIdleTimeout } from "@/thinking-lab/shared/thinkingAiClient";

describe("thinking idle timeout", () => {
  it("recognizes the gateway timeout and ignores other failures", () => {
    expect(isThinkingIdleTimeout({ code: "IDLE_TIMEOUT", message: "Request idle timeout limit (150s) reached" })).toBe(true);
    expect(isThinkingIdleTimeout("Request idle timeout limit (150s) reached")).toBe(true);
    expect(isThinkingIdleTimeout({ error: "Request gagal (500)" })).toBe(false);
    expect(isThinkingIdleTimeout(null)).toBe(false);
  });
});
