import { buildQrCardModel } from "../lib/buildQrCardModel";
import { paperSizeClass } from "../lib/qrPrintLayouts";
import type { QrCardModel } from "../lib/qrPrintTypes";
import { QrTableCard } from "./QrTableCard";

type Props = {
  cards: QrCardModel[];
};

export function QrPrintSheet({ cards }: Props) {
  if (cards.length === 0) return null;

  return (
    <div id="synckerja-qr-print-root" className="hidden print:block">
      {cards.map((model) => (
        <div
          key={`${model.tableLabel}-${model.qrUrl}`}
          className={`qr-print-page ${paperSizeClass(model.paperSize)}`}
        >
          <div className="qr-print-page__inner">
            <QrTableCard model={model} forPrint />
          </div>
        </div>
      ))}
    </div>
  );
}

export function buildQrCardModelsForTables(args: {
  publicCode: string;
  tables: Array<{ id: string; name: string }>;
  businessName: string;
  outletName: string;
  logoUrl: string | null;
  settings: Parameters<typeof buildQrCardModel>[0]["settings"];
  locale?: "id" | "en";
}): QrCardModel[] {
  return args.tables.map((table) =>
    buildQrCardModel({
      publicCode: args.publicCode,
      table,
      businessName: args.businessName,
      outletName: args.outletName,
      logoUrl: args.logoUrl,
      settings: args.settings,
      locale: args.locale,
    }),
  );
}
