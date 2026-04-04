import { User, Building2 } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useClients } from '@/shared/hooks/organized/sales';
import { useAvailableEmployees } from '@/shared/hooks/useAvailableEmployees';

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
  const { clients } = useClients();
  const { data: employees = [] } = useAvailableEmployees();
  
  // Get selected client and employee names for display
  const selectedClient = clients.find(client => client.id === visitData.clientName);
  const selectedEmployee = employees.find(emp => emp.id === visitData.salesPerson);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Instructions */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <User className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-green-900 mb-1">Informasi Kontak</h3>
            <p className="text-green-700 text-sm">
              Lengkapi data klien dan sales person yang akan melakukan kunjungan.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Client Information */}
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
              <Select 
                value={visitData.clientName} 
                onValueChange={value => updateVisitData({ clientName: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih klien">
                    {selectedClient ? selectedClient.company_name : "Pilih klien"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="contact-person" className="text-sm font-medium text-slate-700">
                Nama Kontak Person *
              </Label>
              <Input 
                id="contact-person" 
                value={visitData.contactPerson} 
                onChange={e => updateVisitData({ contactPerson: e.target.value })} 
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
                onChange={e => updateVisitData({ phoneNumber: e.target.value })} 
                className="mt-1"
                placeholder="Masukkan nomor telepon"
              />
            </div>
          </div>
        </div>

        {/* Sales Person */}
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
              onValueChange={value => updateVisitData({ salesPerson: value })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Pilih sales person">
                  {selectedEmployee ? selectedEmployee.full_name : "Pilih sales person"}
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
