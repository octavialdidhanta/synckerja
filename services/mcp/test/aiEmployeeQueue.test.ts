import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { McpAuthContext } from "../src/authz/context";
import { aiEmployeeQueueList } from "../src/db/aiEmployee";

const owner = { userId: "user-1", organizationId: "org-session", roles: ["owner"] } as McpAuthContext;
const admin = { userId: "user-2", organizationId: "org-session", roles: [" Admin "] } as McpAuthContext;
const member = { userId: "user-3", organizationId: "org-session", roles: ["employee"] } as McpAuthContext;

function queueAdmin() {
  const fromCalls: { table: string; eqs: [string, unknown][] }[] = [];
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  const client = {
    from(table: string) {
      const eqs: [string, unknown][] = [];
      const builder = {
        select() { return builder; },
        eq(column: string, value: unknown) { eqs.push([column, value]); return builder; },
        in() { return builder; },
        order() { return builder; },
        limit() { return builder; },
        then(resolve: (value: { data: Record<string, unknown>[]; error: null }) => void) {
          fromCalls.push({ table, eqs: [...eqs] });
          resolve({
            data: table === "employees" ? [{ id: "emp-1", full_name: "Naya" }] : [],
            error: null,
          });
        },
      };
      return builder;
    },
    async rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args });
      return { data: [{ status: "queued", source: "task" }], error: null };
    },
  };
  return { client: client as unknown as SupabaseClient, fromCalls, rpcCalls };
}

describe("ai employee queue", () => {
  it("rejects a member before querying", async () => {
    const { client, fromCalls, rpcCalls } = queueAdmin();
    await expect(aiEmployeeQueueList(client, member, "Naya")).rejects.toThrow("forbidden");
    expect(fromCalls).toHaveLength(0);
    expect(rpcCalls).toHaveLength(0);
  });

  it("lists the session organization for the owner", async () => {
    const { client, rpcCalls } = queueAdmin();
    const listed = await aiEmployeeQueueList(client, owner, "Naya");
    expect(listed).toEqual({ name: "Naya", jobs: [{ status: "queued", source: "task" }] });
    expect(rpcCalls[0]?.fn).toBe("mcp_list_ai_employee_jobs");
    expect(rpcCalls[0]?.args.p_organization_id).toBe("org-session");
    expect(rpcCalls[0]?.args.p_user_id).toBe("user-1");
    expect(rpcCalls[0]?.args.p_employee_id).toBe("emp-1");
  });

  it("lets an admin read and does not accept another organization", async () => {
    const { client, rpcCalls } = queueAdmin();
    await aiEmployeeQueueList(client, admin, "naya");
    expect(rpcCalls[0]?.args.p_organization_id).toBe("org-session");
    expect(rpcCalls[0]?.args.p_user_id).toBe("user-2");
  });
});
