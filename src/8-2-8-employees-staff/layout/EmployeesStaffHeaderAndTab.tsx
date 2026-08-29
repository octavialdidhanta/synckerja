import { KeyRound, Lock, Shield, Users } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useHeaderTabPageAccess } from "@/shared/auth/page-access/useHeaderTabPageAccess";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  EMPLOYEES_STAFF_ACCESS_PATH,
  EMPLOYEES_STAFF_PIN_PATH,
  EMPLOYEES_STAFF_SLOTS_PATH,
  employeesStaffTabFromPathname,
  employeesStaffTabLocation,
  type EmployeesStaffSubTab,
} from "./employeesStaffTabs";

const tabs: Array<{
  id: EmployeesStaffSubTab;
  path: string;
  titleKey: string;
  fallbackTitle: string;
  icon: typeof Users;
}> = [
  {
    id: "slots",
    path: EMPLOYEES_STAFF_SLOTS_PATH,
    titleKey: "employeesStaff.tab.slots",
    fallbackTitle: "Employee Slots",
    icon: Users,
  },
  {
    id: "access",
    path: EMPLOYEES_STAFF_ACCESS_PATH,
    titleKey: "employeesStaff.tab.access",
    fallbackTitle: "Employee Access",
    icon: Shield,
  },
  {
    id: "pin-access",
    path: EMPLOYEES_STAFF_PIN_PATH,
    titleKey: "employeesStaff.tab.pinAccess",
    fallbackTitle: "PIN Access",
    icon: KeyRound,
  },
];

export function EmployeesStaffHeaderAndTab() {
  const { t } = useAppTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { isTabLocked } = useHeaderTabPageAccess();
  const activeTab = employeesStaffTabFromPathname(location.pathname);

  const title = t("employeesStaff.header.title", "Employees");
  const description = t(
    "employeesStaff.header.subtitle",
    "Manage POS staff slots, access roles, and PIN settings",
  );

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-foreground">{title}</h1>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <div className="-mb-3">
        <nav className="flex flex-wrap gap-x-6 gap-y-1" aria-label={title}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const locked = isTabLocked(tab.path);
            const label = t(tab.titleKey, tab.fallbackTitle);

            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                tabIndex={0}
                onClick={() => {
                  if (locked) return;
                  navigate(employeesStaffTabLocation(tab.path, location.search));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (locked) return;
                    navigate(employeesStaffTabLocation(tab.path, location.search));
                  }
                }}
                className={`flex items-center space-x-1.5 px-1 py-1.5 text-sm font-medium transition-colors ${
                  locked
                    ? "cursor-not-allowed border-b-2 border-transparent text-muted-foreground opacity-60"
                    : isActive
                      ? "cursor-pointer border-b-2 border-primary text-primary"
                      : "cursor-pointer border-b-2 border-transparent text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
                style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
                title={
                  locked
                    ? t("employeesStaff.header.noAccess", "You do not have access to this page")
                    : label
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
                {locked ? <Lock className="ml-1 h-3.5 w-3.5" /> : null}
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

EmployeesStaffHeaderAndTab.displayName = "EmployeesStaffHeaderAndTab";
