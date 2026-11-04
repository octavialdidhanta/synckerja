import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCanvaSettings } from "@/canva/hooks/useCanvaSettings";

type CanvaSettingsSectionProps = {
  organizationId: string | null | undefined;
  canManage: boolean;
};

export function CanvaSettingsSection({ organizationId, canManage }: CanvaSettingsSectionProps) {
  const { t } = useAppTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isPending, startOAuth, disconnect, probe } = useCanvaSettings(organizationId);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const connected = searchParams.get("canva_connected");
    const oauthError = searchParams.get("canva_oauth_error");
    if (connected === "1") {
      toast.success(t("socialMedia.settings.canva.connectedToast", "Akun Canva terhubung."));
    }
    if (oauthError) {
      toast.error(
        t(
          "socialMedia.settings.canva.oauthErrorToast",
          "Canva menolak sambungan: {{message}}",
          { message: oauthError },
        ),
      );
    }
    if (connected || oauthError) {
      const next = new URLSearchParams(searchParams);
      next.delete("canva_connected");
      next.delete("canva_oauth_error");
      next.set("section", "canva");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, t]);

  if (isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }

  const connected = data?.oauthConnected ?? false;
  const ready = Boolean(data?.oauthConfigured && data?.encryptionReady);
  const accountLabel = data?.connection?.display_name || data?.connection?.canva_user_id || "—";

  const copyRedirect = async () => {
    if (!data?.redirectUri) return;
    try {
      await navigator.clipboard.writeText(data.redirectUri);
      setCopied(true);
    } catch {
      toast.error(t("socialMedia.settings.canva.copyFailed", "Redirect URL belum tersalin."));
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-md border border-border bg-muted/30 p-4">
        <p className="text-sm font-medium">
          {t("socialMedia.settings.canva.statusTitle", "Sambungan Canva")}
        </p>
        {connected ? (
          <p className="text-sm text-muted-foreground">
            {t("socialMedia.settings.canva.connectedAs", "Terhubung sebagai")}{" "}
            <span className="font-medium text-foreground">{accountLabel}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t(
              "socialMedia.settings.canva.notConnected",
              "Belum terhubung. Owner atau admin menghubungkan satu akun Canva. Desain yang nanti dibuat karyawan AI masuk ke akun itu.",
            )}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {t(
            "socialMedia.settings.canva.foundationHint",
            "Sambungan ini dipakai saat carousel karyawan AI disetujui. Uji MCP hanya memeriksa daftar alat.",
          )}
        </p>
        {data?.connection?.last_error ? (
          <p className="text-xs text-destructive">{data.connection.last_error}</p>
        ) : null}
      </div>

      {!ready ? (
        <div className="space-y-1 rounded-md border border-border p-4 text-sm text-muted-foreground">
          <p>
            {t(
              "socialMedia.settings.canva.serverMissing",
              "Server belum punya CANVA_CLIENT_ID, CANVA_CLIENT_SECRET, dan CANVA_CONFIG_ENCRYPTION_KEY.",
            )}
          </p>
          <p>
            {t(
              "socialMedia.settings.canva.portalHint",
              "Di Canva Developer Portal, nyalakan Canva MCP, aktifkan scope di bawah, lalu daftarkan redirect URL ini.",
            )}
          </p>
        </div>
      ) : null}

      <div className="space-y-2 rounded-md border border-border p-4">
        <p className="text-xs font-medium text-foreground">Redirect URL</p>
        <p className="break-all font-mono text-xs text-muted-foreground">{data?.redirectUri || "—"}</p>
        <Button type="button" variant="secondary" disabled={!data?.redirectUri} onClick={() => void copyRedirect()}>
          {copied
            ? t("socialMedia.settings.canva.copied", "Tersalin")
            : t("socialMedia.settings.canva.copy", "Salin redirect URL")}
        </Button>
        <p className="text-xs text-muted-foreground">
          Scope: {data?.requiredScopes || "profile:read design:content:read design:content:write"}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {!connected ? (
          <Button
            type="button"
            disabled={!canManage || !ready || startOAuth.isPending || !organizationId}
            onClick={() => startOAuth.mutate()}
          >
            {startOAuth.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("socialMedia.settings.canva.connect", "Hubungkan Canva")}
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={!canManage || probe.isPending}
              onClick={() => probe.mutate()}
            >
              {probe.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("socialMedia.settings.canva.probe", "Uji MCP Canva")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!canManage || disconnect.isPending}
              onClick={() => disconnect.mutate()}
            >
              {t("socialMedia.settings.canva.disconnect", "Putuskan")}
            </Button>
          </>
        )}
      </div>

      {!canManage ? (
        <p className="text-xs text-muted-foreground">
          {t("socialMedia.settings.canva.ownerOnly", "Hanya owner atau admin yang bisa menghubungkan akun Canva.")}
        </p>
      ) : null}

      {probe.data ? (
        <div className="rounded-md border border-border p-4 text-sm">
          {probe.data.ok ? (
            <p>
              {t(
              "socialMedia.settings.canva.probeOk",
              "MCP menjawab. {{count}} tool tersedia.",
              { count: probe.data.toolCount ?? 0 },
            )}
            </p>
          ) : (
            <p className="text-destructive">{probe.data.error || "probe_failed"}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
