import { useEffect, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";

const AI_EMPLOYEE_LOCKED_NAV_IDS = new Set([
  "address",
  "education",
  "education-informal",
  "work",
  "family",
  "attendance",
  "leave-permit",
  "documents",
  "payroll",
]);

export function isAiEmployeeNavLocked(isAi: boolean | null | undefined, navId: string) {
  return isAi === true && AI_EMPLOYEE_LOCKED_NAV_IDS.has(navId);
}

export function useRedirectLockedAiEmployee(
  employee: { id?: string | null; is_ai?: boolean | null } | null | undefined,
  navId: string,
) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!employee?.id || !isAiEmployeeNavLocked(employee.is_ai, navId)) return;
    navigate(`/my-info/employment?id=${employee.id}`, { replace: true });
  }, [employee?.id, employee?.is_ai, navId, navigate]);
}

type QuickNavItem = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  path: string;
  active: boolean;
};

export function EmployeeQuickNav({
  items,
  isAi,
  onNavigate,
}: {
  items: QuickNavItem[];
  isAi?: boolean | null;
  onNavigate: (path: string) => void;
}) {
  return (
    <>
      {items.map((item) => {
        const Icon = item.icon;
        const locked = isAiEmployeeNavLocked(isAi, item.id);
        return (
          <Button
            key={item.id}
            type="button"
            variant={item.active && !locked ? "default" : "ghost"}
            size="sm"
            disabled={locked}
            aria-disabled={locked}
            title={locked ? "Not available for AI employees" : undefined}
            className={`w-full justify-start text-xs ${
              locked
                ? "text-gray-400 disabled:opacity-100"
                : item.active
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
            onClick={() => {
              if (locked) return;
              onNavigate(item.path);
            }}
          >
            <Icon className="mr-2 h-3 w-3" />
            {item.label}
          </Button>
        );
      })}
    </>
  );
}
