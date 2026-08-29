import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Info } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  EMPLOYEES_STAFF_ACCESS_PATH,
  EMPLOYEES_STAFF_SLOTS_PATH,
} from "../../layout/employeesStaffTabs";

export function PinAccessIntro() {
  const { t } = useAppTranslation();

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">
        {t("employeesStaff.pinAccess.title", "PIN Access")}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t(
          "employeesStaff.pinAccess.intro1",
          "PIN Access locks certain actions in Synckerja POS on cashier devices. Staff need administrator authorization (PIN) before restricted actions such as discounts, cancel, or refunds.",
        )}
      </p>
      <p className="text-sm text-muted-foreground">
        {t(
          "employeesStaff.pinAccess.intro2Prefix",
          "This configuration applies to outlets whose staff have a PIN assigned and are allowed to use PIN for in-app permission on",
        )}{" "}
        <Link to={EMPLOYEES_STAFF_SLOTS_PATH} className="font-medium text-primary hover:underline">
          {t("employeesStaff.tab.slots", "Employee Slots")}
        </Link>
        {t("employeesStaff.pinAccess.intro2Middle", ", and have mobile app access as set on")}{" "}
        <Link to={EMPLOYEES_STAFF_ACCESS_PATH} className="font-medium text-primary hover:underline">
          {t("employeesStaff.tab.access", "Employee Access")}
        </Link>
        .
      </p>
      <Alert className="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
        <Info className="h-4 w-4" />
        <AlertDescription>
          {t(
            "employeesStaff.pinAccess.versionHint",
            "PIN Access requires at least Synckerja POS v.26.2 on iOS and v.15.9.1 on Android.",
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}
