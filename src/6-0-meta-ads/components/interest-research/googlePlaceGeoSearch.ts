import type { MetaGeoLocation } from "@/meta-ads/hooks/useMetaAdsTargeting";
import { makeMapPinLocation } from "@/meta-ads/hooks/useMetaAdsTargeting";

const COUNTRY_BIAS: Record<string, { lat: number; lng: number }> = {
  ID: { lat: -6.1754, lng: 106.8272 },
  MY: { lat: 3.139, lng: 101.6869 },
  SG: { lat: 1.3521, lng: 103.8198 },
  TH: { lat: 13.7563, lng: 100.5018 },
  PH: { lat: 14.5995, lng: 120.9842 },
  VN: { lat: 10.8231, lng: 106.6297 },
};

function placesReady(): boolean {
  return Boolean(window.google?.maps?.places);
}

function placesService(): google.maps.places.PlacesService | null {
  if (!placesReady()) return null;
  let el = document.getElementById("interest-research-places-attr");
  if (!el) {
    el = document.createElement("div");
    el.id = "interest-research-places-attr";
    el.setAttribute("aria-hidden", "true");
    el.style.display = "none";
    document.body.appendChild(el);
  }
  return new window.google.maps.places.PlacesService(el);
}

function predictOnce(
  input: string,
  countryCode: string,
  types: string | null,
): Promise<google.maps.places.AutocompletePrediction[]> {
  return new Promise((resolve) => {
    if (!placesReady()) {
      resolve([]);
      return;
    }
    const bias = COUNTRY_BIAS[countryCode] ?? COUNTRY_BIAS.ID;
    const request: google.maps.places.AutocompletionRequest = {
      input,
      location: new window.google.maps.LatLng(bias.lat, bias.lng),
      radius: 80_000,
    };
    if (countryCode) request.componentRestrictions = { country: countryCode.toLowerCase() };
    if (types) request.types = [types];
    const service = new window.google.maps.places.AutocompleteService();
    service.getPlacePredictions(request, (predictions, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions?.length) {
        resolve(predictions);
        return;
      }
      resolve([]);
    });
  });
}

function predictionToGeo(
  row: google.maps.places.AutocompletePrediction,
  countryCode: string,
): MetaGeoLocation {
  const name = row.structured_formatting?.main_text || row.description;
  return {
    key: `gplace:${row.place_id}`,
    name,
    type: "place",
    country_code: countryCode,
    display_name: row.description,
    address_string: row.description,
    primary_city: row.structured_formatting?.secondary_text ?? null,
    selectable: true,
    radius_km: 2,
  };
}

export async function predictGooglePlaces(
  query: string,
  countryCode: string,
): Promise<MetaGeoLocation[]> {
  const q = query.trim();
  if (q.length < 2 || !placesReady()) return [];
  const [establishments, geocode] = await Promise.all([
    predictOnce(q, countryCode, "establishment"),
    predictOnce(q, countryCode, "geocode"),
  ]);
  const seen = new Set<string>();
  const out: MetaGeoLocation[] = [];
  for (const row of [...establishments, ...geocode]) {
    if (!row.place_id || seen.has(row.place_id)) continue;
    seen.add(row.place_id);
    out.push(predictionToGeo(row, countryCode));
  }
  if (out.length) return out.slice(0, 10);

  const svc = placesService();
  if (!svc) return [];
  return new Promise((resolve) => {
    svc.findPlaceFromQuery(
      {
        query: q,
        fields: ["place_id", "name", "formatted_address", "geometry"],
      },
      (results, status) => {
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results?.length) {
          resolve([]);
          return;
        }
        resolve(
          results.slice(0, 8).flatMap((place) => {
            const id = place.place_id;
            const loc = place.geometry?.location;
            if (!id || !loc) return [];
            const name = place.name || place.formatted_address || q;
            return [
              makeMapPinLocation({
                lat: loc.lat(),
                lng: loc.lng(),
                label: name,
                radiusKm: 2,
                countryCode,
                key: `gplace:${id}`,
                type: "place",
              }),
            ];
          }),
        );
      },
    );
  });
}

