import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BookmarkPlus, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  META_CITY_RADIUS_OPTIONS_KM,
  META_GEO_RADIUS_NONE,
  META_PIN_RADIUS_OPTIONS_KM,
  META_TARGETING_AGE_MAX,
  META_TARGETING_AGE_MIN,
  clampLocationRadiusKm,
  locationAllowsRadius,
  locationRadiusMinKm,
  locationUsesPinRadius,
  sanitizeMetaAgeRange,
  type InterestResearchFilters,
  type InterestResearchGender,
  type InterestResearchPlacement,
  type MetaGeoLocation,
} from "@/meta-ads/hooks/useMetaAdsTargeting";
import { InterestResearchLocationPicker } from "@/6-0-meta-ads/components/interest-research/InterestResearchLocationPicker";
import { cn } from "@/shared/lib/utils";

const CURRENCY_BY_COUNTRY: Record<string, string> = {
  ID: "IDR",
  MY: "MYR",
  SG: "SGD",
  US: "USD",
  GB: "GBP",
  AU: "AUD",
  PH: "PHP",
  TH: "THB",
  VN: "VND",
  IN: "INR",
};

type InterestResearchFilterBarProps = {
  organizationId: string;
  adAccountId: string;
  filters: InterestResearchFilters;
  onChange: (next: InterestResearchFilters) => void;
  onSave?: () => void;
  saveDisabled?: boolean;
  savePending?: boolean;
  typeFilter?: string;
  onTypeFilterChange?: (value: string) => void;
  children?: ReactNode;
};

function ToolbarRule({ strong = false }: { strong?: boolean }) {
  return (
    <span
      className={cn("mx-1 h-4 w-px shrink-0", strong ? "bg-gray-400" : "bg-gray-200")}
      aria-hidden
    />
  );
}

const compactSelectTrigger =
  "h-6 w-auto gap-0.5 border-0 bg-transparent px-0 py-0 text-xs font-medium shadow-none focus:ring-0 focus:ring-offset-0 [&>span]:line-clamp-none [&>svg]:h-3 [&>svg]:w-3";

const META_AGE_OPTIONS = Array.from(
  { length: META_TARGETING_AGE_MAX - META_TARGETING_AGE_MIN + 1 },
  (_, i) => META_TARGETING_AGE_MIN + i,
);

const ageListClass =
  "max-h-48 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 px-2.5 text-xs leading-none first:pl-0">
      <span className="shrink-0 text-muted-foreground">{label}:</span>
      {children}
    </div>
  );
}

