import { useMemo, useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/mobile/hooks/use-mobile";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import type { Debt, CreateDebtData } from "@/features/4_2_debt/types";
import { debtDisplayBalance, resolveDebtDisplay } from "@/features/4_2_debt/utils/resolveDebtDisplay";
import { formatToRupiah } from "@/utils/formatCurrency";
import { Card, CardContent } from "@/mobile/components/ui/card";
import { Button } from "@/mobile/components/ui/button";
import { Badge } from "@/mobile/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/mobile/components/ui/dropdown-menu";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/mobile/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/features/ui/dialog";
import { Skeleton } from "@/mobile/components/ui/skeleton";
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
} from "lucide-react";

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
        <Badge className="bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded-full">
          {t("debt.status.active", "Active")}
        </Badge>
      );
    }
    if (status === "paid_off") {
      return (
        <Badge className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">
          {t("debt.status.paidOff", "Paid Off")}
        </Badge>
      );
    }
    if (status === "closed") {
      return (
        <Badge variant="secondary" className="text-xs font-medium px-2 py-0.5 rounded-full">
          {t("debt.status.closed", "Closed")}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-xs font-medium px-2 py-0.5 rounded-full">
        {status}
      </Badge>
    );
  };

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 80) return "bg-red-500";
    if (percentage >= 60) return "bg-orange-500";
    return "bg-green-500";
  };

  const clearFilters = () => {
    setFilterType("all");
    setFilterStatus("all");
  };

  const debtTypeOptions: CreateDebtData["debt_type"][] = [
    "Kartu Kredit",
    "Pinjaman Bank",
    "Hutang Supplier",
    "Pinjaman Online",
    "Hutang Pribadi",
    "Lainnya",
  ];

  return (
    <div className="px-2 pt-4 pb-6">
      <Card className="w-full min-w-0 border border-border bg-card overflow-hidden">
        <CardContent className="p-0 flex flex-col min-w-0">
          <div className="px-1.5 py-1.5 border-b bg-muted/50 flex-shrink-0 min-w-0">
            <div className="flex items-center gap-1 min-w-0 w-full">
                <Button size="sm" className="h-9 flex-1 bg-primary gap-1 px-2 min-w-0" onClick={onAdd}>
                  <Plus className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap">{t("debt.add", "Add")}</span>
                </Button>
                <Button
                  size="sm"
                  className="h-9 flex-1 bg-green-600 hover:bg-green-700 text-white gap-1 px-2 min-w-0"
                  onClick={onPayDebt}
                  disabled={!debts.some((d) => {
                    if (d.status !== "active") return false;
                    return debtDisplayBalance(d) > 0;
                  })}
                >
                  <Activity className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap">{t("debt.payment.button", "Pay Debt")}</span>
                </Button>
                <Drawer open={filtersDrawerOpen} onOpenChange={setFiltersDrawerOpen}>
                  <DrawerTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 flex-1 gap-1 px-2 min-w-0">
                      <Filter className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{filterType !== "all" ? filterType : filterStatus !== "all" ? filterStatus : t("expenses.filtersDrawerTitle", "Filter")}</span>
                      <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent className="max-h-[85dvh] flex flex-col">
                    <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                      <DrawerTitle className="text-lg font-semibold">
                        {t("expenses.filtersDrawerTitle", "Filter")}
                      </DrawerTitle>
                    </DrawerHeader>
                    <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4 seamless-scroll">
                      <div className="mb-4">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          {t("debt.table.type", "Type")}
                        </p>
                        <div className="flex flex-col gap-0 rounded-md border bg-card">
                          <button
                            type="button"
                            onClick={() => setFilterType("all")}
                            className={cn(
                              "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border",
                              filterType === "all" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
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
                                "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0",
                                filterType === type ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                              )}
                            >
                              <span className="truncate">{type}</span>
                              {filterType === type ? <Check className="h-4 w-4 text-primary flex-shrink-0" /> : null}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mb-4">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          {t("debt.table.status", "Status")}
                        </p>
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
                                "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0",
                                filterStatus === status.key ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                              )}
                            >
                              <span>{status.label}</span>
                              {filterStatus === status.key ? <Check className="h-4 w-4 text-primary flex-shrink-0" /> : null}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0 border-t bg-muted/30 px-4 pt-3 pb-3 flex items-center justify-between gap-2">
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
                  className="h-9 w-9 flex-shrink-0"
                  onClick={clearFilters}
                  title={t("expenses.refreshFilters", "Reset filters")}
                >
                  <FilterX className="h-4 w-4" />
                </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0 min-w-0 overflow-x-auto overflow-y-auto seamless-scroll nested-scroll-touch-chain-xy touch-pan-x max-h-[50vh]">
            <table className="w-full min-w-[1600px]">
              <thead className="border-b border-slate-400/50 sticky top-0 z-10 bg-slate-500">
                <tr>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">{t("debt.table.debtName", "Debt Name")}</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">{t("debt.table.type", "Type")}</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">{t("debt.table.bankInstitution", "Bank/Institution")}</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">{t("debt.table.totalLimit", "Total Limit")}</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">{t("debt.table.availableLimit", "Available Limit")}</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">{t("debt.table.debt", "Debt")}</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">{t("debt.table.paid", "Paid")}</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">{t("debt.table.interest", "Interest (Rp)")}</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">{t("debt.table.utilization", "Utilization")}</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">{t("debt.table.dueDate", "Due Date")}</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">{t("debt.table.lastPaymentDate", "Last Payment")}</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">{t("debt.table.status", "Status")}</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">{t("debt.table.actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, rowIndex) => (
                    <tr key={rowIndex} className="border-b">
                      <td className="py-2 px-2"><Skeleton className="h-4 w-full max-w-[120px]" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-4 w-20" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-4 w-20" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-4 w-16" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-4 w-16" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-4 w-16" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-4 w-16" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-4 w-16" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-4 w-20" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-4 w-16" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-4 w-16" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-5 w-16 rounded-full" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-8 w-8 rounded" /></td>
                    </tr>
                  ))
                ) : filteredDebts.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-8 text-center text-gray-500">
                      <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 mb-1">{t("debt.table.noData", "No debt data")}</p>
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
                        <td className="py-2 px-2 max-w-[200px] min-w-0">
                          <div className="flex items-start gap-2">
                            <div className="p-1.5 rounded-md bg-blue-50 flex-shrink-0">
                              <CreditCard className="h-3.5 w-3.5 text-blue-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-foreground truncate text-xs">{debt.debt_name}</div>
                              {debt.description && (
                                <div className="text-xs text-muted-foreground truncate mt-0.5">{debt.description}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap text-xs">
                          <Badge variant="outline" className="text-xs">{debt.debt_type}</Badge>
                        </td>
                        <td className="py-2 px-2 max-w-[150px] min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="p-1 rounded-md bg-muted"><Building className="h-3 w-3 text-muted-foreground" /></div>
                            <span className="text-xs text-foreground truncate">{debt.bank_name || "-"}</span>
                          </div>
                        </td>
                        <td className="py-2 px-2 font-medium whitespace-nowrap text-xs">{formatToRupiah(displayLimitAmount)}</td>
                        <td className="py-2 px-2 font-medium whitespace-nowrap text-xs text-green-600">{formatToRupiah(displayAvailableLimit)}</td>
                        <td className="py-2 px-2 font-bold whitespace-nowrap text-xs text-red-600">{formatToRupiah(displayDebtAmount)}</td>
                        <td className="py-2 px-2 font-medium whitespace-nowrap text-xs text-blue-600">
                          {displayPaidAmount != null && displayPaidAmount > 0 ? (
                            <button
                              type="button"
                              onClick={() => onPaidClick(debt)}
                              className="cursor-pointer underline decoration-blue-600/60 underline-offset-2 hover:decoration-blue-600 py-1 min-h-9 touch-manipulation"
                            >
                              {formatToRupiah(displayPaidAmount)}
                            </button>
                          ) : (
                            formatToRupiah(displayPaidAmount ?? 0)
                          )}
                        </td>
                        <td className="py-2 px-2 font-medium whitespace-nowrap text-xs">
                          {displayInterest !== null && displayInterest > 0 ? formatToRupiah(displayInterest) : "-"}
                        </td>
                        <td className="py-2 px-2 min-w-[100px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div className={`h-2 rounded-full ${getUtilizationColor(utilization)}`} style={{ width: `${Math.min(utilization, 100)}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{utilization}%</span>
                          </div>
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap text-xs">
                          {debt.due_date ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {format(new Date(debt.due_date), "dd MMM yyyy")}
                            </div>
                          ) : "-"}
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap text-xs">
                          {debt.last_payment_date ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {format(new Date(debt.last_payment_date), "dd MMM yyyy")}
                            </div>
                          ) : "-"}
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">{getStatusBadge(debt.status)}</td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-10 w-10 p-0 touch-manipulation">
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
                                <Eye className="h-4 w-4 mr-2 text-gray-600" />
                                {t("debt.detail.title", "Debt Details")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onEdit(debt)}>
                                <Edit className="h-4 w-4 mr-2 text-gray-600" />
                                {t("debt.form.editTitle", "Edit Debt")}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600" onClick={() => onDelete(debt.id)}>
                                <Trash2 className="h-4 w-4 mr-2" />
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

          <div className="px-2 py-2 border-t bg-muted/50 flex-shrink-0">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {t("debt.table.showing", "Showing")} {filteredDebts.length} {t("debt.table.of", "of")} {debts.length} {t("debt.debts", "debts")}
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
              ? "fixed left-0 right-0 top-0 translate-x-0 translate-y-0 w-full max-w-none max-h-none rounded-none modal-above-safe-area flex flex-col p-0 gap-0 overflow-hidden"
              : "w-[95vw] max-w-md max-h-[90vh] grid gap-4 p-6"
          )}
          fullscreenAnimation={isMobile}
        >
          {isMobile ? (
            <>
              <DialogHeader className="flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left safe-area-top px-4 pt-4 pb-3">
                <DialogTitle className="text-lg font-semibold">
                  {t("debt.detail.title", "Debt Details")}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {t("debt.detail.description", "Complete information about this debt")}
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll px-4 py-4">
                {selectedDebt && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">{t("debt.table.debtName", "Debt Name")}</label>
                        <p className="text-sm font-semibold mt-1">{selectedDebt.debt_name}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">{t("debt.table.type", "Type")}</label>
                        <p className="text-sm mt-1">{selectedDebt.debt_type}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">{t("debt.table.bankInstitution", "Bank/Institution")}</label>
                        <p className="text-sm mt-1">{selectedDebt.bank_name || "-"}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">{t("debt.table.status", "Status")}</label>
                        <div className="mt-1">{getStatusBadge(selectedDebt.status)}</div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">{t("debt.table.totalLimit", "Total Limit")}</label>
                        <p className="text-sm font-semibold mt-1">{formatToRupiah(selectedDebt.limit_amount)}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">{t("debt.table.debt", "Debt")}</label>
                        <p className="text-sm font-semibold mt-1 text-red-600">
                          {formatToRupiah(resolveDebtDisplay(selectedDebt).displayDebtAmount)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
                <div className="flex items-center justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsDetailModalOpen(false)}>
                    {t("common.close", "Close")}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
