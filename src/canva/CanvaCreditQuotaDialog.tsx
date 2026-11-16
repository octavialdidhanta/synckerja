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
  CANVA_BILLING_URL,
  canvaCreditQuotaDialogOpen,
  closeCanvaCreditQuotaDialog,
  subscribeCanvaCreditQuota,
} from "@/canva/canvaCreditQuota";

export function CanvaCreditQuotaDialog() {
  const { t } = useAppTranslation();
  const open = useSyncExternalStore(subscribeCanvaCreditQuota, canvaCreditQuotaDialogOpen, () => false);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeCanvaCreditQuotaDialog();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("canvaCreditQuota.title", "Kuota AI Canva habis")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              "canvaCreditQuota.body",
              "Canva menolak membuat desain karena kuota AI / credit sedang habis atau cooldown. Buka Billing Canva untuk cek pemakaian, tunggu reset, atau upgrade / ambil kredit tambahan, lalu coba lagi di Synckerja.",
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("canvaCreditQuota.close", "Tutup")}</AlertDialogCancel>
          <Button
            type="button"
            onClick={() => {
              window.open(CANVA_BILLING_URL, "_blank", "noopener,noreferrer");
            }}
          >
            {t("canvaCreditQuota.open", "Buka Billing Canva")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
