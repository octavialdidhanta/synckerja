import { Label } from "@/shared/components/ui/label";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

type OutletOption = {
  id: string;
  name: string;
};

type Props = {
  outlets: OutletOption[];
  value: string | null;
  onChange: (outletId: string) => void;
  className?: string;
};

/** Picks which outlet Hours, Catalog, and QR edit. New POS outlets appear here on their own. */
export function SynckerjaOrderOutletSelect({ outlets, value, onChange, className }: Props) {
  const { t } = useAppTranslation();
  return (
    <div className={className ? `w-full space-y-1 ${className}` : "w-full max-w-md space-y-1"}>
      <Label>{t("synckerjaOrder.hours.outlet", "Outlet")}</Label>
      <select
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        value={value ?? ""}
        onChange={(event) => {
          if (event.target.value) onChange(event.target.value);
        }}
      >
        {outlets.length === 0 ? (
          <option value="">{t("synckerjaOrder.outletPicker.empty", "No outlet yet.")}</option>
        ) : (
          outlets.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
