import "./styles/qr-print.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useToast } from "@/shared/components/ui/use-toast";
import type { SynckerjaOrderOrgSettings } from "@/synckerja-order/shared/lib/orderTypes";
import type { SynckerjaOrderTableRow } from "@/synckerja-order/5-backoffice-shell/hooks/useSynckerjaOrderTables";
import { SYNCKERJA_ORDER_OUTLETS_PATH } from "@/synckerja-order/5-backoffice-shell/lib/synckerjaOrderTabs";
import { buildQrCardModel } from "./lib/buildQrCardModel";
import { mergeQrSettings } from "./lib/buildQrCardModel";
import type { SynckerjaOrderQrSettingsDraft } from "./lib/qrPrintTypes";
import { useSynckerjaOrderQrSettings } from "./hooks/useSynckerjaOrderQrSettings";
import { useSynckerjaOrderQrPrint } from "./hooks/useSynckerjaOrderQrPrint";
import { QrPrintToolbar } from "./components/QrPrintToolbar";
import { QrCustomizePanel } from "./components/QrCustomizePanel";
import { QrTableSelector } from "./components/QrTableSelector";
import { QrCardPreview } from "./components/QrCardPreview";
import { QrPrintSheet, buildQrCardModelsForTables } from "./components/QrPrintSheet";

type Props = {
  publicCode: string | null;
  outletId: string | null;
  outletName: string;
  tables: SynckerjaOrderTableRow[];
  orgSettings: SynckerjaOrderOrgSettings;
  logoUrl: string | null;
};

export function SynckerjaOrderQrPanel({
  publicCode,
  outletId,
  outletName,
  tables,
  orgSettings,
  logoUrl,
}: Props) {
  const { t, language } = useAppTranslation();
  const { toast } = useToast();
  const qrSettings = useSynckerjaOrderQrSettings(outletId);
  const [draft, setDraft] = useState<SynckerjaOrderQrSettingsDraft>(qrSettings.settings);
  const [printScope, setPrintScope] = useState<"selected" | "all">("selected");
  const printPendingRef = useRef(false);

  useEffect(() => {
    setDraft(qrSettings.settings);
  }, [qrSettings.settings, outletId]);

  const printState = useSynckerjaOrderQrPrint(tables);
  const locale = language === "en" ? "en" : "id";
  const businessName = orgSettings.business_name?.trim() || outletName;

  const previewModel = useMemo(() => {
    if (!publicCode || !printState.previewTable) return null;
    return buildQrCardModel({
      publicCode,
      table: printState.previewTable,
      businessName,
      outletName,
      logoUrl,
      settings: draft,
      locale,
    });
  }, [publicCode, printState.previewTable, businessName, outletName, logoUrl, draft, locale]);

  const printModels = useMemo(() => {
    if (!publicCode) return [];
    const tablesToPrint = printScope === "all" ? tables : printState.selectedTables;
    if (tablesToPrint.length === 0) return [];
    return buildQrCardModelsForTables({
      publicCode,
      tables: tablesToPrint,
      businessName,
      outletName,
      logoUrl,
      settings: draft,
      locale,
    });
  }, [
    publicCode,
    printScope,
    tables,
    printState.selectedTables,
    businessName,
    outletName,
    logoUrl,
    draft,
    locale,
  ]);

  useEffect(() => {
    if (!printPendingRef.current) return;
    if (printModels.length === 0) return;
    printPendingRef.current = false;
    requestAnimationFrame(() => window.print());
  }, [printModels, printScope]);

  const handleSave = async () => {
    try {
      await qrSettings.save.mutateAsync(draft);
      toast({ title: t("synckerjaOrder.saved", "Saved") });
    } catch {
      toast({
        title: t("synckerjaOrder.saveError", "Failed to save"),
        variant: "destructive",
      });
    }
  };

  const handlePrintAll = () => {
    if (tables.length === 0) return;
    if (printScope === "all") {
      window.print();
      return;
    }
    printPendingRef.current = true;
    setPrintScope("all");
  };

  const handlePrintSelected = () => {
    if (printState.selectedTables.length === 0) return;
    if (printScope === "selected" && printModels.length > 0) {
      window.print();
      return;
    }
    printPendingRef.current = true;
    setPrintScope("selected");
  };

  if (!publicCode) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        <p>{t("synckerjaOrder.qr.needCode", "Set a public code on the Outlets tab first.")}</p>
        <Button asChild variant="link" className="mt-2 h-auto p-0">
          <Link to={SYNCKERJA_ORDER_OUTLETS_PATH}>
            {t("synckerjaOrder.qr.empty.goOutlets", "Go to Outlets")}
          </Link>
        </Button>
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        <p>
          {t(
            "synckerjaOrder.qr.empty.noTables",
            "No tables found for this outlet. Add tables in Table Management first.",
          )}
        </p>
        <Button asChild variant="link" className="mt-2 h-auto p-0">
          <Link
            to={
              outletId
                ? `/operations/table-management/map?outlet=${encodeURIComponent(outletId)}`
                : "/operations/table-management/map"
            }
          >
            {t("synckerjaOrder.qr.empty.goTables", "Go to Table Management")}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <QrPrintToolbar
        selectedCount={printState.selectedTables.length}
        totalCount={tables.length}
        onSave={() => void handleSave()}
        onPrintSelected={handlePrintSelected}
        onPrintAll={handlePrintAll}
        saveBusy={qrSettings.save.isPending}
      />

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <div className="scrollbar-hide space-y-5 overflow-y-auto border-b border-border p-4 lg:border-b-0 lg:border-r">
          <QrCustomizePanel
            draft={draft}
            brandImageUrl={logoUrl}
            onChange={(patch) => setDraft((prev) => mergeQrSettings(prev, patch))}
            disabled={qrSettings.isLoading}
          />
          <QrTableSelector
            tables={tables}
            selectedIds={printState.selectedIds}
            previewTableId={printState.previewTable?.id ?? null}
            allSelected={printState.allSelected}
            onToggle={printState.toggleTable}
            onSelectAll={printState.selectAll}
            onPreview={printState.setPreviewTableId}
          />
        </div>

        <div className="flex min-h-[480px] flex-col p-4">
          <QrCardPreview model={previewModel} />
        </div>
      </div>

      <QrPrintSheet cards={printModels} />
    </div>
  );
}
