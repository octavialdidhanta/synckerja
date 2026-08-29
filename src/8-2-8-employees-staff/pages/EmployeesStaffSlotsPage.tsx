import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { useToast } from "@/shared/components/ui/use-toast";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { EmployeesStaffModuleShell } from "../layout/EmployeesStaffModuleShell";
import { usePosEmployeeStaff } from "../hooks/usePosEmployeeStaff";
import { usePosStaffInvite } from "../hooks/usePosStaffInvite";
import { usePosStaffVerification } from "../hooks/usePosStaffVerification";
import {
  EmployeeSlotFilters,
  type SlotStatusFilter,
} from "../components/slots/EmployeeSlotFilters";
import { EmployeeSlotsTable } from "../components/slots/EmployeeSlotsTable";
import { InviteEmployeeDialog } from "../components/slots/InviteEmployeeDialog";
import { EmployeeStaffDetailSheet } from "../components/detail/EmployeeStaffDetailSheet";
import type { EmployeeSlotRow, PosStaffListItem } from "../lib/posStaffTypes";

export default function EmployeesStaffSlotsPage() {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const { staff, slotRows, expiryDate, memberLimit, isLoading, isError, error, refetch } =
    usePosEmployeeStaff();
  const { resendInvitation } = usePosStaffInvite();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SlotStatusFilter>("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selected, setSelected] = useState<PosStaffListItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const showContent = useDebouncedReady(!(orgBootstrapPending || isLoading), 200);
  usePosStaffVerification(showContent && !isLoading);

  useEffect(() => {
    if (!selected) return;
    const next = staff.find((s) => s.id === selected.id);
    if (next && next !== selected) setSelected(next);
  }, [staff, selected]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return slotRows.filter((row: EmployeeSlotRow) => {
      if (row.kind === "empty") {
        if (statusFilter === "active" || statusFilter === "inactive") return false;
        if (statusFilter === "empty") return true;
        return !q;
      }
      if (statusFilter === "empty") return false;
      if (statusFilter === "active" && !row.staff.is_active) return false;
      if (statusFilter === "inactive" && row.staff.is_active) return false;
      if (!q) return true;
      const hay = [
        row.staff.full_name,
        row.staff.email ?? "",
        row.staff.role_name ?? "",
        row.staff.role_slug ?? "",
        row.staff.pos_role,
        ...row.staff.outlet_names,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [slotRows, search, statusFilter]);

  const handleResend = async (row: PosStaffListItem) => {
    setResendingId(row.id);
    try {
      const result = await resendInvitation.mutateAsync(row);
      if (result.emailError === "already_verified") {
        toast({ title: t("employeesStaff.status.verified", "Verified") });
        return;
      }
      toast({
        title: result.emailSent
          ? t("employeesStaff.invite.resent", "Invitation resent.")
          : t("employeesStaff.invite.resendFailed", "Could not resend invitation."),
        description: result.emailError || undefined,
        variant: result.emailSent ? "default" : "destructive",
      });
    } catch (err) {
      toast({
        title: t("employeesStaff.invite.resendFailed", "Could not resend invitation."),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setResendingId(null);
    }
  };

  return (
    <EmployeesStaffModuleShell showContent={showContent}>
      <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
        <div className="col-span-12 flex min-h-[560px] min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="flex-shrink-0 space-y-3 border-b px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">
                  {t("employeesStaff.slots.title", "Employee Slots")}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t("employeesStaff.slots.quota", "{{used}} of {{limit}} slots used", {
                    used: slotRows.filter((r) => r.kind === "staff").length,
                    limit: memberLimit,
                  })}
                </p>
              </div>
            </div>
            <EmployeeSlotFilters
              search={search}
              onSearchChange={setSearch}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              onExport={() =>
                toast({
                  title: t("employeesStaff.actions.exportSoon", "Export coming soon."),
                })
              }
              onInvite={() => setInviteOpen(true)}
            />
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
            {isError ? (
              <Alert variant="destructive" className="mb-3">
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
            <EmployeeSlotsTable
              rows={filtered}
              expiryDate={expiryDate}
              resendingId={resendingId}
              onInvite={() => setInviteOpen(true)}
              onResend={(row) => void handleResend(row)}
              onSelectStaff={(next) => {
                setSelected(next);
                setDetailOpen(true);
              }}
            />
          </div>
        </div>
      </div>
      <div className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4" aria-hidden />

      <InviteEmployeeDialog open={inviteOpen} onOpenChange={setInviteOpen} />
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