function pinFromCoords(args: {
  lat: number;
  lng: number;
  name: string;
  address?: string | null;
  placeId: string;
  countryCode: string;
  radiusKm: number;
}): MetaGeoLocation {
  const pin = makeMapPinLocation({
    lat: args.lat,
    lng: args.lng,
    label: args.name,
    radiusKm: args.radiusKm,
    countryCode: args.countryCode,
    key: args.placeId ? `gplace:${args.placeId}` : undefined,
    type: "place",
  });
  const address = args.address || args.name;
  return { ...pin, display_name: address, address_string: address };
}

function geocodeByPlaceId(
  placeId: string,
): Promise<{ lat: number; lng: number; name: string; address: string } | null> {
  return new Promise((resolve) => {
    if (!window.google?.maps || !placeId) {
      resolve(null);
      return;
    }
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ placeId }, (results, status) => {
      const row = results?.[0];
      const loc = row?.geometry?.location;
      if (status !== "OK" || !loc) {
        resolve(null);
        return;
      }
      resolve({
        lat: loc.lat(),
        lng: loc.lng(),
        name: row.address_components?.[0]?.long_name || row.formatted_address || placeId,
        address: row.formatted_address || "",
      });
    });
  });
}

function geocodeByAddress(
  address: string,
  countryCode: string,
): Promise<{ lat: number; lng: number; name: string; address: string; placeId: string } | null> {
  return new Promise((resolve) => {
    if (!window.google?.maps || address.trim().length < 3) {
      resolve(null);
      return;
    }
    const geocoder = new window.google.maps.Geocoder();
    const request: google.maps.GeocoderRequest = { address: address.trim() };
    if (countryCode) request.componentRestrictions = { country: countryCode };
    geocoder.geocode(request, (results, status) => {
      const row = results?.[0];
      const loc = row?.geometry?.location;
      if (status !== "OK" || !loc) {
        resolve(null);
        return;
      }
      resolve({
        lat: loc.lat(),
        lng: loc.lng(),
        name: row.address_components?.[0]?.long_name || row.formatted_address || address,
        address: row.formatted_address || address,
        placeId: row.place_id || "",
      });
    });
  });
}

function detailsByPlaceId(
  placeId: string,
): Promise<{ lat: number; lng: number; name: string; address: string; placeId: string } | null> {
  const svc = placesService();
  if (!svc || !placeId) return Promise.resolve(null);
  return new Promise((resolve) => {
    svc.getDetails(
      { placeId, fields: ["name", "formatted_address", "geometry", "place_id"] },
      (place, status) => {
        const coords = place?.geometry?.location;
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !coords) {
          resolve(null);
          return;
        }
        resolve({
          lat: coords.lat(),
          lng: coords.lng(),
          name: place.name || place.formatted_address || placeId,
          address: place.formatted_address || place.name || "",
          placeId: place.place_id || placeId,
        });
      },
    );
  });
}

export async function resolveGooglePlacePin(
  loc: MetaGeoLocation,
  countryCode: string,
  radiusKm = 2,
): Promise<MetaGeoLocation | null> {
  if (loc.latitude != null && loc.longitude != null) {
    return {
      ...loc,
      type: "place",
      radius_km: radiusKm,
    };
  }
  const placeId = String(loc.key).startsWith("gplace:") ? String(loc.key).slice(7) : "";
  const details = placeId ? await detailsByPlaceId(placeId) : null;
  const byId = details ?? (placeId ? await geocodeByPlaceId(placeId) : null);
  if (byId) {
    return pinFromCoords({
      lat: byId.lat,
      lng: byId.lng,
      name: loc.name || byId.name,
      address: byId.address || loc.display_name,
      placeId,
      countryCode,
      radiusKm,
    });
  }
  const query = loc.address_string || loc.display_name || loc.name;
  const byAddress = await geocodeByAddress(query, countryCode);
  if (!byAddress) return null;
  return pinFromCoords({
    lat: byAddress.lat,
    lng: byAddress.lng,
    name: loc.name || byAddress.name,
    address: byAddress.address,
    placeId: placeId || byAddress.placeId,
    countryCode,
    radiusKm,
  });
}
