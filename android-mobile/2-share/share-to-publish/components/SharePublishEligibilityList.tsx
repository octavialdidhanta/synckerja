import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

const REASON_KEYS: Record<string, string> = {
  post_date: "share.publish.eligibility.postDate",
  approved: "share.publish.eligibility.approved",
  production_approved: "share.publish.eligibility.productionApproved",
  content_type_reel: "share.publish.eligibility.reel",
  google_drive_link: "share.publish.eligibility.driveLink",
  google_drive_file: "share.publish.eligibility.driveFileLink",
  service_id: "share.publish.eligibility.service",
};

type Props = {
  missing: string[];
  eligible: boolean;
  targetCount: number;
  ownerBypass?: boolean;
};

export function SharePublishEligibilityList({
  missing,
  eligible,
  targetCount,
  ownerBypass = false,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="rounded-xl border border-border/70 bg-white p-2.5">
      <p className="text-xs font-medium text-muted-foreground">
        {t("share.publish.eligibility.title", "Publish readiness")}
      </p>
      <p
        className={cn(
          "mt-1 text-sm font-semibold",
          eligible ? "text-emerald-700" : "text-amber-700",
        )}
      >
        {eligible
          ? t("share.publish.eligibility.ready", "Ready to schedule / post now")
          : t(
              "share.publish.eligibility.waiting",
              "Video can be saved; schedule/post waits until all rules pass",
            )}
      </p>
      {ownerBypass && eligible ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {t(
            "share.publish.eligibility.ownerBypassHint",
            "As Owner, concept and production approval are applied automatically when you schedule or post.",
          )}
        </p>
      ) : null}
      {!eligible && missing.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
          {missing.map((key) => (
            <li key={key}>
              {t(REASON_KEYS[key] ?? key, key)}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">
        {t("share.publish.eligibility.targets", "{{count}} required platform account(s)", {
          count: targetCount,
        })}
      </p>
    </div>
  );
}
