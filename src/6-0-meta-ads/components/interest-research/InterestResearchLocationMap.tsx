import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
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
  pin: MapPinState | null;
  focus: MapFocusState | null;
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
      const loc = results?.[0]?.geometry?.location;
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
  { countryCode, pin, focus, onDropPin },
  ref,
) {
  const { t } = useTranslation();
  const { isLoaded, error, reload } = useGoogleMapsLoader();
  const [mapReady, setMapReady] = useState(false);
  const [focusLabel, setFocusLabel] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const previewRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const onDropPinRef = useRef(onDropPin);
  const geocodeCacheRef = useRef<{
    query: string;
    country: string;
    pos: { lat: number; lng: number };
  } | null>(null);
  onDropPinRef.current = onDropPin;

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
    if (!isLoaded || !map) return;

    if (!pin) {
      markerRef.current?.setMap(null);
      markerRef.current = null;
      return;
    }

    const position = { lat: pin.lat, lng: pin.lng };
    if (!markerRef.current) {
      markerRef.current = new window.google.maps.Marker({
        map,
        position,
        draggable: true,
      });
      markerRef.current.addListener("dragend", () => {
        const pos = markerRef.current?.getPosition();
        if (!pos) return;
        const lat = pos.lat();
        const lng = pos.lng();
        void reverseGeocodeLabel(lat, lng).then((label) => onDropPinRef.current(lat, lng, label));
      });
    } else {
      markerRef.current.setPosition(position);
    }

    syncCircle(map, circleRef, position, pin.radiusKm);
    focusMap(map, position, pin.radiusKm);
  }, [isLoaded, mapReady, pin?.lat, pin?.lng, pin?.radiusKm]);

  useEffect(() => {
    const map = mapRef.current;
    if (!isLoaded || !mapReady || !map) return;

    const clearPreview = () => {
      previewRef.current?.setMap(null);
      previewRef.current = null;
      setFocusLabel(null);
    };

    if (pin) {
      clearPreview();
      clearCountryShapes(map);
      return;
    }

    if (!focus?.query) {
      clearPreview();
      clearCountryShapes(map);
      syncCircle(map, circleRef, null, null);
      return;
    }

    if (focus.kind === "country") {
      const code = (focus.countryCode || countryCode || "ID").toUpperCase();
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
      if (!previewRef.current) {
        previewRef.current = new window.google.maps.Marker({
          map,
          position,
          title: focus.label || focus.query,
        });
      } else {
        previewRef.current.setPosition(position);
        previewRef.current.setTitle(focus.label || focus.query);
      }
      syncCircle(map, circleRef, null, null);
      setFocusLabel(focus.label || focus.query);
      void loadCountryShape(map, code);
      return;
    }

    clearCountryShapes(map);

    let cancelled = false;
    const apply = (position: { lat: number; lng: number }) => {
      if (cancelled) return;
      if (!previewRef.current) {
        previewRef.current = new window.google.maps.Marker({
          map,
          position,
          title: focus.label || focus.query,
        });
      } else {
        previewRef.current.setPosition(position);
        previewRef.current.setTitle(focus.label || focus.query);
      }
      syncCircle(map, circleRef, position, focus.radiusKm);
      focusMap(map, position, focus.radiusKm);
      setFocusLabel(
        focus.radiusKm != null
          ? `${focus.label || focus.query} · ${focus.radiusKm} km`
          : focus.label || focus.query,
      );
    };

    if (focus.lat != null && focus.lng != null) {
      apply({ lat: focus.lat, lng: focus.lng });
      return () => {
        cancelled = true;
      };
    }

    const cached = geocodeCacheRef.current;
    if (cached && cached.query === focus.query && cached.country === countryCode) {
      apply(cached.pos);
      return () => {
        cancelled = true;
      };
    }

    void geocodeQuery(focus.query, countryCode).then((pos) => {
      if (!pos || cancelled) return;
      geocodeCacheRef.current = { query: focus.query, country: countryCode, pos };
      apply(pos);
    });

    return () => {
      cancelled = true;
    };
  }, [
    isLoaded,
    mapReady,
    pin,
    countryCode,
    focus?.query,
    focus?.label,
    focus?.lat,
    focus?.lng,
    focus?.radiusKm,
    focus?.kind,
    focus?.countryCode,
  ]);

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
      {focusLabel && !pin ? (
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
