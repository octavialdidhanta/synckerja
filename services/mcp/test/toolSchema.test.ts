import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calendarInput } from "../src/tools/content/calendarList";
import { contentPlansInput } from "../src/tools/content/plansList";
import { leadsInput } from "../src/tools/crm/leadsList";
import { cyclesInput } from "../src/tools/okr/cyclesList";
import { objectivesInput } from "../src/tools/okr/objectivesList";
import { whoamiInput } from "../src/tools/session/whoami";
import { listContentPlans } from "../src/db/listContentPlans";
import { listContentCalendar, listCrmLeads, listOkrCycles, listOkrObjectives } from "../src/db/phase1Reads";

describe("phase 0 tool inputs", () => {
  it("rejects an organization_id argument", () => {
    expect(whoamiInput.safeParse({}).success).toBe(true);
    expect(contentPlansInput.safeParse({}).success).toBe(true);
    expect(contentPlansInput.safeParse({ organization_id: "org-2" }).success).toBe(false);
    expect(calendarInput.safeParse({}).success).toBe(true);
    expect(calendarInput.safeParse({ month: "2026-10" }).success).toBe(true);
    expect(calendarInput.safeParse({ month: "2026-13" }).success).toBe(false);
    expect(calendarInput.safeParse({ month: "October" }).success).toBe(false);
    expect(calendarInput.safeParse({ organization_id: "org-2" }).success).toBe(false);
    expect(cyclesInput.safeParse({ organization_id: "org-2" }).success).toBe(false);
    expect(objectivesInput.safeParse({ cycle_id: "11111111-1111-4111-8111-111111111111" }).success).toBe(true);
    expect(objectivesInput.safeParse({ cycle_id: "not-a-uuid" }).success).toBe(false);
    expect(objectivesInput.safeParse({ organization_id: "org-2" }).success).toBe(false);
    expect(leadsInput.safeParse({ status: "Open" }).success).toBe(true);
    expect(leadsInput.safeParse({ organization_id: "org-2" }).success).toBe(false);
    expect(leadsInput.safeParse({ phone_number: "0812" }).success).toBe(false);
  });

  it("calls the membership-checked RPC with the session organization only", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: "plan-1" }], error: null });
    const admin = { rpc } as unknown as SupabaseClient;
    const rows = await listContentPlans(admin, { userId: "user-1", organizationId: "org-1" });
    expect(rows).toEqual([{ id: "plan-1" }]);
    expect(rpc).toHaveBeenCalledWith("mcp_list_content_plans", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
    });
  });

  it("calls the phase 1 RPCs with the session organization only", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const admin = { rpc } as unknown as SupabaseClient;
    const ctx = { userId: "user-1", organizationId: "org-1" };
    await listContentCalendar(admin, ctx, "2026-10");
    await listOkrCycles(admin, ctx);
    await listOkrObjectives(admin, ctx, null);
    await listCrmLeads(admin, ctx, "Open");
    expect(rpc).toHaveBeenNthCalledWith(1, "mcp_list_content_calendar", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_month: "2026-10",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "mcp_list_okr_cycles", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "mcp_list_okr_objectives", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_cycle_id: null,
    });
    expect(rpc).toHaveBeenNthCalledWith(4, "mcp_list_crm_leads", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_status: "Open",
    });
  });

  it("keeps service-role helpers out of tool files", () => {
    const whoami = readFileSync(new URL("../src/tools/session/whoami.ts", import.meta.url), "utf8");
    const plans = readFileSync(new URL("../src/tools/content/plansList.ts", import.meta.url), "utf8");
    const calendar = readFileSync(new URL("../src/tools/content/calendarList.ts", import.meta.url), "utf8");
    const cycles = readFileSync(new URL("../src/tools/okr/cyclesList.ts", import.meta.url), "utf8");
    const objectives = readFileSync(new URL("../src/tools/okr/objectivesList.ts", import.meta.url), "utf8");
    const leads = readFileSync(new URL("../src/tools/crm/leadsList.ts", import.meta.url), "utf8");
    const identity = readFileSync(new URL("../src/db/identity.ts", import.meta.url), "utf8");
    const consent = readFileSync(new URL("../src/oauth/consent.ts", import.meta.url), "utf8");
    for (const source of [whoami, plans, calendar, cycles, objectives, leads]) {
      expect(source).not.toContain("createAdmin");
      expect(source).not.toContain("SERVICE_ROLE");
      expect(source).not.toContain("active_organization_id");
    }
    expect(identity).not.toContain("active_organization_id");
    expect(identity).not.toContain(".update(");
    expect(consent).not.toContain("active_organization_id");
    expect(consent).not.toContain(".update(");
  });
});
