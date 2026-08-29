import { useMemo, useState } from "react";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PosStaffListItem } from "../../lib/posStaffTypes";

type Props = {
  staff: PosStaffListItem[];
  selectedStaffIds: string[];
  onChange: (ids: string[]) => void;
  /** Current role id — staff already on this role stay selectable; others on different roles shown with note. */
  currentRoleId?: string | null;
};

export function RoleEmployeesAssign({
  staff,
  selectedStaffIds,
  onChange,
  currentRoleId,
}: Props) {
  const { t } = useAppTranslation();
  const [search, setSearch] = useState("");
  const selected = useMemo(() => new Set(selectedStaffIds), [selectedStaffIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((s) => {
      if (!q) return true;
      return (
        s.full_name.toLowerCase().includes(q) ||
        (s.email?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [staff, search]);

  const toggle = (id: string) => {
    if (selected.has(id)) onChange(selectedStaffIds.filter((x) => x !== id));
    else onChange([...selectedStaffIds, id]);
  };

  return (
    <div className="space-y-2">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("employeesStaff.access.searchStaff", "Search staff")}
      />
      <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
        {filtered.length === 0 ? (
          <p className="px-1 py-4 text-center text-sm text-muted-foreground">
            {t("employeesStaff.access.noStaff", "There's no employee for this role yet.")}
          </p>
        ) : (
          filtered.map((s) => {
            const otherRole =
              s.role_id && currentRoleId && s.role_id !== currentRoleId;
            return (
              <label
                key={s.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
              >
                <Checkbox
                  checked={selected.has(s.id)}
                  onCheckedChange={() => toggle(s.id)}
                />
                <span className="min-w-0 flex-1 text-sm">
                  {s.full_name}
                  {s.email ? (
                    <span className="text-muted-foreground"> · {s.email}</span>
                  ) : null}
                  {otherRole ? (
                    <span className="ml-1 text-xs text-amber-700">
                      ({t("employeesStaff.access.reassignNote", "will move from other role")})
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
