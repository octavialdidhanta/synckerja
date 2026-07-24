import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { useGoogleContactsSettings } from "@/google-contacts/hooks/useGoogleContactsSettings";
import {
  GOOGLE_CONTACTS_OMNICHANNEL_SETTINGS_PATH,
  type GoogleContactsOAuthReturnPath,
} from "@/google-contacts/settings/googleContactsSettingsPaths";

export type GoogleContactsSettingsPanelProps = {
  organizationId: string | null | undefined;
  enabled?: boolean;
  oauthReturnPath?: GoogleContactsOAuthReturnPath;
  className?: string;
};

export function GoogleContactsSettingsPanel({
  organizationId,
  enabled = true,
  oauthReturnPath = GOOGLE_CONTACTS_OMNICHANNEL_SETTINGS_PATH,
  className,
}: GoogleContactsSettingsPanelProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isPending, startOAuth, disconnect, enqueueBackfill } = useGoogleContactsSettings(
    organizationId,
    { enabled: Boolean(organizationId) && enabled },
  );

  const oauthConnected = data?.oauthConnected ?? false;
  const connection = data?.connection;

  useEffect(() => {
    const connected = searchParams.get("connected");
    const oauthError = searchParams.get("oauth_error");
    if (connected === "1") {
      toast.success(t("omnichannel.settings.googleContacts.connectedToast"));
      searchParams.delete("connected");
      setSearchParams(searchParams, { replace: true });
    }
    if (oauthError) {
      toast.error(
        t("omnichannel.settings.googleContacts.oauthErrorToast", { message: oauthError }),
      );
      searchParams.delete("oauth_error");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, t]);

  if (isPending) {
    return (
      <div className={cn("space-y-3", className)}>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2">
        <p className="text-sm font-medium">
          {t("omnichannel.settings.googleContacts.statusTitle", "Status koneksi")}
        </p>
        {oauthConnected ? (
          <>
            <p className="text-sm text-muted-foreground">
              {t("omnichannel.settings.googleContacts.connectedAs", "Terhubung sebagai")}{" "}
              <span className="font-medium text-foreground">
                {connection?.google_account_email ?? "—"}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {t(
                "omnichannel.settings.googleContacts.syncHint",
                "Lead baru dengan nomor telepon otomatis disimpan ke Google Contacts akun ini. Email yang menyusul akan memperbarui kontak yang sama.",
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("omnichannel.settings.googleContacts.stats", {
                synced: data?.syncedContacts ?? 0,
                pending: data?.pendingJobs ?? 0,
                defaultValue: `Tersinkron: ${data?.syncedContacts ?? 0} · Antrian: ${data?.pendingJobs ?? 0}`,
              })}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t(
              "omnichannel.settings.googleContacts.notConnected",
              "Belum terhubung. Hubungkan akun Google organisasi agar lead CRM tersimpan otomatis ke Google Contacts.",
            )}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {!oauthConnected ? (
          <Button
            type="button"
            disabled={startOAuth.isPending || !organizationId}
            onClick={() => startOAuth.mutate(oauthReturnPath)}
          >
            {startOAuth.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t("omnichannel.settings.googleContacts.connect", "Hubungkan Google Contacts")}
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={enqueueBackfill.isPending}
              onClick={async () => {
                try {
                  const res = await enqueueBackfill.mutateAsync();
                  toast.success(
                    t("omnichannel.settings.googleContacts.backfillOk", {
                      count: res.enqueued ?? 0,
                      defaultValue: `Antrian sync: ${res.enqueued ?? 0} lead`,
                    }),
                  );
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              {enqueueBackfill.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t(
                "omnichannel.settings.googleContacts.backfill",
                "Sync lead existing",
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={disconnect.isPending}
              onClick={async () => {
                try {
                  await disconnect.mutateAsync();
                  toast.success(t("omnichannel.settings.googleContacts.disconnectedToast"));
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              {disconnect.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("omnichannel.settings.googleContacts.disconnect", "Putuskan")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
