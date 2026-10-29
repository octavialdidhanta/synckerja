import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGoogleMapsLoader } from "@/2-3-settings/hooks/useGoogleMapsLoader";

const COUNTRY_CENTER: Record<string, { lat: number; lng: number; zoom: number }> = {
  ID: { lat: -2.5, lng: 118, zoom: 5 },
  MY: { lat: 4.2, lng: 109.5, zoom: 6 },
  SG: { lat: 1.3521, lng: 103.8198, zoom: 11 },
  TH: { lat: 15.87, lng: 100.99, zoom: 6 },
  PH: { lat: 12.88, lng: 121.77, zoom: 6 },
  VN: { lat: 16.0, lng: 107.8, zoom: 6 },
};

const COUNTRY_VIEW: Record<string, { south: number; west: number; north: number; east: number; lat: number; lng: number }> = {
  ID: { south: -11.05, west: 94.75, north: 6.15, east: 141.05, lat: -2.5, lng: 118 },
  MY: { south: 0.85, west: 99.6, north: 7.4, east: 119.3, lat: 4.2, lng: 109.5 },
  SG: { south: 1.21, west: 103.6, north: 1.47, east: 104.09, lat: 1.3521, lng: 103.8198 },
  TH: { south: 5.6, west: 97.3, north: 20.5, east: 105.7, lat: 15.87, lng: 100.99 },
  PH: { south: 4.6, west: 116.9, north: 21.2, east: 126.6, lat: 12.88, lng: 121.77 },
  VN: { south: 8.4, west: 102.1, north: 23.4, east: 109.7, lat: 16.0, lng: 107.8 },
};

const COUNTRY_ISO3: Record<string, string> = {
  ID: "IDN",
  MY: "MYS",
  SG: "SGP",
  TH: "THA",
  PH: "PHL",
  VN: "VNM",
  US: "USA",
  GB: "GBR",
  AU: "AUS",
  IN: "IND",
  JP: "JPN",
};

export type MapPinState = {
  lat: number;
  lng: number;
  radiusKm: number;
};

export type MapFocusState = {
  query: string;
  label?: string;
  lat?: number | null;
  lng?: number | null;
  radiusKm?: number | null;
  kind?: "country" | "region" | "local";
  countryCode?: string | null;
};

export type MapPlaceState = {
  key: string;
  query: string;
  label: string;
  lat?: number | null;
  lng?: number | null;
  radiusKm?: number | null;
  kind?: "country" | "region" | "local";
  countryCode?: string | null;
  draggable?: boolean;
};

const CIRCLE_OPTS = {
  strokeColor: "#0369a1",
  strokeOpacity: 0.9,
  strokeWeight: 1,
  fillColor: "#0ea5e9",
  fillOpacity: 0.18,
} as const;

function focusMap(
  map: google.maps.Map,
  center: { lat: number; lng: number },
  radiusKm: number | null | undefined,
) {
  window.google.maps.event.trigger(map, "resize");
  const hasRadius = radiusKm != null && Number.isFinite(radiusKm) && radiusKm > 0;
  if (hasRadius) {
    const circle = new window.google.maps.Circle({
      center,
      radius: Math.max(1000, radiusKm * 1000),
    });
    const bounds = circle.getBounds();
    if (bounds) {
      map.fitBounds(bounds, 48);
      return;
    }
  }
  map.panTo(center);
  map.setZoom(15);
}

function syncCircle(
  map: google.maps.Map,
  circleRef: { current: google.maps.Circle | null },
  center: { lat: number; lng: number } | null,
  radiusKm: number | null | undefined,
) {
  if (!center || radiusKm == null || !Number.isFinite(radiusKm) || radiusKm <= 0) {
    circleRef.current?.setMap(null);
    circleRef.current = null;
    return;
  }
  const radiusM = Math.max(1000, radiusKm * 1000);
  if (!circleRef.current) {
    circleRef.current = new window.google.maps.Circle({
      map,
      center,
      radius: radiusM,
      ...CIRCLE_OPTS,
    });
  } else {
    circleRef.current.setCenter(center);
    circleRef.current.setRadius(radiusM);
    if (!circleRef.current.getMap()) circleRef.current.setMap(map);
  }
}

