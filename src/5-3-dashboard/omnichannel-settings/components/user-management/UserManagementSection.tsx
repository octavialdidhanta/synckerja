import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import type { OmnichannelUserManagementRow } from "@/5-3-dashboard/omnichannel-settings/types/userManagement.types";
import { UserManagementPagination } from "@/5-3-dashboard/omnichannel-settings/components/user-management/UserManagementPagination";
import { UserManagementTable } from "@/5-3-dashboard/omnichannel-settings/components/user-management/UserManagementTable";
import { UserManagementToolbar } from "@/5-3-dashboard/omnichannel-settings/components/user-management/UserManagementToolbar";
import type { UserManagementRoleFilter } from "@/5-3-dashboard/omnichannel-settings/components/user-management/UserManagementToolbar";
import { omnichannelSettingsPath } from "@/5-3-dashboard/omnichannel-settings/constants/omnichannelSettingsSections";
import {
  organizationOmnichannelStaffQueryKey,
  useOrganizationOmnichannelStaff,
  useOmnichannelStaffAddCandidates,
  useRemoveOrganizationOmnichannelStaff,
  useUpdateOrganizationOmnichannelStaffRole,
  useUpsertOrganizationOmnichannelStaff,
  type OmnichannelStaffRole,
} from "@/shared/hooks/useOrganizationOmnichannelStaff";
import { useOptimizedSubscription } from "@/10-subscription/hooks/useOptimizedSubscription";
import { useMidtransPayment } from "@/10-subscription/hooks/useMidtransPayment";
import { useActiveOrganization } from "@/10-subscription/shared/useActiveOrganization";
import { subscriptionQueryKeys } from "@/10-subscription/shared/subscriptionQueryKeys";
import { formatIDR } from "@/10-subscription/shared/subscriptionUtils";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  OMNICHANNEL_SETTINGS_CARD_HEADER_BASE,
  OMNICHANNEL_SETTINGS_CARD_SUBTITLE_CLASS,
  OMNICHANNEL_SETTINGS_CARD_TITLE_CLASS,
} from "@/5-3-dashboard/omnichannel-settings/constants/omnichannelSettingsCardHeader";
import { cn } from "@/shared/lib/utils";

const ROLE_FILTER_DB: OmnichannelStaffRole[] = ["agent", "supervisor", "admin"];

function normalizeQuery(s: string): string {
  return s.trim().toLowerCase();
}

function omnichannelSeatQuoteErrorMessage(
  error: unknown,
  t: (key: string, options?: Record<string, string | number>) => string,
): string {
  const raw =
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";
  const msg = raw.trim();
  if (/omnichannel add-on not available for current plan/i.test(msg)) {
    return t("omnichannel.settings.userManagement.buySeatsQuoteAddonUnavailable");
  }
  if (/no headroom for additional omnichannel seats/i.test(msg)) {
    return t("omnichannel.settings.userManagement.buySeatsNoHeadroom");
  }
  if (/additional seats cannot exceed/i.test(msg)) {
    return t("omnichannel.settings.userManagement.buySeatsHeadroomExceededHint");
  }
  if (/no organization subscription/i.test(msg)) {
    return t("omnichannel.settings.userManagement.buySeatsNoOrgSubscription");
  }
  if (msg.length > 0) return msg;
  return t("omnichannel.settings.userManagement.buySeatsQuoteError");
}

