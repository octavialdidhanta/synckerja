import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseShotJob } from "./shotData";
import { setShotDone } from "./shotDocument";
import { shotDataKey, type ShotData } from "./useShotData";
import { useShotSave } from "./useShotSave";

const calls: Array<{ document: Record<string, unknown>; filters: Record<string, string> }> = [];
let reply: { data: unknown[] | null; error: unknown } = { data: [], error: null };

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    from: () => {
      const filters: Record<string, string> = {};
      let document: Record<string, unknown> = {};
      const q = {
        update: (v: { document: Record<string, unknown> }) => {
          document = v.document;
          return q;
        },
        eq: (k: string, v: string) => {
          filters[k] = v;
          return q;
        },
        select: () => {
          calls.push({ document, filters });
          return Promise.resolve(reply);
        },
      };
      return q;
    },
  },
}));
vi.mock("@/shared/auth/hooks/useOrgBootstrapPending", () => ({
  useOrgBootstrapPending: () => ({ organizationId: "org-1" }),
}));

const doc = { judul: "Hari 5", shots: [{ id: "P01", judul: "Hook", done: false }] };

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const data: ShotData = {
    fields: {},
    jobs: [parseShotJob("hari-5", doc)],
    stored: { "hari-5": { document: doc, updatedAt: "2026-11-23T01:00:00.000000+00:00" } },
    footage: {},
  };
  qc.setQueryData(shotDataKey("org-1"), data);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { qc, ...renderHook(() => useShotSave(), { wrapper }) };
}

beforeEach(() => {
  calls.length = 0;
});

describe("useShotSave", () => {
  it("updates only when updated_at still matches and puts the saved row in the cache", async () => {
    const { qc, result } = setup();
    reply = { data: [{ document: { ...setShotDone(doc, "P01", true), saved_at: 5 }, updated_at: "2026-11-23T01:00:05+00:00" }], error: null };
    await act(() => result.current.saveJob("hari-5", (d) => ({ doc: setShotDone(d, "P01", true) })));
    expect(calls[0].filters).toEqual({ organization_id: "org-1", external_id: "hari-5", updated_at: "2026-11-23T01:00:00.000000+00:00" });
    expect((calls[0].document.shots as Array<{ done: boolean }>)[0].done).toBe(true);
    expect(typeof calls[0].document.saved_at).toBe("number");
    const cached = qc.getQueryData<ShotData>(shotDataKey("org-1"))!;
    expect(cached.jobs[0].shots[0].done).toBe(true);
    expect(cached.stored["hari-5"].updatedAt).toBe("2026-11-23T01:00:05+00:00");
    expect(result.current.status).toBe("saved");
  });

  it("does not overwrite a job changed elsewhere: no row back means changed_elsewhere", async () => {
    const { result } = setup();
    reply = { data: [], error: null };
    await act(async () => {
      await expect(result.current.saveJob("hari-5", (d) => ({ doc: d }))).rejects.toThrow("changed_elsewhere");
    });
    expect(result.current.status).toBe("conflict");
  });
});
