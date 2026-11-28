import { describe, expect, it } from "vitest";
import {
  AnthropicCreditError,
  anthropicErrorMessage,
  classifyAnthropicError,
} from "../../../supabase/functions/_shared/anthropicCredit.ts";
import {
  anthropicCreditKindFromCode,
  anthropicCreditSource,
  closeGeminiSpendCapDialog,
  geminiBillingNotice,
  presentAnthropicCredit,
} from "@/shared/ai/geminiSpendCap";

const body = (type: string, message: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ type: "error", error: { type, message, ...extra } });

describe("Anthropic credit refusals for the Lead Magnet PDF", () => {
  it("tells credit, spend limit and billing apart from ordinary errors", () => {
    expect(
      classifyAnthropicError(
        400,
        body("invalid_request_error", "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."),
      ),
    ).toBe("credit");
    expect(
      classifyAnthropicError(
        429,
        body("rate_limit_error", "You have reached your specified workspace API usage limits. You will regain access on 2026-12-01 at 00:00 UTC.", {
          details: { error_code: "enforced_spend_limit_reached" },
        }),
      ),
    ).toBe("spend_limit");
    expect(classifyAnthropicError(402, body("billing_error", "Payment method declined"))).toBe("billing");
    expect(classifyAnthropicError(429, body("rate_limit_error", "Number of request tokens has exceeded your per-minute rate limit"))).toBeNull();
    expect(classifyAnthropicError(529, body("overloaded_error", "Overloaded"))).toBeNull();
    expect(classifyAnthropicError(500, "not json")).toBeNull();
  });

  it("error carries the Office code and an Indonesian message", () => {
    const err = new AnthropicCreditError("spend_limit", "raw");
    expect(err.code).toBe("anthropic_limit");
    expect(err.message).toMatch(/Batas belanja Anthropic/);
    expect(new AnthropicCreditError("credit", "").code).toBe("anthropic_credit");
    expect(new AnthropicCreditError("billing", "").code).toBe("anthropic_billing");
    expect(anthropicErrorMessage(body("api_error", " boom "))).toBe("boom");
  });

  it("Office maps the codes back and opens the dialog for the Lead Magnet", () => {
    expect(anthropicCreditKindFromCode("anthropic_credit")).toBe("credit");
    expect(anthropicCreditKindFromCode("anthropic_limit")).toBe("spend_limit");
    expect(anthropicCreditKindFromCode("anthropic_billing")).toBe("billing");
    expect(anthropicCreditKindFromCode("pdf_failed")).toBeNull();
    expect(anthropicCreditKindFromCode(null)).toBeNull();

    presentAnthropicCredit("spend_limit", "lead_magnet");
    expect(geminiBillingNotice()).toBe("anthropic_limit");
    expect(anthropicCreditSource()).toBe("lead_magnet");
    closeGeminiSpendCapDialog();
    presentAnthropicCredit("credit");
    expect(anthropicCreditSource()).toBe("agent");
    closeGeminiSpendCapDialog();
  });
});
