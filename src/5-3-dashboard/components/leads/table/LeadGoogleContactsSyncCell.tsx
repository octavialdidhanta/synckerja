import { Badge } from "@/shared/components/ui/badge";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { GoogleContactsSyncLinkRecord } from "@/5-3-dashboard/hooks/useGoogleContactsSyncLinksMap";

type LeadGoogleContactsSyncCellProps = {
  sync: GoogleContactsSyncLinkRecord | null;
  loading?: boolean;
  connected?: boolean;
};

export function LeadGoogleContactsSyncCell({
  sync,
  loading,
  connected = true,
}: LeadGoogleContactsSyncCellProps) {
  const { t } = useAppTranslation();

  if (!connected) {
    return <span className="inline-flex w-[100px] justify-center text-sm text-muted-foreground">—</span>;
  }

  if (loading && !sync) {
    return (
      <span className="inline-flex w-[100px] justify-center text-xs text-muted-foreground">…</span>
    );
  }

  if (!sync) {
    return (
      <span
        className="inline-flex w-[100px] justify-center text-xs text-muted-foreground"
        title={t(
          "leadsManagement.googleContactsSync.waitingHint",
          "Menunggu antrian sync ke Google Contacts.",
        )}
      >
        —
      </span>
    );
  }

  if (sync.status === "pending") {
    return (
      <Badge
        className="w-[100px] justify-center rounded-sm border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900"
        title={t("leadsManagement.googleContactsSync.pendingHint", "Sedang menunggu sync")}
      >
        {t("leadsManagement.googleContactsSync.pending", "Menunggu")}
      </Badge>
    );
  }

  if (sync.status === "synced") {
    return (
      <Badge
        className="w-[100px] justify-center rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800"
        title={t("leadsManagement.googleContactsSync.syncedHint", "Tersimpan di Google Contacts")}
      >
        {t("leadsManagement.googleContactsSync.synced", "Tersinkron")}
      </Badge>
    );
  }

  if (sync.status === "skipped") {
    return (
      <Badge
        className="w-[100px] justify-center rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600"
        title={
          sync.last_error?.trim() ||
          t("leadsManagement.googleContactsSync.skippedHint", "Sync dilewati")
        }
      >
        {t("leadsManagement.googleContactsSync.skipped", "Dilewati")}
      </Badge>
    );
  }

  return (
    <Badge
      className="w-[100px] justify-center rounded-sm border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700"
      title={
        sync.last_error?.trim() ||
        t(
          "leadsManagement.googleContactsSync.failedHint",
          "Sync gagal — akan dicoba ulang otomatis.",
        )
      }
    >
      {t("leadsManagement.googleContactsSync.failed", "Gagal")}
    </Badge>
  );
}
