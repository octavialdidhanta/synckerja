import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { setContentPlanDriveLink } from "../src/db/planDriveLink";
import { MCP_TOOLS } from "../src/mcp/registry";
import { isContentPlanDriveUrl, setPlanDriveLinkInput } from "../src/tools/content/planDriveLink";

const sql = readFileSync(
  new URL("../../../supabase/migrations_archive/20261117093000_mcp_set_content_plan_drive_link.sql", import.meta.url),
  "utf8",
);

const me = { userId: "11111111-1111-4111-8111-111111111111", organizationId: "22222222-2222-4222-8222-222222222222" };
const planId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const fileUrl = "https://drive.google.com/file/d/abc123drivefile/view";

describe("content.plans.media.set_link registry", () => {
  it("is a mutating content write on the content page", () => {
    const tool = MCP_TOOLS.find((item) => item.name === "content.plans.media.set_link");
    expect(tool?.scopes).toEqual(["content:write"]);
    expect(tool?.moduleKey).toBe("digitalMarketing");
    expect(tool?.mutates).toBe(true);
  });

  it("accepts a Drive file or folder and rejects other urls", () => {
    expect(setPlanDriveLinkInput.safeParse({ plan_id: planId, url: fileUrl }).success).toBe(true);
    expect(
      setPlanDriveLinkInput.safeParse({
        plan_id: planId,
        url: "https://drive.google.com/drive/folders/folder123",
      }).success,
    ).toBe(true);
    expect(setPlanDriveLinkInput.safeParse({ plan_id: planId, url: "https://example.com/file" }).success).toBe(false);
    expect(isContentPlanDriveUrl("http://drive.google.com/file/d/abc123drivefile/view")).toBe(false);
  });
});

const approvalSql = readFileSync(
  new URL("../../../supabase/migrations_archive/20261117160000_mcp_drive_link_requires_approval.sql", import.meta.url),
  "utf8",
);

describe("mcp_set_content_plan_drive_link approval rule", () => {
  it("rejects an unapproved plan before any update, like the Office Drive Link cell", () => {
    expect(approvalSql).toContain("IF NOT COALESCE(v_plan.approved, false) THEN");
    expect(approvalSql).toContain("RAISE EXCEPTION 'not_approved'");
    expect(approvalSql.indexOf("'not_approved'")).toBeLessThan(approvalSql.indexOf("UPDATE public.social_media_plans"));
    expect(approvalSql).toContain("SECURITY DEFINER");
    expect(approvalSql).toContain("plan.organization_id = p_organization_id");
    expect(approvalSql).toContain("TO service_role");
    expect(approvalSql).not.toMatch(/GRANT EXECUTE[^;]*(anon|authenticated)/);
  });

  it("maps not_approved to its own error and documents it", async () => {
    const blocked = { rpc: vi.fn(async () => ({ data: null, error: { message: "not_approved" } })) };
    await expect(
      setContentPlanDriveLink(blocked as never, me, { planId, url: fileUrl }),
    ).rejects.toThrow("not_approved");
    const tool = MCP_TOOLS.find((item) => item.name === "content.plans.media.set_link");
    expect(tool?.description).toContain("not_approved");
  });
});

describe("mcp_set_content_plan_drive_link SQL", () => {
  it("is locked to the session organization and to service_role", () => {
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path TO 'public'");
    expect(sql).toContain("plan.organization_id = p_organization_id");
    expect(sql).toContain("RAISE EXCEPTION 'not_a_member'");
    expect(sql).toContain("production_status = 'Need Review'");
    expect(sql).toContain("'folder:'");
    expect(sql).toContain("FROM anon, authenticated");
    expect(sql).toContain("TO service_role");
    expect(sql).not.toMatch(/GRANT EXECUTE[^;]*(anon|authenticated)/);
  });
});

describe("setContentPlanDriveLink", () => {
  it("maps membership errors and returns the saved link", async () => {
    const denied = { rpc: vi.fn(async () => ({ data: null, error: { message: "not_a_member" } })) };
    await expect(
      setContentPlanDriveLink(denied as never, me, { planId, url: fileUrl }),
    ).rejects.toThrow("forbidden");

    const ok = {
      rpc: vi.fn(async () => ({
        data: {
          id: planId,
          title: "Reel",
          google_drive_link: fileUrl,
          production_status: "Need Review",
          changed: true,
        },
        error: null,
      })),
    };
    const result = await setContentPlanDriveLink(ok as never, me, { planId, url: fileUrl });
    expect(result.changed).toBe(true);
    expect(result.production_status).toBe("Need Review");
    expect(result.google_drive_link).toBe(fileUrl);
    expect(result).not.toHaveProperty("storage_path");
  });
});
