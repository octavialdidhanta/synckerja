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
  ELEVENLABS_BILLING_URL,
  GEMINI_PREPAID_URL,
  GEMINI_SPEND_CAP_URL,
  geminiBillingNotice,
  subscribeGeminiSpendCap,
} from "@/shared/ai/geminiSpendCap";

export function GeminiSpendCapDialog() {
  const { t } = useAppTranslation();
  const notice = useSyncExternalStore(subscribeGeminiSpendCap, geminiBillingNotice, () => null);
  const open = notice !== null;
  const copy =
    notice === "elevenlabs"
      ? {
          title: t("elevenLabsCredit.title", "Kredit ElevenLabs habis"),
          body: t(
            "elevenLabsCredit.body",
            "Kredit akun ElevenLabs organisasi ini sudah habis, jadi VO belum bisa dibuat. Isi kredit atau aktifkan usage-based billing di ElevenLabs, lalu coba lagi.",
          ),
          url: ELEVENLABS_BILLING_URL,
          action: t("elevenLabsCredit.open", "Buka ElevenLabs"),
        }
      : notice === "prepaid"
        ? {
            title: t("geminiPrepaid.title", "Kredit Gemini habis"),
            body: t(
              "geminiPrepaid.body",
              "Kredit prabayar Google AI Studio sudah habis. Isi ulang kredit di AI Studio, lalu coba lagi.",
            ),
            url: GEMINI_PREPAID_URL,
            action: t("geminiSpendCap.open", "Buka AI Studio"),
          }
        : {
            title: t("geminiSpendCap.title", "Batas belanja Gemini tercapai"),
            body: t(
              "geminiSpendCap.body",
              "Proyek Google AI Studio sudah melewati batas belanja bulan ini. Naikkan atau reset batasnya, lalu coba lagi.",
            ),
            url: GEMINI_SPEND_CAP_URL,
            action: t("geminiSpendCap.open", "Buka AI Studio"),
          };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeGeminiSpendCapDialog();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("geminiSpendCap.close", "Tutup")}</AlertDialogCancel>
          <Button
            type="button"
            onClick={() => {
              window.open(copy.url, "_blank", "noopener,noreferrer");
            }}
          >
            {copy.action}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
