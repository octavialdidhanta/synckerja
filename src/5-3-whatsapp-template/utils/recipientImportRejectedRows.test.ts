import { describe, expect, it } from "vitest";
import { buildRejectedRowsCsv, parseImportErrorSummary } from "./recipientImportRejectedRows";

describe("parseImportErrorSummary", () => {
  it("returns an empty result for lists without a summary", () => {
    expect(parseImportErrorSummary(null)).toEqual({ total: 0, items: [] });
    expect(parseImportErrorSummary("oops")).toEqual({ total: 0, items: [] });
  });

  it("reads rows sorted by row number and drops malformed entries", () => {
    const parsed = parseImportErrorSummary({
      failedTotal: 3,
      failures: [
        { row: 6, code: "DUPLICATE_PHONE", phone: "628000000001", name: "Dup" },
        { row: 3, code: "INVALID_PHONE" },
        { row: "x", code: "INVALID_PHONE" },
        { row: 9, code: "SOMETHING_ELSE" },
      ],
    });
    expect(parsed).toEqual({
      total: 3,
      items: [
        { row: 3, code: "INVALID_PHONE" },
        { row: 6, code: "DUPLICATE_PHONE", phone: "628000000001", name: "Dup" },
      ],
    });
  });

  it("keeps the full total when the stored list was capped", () => {
    expect(parseImportErrorSummary({ failedTotal: 900, failures: [{ row: 2, code: "INVALID_PHONE" }] }).total).toBe(900);
  });
});

describe("buildRejectedRowsCsv", () => {
  it("quotes values, neutralises formulas and adds a BOM", () => {
    const csv = buildRejectedRowsCsv(
      [
        { row: 3, code: "INVALID_PHONE", phone: "12345", name: 'Budi "B"' },
        { row: 4, code: "INVALID_PHONE", phone: "=HYPERLINK(1)" },
        { row: 5, code: "INVALID_PHONE", phone: "+62 800-1" },
      ],
      { row: "Row", phone: "Phone", name: "Name", reason: "Reason" },
      () => "Invalid phone",
    );
    expect(csv).toBe(
      '﻿"Row","Phone","Name","Reason"\r\n' +
        '"3","12345","Budi ""B""","Invalid phone"\r\n' +
        '"4","\'=HYPERLINK(1)","","Invalid phone"\r\n' +
        '"5","+62 800-1","","Invalid phone"\r\n',
    );
  });
});
