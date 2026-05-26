import { Download, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/mobile-app/components/ui/sheet";
import { Separator } from "@/mobile-app/components/ui/separator";

export type LeadsReportFilterSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isGeneratingPDF: boolean;
  canDownload: boolean;
  onDownloadPdf: () => void;
};

export function LeadsReportFilterSheet({
  open,
  onOpenChange,
  isGeneratingPDF,
  canDownload,
  onDownloadPdf,
}: LeadsReportFilterSheetProps) {
  const { t } = useAppTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] flex flex-col gap-0 rounded-t-2xl p-0 [&>button]:hidden"
        underSafeArea
      >
        <div className="flex shrink-0 justify-center pb-1 pt-2">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden />
        </div>
        <SheetHeader className="flex shrink-0 flex-col gap-0 bg-primary px-4 py-3 text-primary-foreground">
          <SheetTitle className="text-center text-base font-semibold text-primary-foreground">
            {t("leadsManagement.reportSummary.title", "Report Summary")}
          </SheetTitle>
        </SheetHeader>
        <Separator className="shrink-0 bg-primary/20" />
        <div className="safe-area-bottom min-h-0 flex-1 overflow-y-auto bg-background">
          <div className="p-3">
            <Button
              onClick={() => {
                onDownloadPdf();
                onOpenChange(false);
              }}
              disabled={isGeneratingPDF || !canDownload}
              className="w-full gap-2 bg-blue-600 text-white hover:bg-blue-700"
            >
              {isGeneratingPDF ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Download className="h-4 w-4 shrink-0" aria-hidden />
              )}
              <span>
                {isGeneratingPDF
                  ? t("leadsManagement.reportSummary.generating", "Generating...")
                  : t("leadsManagement.reportSummary.downloadPdf", "Download PDF")}
              </span>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
