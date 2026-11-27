import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { signContentConfirmation, verifyContentConfirmation } from "../src/tools/content/contentConfirmation";
import {
  briefCreateFromConfirmation,
  briefWriteFrom,
  createBriefInput,
  createBriefPreviewInput,
  createBriefToolInput,
} from "../src/tools/content/briefsCreate";
import { publishedInputFor } from "../src/mcp/handler";
import { MCP_TOOLS } from "../src/mcp/registry";

const secret = "brief-create-gate2-test";
const identity = { userId: "11111111-1111-4111-8111-111111111111", organizationId: "22222222-2222-4222-8222-222222222222" };

const brief = {
  title: "Sop Sumsum Uji",
  content_type_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  voice_over: "Sumsumnya masih nyangkut?",
  sequences: [
    {
      name: "Hook",
      shots: [
        { timing: "0-3", visual: "close up tulang", vo: "Sumsumnya masih nyangkut?" },
        { timing: "3-6", visual: "sedot sumsum", vo: "Coba cara ini." },
      ],
    },
  ],
};

const shotlist = {
  judul: "Sop Sumsum Uji (PIK1, ~6s)",
  lokasi: "PIK1",
  shots: [
    { id: "s1", prompt: "close up tulang sumsum" },
    { id: "s2", prompt: "sendok sedot sumsum" },
  ],
};

describe("content.briefs.create.preview input", () => {
  it("accepts the brief with its shot list", () => {
    expect(createBriefPreviewInput.safeParse({ ...brief, shotlist }).success).toBe(true);
    expect(createBriefPreviewInput.safeParse(brief).success).toBe(true);
  });

  it("refuses a shot list the server must not trust", () => {
    const bad = [
      { ...shotlist, shots: [] },
      { ...shotlist, shots: [{ id: "s1" }, { id: "s1" }] },
      { ...shotlist, shots: [{ id: " " }] },
      { ...shotlist, job_id: "abc" },
      { ...shotlist, external_id: "79316cbe" },
      { judul: "tanpa shots" },
    ];
    for (const doc of bad) expect(createBriefPreviewInput.safeParse({ ...brief, shotlist: doc }).success).toBe(false);
    expect(createBriefPreviewInput.safeParse({ ...brief, approved: true }).success).toBe(false);
  });
});

describe("content.briefs.create confirm", () => {
  it("saves exactly what the preview signed", async () => {
    const input = createBriefInput.parse(brief);
    const signed = await signContentConfirmation(secret, identity, "content.briefs.create", { input, shotlist });
    const verified = await verifyContentConfirmation(secret, identity, "content.briefs.create", signed.confirm_token);
    const payload = briefCreateFromConfirmation(verified.payload);
    expect(payload.input).toEqual(input);
    expect(payload.shotlist).toEqual(shotlist);
    expect(briefWriteFrom(payload.input).sequences[0]!.shots[1]).toEqual({
      timing: "3-6",
      visual: "sedot sumsum",
      vo: "Coba cara ini.",
      element: "",
      tagging: "",
    });
  });

  it("never accepts a token from the brief edit, and keeps an empty shot list empty", async () => {
    const edit = await signContentConfirmation(secret, identity, "content.briefs.update", { planId: "x" });
    await expect(
      verifyContentConfirmation(secret, identity, "content.briefs.create", edit.confirm_token),
    ).rejects.toThrow("confirmation_invalid");
    const input = createBriefInput.parse(brief);
    expect(briefCreateFromConfirmation({ input, shotlist: null }).shotlist).toBeNull();
    expect(() => briefCreateFromConfirmation({ input: { title: "x" }, shotlist: null })).toThrow("confirmation_invalid");
  });

  it("takes either the token alone or the older full brief", () => {
    expect(createBriefToolInput.safeParse({ confirm_token: "t" }).success).toBe(true);
    expect(createBriefToolInput.safeParse(brief).success).toBe(true);
    expect(createBriefToolInput.safeParse({ ...brief, approved: true }).success).toBe(false);
  });
});

describe("gate 2 wiring", () => {
  it("publishes the preview tool with the shot list field and the token on create", () => {
    const names = MCP_TOOLS.map((tool) => tool.name);
    expect(names).toContain("content.briefs.create.preview");
    expect(Object.keys((publishedInputFor("content.briefs.create.preview") as unknown as { shape: object }).shape)).toContain("shotlist");
    expect(Object.keys((publishedInputFor("content.briefs.create") as unknown as { shape: object }).shape)).toContain("confirm_token");
  });

  it("saves the plan, brief and shot list in one function that records the token once", () => {
    const sql = readFileSync(
      new URL("../../../supabase/migrations/20261127190000_brief_create_with_shotlist.sql", import.meta.url),
      "utf8",
    );
    expect(sql).toContain("INSERT INTO public.mcp_tool_confirmations");
    expect(sql).toContain("public.mcp_create_content_brief(");
    expect(sql).toContain("INSERT INTO public.catalog_shot_jobs");
    expect(sql).toContain("FROM PUBLIC, anon, authenticated");
  });
});
