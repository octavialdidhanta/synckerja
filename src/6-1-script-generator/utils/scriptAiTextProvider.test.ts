import { describe, expect, it } from "vitest";
import {
  defaultModelForTextAIProvider,
  isTextAIConfigured,
  resolveTextAIProvider,
  TEXT_AI_PROVIDERS,
  textAIProviderLabel,
} from "@/6-1-script-generator/utils/scriptAiTextProvider";

describe("text AI provider", () => {
  it("recognizes OpenAI only after this organization has saved its own key", () => {
    expect(TEXT_AI_PROVIDERS).toContain("openai");
    expect(resolveTextAIProvider({ text_ai_provider: "openai", is_active: true })).toBe("openai");
    expect(defaultModelForTextAIProvider("openai")).toBe("gpt-4o-mini");
    expect(textAIProviderLabel("openai")).toBe("OpenAI");
    expect(
      isTextAIConfigured({
        text_ai_provider: "openai",
        is_active: true,
        api_key_configured: false,
        openai_api_key_configured: false,
      }),
    ).toBe(false);
    expect(
      isTextAIConfigured({
        text_ai_provider: "openai",
        is_active: true,
        api_key_configured: false,
        openai_api_key_configured: true,
      }),
    ).toBe(true);
  });
});
