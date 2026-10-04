import { ArrowRight, Loader2 } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { useMetaAdsAdsetAudience } from "@/meta-ads/hooks/useMetaAdsAdsetAudience";
import {
  metaAdsetAdvantageAudience,
  metaAdsetAudienceSections,
  metaAudienceSentenceLines,
  type MetaAudienceSectionKey,
} from "@/meta-ads/metrics/metaAdsetAudience";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  adsetId: string | null;
  organizationId?: string | null;
  adAccountId?: string | null;
};

const SECTION_LABELS: Record<MetaAudienceSectionKey, { key: string; fallback: string }> = {
  locations: { key: "digitalMarketing.metaAds.audienceLocations", fallback: "Locations" },
  excludedLocations: {
    key: "digitalMarketing.metaAds.audienceExcludedLocations",
    fallback: "Excluded locations",
  },
  age: { key: "digitalMarketing.metaAds.audienceAge", fallback: "Age" },
  gender: { key: "digitalMarketing.metaAds.audienceGender", fallback: "Gender" },
  includedAudiences: {
    key: "digitalMarketing.metaAds.audienceCustom",
    fallback: "Custom audiences",
  },
  excludedAudiences: {
    key: "digitalMarketing.metaAds.audienceExcludedCustom",
    fallback: "Excluded custom audiences",
  },
  detailedTargeting: {
    key: "digitalMarketing.metaAds.audienceDetailed",
    fallback: "Detailed targeting",
  },
  exclusions: { key: "digitalMarketing.metaAds.audienceExclusions", fallback: "Exclusions" },
  placements: { key: "digitalMarketing.metaAds.audiencePlacements", fallback: "Placements" },
};

export function MetaAdsAdsetAudienceSheet({
  open,
  onOpenChange,
  name,
  adsetId,
  organizationId = null,
  adAccountId = null,
}: Props) {
  const { t } = useAppTranslation();
  const query = useMetaAdsAdsetAudience({
    enabled: open,
    organizationId,
    adAccountId,
    adsetId,
  });
  const sentenceLines = metaAudienceSentenceLines(query.data?.sentence_lines);
  const sections = metaAdsetAudienceSections(query.data?.targeting);
  const advantage = metaAdsetAdvantageAudience(query.data?.targeting);
  const blocks =
    sentenceLines.length > 0
      ? sentenceLines.map((line) => ({ label: line.label, values: line.values }))
      : sections.map((section) => ({
          label: t(SECTION_LABELS[section.key].key, SECTION_LABELS[section.key].fallback),
          values: section.values,
        }));
  const loading = open && (query.isLoading || query.isFetching) && !query.data;
  const errorMessage = query.isError ? (query.error as Error).message : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        hideCloseButton
        side="right"
        className="scrollbar-hide flex w-full flex-col gap-0 overflow-x-hidden overflow-y-auto p-0 [-ms-overflow-style:none] [scrollbar-width:none] sm:max-w-lg [&::-webkit-scrollbar]:hidden"
      >
        <SheetHeader className="flex-row items-start gap-3 space-y-0 border-b border-border px-5 py-4 text-left">
          <div className="min-w-0 flex-1">
            <SheetTitle className="break-words text-base leading-snug">{name}</SheetTitle>
            <SheetDescription className="mt-1">
              {t("digitalMarketing.metaAds.audienceTitle", "Audience")}
            </SheetDescription>
          </div>
          <SheetClose className="shrink-0 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <ArrowRight className="h-5 w-5" />
            <span className="sr-only">{t("common.close", "Close")}</span>
          </SheetClose>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 px-5 py-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t("digitalMarketing.metaAds.audienceLoading", "Loading audience…")}
            </div>
          ) : errorMessage ? (
            <p className="text-sm text-red-600">{errorMessage}</p>
          ) : blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("digitalMarketing.metaAds.audienceEmpty", "No audience settings on this ad set.")}
            </p>
          ) : (
            <>
              {advantage ? (
                <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {t(
                    "digitalMarketing.metaAds.audienceAdvantage",
                    "Advantage+ audience is on. Meta can reach people beyond these settings.",
                  )}
                </p>
              ) : null}
              <dl className="space-y-4">
                {blocks.map((block) => (
                  <div key={`${block.label}-${block.values.join("|")}`}>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {block.label}
                    </dt>
                    <dd className="mt-1 space-y-1 text-sm text-foreground">
                      {block.values.map((value) => (
                        <p key={value} className="break-words">
                          {value}
                        </p>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
