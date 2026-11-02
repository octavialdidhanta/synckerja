import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { McpAuthContext } from "../src/authz/context";
import { listProductKnowledge } from "../src/db/productKnowledge";

const owner = { userId: "user-1", organizationId: "org-session", roles: ["owner"] } as McpAuthContext;
const admin = { userId: "user-2", organizationId: "org-session", roles: [" Admin "] } as McpAuthContext;
const member = { userId: "user-3", organizationId: "org-session", roles: ["employee"] } as McpAuthContext;

function rpcAdmin(rows: unknown[] = [{ feature_name: "Sate" }]) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const client = {
    async rpc(fn: string, args: Record<string, unknown>) {
      calls.push({ fn, args });
      return { data: rows, error: null };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe("product knowledge list", () => {
  it("rejects a member before querying", async () => {
    const { client, calls } = rpcAdmin();
    await expect(listProductKnowledge(client, member, {
      serviceId: null,
      subServiceId: null,
      search: null,
      limit: null,
    })).rejects.toThrow("forbidden");
    expect(calls).toHaveLength(0);
  });

  it("queries only the session organization", async () => {
    const { client, calls } = rpcAdmin();
    const rows = await listProductKnowledge(client, owner, {
      serviceId: "11111111-1111-4111-8111-111111111111",
      subServiceId: null,
      search: "sate",
      limit: 8,
    });
    expect(rows).toEqual([{ feature_name: "Sate" }]);
    expect(calls[0]?.fn).toBe("mcp_list_product_knowledge");
    expect(calls[0]?.args.p_organization_id).toBe("org-session");
    expect(calls[0]?.args.p_user_id).toBe("user-1");
    expect(calls[0]?.args.p_service_id).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("lets an admin read and does not accept another organization", async () => {
    const { client, calls } = rpcAdmin();
    await listProductKnowledge(client, admin, {
      serviceId: null,
      subServiceId: null,
      search: null,
      limit: null,
    });
    expect(calls[0]?.args.p_organization_id).toBe("org-session");
    expect(calls[0]?.args.p_user_id).toBe("user-2");
  });
});
