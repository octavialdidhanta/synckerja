
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

interface AddressInfoData {
  address: string;
  citizen_address: string;
  postal_code: string;
  birth_place: string;
}

interface AddressInfoSectionProps {
  formData: AddressInfoData;
  onChange: (field: string, value: string) => void;
}

export function AddressInfoSection({ formData, onChange }: AddressInfoSectionProps) {
  return (
    <div className="space-y-6 p-6 bg-white rounded-lg border">
      <div className="border-b pb-4">
        <h3 className="text-lg font-semibold text-gray-900">Address Information</h3>
        <p className="text-sm text-gray-600 mt-1">Please provide your address details</p>
      </div>
      
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="birth_place" className="text-sm font-medium text-gray-700">
              Birth Place
            </Label>
            <Input
              id="birth_place"
              value={formData.birth_place || ''}
              onChange={(e) => onChange('birth_place', e.target.value)}
              placeholder="Enter your birth place"
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="postal_code" className="text-sm font-medium text-gray-700">
              Postal Code
            </Label>
            <Input
              id="postal_code"
              value={formData.postal_code || ''}
              onChange={(e) => onChange('postal_code', e.target.value)}
              placeholder="Enter postal code"
              className="w-full"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address" className="text-sm font-medium text-gray-700">
            Current Address
          </Label>
          <Input
            id="address"
            value={formData.address || ''}
            onChange={(e) => onChange('address', e.target.value)}
            placeholder="Enter your current address"
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="citizen_address" className="text-sm font-medium text-gray-700">
            Citizen Address (KTP)
          </Label>
          <Input
            id="citizen_address"
            value={formData.citizen_address || ''}
            onChange={(e) => onChange('citizen_address', e.target.value)}
            placeholder="Enter your citizen address as per KTP"
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
