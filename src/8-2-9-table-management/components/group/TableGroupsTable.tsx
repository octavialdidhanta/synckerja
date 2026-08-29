import { Copy } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PosTableGroup } from "../../lib/posTableGroupTypes";

type Props = {
  groups: PosTableGroup[];
  onSelect: (group: PosTableGroup) => void;
  onDuplicate: (group: PosTableGroup) => void;
  duplicatingId?: string | null;
};

export function TableGroupsTable({
  groups,
  onSelect,
  onDuplicate,
  duplicatingId,
}: Props) {
  const { t } = useAppTranslation();

  if (groups.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
        {t(
          "tableManagement.group.empty",
          "No table groups yet. Create a table group for this outlet.",
        )}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("tableManagement.group.colName", "Table Group")}</TableHead>
          <TableHead>{t("tableManagement.group.colStatus", "Status")}</TableHead>
          <TableHead className="text-right">
            {t("tableManagement.group.colCount", "Table Count")}
          </TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => (
          <TableRow
            key={group.id}
            className="cursor-pointer"
            onClick={() => onSelect(group)}
          >
            <TableCell className="font-medium">{group.name}</TableCell>
            <TableCell>
              <span
                className={
                  group.is_active
                    ? "text-sm font-medium text-emerald-600"
                    : "text-sm text-muted-foreground"
                }
              >
                {group.is_active
                  ? t("tableManagement.group.statusActive", "Active")
                  : t("tableManagement.group.statusInactive", "Inactive")}
              </span>
            </TableCell>
            <TableCell className="text-right tabular-nums">{group.table_count}</TableCell>
            <TableCell>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                disabled={duplicatingId === group.id}
                aria-label={t("tableManagement.group.duplicate", "Duplicate")}
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(group);
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
