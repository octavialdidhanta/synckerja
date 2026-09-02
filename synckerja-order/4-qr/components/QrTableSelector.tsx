import { Checkbox } from "@/shared/components/ui/checkbox";
import { Label } from "@/shared/components/ui/label";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import type { QrTableInput } from "../lib/qrPrintTypes";

type Props = {
  tables: QrTableInput[];
  selectedIds: Set<string>;
  previewTableId: string | null;
  allSelected: boolean;
  onToggle: (tableId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onPreview: (tableId: string) => void;
  disabled?: boolean;
};

export function QrTableSelector({
  tables,
  selectedIds,
  previewTableId,
  allSelected,
  onToggle,
  onSelectAll,
  onPreview,
  disabled,
}: Props) {
  const { t } = useAppTranslation();

  if (tables.length === 0) return null;

  const groups = new Map<string, QrTableInput[]>();
  for (const table of tables) {
    const key = table.group_name?.trim() || "";
    const list = groups.get(key) ?? [];
    list.push(table);
    groups.set(key, list);
  }

  return (
    <div className="space-y-3 print:hidden">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium text-muted-foreground">
          {t("synckerjaOrder.qr.tables.title", "Tables to print")}
        </Label>
        <label className="flex items-center gap-2 text-xs text-foreground">
          <Checkbox
            checked={allSelected}
            disabled={disabled}
            onCheckedChange={(v) => onSelectAll(v === true)}
          />
          {t("synckerjaOrder.qr.tables.selectAll", "Select all")}
        </label>
      </div>

      <div className="max-h-56 space-y-3 overflow-y-auto rounded-lg border border-border p-2">
        {[...groups.entries()].map(([groupName, rows]) => (
          <div key={groupName || "__ungrouped"}>
            {groupName ? (
              <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {groupName}
              </p>
            ) : null}
            <ul className="space-y-1">
              {rows.map((table) => {
                const active = previewTableId === table.id;
                return (
                  <li key={table.id}>
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5",
                        active && "bg-primary/5 ring-1 ring-primary/20",
                      )}
                    >
                      <Checkbox
                        checked={selectedIds.has(table.id)}
                        disabled={disabled}
                        onCheckedChange={(v) => onToggle(table.id, v === true)}
                      />
                      <button
                        type="button"
                        disabled={disabled}
                        className="min-w-0 flex-1 truncate text-left text-sm"
                        onClick={() => onPreview(table.id)}
                      >
                        {table.name}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
