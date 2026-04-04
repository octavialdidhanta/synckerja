import { useState } from 'react';
import { X, MapPin, Calendar, Clock, User, FileText, Building2, Compass } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Label } from '@/shared/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { GoogleMapsLocationSelector } from '@/2-3-settings/components/GoogleMapsLocationSelector';
import { useClients } from '@/shared/hooks/organized/sales';
import { useAvailableEmployees } from '@/shared/hooks/useAvailableEmployees';
import { useLocationTypes } from '@/shared/hooks/organized/sales';
interface LocationData {
  address: string;
  formatted_address: string;
  latitude: number;
  longitude: number;
  google_place_id?: string;
}
interface VisitSchedulingModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (visitData: any) => void;
}
export const VisitSchedulingModal = ({
  open,
  onClose,
  onSave
}: VisitSchedulingModalProps) => {
  const [activeTab, setActiveTab] = useState('peta-interaktif');
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [formData, setFormData] = useState({
    locationName: '',
    locationType: 'client-site',
    clientName: '',
    salesPerson: '',
    contactPerson: '',
    phoneNumber: '',
    plannedStartTime: '',
    plannedEndTime: '',
    visitPurpose: '',
    notes: '',
    radius: '100'
  });
  const {
    clients
  } = useClients();
  const {
    data: employees = []
  } = useAvailableEmployees();
  const {
    locationTypes
  } = useLocationTypes();
  const handleLocationSelect = (location: LocationData) => {
    setSelectedLocation(location);
    setActiveTab('detail-lokasi');
  };
  const handleSave = () => {
    // Map location type to proper UUID
    let locationTypeId = null;
    if (formData.locationType === 'client-site') {
      // Find the Client Site location type UUID
      const clientSiteType = locationTypes.find(type => type.name === 'Client Site');
      locationTypeId = clientSiteType?.id || null;
    } else if (formData.locationType === 'office') {
      // Find the Office location type UUID
      const officeType = locationTypes.find(type => type.name === 'Office');
      locationTypeId = officeType?.id || null;
    } else if (formData.locationType === 'meeting-point') {
      // Find the Meeting Point location type UUID
      const meetingType = locationTypes.find(type => type.name === 'Meeting Point');
      locationTypeId = meetingType?.id || null;
    }
    const locationData = {
      name: formData.locationName || selectedLocation?.formatted_address || '',
      address: selectedLocation?.formatted_address || formData.locationName || '',
      latitude: selectedLocation?.latitude || 0,
      longitude: selectedLocation?.longitude || 0,
      radius_meters: parseInt(formData.radius) || 100,
      is_active: true,
      contact_person: formData.contactPerson || null,
      contact_phone: formData.phoneNumber || null,
      notes: formData.notes || null,
      client_id: formData.clientName && formData.clientName !== '' ? formData.clientName : null,
      is_client_location: formData.locationType === 'client-site',
      google_place_id: selectedLocation?.google_place_id || null,
      formatted_address: selectedLocation?.formatted_address || null,
      location_type_id: locationTypeId
    };
    onSave(locationData);
    onClose();
  };
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-200 bg-gradient-to-r from-brand-blue-soft via-white to-brand-blue-soft/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand-blue-soft rounded-xl">
              <MapPin className="h-6 w-6 text-brand-blue" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Jadwalkan Kunjungan Baru</h1>
              <p className="text-sm text-slate-600 mt-1">Pilih lokasi dan atur detail kunjungan</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose} 
            className="h-10 w-10 rounded-full hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            {/* Tab Navigation */}
            <div className="px-8 py-4 bg-slate-50/50 border-b border-slate-200">
              <TabsList className="grid w-full max-w-lg mx-auto grid-cols-2 h-12 bg-white border border-slate-200 shadow-sm">
                <TabsTrigger 
                  value="peta-interaktif" 
                  className="flex items-center gap-3 text-sm font-medium px-6 data-[state=active]:bg-brand-blue-soft data-[state=active]:text-brand-blue-deep data-[state=active]:border-brand-blue/25 transition-all duration-200"
                >
                  <MapPin className="h-4 w-4" />
                  Peta Interaktif
                </TabsTrigger>
                <TabsTrigger 
                  value="detail-lokasi" 
                  className="flex items-center gap-3 text-sm font-medium px-6 data-[state=active]:bg-brand-blue-soft data-[state=active]:text-brand-blue-deep data-[state=active]:border-brand-blue/25 transition-all duration-200"
                >
                  <FileText className="h-4 w-4" />
                  Detail Lokasi
                  {(selectedLocation || formData.locationName) && (
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
              {/* Peta Interaktif Tab */}
              <TabsContent value="peta-interaktif" className="h-full px-8 py-6 overflow-y-auto">
                <div className="max-w-5xl mx-auto space-y-6">
                  {/* Search Instructions */}
                  <div className="bg-gradient-to-r from-brand-blue-soft to-brand-blue-soft/80 p-6 rounded-xl border border-brand-blue/25">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-brand-blue-soft rounded-lg">
                        <Compass className="h-5 w-5 text-brand-blue" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-brand-blue-deep mb-2">Pilih Lokasi dengan Google Maps</h3>
                        <p className="text-brand-blue-deep text-sm leading-relaxed">
                          Gunakan kotak pencarian di bawah atau klik langsung pada peta untuk memilih lokasi yang tepat. 
                          Pastikan lokasi yang dipilih sudah sesuai dengan alamat yang diinginkan.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Google Maps Container */}
                  <div className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden shadow-lg">
                    <div className="p-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                      <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-brand-blue" />
                        Peta Lokasi
                      </h3>
                    </div>
                    
                    <div className="relative">
                      <GoogleMapsLocationSelector 
                        onLocationSelect={handleLocationSelect} 
                        initialCenter={{
                          lat: -6.2088,
                          lng: 106.8456
                        }} 
                        height="450px" 
                        showAddButton={false} 
                      />
                    </div>
                  </div>

                  {/* Location Status */}
                  <div className={`p-6 rounded-xl border-2 transition-all duration-300 ${
                    selectedLocation 
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' 
                      : 'bg-gradient-to-r from-slate-50 to-gray-50 border-slate-200'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`w-4 h-4 rounded-full mt-1 transition-colors duration-300 ${
                          selectedLocation ? 'bg-green-500' : 'bg-slate-300'
                        }`}></div>
                        <div className="flex-1">
                          <h4 className={`font-semibold mb-2 ${
                            selectedLocation ? 'text-green-800' : 'text-slate-700'
                          }`}>
                            {selectedLocation ? 'Lokasi Berhasil Dipilih' : 'Belum Ada Lokasi Terpilih'}
                          </h4>
                          {selectedLocation ? (
                            <>
                              <p className="text-green-700 text-sm leading-relaxed mb-4">
                                {selectedLocation.formatted_address}
                              </p>
                              <div className="bg-white/60 p-4 rounded-lg border border-green-200">
                                <h5 className="font-medium text-green-800 mb-2">Koordinat Lokasi</h5>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="text-green-600">Latitude:</span>
                                    <span className="ml-2 font-mono text-green-800">
                                      {selectedLocation.latitude.toFixed(6)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-green-600">Longitude:</span>
                                    <span className="ml-2 font-mono text-green-800">
                                      {selectedLocation.longitude.toFixed(6)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : (
                            <p className="text-slate-600 text-sm">
                              Silakan pilih lokasi menggunakan pencarian atau klik pada peta
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-3 ml-6">
                        <Button 
                          variant="outline" 
                          onClick={onClose}
                          className="px-6"
                        >
                          Batal
                        </Button>
                        <Button 
                          onClick={() => selectedLocation && setActiveTab('detail-lokasi')} 
                          disabled={!selectedLocation} 
                          className="bg-primary hover:bg-primary/90 text-primary-foreground disabled:bg-slate-300 px-6"
                        >
                          {selectedLocation ? 'Lanjutkan' : 'Pilih Lokasi Dulu'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Detail Lokasi Tab */}
              <TabsContent value="detail-lokasi" className="h-full px-8 py-6 overflow-y-auto">
                <div className="max-w-5xl mx-auto">
                  {selectedLocation || formData.locationName ? (
                    <div className="space-y-8">
                      {/* Selected Location Summary */}
                      {selectedLocation && (
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border-2 border-green-200">
                          <div className="flex items-start gap-4">
                            <div className="w-3 h-3 bg-green-500 rounded-full mt-2"></div>
                            <div className="flex-1">
                              <h3 className="font-bold text-green-800 mb-2">Lokasi Terpilih</h3>
                              <p className="text-green-700 leading-relaxed mb-3">
                                {selectedLocation.formatted_address}
                              </p>
                              <p className="text-xs text-green-600 font-mono bg-white/60 px-3 py-1 rounded-md inline-block">
                                {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Form Sections */}
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        {/* Left Column */}
                        <div className="space-y-6">
                          {/* Location Information */}
                          <div className="bg-white p-6 rounded-xl border-2 border-slate-200 shadow-sm">
                            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-3">
                              <div className="p-2 bg-brand-blue-soft rounded-lg">
                                <Building2 className="h-5 w-5 text-brand-blue" />
                              </div>
                              Informasi Lokasi
                            </h3>
                            
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="location-name" className="text-sm font-semibold text-slate-700 mb-2 block">
                                  Nama Lokasi *
                                </Label>
                                <Input 
                                  id="location-name" 
                                  value={formData.locationName || selectedLocation?.formatted_address || ''} 
                                  onChange={e => setFormData({...formData, locationName: e.target.value})} 
                                  className="h-12 border-2 border-slate-200 focus:border-primary"
                                  placeholder="Masukkan nama lokasi"
                                />
                              </div>

                              <div>
                                <Label htmlFor="location-type" className="text-sm font-semibold text-slate-700 mb-2 block">
                                  Tipe Lokasi
                                </Label>
                                <Select 
                                  value={formData.locationType} 
                                  onValueChange={value => setFormData({...formData, locationType: value})}
                                >
                                  <SelectTrigger className="h-12 border-2 border-slate-200 focus:border-primary">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white border-2 border-slate-200 shadow-xl">
                                    <SelectItem value="client-site">Client Site</SelectItem>
                                    <SelectItem value="office">Office</SelectItem>
                                    <SelectItem value="meeting-room">Meeting Room</SelectItem>
                                    <SelectItem value="public-space">Public Space</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label htmlFor="radius-meter" className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                  <Compass className="h-4 w-4" />
                                  Radius Meter
                                </Label>
                                <Input 
                                  id="radius-meter" 
                                  type="number" 
                                  min="10" 
                                  max="5000" 
                                  step="10" 
                                  placeholder="100" 
                                  value={formData.radius} 
                                  onChange={e => setFormData({...formData, radius: e.target.value})} 
                                  className="h-12 border-2 border-slate-200 focus:border-primary"
                                />
                                <p className="text-xs text-slate-500 mt-2">
                                  Jarak toleransi dari lokasi kunjungan (10-5000 meter)
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Contact Information */}
                          <div className="bg-white p-6 rounded-xl border-2 border-slate-200 shadow-sm">
                            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-3">
                              <div className="p-2 bg-green-100 rounded-lg">
                                <User className="h-5 w-5 text-green-600" />
                              </div>
                              Kontak & Penanggung Jawab
                            </h3>
                            
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="contact-person" className="text-sm font-semibold text-slate-700 mb-2 block">
                                  Penanggung Jawab
                                </Label>
                                <Input 
                                  id="contact-person" 
                                  placeholder="Nama penanggung jawab" 
                                  value={formData.contactPerson} 
                                  onChange={e => setFormData({...formData, contactPerson: e.target.value})} 
                                  className="h-12 border-2 border-slate-200 focus:border-primary"
                                />
                              </div>

                              <div>
                                <Label htmlFor="phone-number" className="text-sm font-semibold text-slate-700 mb-2 block">
                                  Nomor Telepon
                                </Label>
                                <Input 
                                  id="phone-number" 
                                  placeholder="+62 123 456 789" 
                                  value={formData.phoneNumber} 
                                  onChange={e => setFormData({...formData, phoneNumber: e.target.value})} 
                                  className="h-12 border-2 border-slate-200 focus:border-primary"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-6">
                          {/* Visit Details */}
                          <div className="bg-white p-6 rounded-xl border-2 border-slate-200 shadow-sm">
                            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-3">
                              <div className="p-2 bg-purple-100 rounded-lg">
                                <User className="h-5 w-5 text-purple-600" />
                              </div>
                              Detail Kunjungan
                            </h3>
                            
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="client-name" className="text-sm font-semibold text-slate-700 mb-2 block">
                                  Klien *
                                </Label>
                                <Select 
                                  value={formData.clientName} 
                                  onValueChange={value => setFormData({...formData, clientName: value})}
                                >
                                  <SelectTrigger className="h-12 border-2 border-slate-200 focus:border-primary">
                                    <SelectValue placeholder="Pilih klien" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white border-2 border-slate-200 shadow-xl">
                                    {clients.map(client => (
                                      <SelectItem key={client.id} value={client.id}>
                                        {client.company_name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label htmlFor="sales-person" className="text-sm font-semibold text-slate-700 mb-2 block">
                                  Sales Person *
                                </Label>
                                <Select 
                                  value={formData.salesPerson} 
                                  onValueChange={value => setFormData({...formData, salesPerson: value})}
                                >
                                  <SelectTrigger className="h-12 border-2 border-slate-200 focus:border-primary">
                                    <SelectValue placeholder="Assign sales person" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white border-2 border-slate-200 shadow-xl">
                                    {employees.map(employee => (
                                      <SelectItem key={employee.id} value={employee.id}>
                                        {employee.full_name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label htmlFor="visit-purpose" className="text-sm font-semibold text-slate-700 mb-2 block">
                                  Tujuan Kunjungan *
                                </Label>
                                <Select 
                                  value={formData.visitPurpose} 
                                  onValueChange={value => setFormData({...formData, visitPurpose: value})}
                                >
                                  <SelectTrigger className="h-12 border-2 border-slate-200 focus:border-primary">
                                    <SelectValue placeholder="Pilih tujuan kunjungan" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white border-2 border-slate-200 shadow-xl">
                                    <SelectItem value="presentation">Product Presentation</SelectItem>
                                    <SelectItem value="negotiation">Contract Negotiation</SelectItem>
                                    <SelectItem value="follow-up">Follow-up Meeting</SelectItem>
                                    <SelectItem value="support">Customer Support</SelectItem>
                                    <SelectItem value="consultation">Business Consultation</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>

                          {/* Time Schedule */}
                          <div className="bg-white p-6 rounded-xl border-2 border-slate-200 shadow-sm">
                            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-3">
                              <div className="p-2 bg-orange-100 rounded-lg">
                                <Clock className="h-5 w-5 text-orange-600" />
                              </div>
                              Jadwal Waktu
                            </h3>
                            
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="planned-start" className="text-sm font-semibold text-slate-700 mb-2 block">
                                  Waktu Mulai *
                                </Label>
                                <Input 
                                  id="planned-start" 
                                  type="datetime-local" 
                                  value={formData.plannedStartTime} 
                                  onChange={e => setFormData({...formData, plannedStartTime: e.target.value})} 
                                  className="h-12 border-2 border-slate-200 focus:border-primary"
                                />
                              </div>

                              <div>
                                <Label htmlFor="planned-end" className="text-sm font-semibold text-slate-700 mb-2 block">
                                  Waktu Selesai *
                                </Label>
                                <Input 
                                  id="planned-end" 
                                  type="datetime-local" 
                                  value={formData.plannedEndTime} 
                                  onChange={e => setFormData({...formData, plannedEndTime: e.target.value})} 
                                  className="h-12 border-2 border-slate-200 focus:border-primary"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Notes Section - Full Width */}
                      <div className="bg-white p-6 rounded-xl border-2 border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-3">
                          <div className="p-2 bg-indigo-100 rounded-lg">
                            <FileText className="h-5 w-5 text-indigo-600" />
                          </div>
                          Catatan Tambahan
                        </h3>
                        <Textarea 
                          id="notes" 
                          placeholder="Catatan tambahan tentang kunjungan ini..." 
                          value={formData.notes} 
                          onChange={e => setFormData({...formData, notes: e.target.value})} 
                          className="h-24 resize-none border-2 border-slate-200 focus:border-primary"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-20">
                      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <MapPin className="h-10 w-10 text-slate-400" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 mb-3">Belum Ada Lokasi Terpilih</h3>
                      <p className="text-slate-600 mb-6 max-w-md mx-auto">
                        Silakan pilih lokasi terlebih dahulu menggunakan peta interaktif sebelum mengisi detail kunjungan
                      </p>
                      <Button 
                        onClick={() => setActiveTab('peta-interaktif')}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 h-auto"
                      >
                        <MapPin className="h-4 w-4 mr-2" />
                        Pilih Lokasi
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t-2 border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-8 py-6">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="text-sm">
              {activeTab === 'peta-interaktif' ? (
                selectedLocation ? (
                  <span className="text-green-600 font-semibold flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Lokasi sudah dipilih
                  </span>
                ) : (
                  <span className="text-slate-600">Pilih lokasi terlebih dahulu</span>
                )
              ) : (
                <span className="text-slate-600">Lengkapi semua field yang wajib diisi (*)</span>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                onClick={onClose} 
                className="px-8 py-3 h-auto border-2 border-slate-300 hover:border-slate-400"
              >
                Batal
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={!formData.clientName || !formData.salesPerson || !formData.plannedStartTime || !formData.plannedEndTime || !formData.visitPurpose} 
                className="bg-primary hover:bg-primary/90 text-primary-foreground disabled:bg-slate-300 disabled:text-slate-500 px-8 py-3 h-auto"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Jadwalkan Kunjungan
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
