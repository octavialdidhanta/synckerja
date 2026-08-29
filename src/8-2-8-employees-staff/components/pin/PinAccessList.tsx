import { Badge } from "@/shared/components/ui/badge";
import { Switch } from "@/shared/components/ui/switch";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatPosStaffRole } from "../../lib/formatPosStaffRole";
import type { PosStaffListItem } from "../../lib/posStaffTypes";

type Props = {
  staff: PosStaffListItem[];
  onSelect: (staff: PosStaffListItem) => void;
  onToggleAllowPin: (staff: PosStaffListItem, value: boolean) => void;
  busyId?: string | null;
};

export function PinAccessList({ staff, onSelect, onToggleAllowPin, busyId }: Props) {
  const { t } = useAppTranslation();

  if (staff.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
        {t("employeesStaff.pin.empty", "No POS staff to configure PIN for.")}
      </div>
    );
  }

  return (
    <div className="divide-y rounded-lg border">
      {staff.map((row) => (
        <div
          key={row.id}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30"
        >
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(row)}>
            <p className="font-medium">{row.full_name}</p>
            <p className="text-xs text-muted-foreground">
              {formatPosStaffRole(row, t)}
              {" · "}
              {row.has_pin
                ? t("employeesStaff.pin.statusSet", "PIN is set.")
                : t("employeesStaff.pin.statusUnset", "No PIN set yet.")}
            </p>
          </button>
          <div className="flex items-center gap-3">
            <Badge variant={row.has_pin ? "secondary" : "outline"}>
              {row.has_pin
                ? t("employeesStaff.pin.badgeSet", "PIN")
                : t("employeesStaff.pin.badgeUnset", "No PIN")}
            </Badge>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {t("employeesStaff.pin.allowShort", "Allow PIN")}
              </span>
              <Switch
                checked={row.allow_pin_for_permissions}
                disabled={busyId === row.id}
                onCheckedChange={(v) => onToggleAllowPin(row, v)}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
