import { Link } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { EMPLOYEES_STAFF_PIN_PATH } from "../../layout/employeesStaffTabs";
import { POS_APP_PERMISSION_TREE } from "../../lib/posAccessPermissionCatalog";
import { PermissionCheckboxTree } from "./PermissionCheckboxTree";

type Props = {
  selected: Set<string>;
  onToggle: (key: string, checked: boolean, childKeys: string[]) => void;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
};

export function AppPermissionSection({
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
          {t("employeesStaff.access.appPermissionTitle", "App Permission (POS Kasir)")}
        </span>
        <span className="text-muted-foreground">{expanded ? "−" : "+"}</span>
      </button>
      {expanded ? (
        <div className="border-t px-3 pb-3 pt-2">
          <p className="mb-2 text-xs text-muted-foreground">
            {t(
              "employeesStaff.access.appPermissionHint",
              "Allow employees to sign in to POS Kasir and access the following.",
            )}
          </p>
          <p className="mb-3 text-xs">
            <Link to={EMPLOYEES_STAFF_PIN_PATH} className="text-primary hover:underline">
              {t(
                "employeesStaff.access.pinAccessLink",
                "To set a PIN for these permissions, go to PIN Access.",
              )}
            </Link>
          </p>
          <div className="overflow-hidden rounded-md border">
            <PermissionCheckboxTree
              nodes={POS_APP_PERMISSION_TREE}
              selected={selected}
              onToggle={onToggle}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
