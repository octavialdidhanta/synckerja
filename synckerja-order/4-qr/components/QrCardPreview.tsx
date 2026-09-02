import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { QrCardModel } from "../lib/qrPrintTypes";
import { QrTableCard } from "./QrTableCard";

type Props = {
  model: QrCardModel | null;
};

export function QrCardPreview({ model }: Props) {
  const { t } = useAppTranslation();

  if (!model) {
    return (
      <div className="flex min-h-[420px] flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground print:hidden">
        {t("synckerjaOrder.qr.preview.empty", "Select a table to preview its QR card.")}
      </div>
    );
  }

  return (
    <div className="flex min-h-[420px] flex-1 flex-col print:hidden">
      <p className="mb-3 text-xs font-medium text-muted-foreground">
        {t("synckerjaOrder.qr.preview.label", "Preview")}
      </p>
      <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-muted/20 p-6">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-sm">
          <QrTableCard model={model} />
        </div>
      </div>
    </div>
  );
}
