import { useState, useEffect } from 'react';
import { useOptimizedOfficeLocations } from '@/2-1-employees/MyInfo/Attendance/hooks/useOptimizedAttendanceData';

// Geocoding types and service
export interface GeocodeResult {
  address: string;
  formatted_address: string;
  success: boolean;
  error?: string;
}

// Simple geocoding service using browser's reverse geocoding or fallback
const geocodingService = {
  reverseGeocode: async (lat: number, lng: number): Promise<GeocodeResult> => {
    try {
      // Using OpenStreetMap Nominatim API as a free alternative
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'ProfitLoop-App'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Geocoding request failed');
      }
      
      const data = await response.json();
      
      return {
        address: data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        formatted_address: data.display_name || `Koordinat: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        success: true
      };
    } catch (error) {
      return {
        address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        formatted_address: `Koordinat: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
};

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
  formatted_address?: string;
  geocoding_success?: boolean;
}

export interface LocationValidation {
  isValid: boolean;
  hasGoodAccuracy: boolean;
  nearestOffice?: {
    id: string;
    name: string;
    distance: number;
    allowedRadius: number;
  };
}

export const useLocationServices = () => {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [geocodingLoading, setGeocodingLoading] = useState(false);
  const { data: officeLocations } = useOptimizedOfficeLocations();

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  const reverseGeocode = async (lat: number, lng: number): Promise<GeocodeResult> => {
    setGeocodingLoading(true);
    try {
      const result = await geocodingService.reverseGeocode(lat, lng);
      return result;
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      return {
        address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        formatted_address: `Koordinat: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        success: false,
        error: 'Geocoding failed'
      };
    } finally {
      setGeocodingLoading(false);
    }
  };

  const getCurrentLocation = (): Promise<LocationData> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      setLocationLoading(true);

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };

          // Get real address using geocoding
          const geocodeResult = await reverseGeocode(coordinates.latitude, coordinates.longitude);
          
          const locationData: LocationData = {
            ...coordinates,
            address: geocodeResult.address,
            formatted_address: geocodeResult.formatted_address,
            geocoding_success: geocodeResult.success
          };
          
          setCurrentLocation(locationData);
          setLocationLoading(false);
          resolve(locationData);
        },
        (error) => {
          setLocationLoading(false);
          console.warn('Geolocation error:', error.message);
          
          // Don't reject, just provide fallback data
          const fallbackLocation: LocationData = {
            latitude: 0,
            longitude: 0,
            accuracy: 0,
            address: 'Location not available',
            formatted_address: 'Location not available',
            geocoding_success: false
          };
          
          setCurrentLocation(fallbackLocation);
          resolve(fallbackLocation);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    });
  };

  const validateLocationForAttendance = (
    location: LocationData,
    options?: { accuracyThresholdMeters?: number; requireGpsAccuracy?: boolean },
  ): LocationValidation => {
    const threshold = options?.accuracyThresholdMeters ?? 50;
    const requireGps = options?.requireGpsAccuracy ?? false;
    const hasGoodAccuracy = !requireGps || (location.accuracy > 0 && location.accuracy <= threshold);
    
    if (!officeLocations || officeLocations.length === 0) {
      return {
        isValid: false,
        hasGoodAccuracy,
      };
    }

    // Find nearest office
    let nearestOffice = null;
    let minDistance = Infinity;

    for (const office of officeLocations) {
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        office.latitude,
        office.longitude
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestOffice = {
          id: office.id,
          name: office.name,
          distance: Math.round(distance),
          allowedRadius: office.radius_meters
        };
      }
    }

    const isValid = nearestOffice ? nearestOffice.distance <= nearestOffice.allowedRadius : false;

    return {
      isValid,
      hasGoodAccuracy,
      nearestOffice: nearestOffice || undefined
    };
  };

  // REMOVED: Auto-fetch location on mount
  // This was causing unnecessary geolocation errors on every page load
  // Location will only be fetched when explicitly needed (e.g., attendance check-in)
  // useEffect(() => {
  //   getCurrentLocation().catch(() => {
  //     // Silently handle error on auto-fetch
  //   });
  // }, []);

  return {
    currentLocation,
    locationLoading,
    geocodingLoading,
    getCurrentLocation,
    validateLocationForAttendance,
    reverseGeocode
  };
};

