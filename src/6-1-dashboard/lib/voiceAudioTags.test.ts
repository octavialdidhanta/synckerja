import { describe, expect, it } from "vitest";
import { acceptTaggedNarration, hasVoiceExpression, narrationWithoutTags, resolveTaggedNarration, spokenKey, voiceModelSupportsAudioTags, withLanguageAccent } from "../../../supabase/functions/_shared/voiceAudioTags.ts";

const narration = "Tahukah Anda, banyak yang berpikir makan enak di PIK itu harus keluar komplek?";

describe("voice audio tags", () => {
  it("tells Eleven v4 to use an Indonesian accent instead of the voice's Malay accent", () => {
    const line = "[confident] Untuk membuktikan sebaliknya, sebuah sesi pencicipan buta sate kambing pun saya selenggarakan.";
    expect(withLanguageAccent("eleven_v4", "id", line)).toBe(`[strong Indonesian accent] ${line}`);
    expect(withLanguageAccent("eleven_v3", "ms", line)).toBe(`[strong Malay accent] ${line}`);
    expect(withLanguageAccent("eleven_multilingual_v2", "id", line)).toBe(line);
    expect(withLanguageAccent("eleven_v4", "en", line)).toBe(line);
    expect(withLanguageAccent("eleven_v4", "id", `[strong Indonesian accent] ${line}`)).toBe(`[strong Indonesian accent] ${line}`);
  });

  it("accepts an emotion tag without changing the spoken words", () => {
    const accepted = acceptTaggedNarration(narration, `[playful] ${narration}`);
    expect(accepted.ok).toBe(true);
    if (accepted.ok) expect(spokenKey(accepted.text)).toBe(spokenKey(narration));
  });

  it("rejects a rewrite, a sound effect, and an untagged line", () => {
    expect(acceptTaggedNarration(narration, `[playful] ${narration} ya kan`).ok).toBe(false);
    expect(acceptTaggedNarration(narration, `[coughing] ${narration}`).ok).toBe(false);
    expect(acceptTaggedNarration(narration, narration).ok).toBe(false);
  });

  it("strips a code fence and keeps the original words", () => {
    const accepted = acceptTaggedNarration(narration, "```text\n[curious] " + narration + "\n```");
    expect(accepted).toEqual({ ok: true, text: `[curious] ${narration}` });
  });

  it("retries once and refuses to speak a rewritten line", async () => {
    let calls = 0;
    const retried = await resolveTaggedNarration(narration, async () => {
      calls += 1;
      return calls === 1 ? { text: `[playful] ${narration} ya` } : { text: `[warm] ${narration}` };
    });
    expect(calls).toBe(2);
    expect(retried).toEqual({ text: `[warm] ${narration}`, tokens: null });

    const refused = await resolveTaggedNarration(narration, async () => ({ text: `[laughing] ${narration} tambahan` }));
    expect(refused).toEqual({ error: "Auto-tag mengubah kata narasi. Generate dibatalkan agar teks yang diucapkan tetap sama." });
  });

  it("keeps the words from a real Gemini tag", () => {
    const line = "Yakin lo, makan enak di Pik itu harus keluar komplek? kata siapa?";
    const accepted = acceptTaggedNarration(
      line,
      "[conversational] Yakin lo, makan enak di Pik itu harus keluar komplek? [playful] kata siapa?",
    );
    expect(accepted.ok).toBe(true);
    if (accepted.ok) expect(spokenKey(accepted.text)).toBe(spokenKey(line));
  });

  it("keeps one narration line when the expression is removed", () => {
    const line = "Serius loo? makan enak di Pik itu harus keluar komplek?";
    expect(narrationWithoutTags(`[conversational] ${line}`)).toBe(line);
    expect(hasVoiceExpression(`[playful] ${line}`)).toBe(true);
    expect(hasVoiceExpression(line)).toBe(false);
  });

  it("only offers auto-tag on the models that read tags", () => {
    expect(voiceModelSupportsAudioTags("eleven_v4")).toBe(true);
    expect(voiceModelSupportsAudioTags("eleven_v3")).toBe(true);
    expect(voiceModelSupportsAudioTags("eleven_multilingual_v2")).toBe(false);
    expect(voiceModelSupportsAudioTags("eleven_flash_v2_5")).toBe(false);
  });
});
