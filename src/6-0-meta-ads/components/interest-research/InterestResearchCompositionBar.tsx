import { ChevronRight, Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

export type CompositionHop = {
  id: string;
  label: string;
};

export type CompositionSeedChip = {
  id: string;
  name: string;
};

type InterestResearchCompositionBarProps = {
  hops: CompositionHop[];
  seedChips?: CompositionSeedChip[];
  onJumpToHop: (index: number) => void;
  onRemoveSeed?: (id: string) => void;
  onExploreDeeper: () => void;
  canExploreDeeper: boolean;
  deeperPending?: boolean;
};

export function InterestResearchCompositionBar({
  hops,
  seedChips = [],
  onJumpToHop,
  onRemoveSeed,
  onExploreDeeper,
  canExploreDeeper,
  deeperPending,
}: InterestResearchCompositionBarProps) {
  const { t } = useTranslation();
  if (hops.length === 0 && seedChips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-violet-200/70 bg-violet-50/40 px-3 py-2 text-xs">
      <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1" aria-label="Explore path">
        {hops.map((hop, index) => (
          <span key={`${hop.id}-${index}`} className="flex items-center gap-1">
            {index > 0 ? <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" /> : null}
            <button
              type="button"
              className="max-w-[160px] truncate rounded px-1 py-0.5 text-violet-700 hover:bg-violet-100"
              onClick={() => onJumpToHop(index)}
              title={hop.label}
            >
              {hop.label}
            </button>
          </span>
        ))}
        {seedChips.length > 0 ? (
          <span className="flex flex-wrap items-center gap-1">
            {hops.length > 0 ? (
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            ) : null}
            {seedChips.map((seed) => (
              <span
                key={seed.id}
                className="inline-flex max-w-[180px] items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 font-medium text-violet-900"
                title={seed.name}
              >
                <span className="truncate">{seed.name}</span>
                {onRemoveSeed ? (
                  <button
                    type="button"
                    className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full hover:bg-violet-200"
                    aria-label={t("digitalMarketing.metaAds.interestSearchRemove", "Hapus {{q}}", {
                      q: seed.name,
                    })}
                    onClick={() => onRemoveSeed(seed.id)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </span>
            ))}
          </span>
        ) : null}
      </nav>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="h-7"
        disabled={!canExploreDeeper || deeperPending}
        onClick={onExploreDeeper}
      >
        {deeperPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
        {t("digitalMarketing.metaAds.interestExploreDeeper", "Explore deeper")}
      </Button>
    </div>
  );
}

/** Drop Meta suggestion noise: huge mobile/birthday rows. Keep demographics and behaviors. */
export function filterBroadBehaviourNoise<
  T extends { type: string; path: string[]; name: string },
>(items: T[], enabled: boolean): T[] {
  if (!enabled) return items;
  return items.filter((item) => {
    const name = item.name.toLowerCase();
    if (name.includes("facebook access") || name.includes("friends of")) return false;
    if (name.includes("frequent traveller") || name.includes("birthday in")) return false;
    return true;
  });
}
