
import React from 'react';
import { ModernGoogleMapsSelector } from './ModernGoogleMapsSelector';

interface LocationData {
  address: string;
  formatted_address: string;
  latitude: number;
  longitude: number;
  google_place_id?: string;
}

interface GoogleMapsLocationSelectorProps {
  onLocationSelect: (location: LocationData) => void;
  initialCenter?: { lat: number; lng: number };
  height?: string;
  showAddButton?: boolean;
}

// Updated to use the modern implementation
export const GoogleMapsLocationSelector = (props: GoogleMapsLocationSelectorProps) => {
  return <ModernGoogleMapsSelector {...props} />;
};
