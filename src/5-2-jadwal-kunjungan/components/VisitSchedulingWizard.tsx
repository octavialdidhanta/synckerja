import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { WizardProgress } from '../wizard/WizardProgress';
import { LocationStepWizard } from '../wizard/LocationStepWizard';
import { ContactStepWizard } from '../wizard/ContactStepWizard';
import { ScheduleStepWizard } from '../wizard/ScheduleStepWizard';
import { ReviewStepWizard } from '../wizard/ReviewStepWizard';
import { parseVisitPartyKey } from '@/shared/lib/sales/visitParty';

interface LocationData {
  address: string;
  formatted_address: string;
  latitude: number;
  longitude: number;
  google_place_id?: string;
}

interface VisitData {
  // Location info
  selectedLocation: LocationData | null;
  locationName: string;
  locationType: string;
  radius: string;
  
  // Contact info
  clientName: string;
  contactPerson: string;
  phoneNumber: string;
  salesPerson: string;
  
  // Schedule info
  plannedStartTime: string;
  plannedEndTime: string;
  visitPurpose: string;
  notes: string;
}

interface VisitSchedulingWizardProps {
  open: boolean;
  onClose: () => void;
  onSave: (visitData: any) => void;
}

export const VisitSchedulingWizard = ({
  open,
  onClose,
  onSave
}: VisitSchedulingWizardProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [visitData, setVisitData] = useState<VisitData>({
    selectedLocation: null,
    locationName: '',
    locationType: 'client-site',
    radius: '100',
    clientName: '',
    contactPerson: '',
    phoneNumber: '',
    salesPerson: '',
    plannedStartTime: '',
    plannedEndTime: '',
    visitPurpose: '',
    notes: ''
  });

  const steps = [
    { id: 1, title: 'Pilih Lokasi', subtitle: 'Tentukan lokasi kunjungan' },
    { id: 2, title: 'Info Kontak', subtitle: 'Data klien dan kontak' },
    { id: 3, title: 'Jadwalkan', subtitle: 'Waktu dan tujuan kunjungan' },
    { id: 4, title: 'Review', subtitle: 'Konfirmasi detail kunjungan' }
  ];

  const updateVisitData = (newData: Partial<VisitData>) => {
    setVisitData(prev => ({ ...prev, ...newData }));
  };

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = () => {
    const party = parseVisitPartyKey(visitData.clientName);
    const locationData = {
      name: visitData.locationName || visitData.selectedLocation?.formatted_address || '',
      address: visitData.selectedLocation?.formatted_address || visitData.locationName || '',
      latitude: visitData.selectedLocation?.latitude || 0,
      longitude: visitData.selectedLocation?.longitude || 0,
      radius_meters: parseInt(visitData.radius) || 100,
      is_active: true,
      contact_person: visitData.contactPerson || null,
      contact_phone: visitData.phoneNumber || null,
      notes: visitData.notes || null,
      client_id: party?.kind === 'client' ? party.id : null,
      lead_id: party?.kind === 'lead' ? party.id : null,
      is_client_location: true,
      google_place_id: visitData.selectedLocation?.google_place_id || null,
      formatted_address: visitData.selectedLocation?.formatted_address || null,
      planned_start_time: visitData.plannedStartTime || null,
      planned_end_time: visitData.plannedEndTime || null,
      sales_person_id: visitData.salesPerson && visitData.salesPerson !== '' ? visitData.salesPerson : null,
      visit_purpose: visitData.visitPurpose || '',
    };

    onSave(locationData);
    onClose();
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case 1:
        return visitData.selectedLocation || visitData.locationName;
      case 2:
        return Boolean(visitData.clientName && visitData.contactPerson && visitData.salesPerson);
      case 3:
        return visitData.plannedStartTime && visitData.plannedEndTime && visitData.visitPurpose;
      case 4:
        return true;
      default:
        return false;
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="flex max-h-[95vh] min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-gradient-to-r from-brand-blue-soft via-white to-brand-blue-soft/50 px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Jadwalkan Kunjungan Baru</h1>
            <p className="text-sm text-slate-600 mt-1">{steps[currentStep - 1].subtitle}</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose} 
            className="h-9 w-9 rounded-full hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Progress */}
        <WizardProgress steps={steps} currentStep={currentStep} />

        {/* Content — scroll vertikal tersembunyi; min-h-0 agar flex tidak overflow ke footer */}
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-6 py-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {currentStep === 1 && (
            <LocationStepWizard
              visitData={visitData}
              updateVisitData={updateVisitData}
            />
          )}
          {currentStep === 2 && (
            <ContactStepWizard
              visitData={visitData}
              updateVisitData={updateVisitData}
            />
          )}
          {currentStep === 3 && (
            <ScheduleStepWizard
              visitData={visitData}
              updateVisitData={updateVisitData}
            />
          )}
          {currentStep === 4 && (
            <ReviewStepWizard
              visitData={visitData}
              updateVisitData={updateVisitData}
            />
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-4">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className="px-6"
          >
            Sebelumnya
          </Button>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="px-6"
            >
              Batal
            </Button>
            
            {currentStep < steps.length ? (
              <Button
                onClick={handleNext}
                disabled={!canProceedToNext()}
                className="px-6"
              >
                Lanjutkan
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={!canProceedToNext()}
                className="bg-green-600 hover:bg-green-700 px-6"
              >
                Simpan Kunjungan
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
