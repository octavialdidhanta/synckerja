
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { MapPin, X } from 'lucide-react';
import { GoogleMapsLocationSelector } from './GoogleMapsLocationSelector';

interface LocationData {
  address: string;
  formatted_address: string;
  latitude: number;
  longitude: number;
  google_place_id?: string;
}

interface MapLocationSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLocationSelect: (location: LocationData) => void;
  initialCenter?: { lat: number; lng: number };
}

export const MapLocationSelector = ({
  open,
  onOpenChange,
  onLocationSelect,
  initialCenter
}: MapLocationSelectorProps) => {
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);

  const handleLocationSelect = (location: LocationData) => {
    console.log('Location selected in MapLocationSelector:', location);
    setSelectedLocation(location);
  };

  const handleConfirmLocation = () => {
    if (selectedLocation) {
      console.log('Confirming location:', selectedLocation);
      onLocationSelect(selectedLocation);
      onOpenChange(false);
      setSelectedLocation(null);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setSelectedLocation(null);
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setSelectedLocation(null);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              Pilih Lokasi dari Peta
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            Gunakan kotak pencarian atau klik langsung pada peta untuk memilih lokasi yang tepat. 
            Pastikan lokasi yang dipilih sudah sesuai dengan alamat yang diinginkan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <GoogleMapsLocationSelector
            onLocationSelect={handleLocationSelect}
            initialCenter={initialCenter}
            height="500px"
            showAddButton={false}
          />

          {/* Dialog Footer with Better UX */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-gray-500">
              {selectedLocation ? (
                <span className="text-green-600 font-medium">
                  ✓ Lokasi siap digunakan
                </span>
              ) : (
                <span>
                  Pilih lokasi terlebih dahulu
                </span>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel}>
                Batal
              </Button>
              <Button 
                onClick={handleConfirmLocation}
                disabled={!selectedLocation}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {selectedLocation ? 'Gunakan Lokasi Ini' : 'Pilih Lokasi Dulu'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
