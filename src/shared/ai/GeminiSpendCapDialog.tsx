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
  ANTHROPIC_BILLING_URL,
  ANTHROPIC_LIMITS_URL,
  anthropicCreditSource,
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
  const leadMagnet = anthropicCreditSource() === "lead_magnet";
  const copy =
    notice === "anthropic_credit"
      ? {
          title: t("anthropicCredit.title", "Kredit Anthropic habis"),
          body: leadMagnet
            ? t(
                "anthropicCredit.leadMagnetBody",
                "Kredit Claude API organisasi ini sudah habis, jadi PDF Lead Magnet belum dibuat. Draft tetap tersimpan. Isi kredit di Claude Console, lalu simpan lagi untuk membuat PDF-nya.",
              )
            : t(
                "anthropicCredit.body",
                "Kredit Claude API di laptop Agent sudah habis, jadi footage baru belum diberi keterangan AI. Isi kredit di Claude Console. Agent mengecek tiap 10 menit dan lanjut sendiri, tanpa restart.",
              ),
          url: ANTHROPIC_BILLING_URL,
          action: t("anthropicCredit.open", "Buka Claude Console"),
        }
      : notice === "anthropic_limit"
      ? {
          title: t("anthropicLimit.title", "Batas belanja Anthropic tercapai"),
          body: leadMagnet
            ? t(
                "anthropicLimit.leadMagnetBody",
                "Batas belanja Claude API organisasi ini sudah tercapai, jadi PDF Lead Magnet belum dibuat. Draft tetap tersimpan. Naikkan batasnya di Claude Console, lalu simpan lagi.",
              )
            : t(
                "anthropicLimit.body",
                "Batas belanja Claude API sudah tercapai, jadi footage baru belum diberi keterangan AI. Naikkan batasnya di Claude Console atau tunggu sampai akses kembali. Agent lanjut sendiri.",
              ),
          url: ANTHROPIC_LIMITS_URL,
          action: t("anthropicCredit.open", "Buka Claude Console"),
        }
      : notice === "anthropic_billing"
      ? {
          title: t("anthropicBilling.title", "Pembayaran Anthropic bermasalah"),
          body: leadMagnet
            ? t(
                "anthropicBilling.leadMagnetBody",
                "Claude API menolak karena masalah pembayaran, jadi PDF Lead Magnet belum dibuat. Draft tetap tersimpan. Periksa metode pembayaran di Claude Console, lalu simpan lagi.",
              )
            : t(
                "anthropicBilling.body",
                "Claude API menolak karena masalah pembayaran, jadi footage baru belum diberi keterangan AI. Periksa metode pembayaran di Claude Console. Agent lanjut sendiri.",
              ),
          url: ANTHROPIC_BILLING_URL,
          action: t("anthropicCredit.open", "Buka Claude Console"),
        }
      : notice === "elevenlabs"
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
