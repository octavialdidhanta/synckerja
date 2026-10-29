import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, MapPin, Search, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";
import {
  META_CITY_RADIUS_OPTIONS_KM,
  META_GEO_RADIUS_NONE,
  META_PIN_RADIUS_OPTIONS_KM,
  clampLocationRadiusKm,
  formatAudienceSizeExact,
  isFacebookPlaceKey,
  locationAllowsRadius,
  locationRadiusMinKm,
  locationUsesPinRadius,
  makeMapPinLocation,
  useMetaAdsGeoAudienceEstimate,
  useMetaAdsGeoSearch,
  type InterestResearchFilters,
  type MetaGeoLocation,
} from "@/meta-ads/hooks/useMetaAdsTargeting";
import {
  InterestResearchLocationMap,
  type InterestResearchLocationMapHandle,
  type MapPlaceState,
} from "@/6-0-meta-ads/components/interest-research/InterestResearchLocationMap";
import { useGoogleMapsLoader } from "@/2-3-settings/hooks/useGoogleMapsLoader";
import {
  predictGooglePlaces,
  resolveGooglePlacePin,
} from "@/6-0-meta-ads/components/interest-research/googlePlaceGeoSearch";

const MAX_LOCATIONS = 10;

const TYPE_LABELS: Record<string, string> = {
  country: "Country",
  country_group: "Country group",
  region: "Region",
  city: "City",
  subcity: "District",
  medium_city: "City",
  neighborhood: "Urban Community",
  community: "Urban Community",
  zip: "Zip",
  place: "Place",
  landmark: "Place",
  address: "Address",
  geo_market: "Market",
  electoral_district: "District",
  large_geo_area: "County",
  medium_geo_area: "County",
  small_geo_area: "Area",
  metro_area: "Metro",
  subneighborhood: "Neighborhood",
  village: "Village",
  subdistrict: "Subdistrict",
  suburb: "Suburb",
  district: "District",
  town: "Town",
};

function typeLabel(loc: MetaGeoLocation): string {
  if (String(loc.key).startsWith("gplace:") || String(loc.key).startsWith("pin:")) {
    return "Map pin";
  }
  const hierarchy = (loc.geo_hierarchy_name ?? "").replace(/_/g, " ").trim();
  if (hierarchy) {
    const key = hierarchy.toLowerCase();
    if (key === "district" || key === "subcity" || key === "city district") return "District";
    return hierarchy.charAt(0).toUpperCase() + hierarchy.slice(1).toLowerCase();
  }
  if (loc.type === "place" || loc.type === "landmark") return "Place";
  return TYPE_LABELS[loc.type] ?? loc.type.replace(/_/g, " ");
}

function subtitle(loc: MetaGeoLocation): string {
  const parts: string[] = [];
  const pushUnique = (value: string | null | undefined) => {
    const v = (value ?? "").trim();
    if (!v) return;
    if (parts.some((p) => p.toLowerCase() === v.toLowerCase())) return;
    if (v.toLowerCase() === loc.name.toLowerCase()) return;
    parts.push(v);
  };
  pushUnique(loc.primary_city);
  pushUnique(loc.region);
  pushUnique(loc.country_name ?? loc.country_code);
  return parts.join(", ");
}

function locationSig(loc: MetaGeoLocation): string {
  return `${loc.type}:${loc.key}`;
}

function inheritedCityRadiusKm(locations: MetaGeoLocation[]): number | null {
  for (const loc of locations) {
    if (locationUsesPinRadius(loc) || !locationAllowsRadius(loc)) continue;
    if (loc.radius_km == null || loc.radius_km < locationRadiusMinKm(loc)) continue;
    return loc.radius_km;
  }
  return null;
}

function locationMapQuery(loc: MetaGeoLocation): string {
  const parts: string[] = [];
  const push = (value: string | null | undefined) => {
    const v = (value ?? "").trim();
    if (!v) return;
    if (parts.some((p) => p.toLowerCase() === v.toLowerCase())) return;
    parts.push(v);
  };
  push(loc.display_name || loc.name);
  push(loc.primary_city);
  push(loc.region);
  push(loc.country_name || loc.country_code);
  return parts.join(", ");
}

type InterestResearchLocationPickerProps = {
  organizationId: string;
  adAccountId: string;
  filters: InterestResearchFilters;
  onChange: (locations: MetaGeoLocation[], countryCode?: string) => void;
};

