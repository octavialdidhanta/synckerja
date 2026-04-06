import { MapPin, Compass, CheckCircle } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { GoogleMapsLocationSelector } from '@/2-3-settings/components/GoogleMapsLocationSelector';

interface LocationData {
  address: string;
  formatted_address: string;
  latitude: number;
  longitude: number;
  google_place_id?: string;
}

interface VisitData {
  selectedLocation: LocationData | null;
  locationName: string;
  locationType: string;
  radius: string;
  clientName: string;
  contactPerson: string;
  phoneNumber: string;
  salesPerson: string;
  plannedStartTime: string;
  plannedEndTime: string;
  visitPurpose: string;
  notes: string;
}

interface LocationStepWizardProps {
  visitData: VisitData;
  updateVisitData: (data: Partial<VisitData>) => void;
}

export const LocationStepWizard = ({ visitData, updateVisitData }: LocationStepWizardProps) => {
  const handleLocationSelect = (location: LocationData) => {
    updateVisitData({ 
      selectedLocation: location,
      locationName: location.formatted_address 
    });
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-6">
      {/* Instructions */}
      <div className="bg-gradient-to-r from-brand-blue-soft to-brand-blue-soft/80 p-4 rounded-xl border border-brand-blue/25">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-brand-blue-soft rounded-lg">
            <Compass className="h-5 w-5 text-brand-blue" />
          </div>
          <div>
            <h3 className="font-semibold text-brand-blue-deep mb-1">Pilih Lokasi Kunjungan</h3>
            <p className="text-brand-blue-deep text-sm">
              Gunakan peta di bawah untuk memilih lokasi yang tepat, atau masukkan alamat secara manual.
            </p>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Map Section */}
        <div className="min-w-0 space-y-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-brand-blue" />
            Peta Interaktif
          </h3>
          
          <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <GoogleMapsLocationSelector 
              onLocationSelect={handleLocationSelect} 
              initialCenter={{
                lat: -6.2088,
                lng: 106.8456
              }} 
              height="350px" 
              showAddButton={false} 
            />
          </div>
        </div>

        {/* Form Section */}
        <div className="min-w-0 space-y-4">
          <h3 className="font-semibold text-slate-800">Detail Lokasi</h3>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="location-name" className="text-sm font-medium text-slate-700">
                Nama Lokasi *
              </Label>
              <Input 
                id="location-name" 
                value={visitData.locationName} 
                onChange={e => updateVisitData({ locationName: e.target.value })} 
                className="mt-1"
                placeholder="Masukkan nama lokasi"
              />
            </div>

            <div>
              <Label htmlFor="location-type" className="text-sm font-medium text-slate-700">
                Tipe Lokasi
              </Label>
              <Select 
                value={visitData.locationType} 
                onValueChange={value => updateVisitData({ locationType: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client-site">Client Site</SelectItem>
                  <SelectItem value="office">Office</SelectItem>
                  <SelectItem value="meeting-point">Meeting Point</SelectItem>
                  <SelectItem value="public-space">Public Space</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="radius" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Compass className="h-4 w-4" />
                Radius Toleransi (meter)
              </Label>
              <Input 
                id="radius" 
                type="number" 
                min="10" 
                max="5000" 
                step="10" 
                value={visitData.radius} 
                onChange={e => updateVisitData({ radius: e.target.value })} 
                className="mt-1"
                placeholder="100"
              />
              <p className="text-xs text-slate-500 mt-1">
                Jarak toleransi dari lokasi (10-5000 meter)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Location Status */}
      {(visitData.selectedLocation || visitData.locationName) && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-green-800 mb-1">Lokasi Siap</h4>
              <p className="text-green-700 text-sm">
                {visitData.selectedLocation 
                  ? visitData.selectedLocation.formatted_address 
                  : visitData.locationName
                }
              </p>
              {visitData.selectedLocation && (
                <p className="text-xs text-green-600 mt-1 font-mono">
                  {visitData.selectedLocation.latitude.toFixed(6)}, {visitData.selectedLocation.longitude.toFixed(6)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