type InterestResearchLocationMapProps = {
  countryCode: string;
  pin?: MapPinState | null;
  focus?: MapFocusState | null;
  places?: MapPlaceState[];
  onDropPin: (lat: number, lng: number, label: string) => void;
};

function countryBounds(code: string): google.maps.LatLngBounds | null {
  const view = COUNTRY_VIEW[code];
  if (!view) return null;
  return new window.google.maps.LatLngBounds(
    { lat: view.south, lng: view.west },
    { lat: view.north, lng: view.east },
  );
}

function clearCountryShapes(map: google.maps.Map) {
  map.data.forEach((feature) => {
    map.data.remove(feature);
  });
}

async function loadCountryShape(map: google.maps.Map, code: string): Promise<boolean> {
  const iso3 = COUNTRY_ISO3[code];
  if (!iso3) return false;
  try {
    const res = await fetch(
      `https://cdn.jsdelivr.net/gh/johan/world.geo.json@master/countries/${iso3}.geo.json`,
    );
    if (!res.ok) return false;
    const geo = await res.json();
    clearCountryShapes(map);
    map.data.addGeoJson(geo);
    map.data.setStyle({
      fillColor: "#86efac",
      fillOpacity: 0.38,
      strokeColor: "#16a34a",
      strokeWeight: 1.25,
      clickable: false,
    });
    return true;
  } catch {
    return false;
  }
}

function pickGeocodeLocation(
  results: google.maps.GeocoderResult[] | null | undefined,
  query: string,
): google.maps.LatLng | null {
  if (!results?.length) return null;
  const head = query.split(",")[0]?.trim().toLowerCase() ?? "";
  const named =
    results.find((result) => {
      if (!head) return false;
      if (result.formatted_address.toLowerCase().includes(head)) return true;
      return result.address_components.some(
        (part) =>
          part.long_name.toLowerCase() === head ||
          part.short_name.toLowerCase() === head,
      );
    }) ?? results[0];
  return named.geometry.location;
}

function geocodeQuery(
  query: string,
  countryCode: string,
): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!window.google?.maps || query.trim().length < 2) {
      resolve(null);
      return;
    }
    const geocoder = new window.google.maps.Geocoder();
    const finish = (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
    const loc = pickGeocodeLocation(results, query);
    if (status === "OK" && loc) {
      resolve({ lat: loc.lat(), lng: loc.lng() });
      return true;
    }
    return false;
    };
    const request: google.maps.GeocoderRequest = { address: query.trim() };
    if (countryCode) request.componentRestrictions = { country: countryCode };
    geocoder.geocode(request, (results, status) => {
      if (finish(results, status)) return;
      if (!countryCode) {
        resolve(null);
        return;
      }
      geocoder.geocode({ address: query.trim() }, (retryResults, retryStatus) => {
        if (!finish(retryResults, retryStatus)) resolve(null);
      });
    });
  });
}

function reverseGeocodeLabel(lat: number, lng: number): Promise<string> {
  return new Promise((resolve) => {
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === "OK" && results?.[0]?.formatted_address) {
        resolve(results[0].formatted_address);
        return;
      }
      resolve(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    });
  });
}

export type InterestResearchLocationMapHandle = {
  dropPinAtCenter: () => void;
};

export const InterestResearchLocationMap = forwardRef<
  InterestResearchLocationMapHandle,
  InterestResearchLocationMapProps
