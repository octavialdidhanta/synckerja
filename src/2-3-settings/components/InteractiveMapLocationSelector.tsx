
import React from 'react';
import { GoogleMapsLocationSelector } from './GoogleMapsLocationSelector';

interface LocationData {
  address: string;
  formatted_address: string;
  latitude: number;
  longitude: number;
  google_place_id?: string;
}

interface InteractiveMapLocationSelectorProps {
  onLocationSelect: (location: LocationData) => void;
  initialCenter?: { lat: number; lng: number };
  height?: string;
  showAddButton?: boolean;
}

// Updated component that now uses real Google Maps
export const InteractiveMapLocationSelector = (props: InteractiveMapLocationSelectorProps) => {
  return <GoogleMapsLocationSelector {...props} />;
};
