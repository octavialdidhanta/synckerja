
import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { OrganizationFormData } from "./types";
import { COMPANY_SIZES, INDUSTRIES } from "./constants";

interface BasicInfoFieldsProps {
  formData: OrganizationFormData;
  onInputChange: (field: string, value: string) => void;
  loading: boolean;
}

const BasicInfoFields = ({ formData, onInputChange, loading }: BasicInfoFieldsProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="company_name" className="text-sm font-medium text-foreground">
            Nama Perusahaan *
          </Label>
          <Input
            id="company_name"
            value={formData.company_name}
            onChange={(e) => onInputChange('company_name', e.target.value)}
            placeholder="PT. Contoh Perusahaan"
            disabled={loading}
            className="h-11"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="industry" className="text-sm font-medium text-foreground">
            Industri *
          </Label>
          <Select value={formData.industry} onValueChange={(value) => onInputChange('industry', value)} disabled={loading}>
            <SelectTrigger className="h-11 max-w-full">
              <SelectValue placeholder="Pilih industri" />
            </SelectTrigger>
            <SelectContent className="max-w-xs">
              {INDUSTRIES.map((industry) => (
                <SelectItem key={industry} value={industry} className="text-sm">
                  {industry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="company_size" className="text-sm font-medium text-foreground">
            Jumlah Karyawan *
          </Label>
          <Select value={formData.company_size} onValueChange={(value) => onInputChange('company_size', value)} disabled={loading}>
            <SelectTrigger className="h-11 max-w-full">
              <SelectValue placeholder="Pilih jumlah karyawan" />
            </SelectTrigger>
            <SelectContent className="max-w-xs">
              {COMPANY_SIZES.map((size) => (
                <SelectItem key={size} value={size} className="text-sm">
                  {size} karyawan
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone_number" className="text-sm font-medium text-foreground">
            Nomor Telepon *
          </Label>
          <Input
            type="tel"
            id="phone_number"
            value={formData.phone_number}
            onChange={e => onInputChange("phone_number", e.target.value)}
            placeholder="+62 xxx-xxx-xxxx"
            required
            disabled={loading}
            className="h-11"
          />
        </div>
      </div>
    </div>
  );
};

export default BasicInfoFields;
