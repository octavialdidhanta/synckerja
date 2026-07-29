import { formatDate } from "@/shared/utils/dateFormatter";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { ShareableSocialMediaPlan } from "../lib/buildSharePlanQuery";

type Props = {
  plan: ShareableSocialMediaPlan;
};

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.02em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value?.trim() || "-"}</p>
    </div>
  );
}

export function SharePublishPlanDetailCard({ plan }: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="rounded-xl border border-border/70 bg-white p-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">
            {t("share.publish.selectedPlan", "Selected plan")}
          </p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">
            {plan.title?.trim() || "(Untitled plan)"}
          </p>
        </div>
        <span className="rounded-full bg-primary/8 px-2 py-1 text-[11px] font-medium text-primary">
          {plan.production_approved
            ? t("share.publish.badges.productionApproved", "Production approved")
            : t("share.publish.badges.awaitingProduction", "Awaiting production")}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <DetailItem
          label={t("share.publish.fields.postDate", "Planned upload date")}
          value={plan.post_date ? formatDate(plan.post_date) : "-"}
        />
        <DetailItem
          label={t("share.publish.fields.contentType", "Content type")}
          value={plan.content_type?.name}
        />
        <DetailItem
          label={t("share.publish.fields.service", "Service")}
          value={plan.service?.name}
        />
        <DetailItem
          label={t("share.publish.fields.subService", "Sub service")}
          value={plan.sub_service?.name}
        />
        <DetailItem
          label={t("share.publish.fields.contentPillar", "Content pillar")}
          value={plan.content_pillar?.name}
        />
        <DetailItem label={t("share.publish.fields.title", "Title")} value={plan.title} />
      </div>
    </div>
  );
}