>(function InterestResearchLocationMap(
  { countryCode, pin = null, focus = null, places, onDropPin },
  ref,
) {
  const { t } = useTranslation();
  const { isLoaded, error, reload } = useGoogleMapsLoader();
  const [mapReady, setMapReady] = useState(false);
  const [focusLabel, setFocusLabel] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const circlesRef = useRef<Map<string, google.maps.Circle>>(new Map());
  const onDropPinRef = useRef(onDropPin);
  const geocodeCacheRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());
  onDropPinRef.current = onDropPin;

  const resolvedPlaces = useMemo<MapPlaceState[]>(() => {
    if (places && places.length > 0) return places;
    if (pin) {
      return [
        {
          key: "dropped-pin",
          query: `${pin.lat},${pin.lng}`,
          label: "",
          lat: pin.lat,
          lng: pin.lng,
          radiusKm: pin.radiusKm,
          kind: "local",
          countryCode,
          draggable: true,
        },
      ];
    }
    if (focus?.query) {
      return [
        {
          key: "focus",
          query: focus.query,
          label: focus.label || focus.query,
          lat: focus.lat,
          lng: focus.lng,
          radiusKm: focus.radiusKm,
          kind: focus.kind,
          countryCode: focus.countryCode ?? countryCode,
        },
      ];
    }
    return [];
  }, [places, pin, focus, countryCode]);

  const placesSig = resolvedPlaces
    .map(
      (place) =>
        `${place.key}|${place.query}|${place.lat ?? ""}|${place.lng ?? ""}|${place.radiusKm ?? ""}|${place.kind ?? ""}|${place.draggable ? "1" : "0"}`,
    )
    .join(";");

  useImperativeHandle(ref, () => ({
    dropPinAtCenter: () => {
      const map = mapRef.current;
      const center = map?.getCenter();
      if (!center) return;
      const lat = center.lat();
      const lng = center.lng();
      void reverseGeocodeLabel(lat, lng).then((label) => onDropPinRef.current(lat, lng, label));
    },
  }));

  useEffect(() => {
    if (!isLoaded || !containerRef.current || mapRef.current) return;
    const origin = COUNTRY_CENTER[countryCode] ?? COUNTRY_CENTER.ID;
    const map = new window.google.maps.Map(containerRef.current, {
      center: { lat: origin.lat, lng: origin.lng },
      zoom: origin.zoom,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    mapRef.current = map;
    setMapReady(true);
    map.addListener("click", (event: google.maps.MapMouseEvent) => {
      const lat = event.latLng?.lat();
      const lng = event.latLng?.lng();
      if (lat == null || lng == null) return;
      void reverseGeocodeLabel(lat, lng).then((label) => onDropPinRef.current(lat, lng, label));
    });
  }, [isLoaded, countryCode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!isLoaded || !mapReady || !map) return;

    const clearOverlays = () => {
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current.clear();
      circlesRef.current.forEach((circle) => circle.setMap(null));
      circlesRef.current.clear();
    };

    const showCountry = (code: string, label: string) => {
      const box = COUNTRY_VIEW[code];
      const origin = COUNTRY_CENTER[code] ?? COUNTRY_CENTER.ID;
      const position = box
        ? { lat: box.lat, lng: box.lng }
        : { lat: origin.lat, lng: origin.lng };
      const bounds = countryBounds(code);
      window.google.maps.event.trigger(map, "resize");
      if (bounds) map.fitBounds(bounds, 28);
      else {
        map.panTo(position);
        map.setZoom(origin.zoom);
      }
      let marker = markersRef.current.get("country");
      if (!marker) {
        marker = new window.google.maps.Marker({
          map,
          position,
          title: label,
        });
        markersRef.current.set("country", marker);
      } else {
        marker.setPosition(position);
        marker.setTitle(label);
      }
      setFocusLabel(label);
      void loadCountryShape(map, code);
    };

    if (resolvedPlaces.length === 0) {
      clearOverlays();
      showCountry(countryCode.toUpperCase(), countryCode === "ID" ? "Indonesia" : countryCode);
      return;
    }

    const onlyCountry =
      resolvedPlaces.length === 1 && resolvedPlaces[0].kind === "country";
    if (onlyCountry) {
      clearOverlays();
      const place = resolvedPlaces[0];
      const code = (place.countryCode || countryCode || "ID").toUpperCase();
      showCountry(code, place.label || place.query);
      return;
    }

    const markerPlaces = resolvedPlaces.some((place) => place.kind !== "country")
      ? resolvedPlaces.filter((place) => place.kind !== "country")
      : resolvedPlaces;

    clearCountryShapes(map);
    let cancelled = false;

    const upsertMarker = (place: MapPlaceState, position: { lat: number; lng: number }) => {
      let marker = markersRef.current.get(place.key);
      if (!marker) {
        marker = new window.google.maps.Marker({
          map,
          position,
          title: place.label || place.query,
          draggable: Boolean(place.draggable),
        });
        if (place.draggable) {
          marker.addListener("dragend", () => {
            const pos = marker?.getPosition();
            if (!pos) return;
            const lat = pos.lat();
            const lng = pos.lng();
            void reverseGeocodeLabel(lat, lng).then((label) =>
              onDropPinRef.current(lat, lng, label),
            );
          });
        }
        markersRef.current.set(place.key, marker);
      } else {
        marker.setPosition(position);
        marker.setTitle(place.label || place.query);
        marker.setDraggable(Boolean(place.draggable));
      }

      const existingCircle = circlesRef.current.get(place.key) ?? null;
      const circleHolder = { current: existingCircle };
      syncCircle(map, circleHolder, position, place.radiusKm);
      if (circleHolder.current) circlesRef.current.set(place.key, circleHolder.current);
      else circlesRef.current.delete(place.key);
    };

    void (async () => {
      const resolved: Array<{ place: MapPlaceState; pos: { lat: number; lng: number } }> = [];
      for (const place of markerPlaces) {
        if (cancelled) return;
        if (place.lat != null && place.lng != null) {
          resolved.push({ place, pos: { lat: place.lat, lng: place.lng } });
          continue;
        }
        const cacheKey = `${(place.countryCode || countryCode).toUpperCase()}|${place.query}`;
        const cached = geocodeCacheRef.current.get(cacheKey);
        if (cached) {
          resolved.push({ place, pos: cached });
          continue;
        }
        const pos = await geocodeQuery(place.query, place.countryCode || countryCode);
        if (cancelled || !pos) continue;
        geocodeCacheRef.current.set(cacheKey, pos);
        resolved.push({ place, pos });
      }
      if (cancelled) return;

      const keep = new Set(resolved.map((item) => item.place.key));
      markersRef.current.forEach((marker, key) => {
        if (!keep.has(key)) {
          marker.setMap(null);
          markersRef.current.delete(key);
        }
      });
      circlesRef.current.forEach((circle, key) => {
        if (!keep.has(key)) {
          circle.setMap(null);
          circlesRef.current.delete(key);
        }
      });

      const bounds = new window.google.maps.LatLngBounds();
      for (const item of resolved) {
        upsertMarker(item.place, item.pos);
        bounds.extend(item.pos);
      }

      window.google.maps.event.trigger(map, "resize");
      if (resolved.length === 1) {
        const only = resolved[0];
        focusMap(map, only.pos, only.place.radiusKm);
        setFocusLabel(
          only.place.radiusKm != null
            ? `${only.place.label || only.place.query} · ${only.place.radiusKm} km`
            : only.place.label || only.place.query,
        );
        return;
      }
      if (resolved.length > 1) {
        map.fitBounds(bounds, 48);
        setFocusLabel(
          t("digitalMarketing.metaAds.interestGeoMapPlaces", "{{count}} locations", {
            count: resolved.length,
          }),
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, mapReady, countryCode, placesSig, resolvedPlaces, t]);

  if (error) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 bg-muted/40 p-4 text-center text-xs text-muted-foreground">
        <p>{error}</p>
        <button type="button" className="text-sky-700 underline" onClick={reload}>
          {t("digitalMarketing.metaAds.interestGeoMapRetry", "Retry map")}
        </button>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center gap-2 bg-muted/40 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("digitalMarketing.metaAds.interestGeoMapLoading", "Loading map…")}
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[280px] w-full">
      <div ref={containerRef} className="h-full min-h-[280px] w-full" />
      {focusLabel ? (
        <p className="pointer-events-none absolute left-2 top-2 rounded bg-white/90 px-2 py-1 text-[10px] font-medium text-foreground">
          {focusLabel}
        </p>
      ) : null}
      <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-white/90 px-2 py-1 text-[10px] text-muted-foreground">
        {t("digitalMarketing.metaAds.interestGeoMapHint", "Click the map or drag the pin. Circle = radius.")}
      </p>
    </div>
  );
});
