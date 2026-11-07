/**
 * Minimal ambient types for the Google Maps JavaScript API.
 *
 * The script is loaded at runtime (see `useGoogleMapsLoader`), so `google` is a global.
 * `@types/google.maps` is not installed; these loose declarations cover only what the app
 * uses so `google.maps.*` type-checks. Replace this file with `@types/google.maps` when the
 * package is added.
 */
declare namespace google.maps {
  const Map: any;
  type Map = any;
  const Marker: any;
  type Marker = any;
  const Circle: any;
  type Circle = any;
  const Geocoder: any;
  type Geocoder = any;
  type GeocoderRequest = any;
  type GeocoderResult = any;
  const GeocoderStatus: any;
  type GeocoderStatus = any;
  const LatLng: any;
  type LatLng = any;
  const LatLngBounds: any;
  type LatLngBounds = any;
  type MapMouseEvent = any;
  const Animation: any;
  const event: any;

  namespace places {
    const Autocomplete: any;
    type Autocomplete = any;
    const AutocompleteService: any;
    type AutocompleteService = any;
    type AutocompletePrediction = any;
    type AutocompletionRequest = any;
    const PlacesService: any;
    type PlacesService = any;
    const PlacesServiceStatus: any;
    type PlacesServiceStatus = any;
    type PlaceResult = any;
  }
}
