
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { MapPin, Navigation, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { useToast } from '@/shared/components/ui/use-toast';

interface LocationData {
  address: string;
  formatted_address: string;
  latitude: number;
  longitude: number;
  google_place_id?: string;
}

interface ManualLocationInputProps {
  onLocationSelect: (location: LocationData) => void;
  defaultData?: {
    address: string;
    latitude: number;
    longitude: number;
  };
}

export const ManualLocationInput = ({ 
  onLocationSelect, 
  defaultData = { address: '', latitude: 0, longitude: 0 }
}: ManualLocationInputProps) => {
  const [address, setAddress] = useState(defaultData.address);
  const [latitude, setLatitude] = useState(defaultData.latitude.toString());
  const [longitude, setLongitude] = useState(defaultData.longitude.toString());
  const [isGettingCurrentLocation, setIsGettingCurrentLocation] = useState(false);
  const [isValidLocation, setIsValidLocation] = useState(false);
  
  const { toast } = useToast();

  // Validate location when coordinates change
  useEffect(() => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const isValid = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0 && address.trim() !== '';
    setIsValidLocation(isValid);
    
    if (isValid) {
      onLocationSelect({
        address: address,
        formatted_address: address,
        latitude: lat,
        longitude: lng,
        google_place_id: ''
      });
    }
  }, [address, latitude, longitude, onLocationSelect]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Error",
        description: "Geolocation tidak didukung oleh browser ini.",
        variant: "destructive",
      });
      return;
    }

    setIsGettingCurrentLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLatitude(lat.toString());
        setLongitude(lng.toString());
        if (!address) {
          setAddress(`Lokasi: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        }
        setIsGettingCurrentLocation(false);
        toast({
          title: "Success",
          description: "Lokasi saat ini berhasil didapatkan.",
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast({
          title: "Error",
          description: "Gagal mendapatkan lokasi saat ini. Pastikan izin lokasi telah diberikan.",
          variant: "destructive",
        });
        setIsGettingCurrentLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleManualSubmit = () => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    
    if (isNaN(lat) || isNaN(lng)) {
      toast({
        title: "Error",
        description: "Koordinat tidak valid. Pastikan menggunakan format angka yang benar.",
        variant: "destructive",
      });
      return;
    }

    if (!address.trim()) {
      toast({
        title: "Error",
        description: "Alamat harus diisi.",
        variant: "destructive",
      });
      return;
    }

    onLocationSelect({
      address: address,
      formatted_address: address,
      latitude: lat,
      longitude: lng,
      google_place_id: ''
    });

    toast({
      title: "Success",
      description: "Lokasi berhasil diatur.",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Input Lokasi Manual
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Address Input */}
        <div className="space-y-2">
          <Label htmlFor="address">Alamat Lokasi *</Label>
          <Input
            id="address"
            placeholder="Masukkan alamat lengkap lokasi..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />
        </div>

        {/* Coordinates Input */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="latitude">Latitude *</Label>
            <Input
              id="latitude"
              type="number"
              step="any"
              placeholder="-6.2088"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="longitude">Longitude *</Label>
            <Input
              id="longitude"
              type="number"
              step="any"
              placeholder="106.8456"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={getCurrentLocation}
            disabled={isGettingCurrentLocation}
            className="flex-1"
          >
            {isGettingCurrentLocation ? (
              <>
                <Navigation className="h-4 w-4 mr-2 animate-spin" />
                Mendapatkan Lokasi...
              </>
            ) : (
              <>
                <Navigation className="h-4 w-4 mr-2" />
                Gunakan Lokasi Saat Ini
              </>
            )}
          </Button>
          <Button
            type="button"
            onClick={handleManualSubmit}
            disabled={!isValidLocation}
            className="flex-1"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Konfirmasi Lokasi
          </Button>
        </div>

        {/* Status Display */}
        {isValidLocation && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>Lokasi Valid:</strong> {address}
              <br />
              <span className="text-sm text-green-600">
                Koordinat: {parseFloat(latitude).toFixed(6)}, {parseFloat(longitude).toFixed(6)}
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Help Text */}
        <div className="text-sm text-gray-500 space-y-1">
          <p><strong>Tips:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>Gunakan Google Maps untuk mendapatkan koordinat yang akurat</li>
            <li>Klik kanan pada lokasi di Google Maps → pilih koordinat untuk menyalin</li>
            <li>Atau gunakan tombol "Gunakan Lokasi Saat Ini" jika Anda berada di lokasi kantor</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
