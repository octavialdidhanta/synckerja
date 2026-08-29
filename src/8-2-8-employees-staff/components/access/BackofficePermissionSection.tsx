import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_BACKOFFICE_PERMISSION_TREE } from "../../lib/posAccessPermissionCatalog";
import { PermissionCheckboxTree } from "./PermissionCheckboxTree";

type Props = {
  selected: Set<string>;
  onToggle: (key: string, checked: boolean, childKeys: string[]) => void;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
};

export function BackofficePermissionSection({
  selected,
  onToggle,
  expanded,
  onExpandedChange,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-semibold"
        onClick={() => onExpandedChange(!expanded)}
      >
        <span>
          {t("employeesStaff.access.backofficeTitle", "Backoffice Permissions")}
        </span>
        <span className="text-muted-foreground">{expanded ? "−" : "+"}</span>
      </button>
      {expanded ? (
        <div className="border-t px-3 pb-3 pt-2">
          <p className="mb-3 text-xs text-muted-foreground">
            {t(
              "employeesStaff.access.backofficeHint",
              "Allow employees to sign in to Backoffice and access POS Library, Ingredient, Settings, Customers, Employees, and Inventory.",
            )}
          </p>
          <div className="max-h-[420px] overflow-y-auto rounded-md border">
            <PermissionCheckboxTree
              nodes={POS_BACKOFFICE_PERMISSION_TREE}
              selected={selected}
              onToggle={onToggle}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
