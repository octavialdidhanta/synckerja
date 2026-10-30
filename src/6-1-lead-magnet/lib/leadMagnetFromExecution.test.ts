import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeClaudeModel } from "../../../supabase/functions/_shared/leadMagnet/claudeMaterial.ts";
import {
  fallbackCommentReplies,
  frameworkOfferText,
  resolveLeadMagnetAccountChoice,
  singleScopedLeadMagnetAccounts,
} from "../../../supabase/functions/_shared/leadMagnet/executionDraft.ts";
import {
  clipButtonLabel,
  findClaudeFileId,
  nextPdfTurn,
  parseMaterialOutline,
  shortGuideTitle,
} from "../../../supabase/functions/_shared/leadMagnet/materialOutline.ts";

const DM_AND_COMMENTS = [
  "instagram_manage_messages",
  "pages_messaging",
  "instagram_manage_comments",
  "pages_manage_engagement",
  "pages_read_user_content",
];

describe("lead magnet draft from execution", () => {
  it("replaces the retired Sonnet 4.5 id before calling Claude", () => {
    expect(normalizeClaudeModel("claude-sonnet-4-5")).toBe("claude-sonnet-5-5");
    expect(normalizeClaudeModel("claude-sonnet-4-5-20250929")).toBe("claude-sonnet-5-5");
    expect(normalizeClaudeModel("")).toBe("claude-sonnet-5-5");
    expect(normalizeClaudeModel("claude-opus-5-5")).toBe("claude-opus-5-5");
  });

  it("keeps the offer inside the DM and three unique replies", () => {
    const offer = "Cara menghitung harga jasa";
    expect(frameworkOfferText(offer)).toContain("{{username}}");
    expect(frameworkOfferText(offer)).toContain(offer);
    const replies = fallbackCommentReplies(offer);
    expect(new Set(replies).size).toBe(3);
    expect(replies.every((reply) => reply.includes(offer))).toBe(true);
  });

  it("attaches a platform only when exactly one account has DM and comment scopes", () => {
    const one = singleScopedLeadMagnetAccounts([
      { platform: "instagram", account_id: "ig-1", granted_scopes: DM_AND_COMMENTS },
      { platform: "facebook", account_id: "fb-1", granted_scopes: DM_AND_COMMENTS },
      { platform: "facebook", account_id: "fb-2", granted_scopes: DM_AND_COMMENTS },
    ]);
    expect(one).toEqual([{ platform: "instagram", account_id: "ig-1" }]);

    const none = singleScopedLeadMagnetAccounts([
      { platform: "instagram", account_id: "ig-1", granted_scopes: ["instagram_basic"] },
    ]);
    expect(none).toEqual([]);
  });

  it("lists every account and waits until the extra eligible account is chosen", () => {
    const pending = resolveLeadMagnetAccountChoice([
      { platform: "instagram", account_id: "ig-1", label: "octa.vialdi", granted_scopes: DM_AND_COMMENTS },
      { platform: "instagram", account_id: "ig-2", label: "octa.vialdi", granted_scopes: DM_AND_COMMENTS },
      { platform: "facebook", account_id: "fb-1", label: "Octa", granted_scopes: ["pages_show_list"] },
    ], {});
    expect(pending.needsChoice).toBe(true);
    expect(pending.chosen).toEqual([]);
    expect(pending.instagram.map((account) => account.label)).toEqual([
      "octa.vialdi (ig-1)",
      "octa.vialdi (ig-2)",
    ]);
    expect(pending.facebook[0]?.eligible).toBe(false);

    const picked = resolveLeadMagnetAccountChoice([
      { platform: "instagram", account_id: "ig-1", label: "octa.vialdi", granted_scopes: DM_AND_COMMENTS },
      { platform: "instagram", account_id: "ig-2", label: "synckerja", granted_scopes: DM_AND_COMMENTS },
    ], { instagram: "ig-2" });
    expect(picked.needsChoice).toBe(false);
    expect(picked.chosen).toEqual([{ platform: "instagram", account_id: "ig-2" }]);
    expect(picked.invalidSelection).toBe(false);
  });

  it("accepts a study guide and rejects a thin outline", () => {
    const offer = "Cara menghitung harga jasa";
    const lesson = "Pembaca menghitung harga dari biaya, waktu, dan margin. ".repeat(8);
    const example = "Tulis biaya produksi, waktu pengerjaan, lalu tambah margin 30 persen sebelum mengirim penawaran.";
    const section = (heading: string) => ({ heading, body: lesson, example });
    const ok = parseMaterialOutline(
      JSON.stringify({
        display_title: "Cara menghitung harga jasa",
        intro: "Panduan ini menuntun pembaca menghitung harga yang bisa dipertahankan. ".repeat(4),
        button_label: "Kirim harga lengkap sekarang",
        sections: [section("Rumus harga"), section("Biaya tersembunyi"), section("Margin"), section("Cek akhir")],
        replies: ["Cek DM ya", "Sudah kami kirim", "Cek DM ya"],
      }),
      offer,
    );
    expect(ok?.title).toBe(offer);
    expect(ok?.displayTitle).toBe("Cara menghitung harga jasa");
    expect(ok?.sections).toHaveLength(4);
    expect(ok?.sections[0]?.example).toContain("margin 30 persen");
    expect(ok?.buttonLabel).toBe(clipButtonLabel("Kirim harga lengkap sekarang"));
    expect(ok?.buttonLabel.length).toBeLessThanOrEqual(20);
    expect(ok?.replies).toBeNull();

    const longOffer = "Panduan Interaksi Ibu-Anak: Mengintegrasikan Keinginan Anak ke Rencana Masa Depan. Panduan ini berisi contoh pertanyaan yang panjang sekali.";
    expect(shortGuideTitle(longOffer, "")).toBe("Panduan Interaksi Ibu-Anak: Mengintegrasikan Keinginan Anak ke Rencana");

    expect(parseMaterialOutline(JSON.stringify({
      intro: "x".repeat(200),
      sections: [{ heading: "A", body: "x".repeat(20), example: "pendek" }],
    }), offer)).toBeNull();
  });

  it("finds the PDF file id returned by the skill", () => {
    expect(findClaudeFileId({
      content: [{ type: "code_execution_tool_result", content: [{ file_id: "file_abc123" }] }],
    })).toBe("file_abc123");
  });

  it("continues a paused PDF turn and stops when the skill ends without a file", () => {
    expect(nextPdfTurn({
      stop_reason: "pause_turn",
      container: { id: "container_1" },
      content: [{ type: "text", text: "still writing" }],
    })).toEqual({
      kind: "continue",
      containerId: "container_1",
      content: [{ type: "text", text: "still writing" }],
    });
    expect(nextPdfTurn({
      stop_reason: "pause_turn",
      container: { id: "container_1" },
      content: [{ type: "bash_code_execution_tool_result", content: { content: [{ file_id: "file_ready" }] } }],
    }).kind).toBe("file");
    expect(nextPdfTurn({ stop_reason: "end_turn", content: [] })).toEqual({ kind: "stop", reason: "end_turn" });
  });

  it("does not activate the campaign when a post is attached", () => {
    const source = readFileSync(
      "supabase/functions/_shared/leadMagnet/attachPublishedPost.ts",
      "utf8",
    );
    expect(source).toContain('in("status", ["draft", "active"])');
    expect(source).not.toContain('status: "active"');
    expect(source).toContain("ignoreDuplicates: true");
  });
});
