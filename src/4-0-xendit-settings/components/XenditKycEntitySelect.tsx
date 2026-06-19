import { useTranslation } from "react-i18next";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  ENTITY_SUBTYPE_OPTIONS,
  type EntitySelectValue,
} from "@/xendit/lib/xenditKycEntityConfig";

type XenditKycEntitySelectProps = {
  value: EntitySelectValue;
  onChange: (value: EntitySelectValue) => void;
};

export function XenditKycEntitySelect({ value, onChange }: XenditKycEntitySelectProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <Label>{t("xendit.kyc.businessType", "Tipe bisnis")}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as EntitySelectValue)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ENTITY_SUBTYPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {t(opt.labelKey, opt.labelDefault)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
