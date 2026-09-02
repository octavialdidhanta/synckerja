import type { CSSProperties } from "react";
import QRCode from "react-qr-code";
import { cn } from "@/shared/lib/utils";
import { qrCodeSizeForTemplate, templateClass } from "../lib/qrPrintLayouts";
import type { QrCardModel } from "../lib/qrPrintTypes";

type Props = {
  model: QrCardModel;
  forPrint?: boolean;
  className?: string;
};

export function QrTableCard({ model, forPrint = false, className }: Props) {
  const qrSize = qrCodeSizeForTemplate(model.templateId, forPrint);
  const accent = model.accentColor;

  return (
    <div
      className={cn(
        "qr-table-card flex flex-col items-center text-center",
        templateClass(model.templateId),
        forPrint ? "qr-table-card--print" : "qr-table-card--preview",
        className,
      )}
      style={{ "--qr-accent": accent } as CSSProperties}
    >
      {model.templateId === "tent" ? (
        <div className="qr-table-card__tent-top w-full border-b-2 px-6 py-5" style={{ borderColor: accent }}>
          {model.showLogo && model.logoUrl ? (
            <img
              src={model.logoUrl}
              alt=""
              className="mx-auto mb-3 h-12 max-w-[160px] object-contain"
            />
          ) : null}
          {model.showOutletName ? (
            <p className="text-sm font-medium text-muted-foreground">{model.outletName}</p>
          ) : null}
          {model.showTableName ? (
            <p className="mt-1 text-3xl font-bold tracking-tight" style={{ color: accent }}>
              {model.tableLabel}
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          "flex w-full flex-col items-center px-6 py-6",
          model.templateId === "tent" ? "flex-1 justify-center" : "",
        )}
      >
        {model.templateId !== "tent" && model.showLogo && model.logoUrl ? (
          <img
            src={model.logoUrl}
            alt=""
            className="mb-4 h-14 max-w-[180px] object-contain"
          />
        ) : null}

        {model.templateId !== "tent" && model.showOutletName ? (
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {model.outletName}
          </p>
        ) : null}

        {model.templateId !== "tent" && model.showTableName ? (
          <p
            className={cn(
              "font-bold tracking-tight",
              model.templateId === "minimal" ? "mb-4 text-2xl" : "mb-3 text-3xl",
            )}
            style={{ color: accent }}
          >
            {model.tableLabel}
          </p>
        ) : null}

        {model.templateId === "classic" ? (
          <p className="mb-4 text-lg font-semibold text-foreground">{model.businessName}</p>
        ) : null}

        {model.showScanInstruction ? (
          <p
            className={cn(
              "font-semibold text-foreground",
              model.templateId === "minimal" ? "mb-3 text-base" : "mb-2 text-lg",
            )}
          >
            {model.headline}
          </p>
        ) : null}

        {model.showScanInstruction && model.subheadline ? (
          <p className="mb-4 max-w-xs text-sm text-muted-foreground">{model.subheadline}</p>
        ) : null}

        <div
          className={cn(
            "rounded-xl bg-white p-3 shadow-sm ring-1 ring-border",
            model.templateId === "minimal" && "mb-2",
          )}
        >
          <QRCode value={model.qrUrl} size={qrSize} />
        </div>

        {model.showUrl ? (
          <p className="mt-3 break-all font-mono text-[10px] text-muted-foreground">{model.qrUrl}</p>
        ) : null}

        {model.footer ? (
          <p className="mt-4 text-xs text-muted-foreground">{model.footer}</p>
        ) : null}
      </div>
    </div>
  );
}
