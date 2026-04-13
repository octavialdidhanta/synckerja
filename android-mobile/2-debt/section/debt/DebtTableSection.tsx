import { useMemo, useState } from "react";
import { format } from "date-fns";
import { cn } from "@/shared/lib/utils";
import { useIsMobile } from "@/mobile/shared/hooks/use-mobile";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { Debt } from "@/4-2-debt/types";
import { DEBT_TYPES } from "@/4-2-debt/types";
import { debtDisplayBalance, resolveDebtDisplay } from "@/4-2-debt/utils/resolveDebtDisplay";
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import { Card, CardContent } from "@/mobile-app/components/ui/card";
import { Button } from "@/mobile-app/components/ui/button";
import { Badge } from "@/mobile-app/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/mobile-app/components/ui/dropdown-menu";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/mobile-app/components/ui/drawer";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { MobileDebtTableBodyRows } from "@/mobile/2-debt/pages/MobileDebtPageSkeleton";
import { MOBILE_WIDE_FINANCE_TABLE_VIEWPORT_CLASS } from "@/mobile/shared/mobileWideFinanceTableViewport";
import {
  Activity,
  Building,
  Calendar,
  Check,
  ChevronDown,
  CreditCard,
  Edit,
  Eye,
  Filter,
  FilterX,
  MoreHorizontal,
  Plus,
  Trash2,
  X,
} from "lucide-react";

const SCROLL_HIDE =
  "scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

interface DebtTableSectionProps {
  debts: Debt[];
  isLoading: boolean;
  onAdd: () => void;
  onPayDebt: () => void;
  onEdit: (debt: Debt) => void;
  onDelete: (debtId: string) => void;
  onPaidClick: (debt: Debt) => void;
}

