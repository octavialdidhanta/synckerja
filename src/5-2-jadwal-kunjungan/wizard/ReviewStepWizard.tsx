import { MapPin, User, Calendar, Clock, FileText, Compass, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useAvailableEmployees } from '@/shared/hooks/useAvailableEmployees';
import { useVisitPartyOptions } from '@/shared/hooks/useVisitPartyOptions';

interface VisitData {
  selectedLocation: any;
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

interface ReviewStepWizardProps {
  visitData: VisitData;
  updateVisitData: (data: Partial<VisitData>) => void;
}

const purposeLabels: Record<string, string> = {
  'presentation': 'Presentasi Produk',
  'negotiation': 'Negosiasi Kontrak',
  'follow-up': 'Follow-up Meeting',
  'support': 'Dukungan Pelanggan',
  'consultation': 'Konsultasi Bisnis',
  'site-survey': 'Survey Lokasi',
  'training': 'Pelatihan',
  'maintenance': 'Maintenance'
};

const locationTypeLabels: Record<string, string> = {
  'client-site': 'Client Site',
  'office': 'Office',
  'meeting-point': 'Meeting Point',
  'public-space': 'Public Space'
};

export const ReviewStepWizard = ({ visitData }: ReviewStepWizardProps) => {
  const { findByKey } = useVisitPartyOptions();
  const { data: employees = [] } = useAvailableEmployees();
  const selectedParty = findByKey(visitData.clientName);
  const selectedEmployee = employees.find((emp) => emp.id === visitData.salesPerson);
  const clientLabel = selectedParty?.label || visitData.contactPerson || '-';
  const salesLabel = selectedEmployee?.full_name || '-';

  const formatDateTime = (dateTimeString: string) => {
    if (!dateTimeString) return '-';
    try {
      return format(new Date(dateTimeString), 'dd MMM yyyy, HH:mm', { locale: id });
    } catch {
      return dateTimeString;
    }
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-green-900 mb-1">Review Kunjungan</h3>
            <p className="text-green-700 text-sm">
              Periksa kembali semua detail sebelum menyimpan jadwal kunjungan.
            </p>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Location Information */}
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-3">
            <div className="p-2 bg-brand-blue-soft rounded-lg">
              <MapPin className="h-5 w-5 text-brand-blue" />
            </div>
            Informasi Lokasi
          </h3>
          
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Nama Lokasi</p>
              <p className="text-sm text-slate-900 mt-1">{visitData.locationName || '-'}</p>
            </div>
            
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tipe Lokasi</p>
              <p className="text-sm text-slate-900 mt-1">{locationTypeLabels[visitData.locationType] || visitData.locationType}</p>
            </div>
            
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <Compass className="h-3 w-3" />
                Radius Toleransi
              </p>
              <p className="text-sm text-slate-900 mt-1">{visitData.radius} meter</p>
            </div>
            
            {visitData.selectedLocation && (
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Alamat</p>
                <p className="text-sm text-slate-900 mt-1">{visitData.selectedLocation.formatted_address}</p>
                <p className="text-xs text-slate-500 mt-1 font-mono">
                  {visitData.selectedLocation.latitude.toFixed(6)}, {visitData.selectedLocation.longitude.toFixed(6)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Contact Information */}
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <User className="h-5 w-5 text-green-600" />
            </div>
            Informasi Kontak
          </h3>
          
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Klien</p>
              <p className="text-sm text-slate-900 mt-1">{clientLabel}</p>
            </div>
            
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Kontak Person</p>
              <p className="text-sm text-slate-900 mt-1">{visitData.contactPerson || '-'}</p>
            </div>
            
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Nomor Telepon</p>
              <p className="text-sm text-slate-900 mt-1">{visitData.phoneNumber || '-'}</p>
            </div>
            
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Sales Person</p>
              <p className="text-sm text-slate-900 mt-1">{salesLabel}</p>
            </div>
          </div>
        </div>

        {/* Schedule Information */}
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar className="h-5 w-5 text-purple-600" />
            </div>
            Jadwal Kunjungan
          </h3>
          
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Waktu Mulai
              </p>
              <p className="text-sm text-slate-900 mt-1">{formatDateTime(visitData.plannedStartTime)}</p>
            </div>
            
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Waktu Selesai
              </p>
              <p className="text-sm text-slate-900 mt-1">{formatDateTime(visitData.plannedEndTime)}</p>
            </div>
          </div>
        </div>

        {/* Visit Purpose */}
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <FileText className="h-5 w-5 text-orange-600" />
            </div>
            Tujuan Kunjungan
          </h3>
          
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tujuan</p>
              <p className="text-sm text-slate-900 mt-1">{purposeLabels[visitData.visitPurpose] || visitData.visitPurpose || '-'}</p>
            </div>
            
            {visitData.notes && (
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Catatan</p>
                <p className="text-sm text-slate-900 mt-1">{visitData.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Alert */}
      <div className="bg-gradient-to-r from-brand-blue-soft to-brand-blue-soft/80 p-6 rounded-xl border border-brand-blue/25">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <CheckCircle className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h4 className="font-semibold text-brand-blue-deep mb-2">Siap untuk Disimpan</h4>
            <p className="text-brand-blue-deep text-sm">
              Semua informasi telah dilengkapi. Klik "Simpan Kunjungan" untuk membuat jadwal kunjungan baru.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
