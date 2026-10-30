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
  GEMINI_PREPAID_URL,
  GEMINI_SPEND_CAP_URL,
  geminiBillingNotice,
  subscribeGeminiSpendCap,
} from "@/shared/ai/geminiSpendCap";

export function GeminiSpendCapDialog() {
  const { t } = useAppTranslation();
  const notice = useSyncExternalStore(subscribeGeminiSpendCap, geminiBillingNotice, () => null);
  const open = notice !== null;
  const prepaid = notice === "prepaid";

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
            {prepaid
              ? t("geminiPrepaid.title", "Kredit Gemini habis")
              : t("geminiSpendCap.title", "Batas belanja Gemini tercapai")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {prepaid
              ? t(
                  "geminiPrepaid.body",
                  "Kredit prabayar Google AI Studio sudah habis. Isi ulang kredit di AI Studio, lalu coba lagi.",
                )
              : t(
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
              window.open(prepaid ? GEMINI_PREPAID_URL : GEMINI_SPEND_CAP_URL, "_blank", "noopener,noreferrer");
            }}
          >
            {t("geminiSpendCap.open", "Buka AI Studio")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
