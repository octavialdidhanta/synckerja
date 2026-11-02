import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decideToolRate, isAccessRevoked, type ToolRateState } from "../src/authz/toolGate";
import { MemoryGrantStore } from "../src/oauth/memoryStore";
import { recordToolCall, takeToolSlot } from "../src/db/toolGate";
import type { McpServiceConfig } from "../src/config";
import { createApp } from "../src/http/createApp";
import { signAccessToken } from "../src/oauth/tokens";

const config: McpServiceConfig = {
  publicUrl: "http://localhost:8787",
  officeOrigin: "http://localhost:8080",
  jwtSecret: "test-secret-at-least-16",
  port: 8787,
  supabaseUrl: "http://localhost:54321",
  supabaseServiceRoleKey: "service-role-test",
  scheduledPostsInternalSecret: "schedule-secret",
};

describe("latest connection", () => {
  it("revokes older clients and keeps the connection that just connected", async () => {
    const store = new MemoryGrantStore();
    const shared = {
      userId: "user-1",
      profileId: "profile-1",
      organizationId: "org-1",
      employeeId: null,
      connectionId: null,
      scope: "session:read",
      expiresAt: "2026-12-01T00:00:00.000Z",
      revokedAt: null,
    };
    await store.insertRefresh({ ...shared, tokenHash: "old", clientId: "client-old" });
    await store.insertRefresh({ ...shared, tokenHash: "new", clientId: "client-new" });
    await store.supersedeOlderConnections("user-1", "org-1", "client-new");
    expect((await store.findRefresh("old"))?.revokedAt).toBeTruthy();
    expect((await store.findRefresh("new"))?.revokedAt).toBeNull();
  });
});

describe("access cutoff", () => {
  it("rejects a token issued at or before the revoke time", () => {
    const revokedAt = new Date(100 * 1000).toISOString();
    expect(isAccessRevoked(100, revokedAt)).toBe(true);
    expect(isAccessRevoked(99, revokedAt)).toBe(true);
    expect(isAccessRevoked(101, revokedAt)).toBe(false);
    expect(isAccessRevoked(100, null)).toBe(false);
    expect(isAccessRevoked(100, "not-a-date")).toBe(true);
  });
});

describe("tool rate window", () => {
  it("rejects the 61st call and records one denial for the window", () => {
    const now = new Date("2026-10-31T16:00:00.000Z");
    let state: ToolRateState | null = null;
    for (let call = 1; call <= 60; call += 1) {
      const decision = decideToolRate(state, now);
      expect(decision.allowed).toBe(true);
      expect(decision.recordDenial).toBe(false);
      state = decision.state;
    }
    expect(state?.callCount).toBe(60);
    const denied = decideToolRate(state, now);
    expect(denied.allowed).toBe(false);
    expect(denied.recordDenial).toBe(true);
    const repeated = decideToolRate(denied.state, now);
    expect(repeated.allowed).toBe(false);
    expect(repeated.recordDenial).toBe(false);

    const later = new Date(now.getTime() + 5 * 60 * 1000);
    const reset = decideToolRate(repeated.state, later);
    expect(reset.allowed).toBe(true);
    expect(reset.state.callCount).toBe(1);
    expect(reset.state.denialLogged).toBe(false);
  });
});

describe("tool audit payload", () => {
  it("sends the session and the tool name without arguments", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const admin = { rpc } as unknown as SupabaseClient;
    await recordToolCall(
      admin,
      { userId: "user-1", organizationId: "org-1", clientId: "client-1" },
      "payroll.runs.list",
      "ok",
    );
    expect(rpc).toHaveBeenCalledWith("mcp_record_tool_call", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_client_id: "client-1",
      p_tool_name: "payroll.runs.list",
      p_outcome: "ok",
    });
    const sent = JSON.stringify(rpc.mock.calls);
    expect(sent).not.toContain("month");
    expect(sent).not.toContain("amount");
    expect(sent).not.toContain("brief");
    expect(sent).not.toContain("employee_id");
    const source = readFileSync(new URL("../src/db/toolGate.ts", import.meta.url), "utf8");
    expect(source).not.toContain("p_args");
    expect(source).not.toContain("arguments");
  });

  it("asks the rate function for the user and organization only", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ allowed: false, record_denial: true }], error: null });
    const admin = { rpc } as unknown as SupabaseClient;
    const slot = await takeToolSlot(admin, { userId: "user-1", organizationId: "org-1" });
    expect(slot).toEqual({ allowed: false, recordDenial: true });
    expect(rpc).toHaveBeenCalledWith("mcp_take_tool_slot", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
    });
  });
});

describe("mcp http gate", () => {
  it("answers health without a token or a database call", async () => {
    let lookedUp = false;
    const app = createApp(gateDeps({
      accessRevokedAt: async () => {
        lookedUp = true;
        return null;
      },
    }));
    const response = await app.request("http://localhost:8787/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(lookedUp).toBe(false);
  });

  it("rejects a revoked access token before loading permissions", async () => {
    let loaded = false;
    const app = createApp(gateDeps({
      accessRevokedAt: async () => new Date(Date.now() + 60_000).toISOString(),
      loadContext: async () => {
        loaded = true;
        throw new Error("should not load");
      },
    }));
    const token = await signAccessToken(config, {
      userId: "user-1",
      profileId: "profile-1",
      organizationId: "org-1",
      employeeId: null,
      scope: "session:read",
      clientId: "client-1",
    });
    const response = await app.request("http://localhost:8787/mcp", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: "{}",
    });
    expect(response.status).toBe(401);
    expect(loaded).toBe(false);
  });
});

function gateDeps(overrides: Record<string, unknown>) {
  const unused = async () => {
    throw new Error("unused");
  };
  return {
    config,
    store: {},
    verifySupabaseUser: unused,
    isActiveMember: async () => false,
    loadIdentity: async () => null,
    loadContext: unused,
    accessRevokedAt: async () => null,
    takeToolSlot: async () => ({ allowed: true, recordDenial: false }),
    recordToolCall: async () => {},
    listContentPlans: unused,
    listContentCalendar: unused,
    listOkrCycles: unused,
    listOkrObjectives: unused,
    listCrmLeads: unused,
    listAdsAccounts: unused,
    listAdsPerformance: unused,
    listIncomeTransactions: unused,
    listExpenses: unused,
    listEmployees: unused,
    listPayrollRuns: unused,
    listCustomerVisits: unused,
    listPosDailySales: unused,
    listKolCampaigns: unused,
    listKolProfiles: unused,
    listInventoryStock: unused,
    createContentPlan: unused,
    updateContentPlan: unused,
    createCompanyObjective: unused,
    updateObjective: unused,
    createLead: unused,
    updateLead: unused,
    scheduleContentPlan: unused,
    setLeadStatus: unused,
    createIncomeTransaction: unused,
    updateIncomeTransaction: unused,
    createExpenseRecord: unused,
    updateExpenseRecord: unused,
    ...overrides,
  } as unknown as Parameters<typeof createApp>[0];
}
