
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { OrganizationFormData } from "./types";

interface AdditionalInfoFieldsProps {
  formData: OrganizationFormData;
  onInputChange: (field: string, value: string) => void;
  loading: boolean;
}

const AdditionalInfoFields = ({ formData, onInputChange, loading }: AdditionalInfoFieldsProps) => {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="address" className="text-sm font-medium text-foreground">
          Alamat Perusahaan *
        </Label>
        <Textarea
          id="address"
          value={formData.address}
          onChange={e => onInputChange("address", e.target.value)}
          placeholder="Jl. Contoh No. 123, Jakarta Selatan, DKI Jakarta"
          required
          disabled={loading}
          className="min-h-[80px]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="website" className="text-sm font-medium text-foreground">
          Website (Opsional)
        </Label>
        <Input
          type="url"
          id="website"
          value={formData.website}
          onChange={e => onInputChange("website", e.target.value)}
          placeholder="https://www.contohperusahaan.com"
          disabled={loading}
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description" className="text-sm font-medium text-foreground">
          Deskripsi Perusahaan (Opsional)
        </Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={e => onInputChange("description", e.target.value)}
          placeholder="Ceritakan sedikit tentang perusahaan Anda..."
          disabled={loading}
          className="min-h-[100px]"
        />
      </div>
    </>
  );
};

export default AdditionalInfoFields;
