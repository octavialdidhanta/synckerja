import { describe, expect, it } from "vitest";
import { filterCustomers } from "./filterCustomers";
import type { CustomerListRow } from "../types";

function row(partial: Partial<CustomerListRow> & Pick<CustomerListRow, "id" | "name">): CustomerListRow {
  return {
    email: null,
    phone: null,
    customerSince: "2026-09-01",
    thisMonth: 0,
    thisYear: 0,
    lifetime: 0,
    ...partial,
  };
}

describe("filterCustomers", () => {
  const rows: CustomerListRow[] = [
    row({
      id: "phone:6281234567890",
      name: "Octa Vialdi",
      phone: "6281234567890",
      email: "octa@mail.com",
    }),
    row({
      id: "email:other@mail.com",
      name: "Other",
      email: "other@mail.com",
    }),
  ];

  it("returns all rows when search empty", () => {
    expect(filterCustomers(rows, "  ")).toHaveLength(2);
  });

  it("matches aggregated row by phone", () => {
    const hit = filterCustomers(rows, "628123");
    expect(hit).toHaveLength(1);
    expect(hit[0]?.id).toBe("phone:6281234567890");
  });

  it("matches aggregated row by email", () => {
    const hit = filterCustomers(rows, "octa@mail");
    expect(hit).toHaveLength(1);
    expect(hit[0]?.name).toBe("Octa Vialdi");
  });

  it("matches by name", () => {
    expect(filterCustomers(rows, "other")).toHaveLength(1);
  });
});
