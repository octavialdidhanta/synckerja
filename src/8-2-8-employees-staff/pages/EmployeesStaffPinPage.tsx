import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { useToast } from "@/shared/components/ui/use-toast";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { EmployeesStaffModuleShell } from "../layout/EmployeesStaffModuleShell";
import { EmployeesStaffWorkspace } from "../layout/EmployeesStaffWorkspace";
import { usePosEmployeeStaff } from "../hooks/usePosEmployeeStaff";
import { usePosPinAccessSettings } from "../hooks/usePosPinAccessSettings";
import { EmployeeStaffDetailSheet } from "../components/detail/EmployeeStaffDetailSheet";
import { PinAccessIntro } from "../components/pin/PinAccessIntro";
import { PinAdministratorList } from "../components/pin/PinAdministratorList";
import { PinFeatureChecklist } from "../components/pin/PinFeatureChecklist";
import type { PosStaffListItem } from "../lib/posStaffTypes";

export default function EmployeesStaffPinPage() {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const { staff, isLoading, isError, error, refetch } = usePosEmployeeStaff();
  const { settings, isLoading: settingsLoading, save } = usePosPinAccessSettings();

  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [selected, setSelected] = useState<PosStaffListItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const showContent = useDebouncedReady(
    !(orgBootstrapPending || isLoading || settingsLoading),
    200,
  );

  useEffect(() => {
    if (!settings || settingsLoading) return;
    setDraft(new Set(settings.required_features));
    setHydrated(true);
  }, [settings, settingsLoading]);

  useEffect(() => {
    if (!selected) return;
    const next = staff.find((s) => s.id === selected.id);
    if (next && next !== selected) setSelected(next);
  }, [staff, selected]);

  const dirty = useMemo(() => {
    if (!settings || !hydrated) return false;
    const a = [...draft].sort().join("|");
    const b = [...settings.required_features].sort().join("|");
    return a !== b;
  }, [draft, settings, hydrated]);

  const handleToggle = (key: string, checked: boolean) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const handleSave = async () => {
    try {
      await save.mutateAsync([...draft]);
      toast({
        title: t("employeesStaff.pinAccess.saved", "PIN Access settings saved."),
      });
    } catch (err) {
      toast({
        title: t("employeesStaff.pinAccess.saveError", "Failed to save PIN Access settings."),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  return (
    <EmployeesStaffModuleShell showContent={showContent}>
      <EmployeesStaffWorkspace count={staff.length}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex-shrink-0 border-b px-4 py-4">
            <PinAccessIntro />
          </div>

          {isError ? (
            <Alert variant="destructive" className="mx-4 mt-3">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {error instanceof Error
                    ? error.message
                    : t("employeesStaff.loadError", "Failed to load POS staff.")}
                </span>
                <Button variant="outline" size="sm" onClick={() => void refetch()}>
                  {t("common.retry", "Retry")}
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-3 overflow-hidden p-4 lg:grid-cols-2">
            <PinAdministratorList
              staff={staff}
              onSelectStaff={(next) => {
                setSelected(next);
                setDetailOpen(true);
              }}
            />
            <PinFeatureChecklist selected={draft} onToggle={handleToggle} />
          </div>

          <div className="flex flex-shrink-0 justify-end px-4 pb-3">
            <Button
              type="button"
              disabled={save.isPending || !dirty}
              onClick={() => void handleSave()}
            >
              {t("common.save", "Save")}
            </Button>
          </div>
        </div>
      </EmployeesStaffWorkspace>

      <EmployeeStaffDetailSheet
        staff={selected}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelected(null);
        }}
      />
    </EmployeesStaffModuleShell>
  );
}
