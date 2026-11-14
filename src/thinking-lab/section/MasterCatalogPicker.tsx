import { Checkbox } from "@/shared/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  withCategory,
  type CatalogOption,
  type LabCatalog,
  type MasterCatalogLink,
} from "@/thinking-lab/master-thought/catalog";

function OptionList({
  title,
  options,
  picked,
  disabled,
  onChange,
}: {
  title: string;
  options: CatalogOption[];
  picked: string[];
  disabled: boolean;
  onChange: (ids: string[]) => void;
}) {
  if (options.length === 0) return null;
  return (
    <fieldset className="space-y-1">
      <legend className="text-xs font-medium text-muted-foreground">{title}</legend>
      <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-input p-2">
        {options.map((option) => {
          const checked = picked.includes(option.id);
          return (
            <label key={option.id} className="flex items-center gap-2 text-sm font-normal text-foreground">
              <Checkbox
                checked={checked}
                disabled={disabled}
                onCheckedChange={(value) =>
                  onChange(value === true ? [...picked, option.id] : picked.filter((id) => id !== option.id))
                }
              />
              <span className="min-w-0 truncate">{option.name}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Required category, then optional sub-categories and features of that category (several allowed). */
export function MasterCatalogPicker({
  value,
  catalogs,
  disabled,
  onChange,
}: {
  value: MasterCatalogLink;
  catalogs: LabCatalog[];
  disabled: boolean;
  onChange: (value: MasterCatalogLink) => void;
}) {
  const { t } = useAppTranslation();
  const catalog = catalogs.find((item) => item.id === value.serviceId);
  return (
    <div className="w-full space-y-2">
      <Select
        value={catalog?.id ?? ""}
        onValueChange={(serviceId) => onChange(withCategory(value, serviceId, catalogs))}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 w-full" aria-label={t("thinkingLab.catalog.label", "Kategori katalog")}>
          <SelectValue placeholder={t("thinkingLab.catalog.pick", "Pilih kategori (wajib)")} />
        </SelectTrigger>
        <SelectContent>
          {catalogs.map((item) => (
            <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {catalog ? (
        <>
          <OptionList
            title={t("thinkingLab.catalog.subCategories", "Sub-kategori (opsional, boleh lebih dari satu)")}
            options={catalog.subCategories}
            picked={value.subServiceIds}
            disabled={disabled}
            onChange={(subServiceIds) => onChange({ ...value, subServiceIds })}
          />
          <OptionList
            title={t("thinkingLab.catalog.features", "Fitur (opsional, boleh lebih dari satu)")}
            options={catalog.features}
            picked={value.featureIds}
            disabled={disabled}
            onChange={(featureIds) => onChange({ ...value, featureIds })}
          />
        </>
      ) : null}
    </div>
  );
}
