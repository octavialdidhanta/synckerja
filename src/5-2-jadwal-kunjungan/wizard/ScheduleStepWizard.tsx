import { Calendar, Clock, FileText } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';

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

interface ScheduleStepWizardProps {
  visitData: VisitData;
  updateVisitData: (data: Partial<VisitData>) => void;
}

export const ScheduleStepWizard = ({ visitData, updateVisitData }: ScheduleStepWizardProps) => {
  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl space-y-6">
      {/* Instructions */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-xl border border-purple-200">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Calendar className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-purple-900 mb-1">Jadwal Kunjungan</h3>
            <p className="text-purple-700 text-sm">
              Tentukan waktu dan tujuan kunjungan yang akan dilakukan.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Schedule Information */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-3">
            <div className="p-2 bg-brand-blue-soft rounded-lg">
              <Clock className="h-5 w-5 text-brand-blue" />
            </div>
            Waktu Kunjungan
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-time" className="text-sm font-medium text-slate-700">
                Waktu Mulai *
              </Label>
              <Input 
                id="start-time" 
                type="datetime-local"
                value={visitData.plannedStartTime} 
                onChange={e => updateVisitData({ plannedStartTime: e.target.value })} 
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="end-time" className="text-sm font-medium text-slate-700">
                Waktu Selesai *
              </Label>
              <Input 
                id="end-time" 
                type="datetime-local"
                value={visitData.plannedEndTime} 
                onChange={e => updateVisitData({ plannedEndTime: e.target.value })} 
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Visit Purpose */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <FileText className="h-5 w-5 text-green-600" />
            </div>
            Tujuan Kunjungan
          </h3>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="visit-purpose" className="text-sm font-medium text-slate-700">
                Tujuan Kunjungan *
              </Label>
              <Select 
                value={visitData.visitPurpose} 
                onValueChange={value => updateVisitData({ visitPurpose: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih tujuan kunjungan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="presentation">Presentasi Produk</SelectItem>
                  <SelectItem value="negotiation">Negosiasi Kontrak</SelectItem>
                  <SelectItem value="follow-up">Follow-up Meeting</SelectItem>
                  <SelectItem value="support">Dukungan Pelanggan</SelectItem>
                  <SelectItem value="consultation">Konsultasi Bisnis</SelectItem>
                  <SelectItem value="site-survey">Survey Lokasi</SelectItem>
                  <SelectItem value="training">Pelatihan</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes" className="text-sm font-medium text-slate-700">
                Catatan Tambahan
              </Label>
              <Textarea
                id="notes"
                value={visitData.notes}
                onChange={e => updateVisitData({ notes: e.target.value })}
                className="mt-1"
                rows={4}
                placeholder="Masukkan catatan atau detail tambahan tentang kunjungan..."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
