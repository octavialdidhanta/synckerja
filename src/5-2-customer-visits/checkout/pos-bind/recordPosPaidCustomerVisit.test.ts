import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

vi.mock("@/shared/lib/date/getLocalDateYmd", () => ({
  getLocalDateYmd: () => "2026-08-30",
}));

import { recordPosPaidCustomerVisit } from "./recordPosPaidCustomerVisit";

type QueryResult = { data: unknown; error: { code?: string; message?: string } | null };

function thenableQuery(handlers: {
  maybeSingle?: QueryResult;
  single?: QueryResult;
  update?: QueryResult;
}) {
  const query: Record<string, unknown> = {};
  const self = () => query;
  query.select = self;
  query.insert = self;
  query.update = self;
  query.eq = self;
  query.order = self;
  query.limit = self;
  query.maybeSingle = () =>
    Promise.resolve(handlers.maybeSingle ?? { data: null, error: null });
  query.single = () => Promise.resolve(handlers.single ?? { data: null, error: null });
  query.then = (resolve: (value: QueryResult) => unknown) =>
    Promise.resolve(handlers.update ?? { data: null, error: null }).then(resolve);
  return query;
}

describe("recordPosPaidCustomerVisit", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("does not insert a visit when the receipt was skipped without a phone", async () => {
    const result = await recordPosPaidCustomerVisit({
      organizationId: "org-1",
      leadId: "lead-walkin",
      salesActivityId: "sa-1",
      phoneKey: "628111",
      boundByPhone: false,
    });
    expect(result).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("inserts a matched visit and links the receipt", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "customer_visits") {
        return thenableQuery({
          maybeSingle: { data: null, error: null },
          single: { data: { id: "visit-new" }, error: null },
          update: { data: { id: "visit-new" }, error: null },
        });
      }
      return thenableQuery({
        update: { data: null, error: null },
      });
    });

    const result = await recordPosPaidCustomerVisit({
      organizationId: "org-1",
      leadId: "lead-magnet",
      salesActivityId: "sa-1",
      phoneKey: "6281234567890",
      lookupRaw: "81234567890",
      boundByPhone: true,
    });

    expect(result).toEqual({ visitId: "visit-new", reused: false });
    expect(fromMock).toHaveBeenCalledWith("customer_visits");
    expect(fromMock).toHaveBeenCalledWith("sales_activities");
  });

  it("reuses today's CS check-in instead of inserting a second row", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "customer_visits") {
        return thenableQuery({
          maybeSingle: { data: { id: "visit-cs" }, error: null },
          update: { data: { id: "visit-cs" }, error: null },
        });
      }
      return thenableQuery({
        update: { data: null, error: null },
      });
    });

    const result = await recordPosPaidCustomerVisit({
      organizationId: "org-1",
      leadId: "lead-magnet",
      salesActivityId: "sa-2",
      phoneKey: "6281234567890",
      boundByPhone: true,
    });

    expect(result).toEqual({ visitId: "visit-cs", reused: true });
  });
});