export function UserManagementSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organizationId } = useActiveOrganization();
  const [roleFilter, setRoleFilter] = useState<UserManagementRoleFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [addOpen, setAddOpen] = useState(false);
  const [buySeatsOpen, setBuySeatsOpen] = useState(false);
  const [newEmployeeId, setNewEmployeeId] = useState<string>("");
  const [newRole, setNewRole] = useState<OmnichannelStaffRole>("agent");
  const [busyRosterId, setBusyRosterId] = useState<string | null>(null);
  const [additionalSeats, setAdditionalSeats] = useState(1);

  const { data: roster = [], isPending: rosterLoading } = useOrganizationOmnichannelStaff();
  const { data: candidates = [], isPending: candidatesLoading } = useOmnichannelStaffAddCandidates(roster);
  const { subscriptionStatus, refreshSubscriptionStatus, statusFetching } = useOptimizedSubscription({
    includePlans: false,
  });

  const seatCap = subscriptionStatus?.omnichannel_roster_seat_cap ?? 0;
  const paidOmnichannelSeats = subscriptionStatus?.omnichannel_paid_seat_count ?? 0;
  const hrMemberLimit = subscriptionStatus?.member_limit ?? subscriptionStatus?.member_count ?? 0;
  /** Max additional omnichannel seats you can still buy: HR member_count − already paid add-on seats (roster cap cannot exceed HR). */
  const omnichannelTopUpHeadroom = Math.max(0, hrMemberLimit - paidOmnichannelSeats);
  const maxAdditionalSeatsPurchase = Math.min(500, omnichannelTopUpHeadroom);

  /** Seat top-up pricing always follows HR subscription billing cycle (Model A). */
  const hrBillingCycle: "monthly" | "yearly" = useMemo(() => {
    const bc = subscriptionStatus?.billing_cycle;
    return bc === "yearly" || bc === "monthly" ? bc : "monthly";
  }, [subscriptionStatus?.billing_cycle]);

  /** Align seat counts with `/subscription/plans` before quoting Midtrans (same cache key; forces refresh after navigation). */
  useEffect(() => {
    if (!buySeatsOpen || !organizationId) return;
    refreshSubscriptionStatus();
  }, [buySeatsOpen, organizationId, refreshSubscriptionStatus]);

  const addStaff = useUpsertOrganizationOmnichannelStaff();
  const updateRole = useUpdateOrganizationOmnichannelStaffRole();
  const removeStaff = useRemoveOrganizationOmnichannelStaff();

  const { initiateMidtransPayment, isLoading: midtransLoading } = useMidtransPayment({
    onPaymentStatusChange: () => {
      if (organizationId) {
        void queryClient.invalidateQueries({ queryKey: subscriptionQueryKeys.status(organizationId) });
        void queryClient.invalidateQueries({ queryKey: organizationOmnichannelStaffQueryKey(organizationId) });
      }
    },
    onPaymentClose: (path) => {
      navigate(path);
    },
  });

  const seatsToQuote =
    maxAdditionalSeatsPurchase < 1
      ? 0
      : Math.max(1, Math.min(maxAdditionalSeatsPurchase, Math.round(Number(additionalSeats)) || 1));

  useEffect(() => {
    if (!buySeatsOpen) return;
    if (maxAdditionalSeatsPurchase < 1) return;
    setAdditionalSeats((prev) => Math.min(maxAdditionalSeatsPurchase, Math.max(1, prev)));
  }, [buySeatsOpen, maxAdditionalSeatsPurchase]);

  const {
    data: quoteAmount,
    isFetching: quoteLoading,
    isError: quoteFailed,
    error: quoteError,
  } = useQuery({
    queryKey: [
      "omnichannel-seat-topup-quote",
      organizationId,
      seatsToQuote,
      hrBillingCycle,
      buySeatsOpen,
      hrMemberLimit,
      paidOmnichannelSeats,
    ],
    queryFn: async () => {
      if (!organizationId) throw new Error("No org");
      const { data, error } = await supabase.rpc("compute_omnichannel_seat_topup_amount", {
        p_org_id: organizationId,
        p_additional_seats: seatsToQuote,
        p_billing_cycle: hrBillingCycle,
      });
      if (error) throw error;
      return Math.round(Number(data));
    },
    enabled:
      Boolean(organizationId) &&
      buySeatsOpen &&
      maxAdditionalSeatsPurchase >= 1 &&
      seatsToQuote >= 1 &&
      !statusFetching,
    staleTime: 30_000,
  });

  const rows: OmnichannelUserManagementRow[] = useMemo(
    () =>
      roster.map((r) => ({
        rosterId: r.id,
        employeeId: r.employee_id,
        fullName: r.employees?.full_name ?? "",
        presenceStatus: "offline" as const,
        phone: "",
        email: r.employees?.email ?? "",
        role: r.role,
      })),
    [roster],
  );

  const filteredRows = useMemo(() => {
    const q = normalizeQuery(search);
    return rows.filter((row) => {
      if (roleFilter !== "all" && row.role !== roleFilter) return false;
      if (!q) return true;
      return (
        row.fullName.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        row.phone.toLowerCase().includes(q) ||
        row.role.toLowerCase().includes(q)
      );
    });
  }, [roleFilter, search, rows]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const safePage = Math.min(page, pageCount);
  const startIdx = (safePage - 1) * rowsPerPage;
  const pageRows = filteredRows.slice(startIdx, startIdx + rowsPerPage);
  const showingFrom = filteredRows.length === 0 ? 0 : startIdx + 1;
  const showingTo = filteredRows.length === 0 ? 0 : Math.min(startIdx + pageRows.length, filteredRows.length);

  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(1, Math.ceil(filteredRows.length / rowsPerPage) || 1)));
  }, [filteredRows.length, rowsPerPage]);

  const rosterAtOrOverCap = roster.length >= seatCap;

  const handleAddUserClick = () => {
    if (rosterAtOrOverCap) {
      setAdditionalSeats(1);
      setBuySeatsOpen(true);
      return;
    }
    setNewEmployeeId("");
    setNewRole("agent");
    setAddOpen(true);
  };

  const handleAddSubmit = async () => {
    if (!newEmployeeId) {
      toast.error(t("omnichannel.settings.userManagement.selectEmployeeFirst"));
      return;
    }
    try {
      await addStaff.mutateAsync({
        employeeId: newEmployeeId,
        role: newRole,
        maxRosterSlots: seatCap,
      });
      toast.success(t("omnichannel.settings.userManagement.addedToRoster"));
      setAddOpen(false);
    } catch (e) {
      if ((e as Error)?.message === "ROSTER_FULL") {
        toast.error(t("omnichannel.settings.userManagement.rosterFullHint", { seats: seatCap }));
      } else {
        toast.error(t("omnichannel.settings.userManagement.addFailed"));
      }
    }
  };

  const handlePayForSeats = async () => {
    if (maxAdditionalSeatsPurchase < 1 || seatsToQuote < 1 || seatsToQuote > maxAdditionalSeatsPurchase) {
      toast.error(t("omnichannel.settings.userManagement.buySeatsQuoteError"));
      return;
    }
    if (!organizationId || quoteAmount == null || !Number.isFinite(quoteAmount) || quoteAmount <= 0) {
      toast.error(t("omnichannel.settings.userManagement.buySeatsQuoteError"));
      return;
    }
    try {
      await initiateMidtransPayment({
        planName: t("omnichannel.settings.userManagement.buySeatsPlanName"),
        amount: quoteAmount,
        memberCount: seatsToQuote,
        billingCycle: hrBillingCycle,
        purchaseKind: "omnichannel_seats",
        additionalSeats: seatsToQuote,
        checkoutSuccessRelativePath: omnichannelSettingsPath("user-management"),
      });
      setBuySeatsOpen(false);
    } catch {
      toast.error(t("omnichannel.settings.userManagement.buySeatsPayFailed"));
    }
  };

  const handleRoleChange = async (rosterId: string, role: OmnichannelStaffRole) => {
    setBusyRosterId(rosterId);
    try {
      await updateRole.mutateAsync({ id: rosterId, role });
    } catch {
      toast.error(t("omnichannel.settings.userManagement.updateRoleFailed"));
    } finally {
      setBusyRosterId(null);
    }
  };

  const handleRemove = async (row: OmnichannelUserManagementRow) => {
    const ok = window.confirm(t("omnichannel.settings.userManagement.confirmRemoveRoster"));
    if (!ok) return;
    setBusyRosterId(row.rosterId);
    try {
      await removeStaff.mutateAsync(row.rosterId);
      toast.success(t("omnichannel.settings.userManagement.removedFromRoster"));
    } catch {
      toast.error(t("omnichannel.settings.userManagement.errorRemoveAssigned"));
    } finally {
      setBusyRosterId(null);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
      <div
        className={cn(
          OMNICHANNEL_SETTINGS_CARD_HEADER_BASE,
          "flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between",
        )}
      >
        <div className="min-w-0 lg:min-w-0 lg:flex-1 lg:pr-2">
          <h3 className={OMNICHANNEL_SETTINGS_CARD_TITLE_CLASS}>
            {t("omnichannel.settings.userManagement.pageTitle")}
          </h3>
          <p className={OMNICHANNEL_SETTINGS_CARD_SUBTITLE_CLASS}>
            {t("omnichannel.settings.userManagement.rosterSeatHint", {
              current: roster.length,
              seats: seatCap,
              paid: paidOmnichannelSeats,
              hr: hrMemberLimit,
            })}
          </p>
        </div>
        <UserManagementToolbar
          headerCluster
          className="lg:max-w-[min(100%,640px)]"
          roleFilter={roleFilter}
          onRoleFilterChange={(v) => {
            setRoleFilter(v);
            setPage(1);
          }}
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          roleOptionValues={ROLE_FILTER_DB}
          endContent={
            <Button
              type="button"
              size="sm"
              className="shrink-0 gap-1"
              onClick={handleAddUserClick}
              disabled={rosterLoading || candidatesLoading}
            >
              <Plus className="h-4 w-4" />
              {t("omnichannel.settings.userManagement.addUser")}
            </Button>
          }
        />
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("omnichannel.settings.userManagement.addToRosterTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <span className="text-sm font-medium">{t("omnichannel.settings.userManagement.colName")}</span>
              <Select value={newEmployeeId || undefined} onValueChange={setNewEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("omnichannel.settings.userManagement.selectEmployeePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name || c.email || c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-sm font-medium">{t("omnichannel.settings.userManagement.colRole")}</span>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as OmnichannelStaffRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_FILTER_DB.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r === "admin"
                        ? t("omnichannel.settings.userManagement.roleAdminOmnichannel")
                        : t(`omnichannel.settings.userManagement.role.${r}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              {t("omnichannel.settings.userManagement.cancel")}
            </Button>
            <Button type="button" onClick={handleAddSubmit} disabled={addStaff.isPending || !newEmployeeId}>
              {t("omnichannel.settings.userManagement.saveAdd")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={buySeatsOpen} onOpenChange={setBuySeatsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("omnichannel.settings.userManagement.buySeatsTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <p className="text-muted-foreground">{t("omnichannel.settings.userManagement.buySeatsSubtitle")}</p>
            <div className="space-y-2">
              <Label htmlFor="omni-additional-seats">{t("omnichannel.settings.userManagement.buySeatsAdditionalLabel")}</Label>
              <Input
                id="omni-additional-seats"
                type="number"
                min={1}
                max={maxAdditionalSeatsPurchase >= 1 ? maxAdditionalSeatsPurchase : 1}
                disabled={maxAdditionalSeatsPurchase < 1}
                value={additionalSeats}
                onChange={(e) => {
                  if (maxAdditionalSeatsPurchase < 1) return;
                  setAdditionalSeats(
                    Math.max(1, Math.min(maxAdditionalSeatsPurchase, Math.round(Number(e.target.value)) || 1)),
                  );
                }}
              />
              {maxAdditionalSeatsPurchase >= 1 ? (
                <p className="text-xs text-muted-foreground">
                  {t("omnichannel.settings.userManagement.buySeatsHeadroomHint", {
                    max: maxAdditionalSeatsPurchase,
                    hr: hrMemberLimit,
                    paid: paidOmnichannelSeats,
                  })}
                </p>
              ) : (
                <p className="text-xs text-destructive">
                  {t("omnichannel.settings.userManagement.buySeatsNoHeadroom")}
                </p>
              )}
            </div>
            <div className="space-y-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">
                {t("omnichannel.settings.userManagement.buySeatsBillingLabel")}
              </p>
              <p>
                {t("omnichannel.settings.userManagement.buySeatsBillingFollowsHr", {
                  cycle: t(
                    hrBillingCycle === "yearly"
                      ? "omnichannel.settings.userManagement.buySeatsBillingYearly"
                      : "omnichannel.settings.userManagement.buySeatsBillingMonthly",
                  ),
                })}
              </p>
              <p className="text-[11px] text-muted-foreground/90">
                {t("omnichannel.settings.userManagement.buySeatsBillingHint")}
              </p>
            </div>
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <div className="flex justify-between font-medium">
                <span>{t("omnichannel.settings.userManagement.buySeatsTotalLabel")}</span>
                <span>
                  {quoteLoading ? "…" : quoteAmount != null ? formatIDR(quoteAmount) : "—"}
                </span>
              </div>
              {quoteFailed && (
                <p className="mt-2 text-xs text-destructive">
                  {omnichannelSeatQuoteErrorMessage(quoteError, t)}
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setBuySeatsOpen(false)}>
              {t("omnichannel.settings.userManagement.cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => void handlePayForSeats()}
              disabled={
                midtransLoading ||
                quoteLoading ||
                maxAdditionalSeatsPurchase < 1 ||
                seatsToQuote < 1 ||
                quoteAmount == null ||
                quoteAmount <= 0
              }
            >
              {t("omnichannel.settings.userManagement.buySeatsPayCta")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <UserManagementTable
            rows={pageRows}
            onRoleChange={handleRoleChange}
            onRemove={handleRemove}
            busyRosterId={busyRosterId}
          />
        </div>

        <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
          <UserManagementPagination
            page={safePage}
            pageCount={pageCount}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(n) => {
              setRowsPerPage(n);
              setPage(1);
            }}
            onPageChange={(p) => setPage(p)}
            totalFiltered={filteredRows.length}
            showingFrom={showingFrom}
            showingTo={showingTo}
          />
        </div>
      </div>
    </div>
  );
}