export function InterestResearchLocationPicker({
  organizationId,
  adAccountId,
  filters,
  onChange,
}: InterestResearchLocationPickerProps) {
  const countryCode = filters.countryCode;
  const locations = filters.locations ?? [];
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [queryInput, setQueryInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [googlePlaces, setGooglePlaces] = useState<MetaGeoLocation[]>([]);
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const mapHandleRef = useRef<InterestResearchLocationMapHandle | null>(null);
  const { isLoaded: mapsLoaded } = useGoogleMapsLoader();

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  const onQueryChange = (value: string) => {
    setQueryInput(value);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => setDebouncedQ(value.trim()), 300);
  };

  const audienceQuery = useMetaAdsGeoAudienceEstimate({
    organizationId,
    adAccountId,
    filters,
    enabled: open,
  });

  const geoQuery = useMetaAdsGeoSearch({
    organizationId,
    adAccountId,
    q: debouncedQ,
    countryCode,
    enabled: open,
  });

  useEffect(() => {
    const inherited = inheritedCityRadiusKm(locations);
    if (inherited == null) return;
    let changed = false;
    const next = locations.map((loc) => {
      if (locationUsesPinRadius(loc) || !locationAllowsRadius(loc)) return loc;
      if (loc.radius_km != null && loc.radius_km >= locationRadiusMinKm(loc)) return loc;
      changed = true;
      return { ...loc, radius_km: clampLocationRadiusKm(loc, inherited) };
    });
    if (changed) onChange(next);
  }, [locations, onChange]);

  useEffect(() => {
    if (!open || !mapsLoaded || debouncedQ.length < 2) {
      setGooglePlaces([]);
      return;
    }
    let cancelled = false;
    void predictGooglePlaces(debouncedQ, countryCode).then((hits) => {
      if (!cancelled) setGooglePlaces(hits);
    });
    return () => {
      cancelled = true;
    };
  }, [open, mapsLoaded, debouncedQ, countryCode]);

  const selectedSigs = useMemo(
    () => new Set(locations.map(locationSig)),
    [locations],
  );

  const triggerLabel = useMemo(() => {
    if (!locations.length) {
      return countryCode === "ID" ? "Indonesia" : countryCode;
    }
    const radius =
      locations.length === 1 && locations[0].radius_km != null
        ? ` · ${locations[0].radius_km} km`
        : "";
    if (locations.length === 1) return `${locations[0].name}${radius}`;
    return `${locations[0].name} +${locations.length - 1}`;
  }, [locations, countryCode]);

  const isRowSelected = (loc: MetaGeoLocation) =>
    locations.some((item) => item.key === loc.key);

  const toggle = async (loc: MetaGeoLocation) => {
    if (loc.selectable === false) return;
    if (isRowSelected(loc)) {
      onChange(locations.filter((item) => item.key !== loc.key));
      return;
    }
    const isPlacePin =
      String(loc.key).startsWith("gplace:") || locationUsesPinRadius(loc);
    if (!isPlacePin && locations.length >= MAX_LOCATIONS) return;
    const nextCountry =
      loc.type === "country" ? loc.key : loc.country_code ?? countryCode;
    const country = nextCountry ? String(nextCountry).toUpperCase() : undefined;

    const isMetaPlace =
      (loc.type === "place" || loc.type === "landmark") &&
      isFacebookPlaceKey(loc.key) &&
      !String(loc.key).startsWith("gplace:");
    if (isMetaPlace) {
      const withRadius: MetaGeoLocation = {
        ...loc,
        type: "place",
        radius_km: loc.radius_km ?? 2,
      };
      const withoutPins = locations.filter(
        (item) =>
          !locationUsesPinRadius(item) &&
          item.type !== "country" &&
          item.type !== "country_group",
      );
      onChange([...withoutPins, withRadius], country);
      return;
    }

    if (String(loc.key).startsWith("gplace:") || (locationUsesPinRadius(loc) && loc.latitude == null)) {
      setResolvingKey(locationSig(loc));
      try {
        const pin = String(loc.key).startsWith("gplace:")
          ? await resolveGooglePlacePin(loc, countryCode, loc.radius_km ?? 2)
          : null;
        const resolved =
          pin ??
          (loc.latitude != null && loc.longitude != null
            ? makeMapPinLocation({
                lat: loc.latitude,
                lng: loc.longitude,
                label: loc.display_name || loc.name,
                radiusKm: loc.radius_km ?? 2,
                countryCode,
                type: "place",
              })
            : null);
        if (!resolved) return;
        const withoutPins = locations.filter(
          (item) =>
            !locationUsesPinRadius(item) &&
            item.type !== "country" &&
            item.type !== "country_group",
        );
        onChange([...withoutPins, resolved], country);
      } finally {
        setResolvingKey(null);
      }
      return;
    }

    const inheritedRadius = inheritedCityRadiusKm(locations);
    const withRadius: MetaGeoLocation = locationUsesPinRadius(loc)
      ? { ...loc, radius_km: loc.radius_km ?? 2 }
      : {
          ...loc,
          radius_km:
            loc.radius_km ??
            (locationAllowsRadius(loc) && inheritedRadius != null
              ? clampLocationRadiusKm(loc, inheritedRadius)
              : null),
        };
    onChange([...locations, withRadius], country);
  };

  const remove = (loc: MetaGeoLocation) => {
    onChange(locations.filter((l) => locationSig(l) !== locationSig(loc)));
  };

  const pinLoc = locations.find(
    (loc) =>
      locationUsesPinRadius(loc) && loc.latitude != null && loc.longitude != null,
  );
  const mapPlaces = useMemo<MapPlaceState[]>(
    () =>
      locations.map((loc) => {
        const type = String(loc.type ?? "").toLowerCase();
        const kind: MapPlaceState["kind"] =
          type === "country" || type === "country_group"
            ? "country"
            : type === "region"
              ? "region"
              : "local";
        return {
          key: locationSig(loc),
          query: locationMapQuery(loc),
          label: loc.display_name || loc.name,
          lat: loc.latitude,
          lng: loc.longitude,
          radiusKm: loc.radius_km,
          kind,
          countryCode:
            kind === "country"
              ? String(loc.key).toUpperCase()
              : loc.country_code ?? countryCode,
          draggable:
            locationUsesPinRadius(loc) && loc.latitude != null && loc.longitude != null,
        };
      }),
    [locations, countryCode],
  );

  const pinLocations = locations.filter(locationUsesPinRadius);
  const radiusPinOnly = pinLocations.length > 0;
  const radiusTargets = radiusPinOnly
    ? pinLocations
    : locations.filter(locationAllowsRadius);
  const radiusOptions = radiusPinOnly ? META_PIN_RADIUS_OPTIONS_KM : META_CITY_RADIUS_OPTIONS_KM;
  const radiusValue = (() => {
    const loc = radiusTargets[0];
    if (!loc) return META_GEO_RADIUS_NONE;
    if (locationUsesPinRadius(loc)) {
      return String(clampLocationRadiusKm(loc, loc.radius_km ?? locationRadiusMinKm(loc)));
    }
    if (loc.radius_km == null || loc.radius_km < locationRadiusMinKm(loc)) {
      return META_GEO_RADIUS_NONE;
    }
    return String(clampLocationRadiusKm(loc, loc.radius_km));
  })();
  const onRadiusChange = (raw: string) => {
    onChange(
      locations.map((loc) => {
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
    );
  };

  const onDropPin = (lat: number, lng: number, label: string) => {
    const pin = makeMapPinLocation({
      lat,
      lng,
      label,
      radiusKm: pinLoc?.radius_km ?? 2,
      countryCode,
    });
    const withoutPins = locations.filter(
      (item) =>
        !locationUsesPinRadius(item) &&
        item.type !== "country" &&
        item.type !== "country_group",
    );
    if (withoutPins.length >= MAX_LOCATIONS) {
      onChange([...withoutPins.slice(0, MAX_LOCATIONS - 1), pin], countryCode);
      return;
    }
    onChange([...withoutPins, pin], countryCode);
  };

  const results = useMemo(() => {
    const meta = geoQuery.data?.locations ?? [];
    const metaKeys = new Set(meta.map(locationSig));
    const facebookPlaces = meta.filter(
      (item) =>
        (item.type === "place" || item.type === "landmark") &&
        isFacebookPlaceKey(item.key),
    );
    const facebookKeys = new Set(facebookPlaces.map(locationSig));
    const polygons = meta.filter(
      (item) => !facebookKeys.has(locationSig(item)) && !locationUsesPinRadius(item),
    );
    const metaPins = meta.filter(
      (item) => !facebookKeys.has(locationSig(item)) && locationUsesPinRadius(item),
    );
    const extra = googlePlaces.filter((item) => !metaKeys.has(locationSig(item)));
    return [...facebookPlaces, ...polygons, ...metaPins, ...extra];
  }, [geoQuery.data?.locations, googlePlaces]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex h-6 max-w-[160px] items-center gap-1 truncate border-0 bg-transparent px-0 text-left text-xs font-medium text-foreground shadow-none outline-none focus-visible:ring-0"
        >
          <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="truncate">{triggerLabel}</span>
        </button>
      </DialogTrigger>
      <DialogContent
        hideCloseButton
        className="flex h-[min(90vh,720px)] w-[min(96vw,960px)] max-w-none flex-col gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="border-b px-4 py-3 text-left">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1">
              <DialogTitle className="text-sm">
                {t("digitalMarketing.metaAds.interestGeoDialogTitle", "Location")}
              </DialogTitle>
              <DialogClose
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-gray-100 hover:text-foreground"
                aria-label={t("layout.sheetClose", "Close")}
              >
                <X className="h-4 w-4" />
              </DialogClose>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("digitalMarketing.metaAds.interestGeoEstimatedAudience", "Estimated audience size")}
              </p>
              <p className="tabular-nums text-sm font-semibold text-gray-900">
                {audienceQuery.isFetching ? (
                  <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : audienceQuery.data?.estimate ? (
                  formatAudienceSizeExact(
                    audienceQuery.data.estimate.users_lower,
                    audienceQuery.data.estimate.users_upper,
                  )
                ) : (
                  "—"
                )}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2 md:overflow-hidden">
          <div className="flex min-h-0 flex-col overflow-hidden border-b md:h-full md:border-b-0 md:border-r">
            <div className="border-b p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-8 pl-7 text-xs"
                  value={queryInput}
                  placeholder={t(
                    "digitalMarketing.metaAds.interestGeoSearchPlaceholder",
                    "Search city, zip, village…",
                  )}
                  onChange={(e) => onQueryChange(e.target.value)}
                  autoFocus
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 h-7 w-full text-xs"
                onClick={() => mapHandleRef.current?.dropPinAtCenter()}
              >
                {t("digitalMarketing.metaAds.interestGeoDropPin", "Drop pin on map")}
              </Button>
              {locations.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {locations.map((loc) => (
                    <span
                      key={locationSig(loc)}
                      className="inline-flex max-w-full items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-900"
                    >
                      <span className="truncate">{loc.name}</span>
                      <button
                        type="button"
                        className="shrink-0 rounded-full p-0.5 hover:bg-sky-100"
                        onClick={() => remove(loc)}
                        aria-label={`Remove ${loc.name}`}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">
              {debouncedQ.length < 2 ? (
                <p className="p-3 text-xs text-muted-foreground">
                  {t(
                    "digitalMarketing.metaAds.interestGeoHint",
                    "Type a city, village, or place like Elang Laut.",
                  )}
                </p>
              ) : results.length === 0 && geoQuery.isFetching ? (
                <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("digitalMarketing.metaAds.interestGeoLoading", "Searching…")}
                </div>
              ) : results.length === 0 && geoQuery.isError && googlePlaces.length === 0 ? (
                <p className="p-3 text-xs text-destructive">
                  {geoQuery.error instanceof Error
                    ? geoQuery.error.message
                    : t("digitalMarketing.metaAds.interestGeoError", "Location search failed")}
                </p>
              ) : results.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">
                  {t(
                    "digitalMarketing.metaAds.interestGeoEmptyPin",
                    "No city or place found. Drop a pin on the map.",
                  )}
                </p>
              ) : (
                <ul className="py-1">
                  {results.map((loc) => {
                    const sig = locationSig(loc);
                    const selected = isRowSelected(loc);
                    const resolving = resolvingKey === sig;
                    const isPlacePin =
                      String(loc.key).startsWith("gplace:") || locationUsesPinRadius(loc);
                    const disabled =
                      loc.selectable === false ||
                      resolving ||
                      (!selected && !isPlacePin && locations.length >= MAX_LOCATIONS);
                    const sub = subtitle(loc);
                    return (
                      <li key={sig}>
                        <button
                          type="button"
                          disabled={disabled && !selected}
                          onClick={() => toggle(loc)}
                          className={cn(
                            "flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50",
                            selected && "bg-sky-50/80",
                            disabled && !selected && "cursor-not-allowed opacity-50",
                          )}
                        >
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                            {resolving ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-700" />
                            ) : selected ? (
                              <Check className="h-3.5 w-3.5 text-sky-700" />
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-gray-900">
                              {loc.display_name || loc.name}
                            </span>
                            {sub ? (
                              <span className="block truncate text-[10px] text-muted-foreground">
                                {sub}
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {typeLabel(loc)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex h-11 shrink-0 items-center border-t p-2">
              {locations.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-full text-xs"
                  onClick={() => onChange([])}
                >
                  {t("digitalMarketing.metaAds.interestGeoClear", "Clear locations (use country only)")}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="relative min-h-[280px] bg-muted/30 md:min-h-0 md:h-full">
            {open ? (
              <InterestResearchLocationMap
                ref={mapHandleRef}
                countryCode={countryCode}
                places={mapPlaces}
                onDropPin={onDropPin}
              />
            ) : null}
            {radiusTargets.length > 0 ? (
              <div className="absolute right-2 top-2 z-10 w-[118px] rounded-md border bg-white/95 p-1.5 shadow-sm">
                <p className="px-1 pb-1 text-[10px] font-medium text-muted-foreground">
                  {t("digitalMarketing.metaAds.interestFilterRadius", "Radius")}
                </p>
                <Select value={radiusValue} onValueChange={onRadiusChange}>
                  <SelectTrigger className="h-7 border-0 bg-transparent px-1 text-xs shadow-none focus:ring-0">
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
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
