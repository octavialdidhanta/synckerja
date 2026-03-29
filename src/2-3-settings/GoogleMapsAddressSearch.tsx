
import { UnifiedLocationSelector } from './UnifiedLocationSelector';

interface GoogleMapsAddressSearchProps {
  onPlaceSelect: (place: {
    address: string;
    formatted_address: string;
    latitude: number;
    longitude: number;
    google_place_id: string;
  }) => void;
  placeholder?: string;
  value?: string;
  disabled?: boolean;
}

// Legacy component - redirects to UnifiedLocationSelector
export const GoogleMapsAddressSearch = ({ 
  onPlaceSelect, 
  value = "",
  disabled = false
}: GoogleMapsAddressSearchProps) => {
  return (
    <UnifiedLocationSelector
      onLocationSelect={onPlaceSelect}
      showMap={false}
      defaultAddress={value}
    />
  );
};
