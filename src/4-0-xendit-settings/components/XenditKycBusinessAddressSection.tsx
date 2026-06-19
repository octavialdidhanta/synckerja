import { useTranslation } from "react-i18next";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import type { XenditBusinessAddress } from "@/xendit/lib/xenditKycEntityConfig";

type XenditKycBusinessAddressSectionProps = {
  idPrefix: string;
  address: XenditBusinessAddress;
  onChange: (address: XenditBusinessAddress) => void;
};

export function XenditKycBusinessAddressSection({
  idPrefix,
  address,
  onChange,
}: XenditKycBusinessAddressSectionProps) {
  const { t } = useTranslation();

  const set = (field: keyof XenditBusinessAddress, value: string) => {
    onChange({ ...address, [field]: value });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-gray-700">
        {t("xendit.kyc.businessAddressTitle", "Alamat bisnis")}
      </p>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-street`}>{t("xendit.kyc.street", "Jalan / alamat")}</Label>
        <Input
          id={`${idPrefix}-street`}
          value={address.street_line_1}
          onChange={(e) => set("street_line_1", e.target.value)}
          required
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-district`}>{t("xendit.kyc.district", "Kecamatan")}</Label>
          <Input
            id={`${idPrefix}-district`}
            value={address.district}
            onChange={(e) => set("district", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-sub-district`}>{t("xendit.kyc.subDistrict", "Kelurahan")}</Label>
          <Input
            id={`${idPrefix}-sub-district`}
            value={address.sub_district}
            onChange={(e) => set("sub_district", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-city`}>{t("xendit.kyc.city", "Kota/Kabupaten")}</Label>
          <Input
            id={`${idPrefix}-city`}
            value={address.city}
            onChange={(e) => set("city", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-province`}>{t("xendit.kyc.province", "Provinsi")}</Label>
          <Input
            id={`${idPrefix}-province`}
            value={address.province}
            onChange={(e) => set("province", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${idPrefix}-postal`}>{t("xendit.kyc.postalCode", "Kode pos")}</Label>
          <Input
            id={`${idPrefix}-postal`}
            value={address.postal_code}
            onChange={(e) => set("postal_code", e.target.value)}
            inputMode="numeric"
            required
          />
        </div>
      </div>
    </div>
  );
}
