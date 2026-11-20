import { describe, expect, it } from "vitest";
import { parseRecipientImportFile } from "./parseRecipientImportFile";

/** jsdom's File has no arrayBuffer(); give the parser the bytes it reads. */
function csvFile(lines: string[], name = "recipients.csv"): File {
  const text = lines.join("\n");
  const file = new File([text], name, { type: "text/csv" });
  const bytes = new TextEncoder().encode(text);
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  });
  return file;
}

const HEADER = "phone_number,full_name,customer_name,company";

describe("parseRecipientImportFile", () => {
  it("keeps valid rows and reports rejected rows with phone, name and reason", async () => {
    const result = await parseRecipientImportFile(
      csvFile([
        HEADER,
        "628000000001,Demo Satu,Demo Satu,Sate Sultan PIK",
        "12345,Nomor Salah,Nomor Salah,Tes",
        "628000000001,Duplikat Satu,Duplikat Satu,Tes",
        "628000000004,,Tanpa Nama,Tes",
      ]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.validRows.map((r) => r.phoneKey)).toEqual(["628000000001"]);
    expect(result.failures).toEqual([
      { row: 3, code: "INVALID_PHONE", phone: "12345", name: "Nomor Salah" },
      { row: 4, code: "DUPLICATE_PHONE", phone: "628000000001", name: "Duplikat Satu" },
      { row: 5, code: "MISSING_FIELD", field: "full_name", phone: "628000000004", name: "Tanpa Nama" },
    ]);
  });

  it("reports the real file row number when blank rows sit between data rows", async () => {
    const result = await parseRecipientImportFile(
      csvFile([HEADER, "628000000001,A,A,X", "", "", "12345,B,B,X"]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rowCountExpected).toBe(2);
    expect(result.failures).toEqual([{ row: 5, code: "INVALID_PHONE", phone: "12345", name: "B" }]);
  });

  it("caps stored raw values so one oversized cell cannot bloat the summary", async () => {
    const longName = "x".repeat(600);
    const result = await parseRecipientImportFile(csvFile([HEADER, `628000000001,${longName},A,X`]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.failures[0]?.code).toBe("FIELD_TOO_LONG");
    expect(result.failures[0]?.name?.length).toBe(120);
  });
});
