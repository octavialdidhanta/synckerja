import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFootageBan } from "./useFootageBan";

const setQueryData = vi.fn();
const getQueryData = vi.fn();
const upsert = vi.fn();
const delEq2 = vi.fn();
const delEq1 = vi.fn(() => ({ eq: delEq2 }));
const del = vi.fn(() => ({ eq: delEq1 }));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ setQueryData, getQueryData }),
}));

vi.mock("@/shared/auth/hooks/useOrgBootstrapPending", () => ({
  useOrgBootstrapPending: () => ({ organizationId: "org-1" }),
}));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    from: () => ({
      upsert: (...args: unknown[]) => {
        upsert(...args);
        return Promise.resolve({ error: null });
      },
      delete: () => {
        del();
        return { eq: delEq1 };
      },
    }),
  },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

describe("useFootageBan", () => {
  beforeEach(() => {
    setQueryData.mockClear();
    getQueryData.mockClear();
    upsert.mockClear();
    del.mockClear();
    delEq1.mockClear();
    delEq2.mockResolvedValue({ error: null });
    getQueryData.mockReturnValue({
      rows: [{ id: "s1", ban: null }],
      productOrder: [],
      thumbs: {},
    });
  });

  it("upserts a ban reason and patches the footage cache", async () => {
    const { result } = renderHook(() => useFootageBan());
    await act(async () => {
      await expect(result.current.setBan("s1", "senyum")).resolves.toBe(true);
    });
    expect(upsert).toHaveBeenCalledWith(
      { organization_id: "org-1", scene_id: "s1", reason: "senyum" },
      { onConflict: "scene_id" },
    );
    expect(setQueryData).toHaveBeenCalled();
  });

  it("defaults an empty reason like katalog.html", async () => {
    const { result } = renderHook(() => useFootageBan());
    await act(async () => {
      await result.current.setBan("s1", "   ");
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "tidak sesuai" }),
      expect.anything(),
    );
  });

  it("deletes the ban row when clearing", async () => {
    const { result } = renderHook(() => useFootageBan());
    await act(async () => {
      await expect(result.current.setBan("s1", null)).resolves.toBe(true);
    });
    expect(del).toHaveBeenCalled();
    expect(delEq1).toHaveBeenCalledWith("organization_id", "org-1");
    expect(delEq2).toHaveBeenCalledWith("scene_id", "s1");
  });
});