export function InterestResearchFilterBar({
  organizationId,
  adAccountId,
  filters,
  onChange,
  onSave,
  saveDisabled,
  savePending,
  typeFilter = "all",
  onTypeFilterChange,
  children,
}: InterestResearchFilterBarProps) {
  const { t } = useTranslation();

  const patch = (partial: Partial<InterestResearchFilters>) => {
    const next = { ...filters, ...partial };
    if (partial.countryCode && !partial.currency) {
      next.currency = CURRENCY_BY_COUNTRY[partial.countryCode] ?? filters.currency;
      if (partial.countryCode === "ID" && filters.currency !== "IDR") {
        next.dailyBudget = 150_000;
      } else if (partial.countryCode === "US" && filters.currency === "IDR") {
        next.dailyBudget = 10;
      }
    }
    onChange(next);
  };

  const onLocationsChange = (locations: MetaGeoLocation[], countryCode?: string) => {
    const next: InterestResearchFilters = { ...filters, locations };
    if (countryCode) {
      next.countryCode = countryCode;
      next.currency = CURRENCY_BY_COUNTRY[countryCode] ?? filters.currency;
    }
    onChange(next);
  };

  const radiusLocations = (filters.locations ?? []).filter(locationAllowsRadius);
  const pinLocations = (filters.locations ?? []).filter(locationUsesPinRadius);
  const radiusPinOnly = pinLocations.length > 0;
  const radiusOptions = radiusPinOnly ? META_PIN_RADIUS_OPTIONS_KM : META_CITY_RADIUS_OPTIONS_KM;
  const radiusValue = (() => {
    const loc = radiusPinOnly ? pinLocations[0] : radiusLocations[0];
    if (!loc) return META_GEO_RADIUS_NONE;
    if (locationUsesPinRadius(loc)) {
      return String(clampLocationRadiusKm(loc, loc.radius_km ?? locationRadiusMinKm(loc)));
    }
    if (loc.radius_km == null) return META_GEO_RADIUS_NONE;
    if (loc.radius_km < locationRadiusMinKm(loc)) return META_GEO_RADIUS_NONE;
    return String(clampLocationRadiusKm(loc, loc.radius_km));
  })();
  const onRadiusChange = (raw: string) => {
    onChange({
      ...filters,
      locations: (filters.locations ?? []).map((loc) => {
        if (radiusPinOnly) {
          if (!locationUsesPinRadius(loc)) return loc;
          const km = Number(raw === META_GEO_RADIUS_NONE ? locationRadiusMinKm(loc) : raw);
          if (!Number.isFinite(km)) return loc;
          return { ...loc, radius_km: clampLocationRadiusKm(loc, km) };
        }
        if (!locationAllowsRadius(loc)) return loc;
        if (raw === META_GEO_RADIUS_NONE) return { ...loc, radius_km: null };
        const km = Number(raw);
        if (!Number.isFinite(km)) return loc;
        return { ...loc, radius_km: clampLocationRadiusKm(loc, km) };
      }),
    });
  };

  return (
    <div className="scrollbar-hide nested-scroll-touch-chain mt-1.5 flex w-full min-w-0 flex-nowrap items-center overflow-x-auto overflow-y-hidden whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex shrink-0 items-center divide-x divide-gray-200">
      <FilterField label={t("digitalMarketing.metaAds.interestFilterLocation", "Location")}>
        <InterestResearchLocationPicker
          organizationId={organizationId}
          adAccountId={adAccountId}
          filters={filters}
          onChange={onLocationsChange}
        />
      </FilterField>

      {radiusPinOnly || radiusLocations.length ? (
        <FilterField label={t("digitalMarketing.metaAds.interestFilterRadius", "Radius")}>
          <Select value={radiusValue} onValueChange={onRadiusChange}>
            <SelectTrigger className={compactSelectTrigger}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {!radiusPinOnly ? (
                <SelectItem value={META_GEO_RADIUS_NONE}>
                  {t("digitalMarketing.metaAds.interestFilterRadiusOff", "Off")}
                </SelectItem>
              ) : null}
              {radiusOptions.map((km) => (
                <SelectItem key={km} value={String(km)}>
                  {km} km
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      ) : null}

      <FilterField label={t("digitalMarketing.metaAds.interestFilterGender", "Gender")}>
        <Select
          value={filters.gender}
          onValueChange={(v) => patch({ gender: v as InterestResearchGender })}
        >
          <SelectTrigger className={compactSelectTrigger}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("digitalMarketing.metaAds.interestGenderAll", "All")}</SelectItem>
            <SelectItem value="male">{t("digitalMarketing.metaAds.interestGenderMale", "Male")}</SelectItem>
            <SelectItem value="female">
              {t("digitalMarketing.metaAds.interestGenderFemale", "Female")}
            </SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label={t("digitalMarketing.metaAds.interestFilterAge", "Age")}>
        <Popover modal={false}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex h-6 items-center gap-0.5 text-xs font-medium outline-none"
              aria-label={t("digitalMarketing.metaAds.interestFilterAge", "Age")}
            >
              <span>
                {filters.ageMin} - {filters.ageMax >= META_TARGETING_AGE_MAX ? "65+" : filters.ageMax}
              </span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-2" onOpenAutoFocus={(e) => e.preventDefault()}>
            <div className="flex gap-2">
              <div className="w-16">
                <p className="mb-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Min
                </p>
                <div className={ageListClass}>
                  {META_AGE_OPTIONS.filter((n) => n <= filters.ageMax).map((n) => (
                    <button
                      key={`min-${n}`}
                      type="button"
                      className={cn(
                        "flex h-7 w-full items-center justify-center rounded text-sm",
                        n === filters.ageMin
                          ? "bg-sky-50 font-semibold text-sky-800"
                          : "text-foreground hover:bg-muted",
                      )}
                      onClick={() => patch(sanitizeMetaAgeRange(n, filters.ageMax))}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-16">
                <p className="mb-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Max
                </p>
                <div className={ageListClass}>
                  {META_AGE_OPTIONS.filter((n) => n >= filters.ageMin).map((n) => (
                    <button
                      key={`max-${n}`}
                      type="button"
                      className={cn(
                        "flex h-7 w-full items-center justify-center rounded text-sm",
                        n === filters.ageMax
                          ? "bg-sky-50 font-semibold text-sky-800"
                          : "text-foreground hover:bg-muted",
                      )}
                      onClick={() => patch(sanitizeMetaAgeRange(filters.ageMin, n))}
                    >
                      {n === META_TARGETING_AGE_MAX ? "65+" : n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </FilterField>

      <FilterField label={t("digitalMarketing.metaAds.interestFilterPlacement", "Placement")}>
        <Select
          value={filters.placement}
          onValueChange={(v) => patch({ placement: v as InterestResearchPlacement })}
        >
          <SelectTrigger className={compactSelectTrigger}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="automatic">
              {t("digitalMarketing.metaAds.interestPlaceAuto", "Automatic")}
            </SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="audience_network">Audience Network</SelectItem>
            <SelectItem value="messenger">Messenger</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>
      </div>

      {children ? (
        <>
          <ToolbarRule strong />
          <div className="flex shrink-0 items-center divide-x divide-gray-200">{children}</div>
        </>
      ) : null}

      {onTypeFilterChange ? (
        <>
          <ToolbarRule />
          <FilterField label={t("digitalMarketing.metaAds.interestFilterType", "Type")}>
            <Select value={typeFilter} onValueChange={onTypeFilterChange}>
              <SelectTrigger className={compactSelectTrigger}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("digitalMarketing.metaAds.interestFilterAll", "All types")}
                </SelectItem>
                <SelectItem value="interests">
                  {t("digitalMarketing.metaAds.interestFilterInterests", "Interests")}
                </SelectItem>
                <SelectItem value="behaviors">
                  {t("digitalMarketing.metaAds.interestFilterBehaviors", "Behaviours")}
                </SelectItem>
                <SelectItem value="demographics">
                  {t("digitalMarketing.metaAds.interestFilterDemographics", "Demographics")}
                </SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
        </>
      ) : null}

      {onSave ? (
        <>
          <ToolbarRule />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 shrink-0 px-2.5 text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
            onClick={onSave}
            disabled={saveDisabled || savePending}
          >
            {savePending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <BookmarkPlus className="mr-1 h-3.5 w-3.5" />
            )}
            {t("digitalMarketing.metaAds.interestSave", "Save")}
          </Button>
        </>
      ) : null}
    </div>
  );
}

export { CURRENCY_BY_COUNTRY };
