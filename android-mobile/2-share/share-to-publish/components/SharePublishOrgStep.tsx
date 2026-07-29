import { Button } from "@/mobile-app/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

type Props = {
  orgName: string | null;
  canSwitch: boolean;
  onChangeOrg: () => void;
  className?: string;
};

export function SharePublishOrgStep({ orgName, canSwitch, onChangeOrg, className }: Props) {
  const { t } = useAppTranslation();
  return (
    <div className={cn("rounded-xl border border-border/70 bg-white p-2.5", className)}>
      <p className="text-xs font-medium text-muted-foreground">
        {t("shareReceipt.currentOrganization", "Current organization")}
      </p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {orgName || "—"}
        </p>
        {canSwitch ? (
          <Button type="button" variant="outline" size="sm" onClick={onChangeOrg}>
            {t("shareReceipt.changeOrg", "Change")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
