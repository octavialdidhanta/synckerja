import { User, Building2 } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useAvailableEmployees } from '@/shared/hooks/useAvailableEmployees';
import { useVisitPartyOptions } from '@/shared/hooks/useVisitPartyOptions';
import { VisitPartyPicker } from '@/5-2-jadwal-kunjungan/components/VisitPartyPicker';

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

interface ContactStepWizardProps {
  visitData: VisitData;
  updateVisitData: (data: Partial<VisitData>) => void;
}

export const ContactStepWizard = ({ visitData, updateVisitData }: ContactStepWizardProps) => {
  const { leadParties, clientParties, findByKey, isLoading } = useVisitPartyOptions();
  const { data: employees = [] } = useAvailableEmployees();

  const selectedParty = findByKey(visitData.clientName);
  const selectedEmployee = employees.find((emp) => emp.id === visitData.salesPerson);

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl space-y-6">
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <User className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-green-900 mb-1">Informasi Kontak</h3>
            <p className="text-green-700 text-sm">
              Pilih lead atau klien, lalu lengkapi sales person yang akan melakukan kunjungan.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-3">
            <div className="p-2 bg-brand-blue-soft rounded-lg">
              <Building2 className="h-5 w-5 text-brand-blue" />
            </div>
            Informasi Klien
          </h3>

          <div className="space-y-4">
            <div>
              <Label htmlFor="client-name" className="text-sm font-medium text-slate-700">
                Nama Klien *
              </Label>
              <VisitPartyPicker
                value={visitData.clientName}
                selected={selectedParty}
                leadParties={leadParties}
                clientParties={clientParties}
                isLoading={isLoading}
                onSelect={(party) =>
                  updateVisitData({
                    clientName: party.key,
                    contactPerson: party.contactPerson || party.label,
                    phoneNumber: party.phone || '',
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="contact-person" className="text-sm font-medium text-slate-700">
                Nama Kontak Person *
              </Label>
              <Input
                id="contact-person"
                value={visitData.contactPerson}
                onChange={(e) => updateVisitData({ contactPerson: e.target.value })}
                className="mt-1"
                placeholder="Masukkan nama kontak person"
              />
            </div>

            <div>
              <Label htmlFor="phone-number" className="text-sm font-medium text-slate-700">
                Nomor Telepon
              </Label>
              <Input
                id="phone-number"
                type="tel"
                value={visitData.phoneNumber}
                onChange={(e) => updateVisitData({ phoneNumber: e.target.value })}
                className="mt-1"
                placeholder="Masukkan nomor telepon"
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <User className="h-5 w-5 text-orange-600" />
            </div>
            Sales Person
          </h3>

          <div>
            <Label htmlFor="sales-person" className="text-sm font-medium text-slate-700">
              Pilih Sales Person *
            </Label>
            <Select
              value={visitData.salesPerson}
              onValueChange={(value) => updateVisitData({ salesPerson: value })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Pilih sales person">
                  {selectedEmployee ? selectedEmployee.full_name : 'Pilih sales person'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
};
