import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { MapPin, Search, Loader2, AlertCircle, Navigation } from 'lucide-react';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { useToast } from '@/shared/components/ui/use-toast';
import { ManualLocationInput } from './ManualLocationInput';

interface LocationData {
  address: string;
  formatted_address: string;
  latitude: number;
  longitude: number;
  google_place_id: string;
}

interface UnifiedLocationSelectorProps {
  onLocationSelect: (location: LocationData) => void;
  initialCenter?: { lat: number; lng: number };
  showMap?: boolean;
  defaultAddress?: string;
}

declare global {
  interface Window {
    google: any;
  }
}

export const UnifiedLocationSelector = ({ 
  onLocationSelect, 
  initialCenter = { lat: -6.2088, lng: 106.8456 }, // Jakarta default
  showMap = true,
  defaultAddress = ""
}: UnifiedLocationSelectorProps) => {
  const [searchQuery, setSearchQuery] = useState(defaultAddress);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useManualMode, setUseManualMode] = useState(true); // Default to manual mode
  const [showGoogleMaps, setShowGoogleMaps] = useState(false);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mapInstance = useRef<any>(null);
  const markerInstance = useRef<any>(null);
  const autocompleteInstance = useRef<any>(null);
  
  const { toast } = useToast();

  // Load Google Maps with improved error handling
  const loadGoogleMaps = useCallback(async () => {
    if (window.google && window.google.maps) {
      setIsGoogleMapsLoaded(true);
      setUseManualMode(false);
      return;
    }

    try {
      console.log('Attempting to load Google Maps API...');
      
      // Try to get API key from Supabase Edge Function
      const response = await fetch('/functions/v1/google-maps-key', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hamdkd2ZmamhucWxvZ2ZybHFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5MDg3NjgsImV4cCI6MjA2NTQ4NDc2OH0.Qr10qkO19ssS8ZoF7HUULGFVLX_zeFLCFYJNyI97XHg`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Invalid content type:', contentType);
        throw new Error('Edge function returned non-JSON response');
      }
      
      const data = await response.json();
      console.log('API response:', data);
      
      if (!data?.apiKey) {
        console.log('No API key available, using manual mode');
        setUseManualMode(true);
        return;
      }
      
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${data.apiKey}&libraries=places&language=id`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        console.log('Google Maps loaded successfully');
        setIsGoogleMapsLoaded(true);
        setUseManualMode(false);
        setError(null);
      };
      
      script.onerror = (err) => {
        console.error('Failed to load Google Maps script:', err);
        setUseManualMode(true);
        setError('Failed to load Google Maps');
      };
      
      document.head.appendChild(script);
    } catch (error) {
      console.error('Error loading Google Maps:', error);
      setUseManualMode(true);
      setError(error instanceof Error ? error.message : 'Unknown error loading Google Maps');
    }
  }, []);

  // Initialize autocomplete for search input
  const initializeAutocomplete = useCallback(() => {
    if (!window.google || !searchInputRef.current || !isGoogleMapsLoaded) return;

    try {
      autocompleteInstance.current = new window.google.maps.places.Autocomplete(
        searchInputRef.current,
        {
          types: ['establishment', 'geocode'],
          componentRestrictions: { country: 'ID' },
          fields: ['place_id', 'formatted_address', 'geometry', 'name']
        }
      );

      autocompleteInstance.current.addListener('place_changed', () => {
        const place = autocompleteInstance.current.getPlace();
        if (place.geometry && place.geometry.location) {
          handleLocationSelect(
            place.geometry.location.lat(),
            place.geometry.location.lng(),
            place
          );
        }
      });
    } catch (error) {
      console.error('Error initializing autocomplete:', error);
    }
  }, [isGoogleMapsLoaded]);

  // Initialize map
  const initializeMap = useCallback(() => {
    if (!mapRef.current || !window.google || mapInstance.current || !showMap) return;

    try {
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        center: initialCenter,
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      // Add click listener to map
      mapInstance.current.addListener('click', (event: any) => {
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();
        handleMapClick(lat, lng);
      });
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }, [initialCenter, showMap]);

  // Handle location selection from various sources
  const handleLocationSelect = useCallback((lat: number, lng: number, place?: any) => {
    const locationData: LocationData = {
      address: place?.name || place?.formatted_address || searchQuery || 'Lokasi Terpilih',
      formatted_address: place?.formatted_address || `${lat}, ${lng}`,
      latitude: lat,
      longitude: lng,
      google_place_id: place?.place_id || ''
    };

    setSelectedLocation(locationData);
    setSearchQuery(locationData.formatted_address);

    // Update map marker if map is available
    if (mapInstance.current && window.google) {
      if (markerInstance.current) {
        markerInstance.current.setMap(null);
      }

      markerInstance.current = new window.google.maps.Marker({
        position: { lat, lng },
        map: mapInstance.current,
        title: locationData.address,
        animation: window.google.maps.Animation.DROP
      });

      mapInstance.current.setCenter({ lat, lng });
      mapInstance.current.setZoom(17);
    }

    onLocationSelect(locationData);
  }, [searchQuery, onLocationSelect]);

  // Handle map click
  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    if (!window.google) return;

    setIsLoading(true);
    const geocoder = new window.google.maps.Geocoder();
    
    try {
      const result = await new Promise((resolve, reject) => {
        geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
          if (status === 'OK' && results[0]) {
            resolve(results[0]);
          } else {
            reject(new Error('Geocoding failed'));
          }
        });
      });

      handleLocationSelect(lat, lng, result);
    } catch (error) {
      console.error('Geocoding error:', error);
      // Fallback to coordinates only
      handleLocationSelect(lat, lng);
    } finally {
      setIsLoading(false);
    }
  }, [handleLocationSelect]);

  // Get current location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Error",
        description: "Geolocation tidak didukung oleh browser ini.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        handleLocationSelect(lat, lng);
        setIsLoading(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast({
          title: "Error",
          description: "Gagal mendapatkan lokasi saat ini. Pastikan izin lokasi telah diberikan.",
          variant: "destructive",
        });
        setIsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  useEffect(() => {
    if (showGoogleMaps) {
      loadGoogleMaps();
    }
  }, [loadGoogleMaps, showGoogleMaps]);

  useEffect(() => {
    if (isGoogleMapsLoaded && !useManualMode) {
      initializeAutocomplete();
      initializeMap();
    }
  }, [isGoogleMapsLoaded, useManualMode, initializeAutocomplete, initializeMap]);

  // If using manual mode or Google Maps failed, show manual input
  if (useManualMode) {
    return (
      <div className="space-y-4">
        <ManualLocationInput 
          onLocationSelect={onLocationSelect}
          defaultData={{
            address: defaultAddress,
            latitude: initialCenter.lat,
            longitude: initialCenter.lng
          }}
        />
        
        {!showGoogleMaps && (
          <div className="text-center">
            <Button
              variant="outline"
              onClick={() => setShowGoogleMaps(true)}
              className="text-sm"
            >
              Coba Google Maps (Opsional)
            </Button>
          </div>
        )}
        
        {error && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Google Maps tidak tersedia: {error}. Mode manual digunakan sebagai alternatif.
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Pilih Lokasi dengan Google Maps
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="space-y-2">
          <Label htmlFor="search">Cari Alamat</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                ref={searchInputRef}
                id="search"
                placeholder="Masukkan alamat atau nama tempat..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={getCurrentLocation}
              disabled={isLoading}
              title="Gunakan lokasi saat ini"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Navigation className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Map Container */}
        {showMap && (
          <div className="space-y-2">
            <Label>Peta Interaktif</Label>
            <div 
              ref={mapRef} 
              className="w-full h-64 border rounded-lg bg-gray-100"
            >
              {!isGoogleMapsLoaded && (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Memuat peta...</p>
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Klik pada peta untuk memilih lokasi
            </p>
          </div>
        )}

        {/* Selected Location Info */}
        {selectedLocation && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-medium text-green-900 mb-1">Lokasi Terpilih:</h4>
            <p className="text-sm text-green-800">{selectedLocation.formatted_address}</p>
            {selectedLocation.latitude !== 0 && selectedLocation.longitude !== 0 && (
              <p className="text-xs text-green-600 mt-1">
                Koordinat: {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
              </p>
            )}
          </div>
        )}

        {/* Fallback to Manual Mode */}
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => setUseManualMode(true)}
            className="text-sm"
          >
            Gunakan Input Manual
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
