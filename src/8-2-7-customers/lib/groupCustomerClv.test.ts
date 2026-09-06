import { describe, expect, it } from "vitest";
import type { CustomerSpendTotals } from "./aggregateCustomerSpend";
import { groupCustomerClv, type CustomerClvLeadInput } from "./groupCustomerClv";

function spend(partial: Partial<CustomerSpendTotals>): CustomerSpendTotals {
  return {
    thisMonth: 0,
    thisYear: 0,
    lifetime: 0,
    firstPurchaseDate: null,
    ...partial,
  };
}

function lead(partial: Partial<CustomerClvLeadInput> & { id: string }): CustomerClvLeadInput {
  return {
    client: "Walk-in",
    email: null,
    phone_number: null,
    converted_at: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...partial,
  };
}

describe("groupCustomerClv", () => {
  it("excludes Walk-in leads without phone or email", () => {
    const rows = groupCustomerClv(
      [
        lead({
          id: "w1",
          client: "Walk-in",
          converted_at: "2026-09-04T00:00:00.000Z",
        }),
      ],
      new Map([["w1", spend({ lifetime: 18315, thisMonth: 18315, thisYear: 18315 })]]),
      new Set(["w1"]),
    );
    expect(rows).toEqual([]);
  });

  it("merges two leads with the same phone and sums spend", () => {
    const rows = groupCustomerClv(
      [
        lead({
          id: "a",
          client: "Octa",
          phone_number: "081234567890",
          converted_at: "2026-09-05T00:00:00.000Z",
          updated_at: "2026-09-05T00:00:00.000Z",
        }),
        lead({
          id: "b",
          client: "Octa Vialdi",
          phone_number: "6281234567890",
          email: "octa@mail.com",
          converted_at: "2026-09-01T00:00:00.000Z",
          updated_at: "2026-09-06T00:00:00.000Z",
        }),
      ],
      new Map([
        ["a", spend({ lifetime: 100, thisMonth: 100, thisYear: 100, firstPurchaseDate: "2026-09-05" })],
        ["b", spend({ lifetime: 50, thisMonth: 50, thisYear: 50, firstPurchaseDate: "2026-09-01" })],
      ]),
      new Set(["a", "b"]),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Octa Vialdi",
      phone: "6281234567890",
      email: "octa@mail.com",
      lifetime: 150,
      thisMonth: 150,
      thisYear: 150,
      customerSince: "2026-09-01",
    });
    // Component id = lexicographic min of bridged nodes (email:… < phone:…).
    expect(rows[0]?.id).toBe("email:octa@mail.com");
  });

  it("merges two leads with the same email when phone missing", () => {
    const rows = groupCustomerClv(
      [
        lead({
          id: "a",
          client: "Octa",
          email: "same@mail.com",
          converted_at: "2026-09-05T00:00:00.000Z",
        }),
        lead({
          id: "b",
          client: "Octa",
          email: "Same@Mail.com",
          converted_at: "2026-09-06T00:00:00.000Z",
        }),
      ],
      new Map([
        ["a", spend({ lifetime: 10, thisMonth: 10, thisYear: 10 })],
        ["b", spend({ lifetime: 20, thisMonth: 20, thisYear: 20 })],
      ]),
      new Set(["a", "b"]),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "email:same@mail.com",
      email: "same@mail.com",
      phone: null,
      lifetime: 30,
    });
  });

  it("keeps same display name with different phones as separate rows", () => {
    const rows = groupCustomerClv(
      [
        lead({
          id: "a",
          client: "Octa",
          phone_number: "081111111111",
          converted_at: "2026-09-05T00:00:00.000Z",
        }),
        lead({
          id: "b",
          client: "Octa",
          phone_number: "082222222222",
          converted_at: "2026-09-06T00:00:00.000Z",
        }),
      ],
      new Map([
        ["a", spend({ lifetime: 1 })],
        ["b", spend({ lifetime: 2 })],
      ]),
      new Set(["a", "b"]),
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.id).sort()).toEqual([
      "phone:6281111111111",
      "phone:6282222222222",
    ]);
  });

  it("does not cross-link phone group with email-only group", () => {
    const rows = groupCustomerClv(
      [
        lead({
          id: "phone-lead",
          client: "Octa",
          phone_number: "081234567890",
          converted_at: "2026-09-05T00:00:00.000Z",
        }),
        lead({
          id: "email-lead",
          client: "Octa",
          email: "octa@mail.com",
          converted_at: "2026-09-06T00:00:00.000Z",
        }),
      ],
      new Map([
        ["phone-lead", spend({ lifetime: 1 })],
        ["email-lead", spend({ lifetime: 2 })],
      ]),
      new Set(["phone-lead", "email-lead"]),
    );

    expect(rows).toHaveLength(2);
  });

  it("cross-links phone-only and email-only when a bridge lead has both", () => {
    const rows = groupCustomerClv(
      [
        lead({
          id: "phone-lead",
          client: "Phone Only",
          phone_number: "081234567890",
          converted_at: "2026-09-05T00:00:00.000Z",
        }),
        lead({
          id: "email-lead",
          client: "Email Only",
          email: "octa@mail.com",
          converted_at: "2026-09-06T00:00:00.000Z",
        }),
        lead({
          id: "bridge",
          client: "Bridge",
          phone_number: "6281234567890",
          email: "octa@mail.com",
          converted_at: "2026-09-04T00:00:00.000Z",
          updated_at: "2026-09-07T00:00:00.000Z",
        }),
      ],
      new Map([
        ["phone-lead", spend({ lifetime: 10 })],
        ["email-lead", spend({ lifetime: 20 })],
        ["bridge", spend({ lifetime: 30 })],
      ]),
      new Set(["phone-lead", "email-lead", "bridge"]),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      phone: "6281234567890",
      email: "octa@mail.com",
      lifetime: 60,
      name: "Bridge",
    });
  });
});
