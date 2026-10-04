import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatMetaDeliveryCell } from "@/meta-ads/metrics/formatMetaMetricValue";

const PILL =
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium leading-none";

export function MetaAdsDeliveryBadge({ value }: { value: unknown }) {
  const { t } = useAppTranslation();
  const status = String(value ?? "").trim();
  const label = formatMetaDeliveryCell(value, {
    active: t("digitalMarketing.metaAds.deliveryActive", "Active"),
    off: t("digitalMarketing.metaAds.deliveryOff", "Off"),
    learning: t("digitalMarketing.metaAds.deliveryLearning", "Learning"),
    learningLimited: t("digitalMarketing.metaAds.deliveryLearningLimited", "Learning limited"),
  });

  if (status === "Active") {
    return <span className={`${PILL} bg-green-100 text-green-700`}>{label}</span>;
  }
  if (status === "Off") {
    return <span className={`${PILL} bg-red-100 text-red-700`}>{label}</span>;
  }
  return label;
}
