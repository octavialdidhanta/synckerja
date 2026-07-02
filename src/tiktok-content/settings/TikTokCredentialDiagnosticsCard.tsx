import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useTikTokCredentialDiagnostics } from "@/tiktok-content/hooks/useTikTokCredentialDiagnostics";

type Props = {
  organizationId: string | null | undefined;
};

function SlotRow({
  label,
  masked,
  matchedLabel,
  redirectUri,
  recommendation,
}: {
  label: string;
  masked: string | null;
  matchedLabel: string | null;
  redirectUri: string | null;
  recommendation: string | null;
}) {
  return (
    <div className="space-y-1 rounded-md border border-border/60 bg-muted/20 p-3 text-xs">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-muted-foreground">
        App ID: <span className="font-mono text-foreground">{masked ?? "—"}</span>
      </p>
      {matchedLabel ? <p className="text-muted-foreground">{matchedLabel}</p> : null}
      {redirectUri ? (
        <p className="break-all text-muted-foreground">
          Redirect: <span className="font-mono text-[11px]">{redirectUri}</span>
        </p>
      ) : null}
      {recommendation ? <p className="text-foreground/90">{recommendation}</p> : null}
    </div>
  );
}

export function TikTokCredentialDiagnosticsCard({ organizationId }: Props) {
  const { t } = useTranslation();
  const { data, isPending, isError, error } = useTikTokCredentialDiagnostics(organizationId);

  if (isPending) {
    return <Skeleton className="h-28 w-full" />;
  }

  if (isError) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("forbidden") || message.includes("403")) {
      return null;
    }
    return (
      <Alert variant="destructive">
        <AlertTitle>
          {t("digitalMarketing.tiktokContent.credentialDiagnosticsError", "Credential check failed")}
        </AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  return (
    <Alert>
      <AlertTitle>
        {t("digitalMarketing.tiktokContent.credentialDiagnosticsTitle", "Server credential check")}
      </AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{data.summary}</p>
        {data.content_matches_ads === true ? (
          <p className="text-amber-800 dark:text-amber-300">
            {t(
              "digitalMarketing.tiktokContent.credentialSameAppWarning",
              "CONTENT and ADS use the same App ID — expected Synkerja Content Insight + Synkerja Office as separate apps.",
            )}
          </p>
        ) : data.content_matches_ads === false ? (
          <p className="text-muted-foreground">
            {t(
              "digitalMarketing.tiktokContent.credentialDifferentApps",
              "TIKTOK_CONTENT and TIKTOK_ADS use different App IDs (expected).",
            )}
          </p>
        ) : null}
        <SlotRow
          label="TIKTOK_CONTENT_*"
          masked={data.content.client_id_masked}
          matchedLabel={data.content.matched_app_label}
          redirectUri={data.content.oauth_redirect_uri}
          recommendation={data.content.recommendation}
        />
        <SlotRow
          label="TIKTOK_CONTENT_PUBLISH_*"
          masked={data.publish.client_id_masked}
          matchedLabel={data.publish.matched_app_label}
          redirectUri={data.publish.oauth_redirect_uri}
          recommendation={data.publish.recommendation}
        />
        <SlotRow
          label="TIKTOK_ADS_*"
          masked={data.ads.client_id_masked}
          matchedLabel={data.ads.matched_app_label}
          redirectUri={data.ads.oauth_redirect_uri}
          recommendation={data.ads.recommendation}
        />
      </AlertDescription>
    </Alert>
  );
}
