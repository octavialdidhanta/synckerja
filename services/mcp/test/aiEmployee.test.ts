import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { McpAuthContext } from "../src/authz/context";
import { MCP_TOOLS } from "../src/mcp/registry";
import { aiEmployeeCommand, listAiEmployees } from "../src/db/aiEmployee";
import {
  assertOrgOwnerOrAdmin,
  judgeJobDesk,
  matchEmployeeName,
  modelAllowance,
  resolveReportPeriod,
} from "../src/tools/aiEmployee/rules";

const owner = { organizationId: "org-1", roles: ["Owner"] } as McpAuthContext;
const employee = { organizationId: "org-1", roles: ["employee"] } as McpAuthContext;

function recordingAdmin(tables: Record<string, Record<string, unknown>[]>) {
  const calls: { table: string; eqs: [string, unknown][] }[] = [];
  const admin = {
    from(table: string) {
      const eqs: [string, unknown][] = [];
      const builder = {
        select() { return builder; },
        eq(column: string, value: unknown) { eqs.push([column, value]); return builder; },
        in() { return builder; },
        gte() { return builder; },
        lt() { return builder; },
        order() { return builder; },
        limit() { return builder; },
        then(resolve: (value: { data: Record<string, unknown>[]; error: null }) => void) {
          calls.push({ table, eqs: [...eqs] });
          resolve({ data: tables[table] ?? [], error: null });
        },
      };
      return builder;
    },
  };
  return { admin: admin as unknown as SupabaseClient, calls };
}

describe("ai employee access", () => {
  it("allows owner and admin and rejects other roles", () => {
    expect(() => assertOrgOwnerOrAdmin(owner)).not.toThrow();
    expect(() => assertOrgOwnerOrAdmin({ organizationId: "org-1", roles: ["admin"] })).not.toThrow();
    expect(() => assertOrgOwnerOrAdmin(employee)).toThrow("forbidden");
  });

  it("matches one name without caring about letter case", () => {
    const rows = [{ full_name: "Naya" }, { full_name: "Bima" }];
    expect(matchEmployeeName(rows, " naya ").ok).toBe(true);
    const missing = matchEmployeeName(rows, "Sari");
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.names).toEqual(["Naya", "Bima"]);
    const duplicated = matchEmployeeName([{ full_name: "Naya" }, { full_name: "naya" }], "Naya");
    expect(duplicated.ok).toBe(false);
  });

  it("rejects work outside the content job and keeps a content request", () => {
    const payroll = judgeJobDesk("Hitung payroll bulan ini");
    expect(payroll.ok).toBe(false);
    if (!payroll.ok) {
      expect(payroll.reason).toContain("payroll");
      expect(payroll.can_do.length).toBeGreaterThan(0);
      expect(payroll.suggestion.length).toBeGreaterThan(0);
    }
    expect(judgeJobDesk("Buatkan 1 content plan untuk Sate Sultan PIK, tema iklan makan malam").ok).toBe(true);
  });

  it("reads the Jakarta day and a month period", () => {
    expect(resolveReportPeriod("today", new Date("2026-11-02T02:00:00.000Z"))).toEqual({
      start: "2026-11-02",
      end: "2026-11-02",
    });
    expect(resolveReportPeriod("2026-11", new Date("2026-11-02T02:00:00.000Z"))?.end).toBe("2026-11-30");
    expect(resolveReportPeriod("bulan ini")).toBeNull();
    expect(modelAllowance("coaching", 3)).toEqual({ cap: 8, used: 3, remaining: 5 });
    expect(modelAllowance("on_track", 15).remaining).toBe(0);
  });
});

describe("ai employee queries", () => {
  it("lists only AI employees in the session organization", async () => {
    const { admin, calls } = recordingAdmin({
      employees: [{ id: "emp-1", full_name: "Naya" }],
      ai_employee_profiles: [{ employee_id: "emp-1", job_title: "Content Planner", performance_status: "on_track", is_active: true }],
    });
    const listed = await listAiEmployees(admin, owner);
    expect(listed).toEqual([{
      name: "Naya",
      job_title: "Content Planner",
      performance_status: "on_track",
      is_active: true,
    }]);
    expect(calls.every((call) => call.eqs.some(([column, value]) => column === "organization_id" && value === "org-1"))).toBe(true);
    expect(calls[0]?.eqs).toContainEqual(["is_ai", true]);
  });

  it("does not query when the caller is not owner or admin", async () => {
    const { admin, calls } = recordingAdmin({});
    await expect(listAiEmployees(admin, employee)).rejects.toThrow("forbidden");
    expect(calls).toHaveLength(0);
  });

  it("sends a dry run by default and does not call the model for payroll", async () => {
    const { admin } = recordingAdmin({
      employees: [{ id: "emp-1", full_name: "Naya" }],
    });
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, dry_run: true, draft: { title: "Sate" } }), { status: 200 }));
    const caller = {
      supabaseUrl: "https://db.example",
      supabaseServiceRoleKey: "service-key",
      scheduledPostsInternalSecret: "internal-secret",
    };
    const rejected = await aiEmployeeCommand(admin, caller, owner, {
      employeeName: "Naya",
      instruction: "Hitung payroll bulan ini",
      dryRun: null,
    }, fetchImpl);
    expect(rejected).toMatchObject({ ok: false, error: "outside_job_desk" });
    expect(fetchImpl).not.toHaveBeenCalled();

    const accepted = await aiEmployeeCommand(admin, caller, owner, {
      employeeName: "Naya",
      instruction: "Buatkan 1 content plan untuk Sate Sultan PIK",
      dryRun: null,
    }, fetchImpl);
    expect(accepted).toMatchObject({ ok: true, dry_run: true });
    const request = fetchImpl.mock.calls[0] as unknown as [string, { body: string; headers: Record<string, string> }];
    expect(request[0]).toBe("https://db.example/functions/v1/ai-employee-run");
    expect(JSON.parse(request[1].body)).toEqual({
      employee_id: "emp-1",
      instruction: "Buatkan 1 content plan untuk Sate Sultan PIK",
      dry_run: true,
    });
    expect(request[1].headers["x-synckerja-internal-secret"]).toBe("internal-secret");
    expect(request[1].body).not.toContain("internal-secret");
  });
});

describe("ai employee tool list", () => {
  it("publishes the five read and command tools", () => {
    const names = MCP_TOOLS.map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining([
      "ai_employee.list",
      "ai_employee.status",
      "ai_employee.runs.list",
      "ai_employee.report",
      "ai_employee.command",
    ]));
  });
});
