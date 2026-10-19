import { useSyncExternalStore } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  closeGeminiSpendCapDialog,
  GEMINI_SPEND_CAP_URL,
  geminiSpendCapDialogOpen,
  subscribeGeminiSpendCap,
} from "@/shared/ai/geminiSpendCap";

export function GeminiSpendCapDialog() {
  const { t } = useAppTranslation();
  const open = useSyncExternalStore(subscribeGeminiSpendCap, geminiSpendCapDialogOpen, () => false);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeGeminiSpendCapDialog();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("geminiSpendCap.title", "Batas belanja Gemini tercapai")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              "geminiSpendCap.body",
              "Proyek Google AI Studio sudah melewati batas belanja bulan ini. Naikkan atau reset batasnya, lalu coba lagi.",
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("geminiSpendCap.close", "Tutup")}</AlertDialogCancel>
          <Button
            type="button"
            onClick={() => {
              window.open(GEMINI_SPEND_CAP_URL, "_blank", "noopener,noreferrer");
            }}
          >
            {t("geminiSpendCap.open", "Buka AI Studio")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
