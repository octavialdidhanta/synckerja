
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Separator } from '@/shared/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Loader2, MapPin, MoreVertical, Settings, Plus, Edit } from 'lucide-react';
import { useOfficeLocations, useLocationTypes, useClients } from '@/features/2-3-settings/hooks/useLocationManagement';
import { ManualLocationInput } from '../components/ManualLocationInput';
import { LocationTypesCRUD } from '../components/LocationTypesCRUD';

interface AddOfficeLocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLocationAdded?: () => void;
}

export const AddOfficeLocationModal = ({ open, onOpenChange, onLocationAdded }: AddOfficeLocationModalProps) => {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    latitude: 0,
    longitude: 0,
    radius_meters: 100,
    google_place_id: '',
    formatted_address: '',
    contact_person: '',
    contact_phone: '',
    notes: '',
    location_type_id: null as string | null,
    client_id: null as string | null,
    is_client_location: false,
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [locationSelected, setLocationSelected] = useState(false);
  const [showLocationTypesCRUD, setShowLocationTypesCRUD] = useState(false);
  
  const { addLocation } = useOfficeLocations();
  const { locationTypes, loading: locationTypesLoading } = useLocationTypes();
  const { clients, loading: clientsLoading } = useClients();

  const handleLocationSelect = (location: {
    address: string;
    formatted_address: string;
    latitude: number;
    longitude: number;
    google_place_id?: string;
  }) => {
    setFormData(prev => ({
      ...prev,
      address: location.formatted_address || location.address,
      formatted_address: location.formatted_address || location.address,
      latitude: location.latitude,
      longitude: location.longitude,
      google_place_id: location.google_place_id || '',
      name: prev.name || location.address,
    }));
    setLocationSelected(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!locationSelected || formData.latitude === 0 || formData.longitude === 0) {
      return;
    }

    setLoading(true);

    // Clean data before sending - ensure null values for optional UUID fields
    const cleanedData = {
      ...formData,
      location_type_id: formData.location_type_id === 'none' ? null : formData.location_type_id,
      client_id: formData.client_id === 'none' ? null : formData.client_id,
      google_place_id: formData.google_place_id || null,
      contact_person: formData.contact_person || null,
      contact_phone: formData.contact_phone || null,
      notes: formData.notes || null,
    };

    console.log('Submitting location data:', cleanedData);

    const result = await addLocation(cleanedData);
    
    if (result) {
      // Reset form
      setFormData({
        name: '',
        address: '',
        latitude: 0,
        longitude: 0,
        radius_meters: 100,
        google_place_id: '',
        formatted_address: '',
        contact_person: '',
        contact_phone: '',
        notes: '',
        location_type_id: null,
        client_id: null,
        is_client_location: false,
        is_active: true,
      });
      setLocationSelected(false);
      onLocationAdded?.();
      onOpenChange(false);
    }
    
    setLoading(false);
  };

  const handleCancel = () => {
    // Reset form
    setFormData({
      name: '',
      address: '',
      latitude: 0,
      longitude: 0,
      radius_meters: 100,
      google_place_id: '',
      formatted_address: '',
      contact_person: '',
      contact_phone: '',
      notes: '',
      location_type_id: null,
      client_id: null,
      is_client_location: false,
      is_active: true,
    });
    setLocationSelected(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Tambah Lokasi Kantor Baru
          </DialogTitle>
          <DialogDescription>
            Tambahkan lokasi kantor baru untuk sistem absensi. Masukkan koordinat lokasi secara manual.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Manual Location Input Section */}
          <div className="space-y-4">
            <ManualLocationInput 
              onLocationSelect={handleLocationSelect}
              defaultData={{
                address: formData.address,
                latitude: formData.latitude,
                longitude: formData.longitude
              }}
            />
          </div>

          <Separator />

          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="name">Nama Lokasi *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="contoh: Kantor Pusat Jakarta"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location_type" className="flex items-center justify-between">
                Tipe Lokasi
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2" align="end">
                    <div className="space-y-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start h-8"
                        onClick={() => {
                          console.log('Add New Type clicked');
                          setShowLocationTypesCRUD(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add New Type
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start h-8"
                        onClick={() => {
                          console.log('Edit Types clicked');
                          setShowLocationTypesCRUD(true);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Types
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start h-8"
                        onClick={() => {
                          console.log('Manage All Types clicked');
                          setShowLocationTypesCRUD(true);
                        }}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Manage All Types
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </Label>
              <Select
                value={formData.location_type_id || "none"}
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  location_type_id: value === "none" ? null : value 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih tipe lokasi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak ada tipe</SelectItem>
                  {locationTypesLoading ? (
                    <SelectItem value="loading" disabled>
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </div>
                    </SelectItem>
                  ) : locationTypes.length > 0 ? (
                    locationTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-data" disabled>
                      Tidak ada tipe lokasi
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="radius">Radius Absensi (meter)</Label>
              <Input
                id="radius"
                type="number"
                value={formData.radius_meters}
                onChange={(e) => setFormData(prev => ({ ...prev, radius_meters: parseInt(e.target.value) || 100 }))}
                min="10"
                max="1000"
              />
              <p className="text-xs text-gray-500">
                Jarak maksimal untuk check-in/out dari lokasi ini
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="client">Klien (Opsional)</Label>
              <Select
                value={formData.client_id || "none"}
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  client_id: value === "none" ? null : value,
                  is_client_location: value !== "none" && value !== null
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih klien" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak ada klien</SelectItem>
                  {clientsLoading ? (
                    <SelectItem value="loading" disabled>
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </div>
                    </SelectItem>
                  ) : clients.length > 0 ? (
                    clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.company_name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-clients" disabled>
                      Tidak ada klien tersedia
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_person">Penanggung Jawab</Label>
              <Input
                id="contact_person"
                value={formData.contact_person || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                placeholder="Nama penanggung jawab"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_phone">Nomor Telepon</Label>
              <Input
                id="contact_phone"
                value={formData.contact_phone || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                placeholder="+62 123 456 789"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Catatan</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Catatan tambahan tentang lokasi ini..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              Batal
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !locationSelected}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Menambahkan...
                </>
              ) : (
                'Tambah Lokasi'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Location Types CRUD Modal */}
      <Dialog open={showLocationTypesCRUD} onOpenChange={setShowLocationTypesCRUD}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Location Types</DialogTitle>
          </DialogHeader>
          <LocationTypesCRUD />
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};