export function DebtTableSection({
  debts,
  isLoading,
  onAdd,
  onPayDebt,
  onEdit,
  onDelete,
  onPaidClick,
}: DebtTableSectionProps) {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();

  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const filteredDebts = useMemo(() => {
    return debts.filter((debt) => {
      const matchesType = filterType === "all" || debt.debt_type === filterType;
      const matchesStatus = filterStatus === "all" || debt.status === filterStatus;
      return matchesType && matchesStatus;
    });
  }, [debts, filterType, filterStatus]);

  const getStatusBadge = (status: string) => {
    if (status === "active") {
      return (
        <Badge className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
          {t("debt.status.active", "Active")}
        </Badge>
      );
    }
    if (status === "paid_off") {
      return (
        <Badge className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
          {t("debt.status.paidOff", "Paid Off")}
        </Badge>
      );
    }
    if (status === "closed") {
      return (
        <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs font-medium">
          {t("debt.status.closed", "Closed")}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs font-medium">
        {status}
      </Badge>
    );
  };

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 80) return "bg-brand-red";
    if (percentage >= 60) return "bg-orange-500";
    return "bg-green-600";
  };

  const clearFilters = () => {
    setFilterType("all");
    setFilterStatus("all");
  };

  const debtTypeOptions = [...DEBT_TYPES];

  const detailBody =
    selectedDebt != null ? (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t("debt.table.debtName", "Debt Name")}</label>
            <p className="mt-1 text-sm font-semibold">{selectedDebt.debt_name}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t("debt.table.type", "Type")}</label>
            <p className="mt-1 text-sm">{selectedDebt.debt_type}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {t("debt.table.bankInstitution", "Bank/Institution")}
            </label>
            <p className="mt-1 text-sm">{selectedDebt.bank_name || "-"}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t("debt.table.status", "Status")}</label>
            <div className="mt-1">{getStatusBadge(selectedDebt.status)}</div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t("debt.table.totalLimit", "Total Limit")}</label>
            <p className="mt-1 text-sm font-semibold">{formatToRupiah(selectedDebt.limit_amount)}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t("debt.table.debt", "Debt")}</label>
            <p className="mt-1 text-sm font-semibold text-brand-red">
              {formatToRupiah(resolveDebtDisplay(selectedDebt).displayDebtAmount)}
            </p>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <div className={cn("min-w-0 w-full", isMobile && "flex min-h-0 min-w-0 flex-col")}>
      <Card
        className={cn(
          "w-full min-w-0 overflow-hidden border border-border bg-card",
          isMobile && "flex min-h-0 min-w-0 flex-col",
        )}
      >
        <CardContent className={cn("flex min-w-0 flex-col p-0", isMobile && "min-h-0 min-w-0 flex-col")}>
          <div className="min-w-0 flex-shrink-0 border-b bg-muted/50 px-1.5 py-1.5">
            <div className="flex w-full min-w-0 items-center gap-1">
              <Button
                size="sm"
                className="h-9 min-w-0 flex-1 gap-1 border-0 bg-brand-red px-2 text-white hover:bg-brand-red/90 focus-visible:ring-2 focus-visible:ring-brand-red/40 disabled:opacity-50"
                onClick={onAdd}
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{t("debt.add", "Add")}</span>
              </Button>
              <Button
                size="sm"
                className="h-9 min-w-0 flex-1 gap-1 border-0 bg-brand-blue px-2 text-white hover:bg-brand-blue/90 focus-visible:ring-2 focus-visible:ring-brand-blue/40 disabled:opacity-50"
                onClick={onPayDebt}
                disabled={
                  !debts.some((d) => {
                    if (d.status !== "active") return false;
                    return debtDisplayBalance(d) > 0;
                  })
                }
              >
                <Activity className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{t("debt.payment.buttonShort", "Pay")}</span>
              </Button>
              <Drawer open={filtersDrawerOpen} onOpenChange={setFiltersDrawerOpen}>
                <DrawerTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 min-w-0 flex-1 gap-1 px-2">
                    <Filter className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {filterType !== "all"
                        ? filterType
                        : filterStatus !== "all"
                          ? filterStatus
                          : t("expenses.filtersDrawerTitle", "Filter")}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  </Button>
                </DrawerTrigger>
                <DrawerContent className="flex max-h-[85dvh] flex-col">
                  <DrawerHeader className="safe-area-top px-4 pb-2 pt-4 text-left">
                    <DrawerTitle className="text-lg font-semibold">{t("expenses.filtersDrawerTitle", "Filter")}</DrawerTitle>
                  </DrawerHeader>
                  <div
                    className={cn(
                      "min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4 seamless-scroll",
                      SCROLL_HIDE,
                    )}
                  >
                    <div className="mb-4">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">{t("debt.table.type", "Type")}</p>
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        <button
                          type="button"
                          onClick={() => setFilterType("all")}
                          className={cn(
                            "flex w-full items-center justify-between border-b border-border px-3 py-2.5 text-left text-sm",
                            filterType === "all" ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted/50",
                          )}
                        >
                          <span>{t("debt.allTypes", "All Types")}</span>
                          {filterType === "all" ? <Check className="h-4 w-4 text-primary" /> : null}
                        </button>
                        {debtTypeOptions.map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setFilterType(type)}
                            className={cn(
                              "flex w-full items-center justify-between border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0",
                              filterType === type ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted/50",
                            )}
                          >
                            <span className="truncate">{type}</span>
                            {filterType === type ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">{t("debt.table.status", "Status")}</p>
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        {[
                          { key: "all", label: t("debt.allStatus", "All Status") },
                          { key: "active", label: t("debt.status.active", "Active") },
                          { key: "paid_off", label: t("debt.status.paidOff", "Paid Off") },
                          { key: "closed", label: t("debt.status.closed", "Closed") },
                        ].map((status) => (
                          <button
                            key={status.key}
                            type="button"
                            onClick={() => setFilterStatus(status.key)}
                            className={cn(
                              "flex w-full items-center justify-between border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0",
                              filterStatus === status.key
                                ? "bg-primary/10 font-medium text-primary"
                                : "hover:bg-muted/50",
                            )}
                          >
                            <span>{status.label}</span>
                            {filterStatus === status.key ? (
                              <Check className="h-4 w-4 shrink-0 text-primary" />
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center justify-between gap-2 border-t bg-muted/30 px-4 pb-3 pt-3">
                    <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                      {t("expenses.refreshFilters", "Reset")}
                    </Button>
                    <DrawerClose asChild>
                      <Button size="sm" className="min-w-[100px]">
                        {t("common.done", "Done")}
                      </Button>
                    </DrawerClose>
                  </div>
                </DrawerContent>
              </Drawer>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={clearFilters}
                title={t("expenses.refreshFilters", "Reset filters")}
              >
                <FilterX className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div
            className={cn(
              "nested-scroll-touch-chain min-h-0 min-w-0 overflow-x-auto overflow-y-auto seamless-scroll [touch-action:pan-x_pan-y]",
              SCROLL_HIDE,
              isMobile ? MOBILE_WIDE_FINANCE_TABLE_VIEWPORT_CLASS : "max-h-[50vh] flex-1",
            )}
          >
            <table className="min-w-[1600px] w-full">
              <thead className="sticky top-0 z-10 border-b border-white/20 bg-brand-blue">
                <tr>
                  <th className="bg-brand-blue px-2 py-2 text-left text-xs font-medium whitespace-nowrap text-white">
                    {t("debt.table.debtName", "Debt Name")}
                  </th>
                  <th className="bg-brand-blue px-2 py-2 text-left text-xs font-medium whitespace-nowrap text-white">
                    {t("debt.table.type", "Type")}
                  </th>
                  <th className="bg-brand-blue px-2 py-2 text-left text-xs font-medium whitespace-nowrap text-white">
                    {t("debt.table.bankInstitution", "Bank/Institution")}
                  </th>
                  <th className="bg-brand-blue px-2 py-2 text-left text-xs font-medium whitespace-nowrap text-white">
                    {t("debt.table.totalLimit", "Total Limit")}
                  </th>
                  <th className="bg-brand-blue px-2 py-2 text-left text-xs font-medium whitespace-nowrap text-white">
                    {t("debt.table.availableLimit", "Available Limit")}
                  </th>
                  <th className="bg-brand-blue px-2 py-2 text-left text-xs font-medium whitespace-nowrap text-white">
                    {t("debt.table.debt", "Debt")}
                  </th>
                  <th className="bg-brand-blue px-2 py-2 text-left text-xs font-medium whitespace-nowrap text-white">
                    {t("debt.table.paid", "Paid")}
                  </th>
                  <th className="bg-brand-blue px-2 py-2 text-left text-xs font-medium whitespace-nowrap text-white">
                    {t("debt.table.interest", "Interest (Rp)")}
                  </th>
                  <th className="bg-brand-blue px-2 py-2 text-left text-xs font-medium whitespace-nowrap text-white">
                    {t("debt.table.utilization", "Utilization")}
                  </th>
                  <th className="bg-brand-blue px-2 py-2 text-left text-xs font-medium whitespace-nowrap text-white">
                    {t("debt.table.dueDate", "Due Date")}
                  </th>
                  <th className="bg-brand-blue px-2 py-2 text-left text-xs font-medium whitespace-nowrap text-white">
                    {t("debt.table.lastPaymentDate", "Last Payment")}
                  </th>
                  <th className="bg-brand-blue px-2 py-2 text-left text-xs font-medium whitespace-nowrap text-white">
                    {t("debt.table.status", "Status")}
                  </th>
                  <th className="bg-brand-blue px-2 py-2 text-left text-xs font-medium whitespace-nowrap text-white">
                    {t("debt.table.actions", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <MobileDebtTableBodyRows />
                ) : filteredDebts.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-8 text-center text-gray-500">
                      <CreditCard className="mx-auto mb-2 h-12 w-12 text-gray-300" />
                      <p className="mb-1 text-sm text-gray-500">{t("debt.table.noData", "No debt data")}</p>
                      <p className="text-xs text-gray-400">{t("debt.table.addFirst", "Add your first debt to get started")}</p>
                    </td>
                  </tr>
                ) : (
                  filteredDebts.map((debt) => {
                    const {
                      displayLimitAmount,
                      displayAvailableLimit,
                      displayDebtAmount,
                      displayPaidAmount,
                      displayInterest,
                      utilization,
                    } = resolveDebtDisplay(debt);

                    return (
                      <tr key={debt.id} className="border-b hover:bg-muted/30">
                        <td className="max-w-[200px] min-w-0 px-2 py-2">
                          <div className="flex items-start gap-2">
                            <div className="flex-shrink-0 rounded-md bg-brand-blue/10 p-1.5">
                              <CreditCard className="h-3.5 w-3.5 text-brand-blue" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-medium text-foreground">{debt.debt_name}</div>
                              {debt.description ? (
                                <div className="mt-0.5 truncate text-xs text-muted-foreground">{debt.description}</div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-xs">
                          <Badge variant="outline" className="text-xs">
                            {debt.debt_type}
                          </Badge>
                        </td>
                        <td className="max-w-[150px] min-w-0 px-2 py-2">
                          <div className="flex items-center gap-2">
                            <div className="rounded-md bg-muted p-1">
                              <Building className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <span className="truncate text-xs text-foreground">{debt.bank_name || "-"}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-xs font-medium">{formatToRupiah(displayLimitAmount)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-xs font-medium text-green-600">
                          {formatToRupiah(displayAvailableLimit)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-xs font-bold text-red-600">
                          {formatToRupiah(displayDebtAmount)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-xs font-medium text-blue-600">
                          {displayPaidAmount != null && displayPaidAmount > 0 ? (
                            <button
                              type="button"
                              onClick={() => onPaidClick(debt)}
                              className="min-h-9 cursor-pointer touch-manipulation py-1 underline decoration-blue-600/60 underline-offset-2 hover:decoration-blue-600"
                            >
                              {formatToRupiah(displayPaidAmount)}
                            </button>
                          ) : (
                            formatToRupiah(displayPaidAmount ?? 0)
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-xs font-medium">
                          {displayInterest !== null && displayInterest > 0 ? formatToRupiah(displayInterest) : "-"}
                        </td>
                        <td className="min-w-[100px] px-2 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 rounded-full bg-gray-200">
                              <div
                                className={cn("h-2 rounded-full", getUtilizationColor(utilization))}
                                style={{ width: `${Math.min(utilization, 100)}%` }}
                              />
                            </div>
                            <span className="whitespace-nowrap text-xs text-muted-foreground">{utilization}%</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-xs">
                          {debt.due_date ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {format(new Date(debt.due_date), "dd MMM yyyy")}
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-xs">
                          {debt.last_payment_date ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {format(new Date(debt.last_payment_date), "dd MMM yyyy")}
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2">{getStatusBadge(debt.status)}</td>
                        <td className="whitespace-nowrap px-2 py-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-10 w-10 touch-manipulation p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedDebt(debt);
                                  setIsDetailModalOpen(true);
                                }}
                              >
                                <Eye className="mr-2 h-4 w-4 text-gray-600" />
                                {t("debt.detail.title", "Debt Details")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onEdit(debt)}>
                                <Edit className="mr-2 h-4 w-4 text-gray-600" />
                                {t("debt.form.editTitle", "Edit Debt")}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600" onClick={() => onDelete(debt.id)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t("debt.form.delete", "Delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex-shrink-0 border-t bg-muted/50 px-2 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {t("debt.table.showing", "Showing")} {filteredDebts.length} {t("debt.table.of", "of")} {debts.length}{" "}
                {t("debt.debts", "debts")}
              </span>
              <span>
                {t("debt.totalDebt", "Total Debt")}:{" "}
                <span className="font-bold text-red-600">
                  {formatToRupiah(filteredDebts.reduce((sum, d) => sum + debtDisplayBalance(d), 0))}
                </span>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent
          className={cn(
            isMobile
              ? "modal-above-safe-area fixed left-0 right-0 top-0 flex max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0"
              : "grid max-h-[90vh] w-[95vw] max-w-md gap-4 p-6",
          )}
          fullscreenAnimation={isMobile}
          hideCloseButton={isMobile}
        >
          {isMobile ? (
            <>
              <DialogHeader className="safe-area-top flex flex-shrink-0 flex-row flex-nowrap items-stretch gap-0 space-y-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 px-0 py-0 text-left dark:from-blue-950/20 dark:to-indigo-950/20">
                <div className="flex w-full min-w-0 items-center gap-1.5 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="m-0 flex min-h-0 min-w-0 items-center text-left text-base font-semibold leading-tight">
                      {t("debt.detail.title", "Debt Details")}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                      {t("debt.detail.description", "Complete information about this debt")}
                    </DialogDescription>
                  </div>
                  <DialogClose
                    type="button"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-blue/50 bg-background/80 p-0 text-muted-foreground ring-offset-background transition hover:bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <X className="block h-4 w-4 shrink-0" aria-hidden />
                    <span className="sr-only">{t("common.close", "Close")}</span>
                  </DialogClose>
                </div>
              </DialogHeader>
              <div
                className={cn(
                  "min-h-0 flex-1 overflow-x-hidden overflow-y-auto seamless-scroll px-4 py-4",
                  SCROLL_HIDE,
                )}
              >
                {detailBody}
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{t("debt.detail.title", "Debt Details")}</DialogTitle>
                <DialogDescription>{t("debt.detail.description", "Complete information about this debt")}</DialogDescription>
              </DialogHeader>
              <div className={cn("max-h-[60vh] overflow-y-auto overflow-x-hidden", SCROLL_HIDE)}>{detailBody}</div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
