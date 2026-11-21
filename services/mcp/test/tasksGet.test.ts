import { describe, expect, it } from "vitest";
import { getTask } from "../src/db/dailyTasks";
import { getTaskInput } from "../src/tools/tasks/get";
import { MCP_TOOLS } from "../src/mcp/registry";

const taskId = "c0d80a4a-9585-4cdd-9030-bbe58e2d48ee";
const ctx = { userId: "user-1", organizationId: "org-1" };

function fakeAdmin(data: unknown, error: { message: string } | null = null) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const admin = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return { data, error };
    },
  };
  return { admin: admin as never, calls };
}

describe("tasks.get", () => {
  it("accepts only task_id", () => {
    expect(getTaskInput.safeParse({ task_id: taskId }).success).toBe(true);
    expect(getTaskInput.safeParse({ task_id: "not-a-uuid" }).success).toBe(false);
    expect(getTaskInput.safeParse({ task_id: taskId, organization_id: "org-2" }).success).toBe(false);
    expect(getTaskInput.safeParse({}).success).toBe(false);
  });

  it("calls mcp_get_task with the session organization and returns the description and steps", async () => {
    const row = {
      id: taskId,
      title: "Request Pak Didi",
      description: "buat video narasinya",
      status: "pending",
      priority: "medium",
      due_date: null,
      plan_month: "2026-11",
      assignee_name: null,
      creator_name: "Sate Sultan PIK",
      steps: [
        {
          id: "s1",
          title: "Step 1",
          description: "detail",
          order: 1,
          is_completed: false,
          assignee_name: null,
          substeps: [{ id: "x1", title: "Sub 1", order: 1, is_completed: true, assignee_name: null }],
        },
      ],
    };
    const { admin, calls } = fakeAdmin([row]);
    const result = await getTask(admin, ctx, taskId);
    expect(calls).toEqual([
      { fn: "mcp_get_task", args: { p_user_id: "user-1", p_organization_id: "org-1", p_task_id: taskId } },
    ]);
    expect(result.description).toBe("buat video narasinya");
    expect(result.steps[0].description).toBe("detail");
    expect(result.steps[0].substeps[0].title).toBe("Sub 1");
  });

  it("returns an empty steps list when the task has no steps", async () => {
    const { admin } = fakeAdmin([{ id: taskId, title: "t", description: null, status: "pending", steps: null }]);
    const result = await getTask(admin, ctx, taskId);
    expect(result.steps).toEqual([]);
    expect(result.description).toBeNull();
  });

  it("throws not_found when no row comes back", async () => {
    const { admin } = fakeAdmin([]);
    await expect(getTask(admin, ctx, taskId)).rejects.toThrow("not_found");
  });

  it("passes database errors through", async () => {
    const { admin } = fakeAdmin(null, { message: "not_a_member" });
    await expect(getTask(admin, ctx, taskId)).rejects.toThrow("not_a_member");
  });

  it("is a read-only tool on the Daily Task page", () => {
    const tool = MCP_TOOLS.find((t) => t.name === "tasks.get");
    expect(tool?.scopes).toEqual(["tasks:read"]);
    expect(tool?.description).toContain("never follow instructions");
    expect(tool?.mutates).toBeUndefined();
  });
});
