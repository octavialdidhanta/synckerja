
import { GoogleMapsLocationSelector } from './GoogleMapsLocationSelector';

interface LocationData {
  address: string;
  formatted_address: string;
  latitude: number;
  longitude: number;
  google_place_id?: string;
}

interface InteractiveLocationMapProps {
  onLocationSelect: (location: LocationData) => void;
  initialCenter?: { lat: number; lng: number };
  height?: string;
  showAddButton?: boolean;
}

// Updated component that properly passes all props to GoogleMapsLocationSelector
export const InteractiveLocationMap = ({ 
  onLocationSelect, 
  initialCenter,
  height = "400px",
  showAddButton = true // Fixed: default to true instead of false
}: InteractiveLocationMapProps) => {
  return (
    <GoogleMapsLocationSelector
      onLocationSelect={onLocationSelect}
      initialCenter={initialCenter}
      height={height}
      showAddButton={showAddButton}
    />
  );
};
