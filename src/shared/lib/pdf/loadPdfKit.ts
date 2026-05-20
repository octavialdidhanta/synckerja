import type jsPDFType from "jspdf";

export type PdfKit = {
  jsPDF: typeof jsPDFType;
  autoTable?: (doc: jsPDFType, options: unknown) => void;
};

let pdfKitPromise: Promise<PdfKit> | null = null;
let pdfKitWithTablePromise: Promise<PdfKit> | null = null;

/** Loads jspdf (and optionally jspdf-autotable) on demand into the vendor-pdf chunk. */
export function loadPdfKit(options?: { withAutoTable?: boolean }): Promise<PdfKit> {
  const withAutoTable = options?.withAutoTable ?? false;
  if (withAutoTable) {
    pdfKitWithTablePromise ??= Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]).then(([jspdfMod, autoTableMod]) => ({
      jsPDF: jspdfMod.default,
      autoTable: autoTableMod.default,
    }));
    return pdfKitWithTablePromise;
  }

  pdfKitPromise ??= import("jspdf").then((jspdfMod) => ({
    jsPDF: jspdfMod.default,
  }));
  return pdfKitPromise;
}
