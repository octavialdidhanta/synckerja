import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Search, Filter, FilterX, ChevronDown, Check, CreditCard, User, Building, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/mobile/components/ui/card";
import { Button } from "@/mobile/components/ui/button";
import { Input } from "@/mobile/components/ui/input";
import { Badge } from "@/mobile/components/ui/badge";
import { Skeleton } from "@/mobile/components/ui/skeleton";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/mobile/components/ui/drawer";
import { usePurchaseRequests, type PurchaseRequest } from "@/features/9_request-form/hooks/usePurchaseRequests";
import { filterRequests } from "@/features/4_2_approvals/utils/approvalUtils";
import { formatToRupiah } from "@/utils/formatCurrency";
import { MobileApprovalActionsDropdown } from "@/mobile/pages/expenses/approvals/section/MobileApprovalActionsDropdown";

interface ApprovalFiltersType {
  search: string;
  status: string;
  type: string;
  department: string;
}

export function ApprovalsTableSection() {
  const { data: requests = [], isLoading } = usePurchaseRequests();
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  const filters: ApprovalFiltersType = {
    search: searchQuery,
    status: statusFilter,
    type: typeFilter,
    department: departmentFilter,
  };

  const filteredRequests = useMemo(
    () => filterRequests(requests as PurchaseRequest[], filters as any),
    [requests, filters]
  );

  const uniqueDepartments = useMemo(() => {
    return Array.from(
      new Set(
        requests
          .map((r) => r.department_name)
          .filter((v): v is string => !!v && v.trim().length > 0)
      )
    ).sort();
  }, [requests]);

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
    setDepartmentFilter("all");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="text-xs font-medium px-2 py-0.5 rounded-full">Rejected</Badge>;
      case "pending_approval":
      case "submitted":
        return <Badge className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">Pending</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs font-medium px-2 py-0.5 rounded-full">Draft</Badge>;
    }
  };

  const getTypeDisplay = (request: PurchaseRequest) => {
    if (request.request_type === "reimbursement") return request.reimbursement_type || "Reimbursement";
    return request.purchase_type || "Purchase";
  };

  return (
    <div className="px-2 pt-4 pb-6">
      <Card className="w-full min-w-0 border border-border bg-card overflow-hidden">
        <CardContent className="p-0 flex flex-col min-w-0">
          <div className="px-1.5 py-1.5 border-b bg-muted/50 flex-shrink-0 min-w-0">
            <div className="flex items-center gap-1 min-w-0 w-full">
              <div className="relative flex-[1_1_auto] min-w-0">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
                <Input
                  placeholder="Search requests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 w-full min-w-0 pr-2 !text-[11px] placeholder:!text-[11px]"
                />
              </div>
              <Drawer open={filtersDrawerOpen} onOpenChange={setFiltersDrawerOpen}>
                <DrawerTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 w-auto gap-1 px-2 min-w-[88px] shrink-0">
                    <Filter className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">Filter</span>
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  </Button>
                </DrawerTrigger>
                <DrawerContent className="max-h-[85dvh] flex flex-col">
                  <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                    <DrawerTitle className="text-lg font-semibold">Filter</DrawerTitle>
                  </DrawerHeader>
                  <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4 seamless-scroll">
                    <div className="mb-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Status</p>
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        {[
                          { value: "all", label: "All Status" },
                          { value: "pending_approval", label: "Pending" },
                          { value: "submitted", label: "Submitted" },
                          { value: "approved", label: "Approved" },
                          { value: "rejected", label: "Rejected" },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setStatusFilter(opt.value)}
                            className={cn(
                              "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0",
                              statusFilter === opt.value ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                            )}
                          >
                            <span>{opt.label}</span>
                            {statusFilter === opt.value ? <Check className="h-4 w-4 text-primary" /> : null}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Type</p>
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        {[
                          { value: "all", label: "All Types" },
                          { value: "purchase", label: "Purchase" },
                          { value: "reimbursement", label: "Reimbursement" },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setTypeFilter(opt.value)}
                            className={cn(
                              "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0",
                              typeFilter === opt.value ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                            )}
                          >
                            <span>{opt.label}</span>
                            {typeFilter === opt.value ? <Check className="h-4 w-4 text-primary" /> : null}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Department</p>
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        <button
                          type="button"
                          onClick={() => setDepartmentFilter("all")}
                          className={cn(
                            "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border",
                            departmentFilter === "all" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                          )}
                        >
                          <span>All Departments</span>
                          {departmentFilter === "all" ? <Check className="h-4 w-4 text-primary" /> : null}
                        </button>
                        {uniqueDepartments.map((dept) => (
                          <button
                            key={dept}
                            type="button"
                            onClick={() => setDepartmentFilter(dept)}
                            className={cn(
                              "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0",
                              departmentFilter === dept ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                            )}
                          >
                            <span className="truncate">{dept}</span>
                            {departmentFilter === dept ? <Check className="h-4 w-4 text-primary" /> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 border-t bg-muted/30 px-4 pt-3 pb-3 flex items-center justify-between gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                      Reset
                    </Button>
                    <DrawerClose asChild>
                      <Button size="sm" className="min-w-[100px]">Done</Button>
                    </DrawerClose>
                  </div>
                </DrawerContent>
              </Drawer>
              <Button type="button" variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={clearFilters} title="Reset filters">
                <FilterX className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0 min-w-0 overflow-x-auto overflow-y-auto seamless-scroll nested-scroll-touch-chain-xy touch-pan-x max-h-[50vh]">
            <table className="w-full min-w-[1400px]">
              <thead className="border-b border-slate-400/50 sticky top-0 z-10 bg-slate-500">
                <tr>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs">Request</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs">Requester</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs">Department</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs">Amount</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs">Type</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs">Status</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs">Recurring</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs">Request Date</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs">Approved Date</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs">Approved By</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, rowIndex) => (
                    <tr key={rowIndex} className="border-b">
                      {Array.from({ length: 11 }).map((__, cellIndex) => (
                        <td key={cellIndex} className="py-2 px-2">
                          <Skeleton className="h-4 w-full max-w-[120px]" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-gray-500">
                      <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 mb-1">No approval requests found</p>
                      <p className="text-xs text-gray-400">Create your first approval request to get started</p>
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((request) => (
                    <tr key={request.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-2 text-xs max-w-[280px] w-[280px]">
                        <div className="flex items-start gap-2 min-w-0">
                          <div className="p-1.5 rounded-md bg-blue-50 flex-shrink-0">
                            <CreditCard className="h-3.5 w-3.5 text-blue-600" />
                          </div>
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="font-medium text-gray-900 truncate">{request.request_title}</div>
                            <div className="text-xs text-gray-500 truncate mt-0.5 line-clamp-2">
                              {request.description || "No description"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded-md bg-gray-100"><User className="h-3 w-3 text-gray-600" /></div>
                          <span className="font-medium text-gray-700">{request.requester_name}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-600">
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded-md bg-gray-100"><Building className="h-3 w-3 text-gray-600" /></div>
                          <span>{request.department_name || "Not specified"}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-xs"><div className="font-bold text-gray-900">{formatToRupiah(request.amount_idr)}</div></td>
                      <td className="py-2 px-2 text-xs"><Badge variant="outline" className="text-xs">{getTypeDisplay(request as PurchaseRequest)}</Badge></td>
                      <td className="py-2 px-2 text-xs">{getStatusBadge(request.status)}</td>
                      <td className="py-2 px-2 text-xs whitespace-nowrap">
                        <Badge variant={request.is_recurring ? "default" : "secondary"}>
                          {request.is_recurring ? "Recurring" : "One-time"}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-600">
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded-md bg-gray-100"><Calendar className="h-3 w-3 text-gray-600" /></div>
                          <span>{format(new Date(request.created_at || request.submitted_at || ""), "MMM dd, yyyy")}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-600">
                        {request.approved_at ? (
                          <div className="flex items-center gap-2">
                            <div className="p-1 rounded-md bg-gray-100"><Calendar className="h-3 w-3 text-gray-600" /></div>
                            <span>{format(new Date(request.approved_at), "MMM dd, yyyy")}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-600">
                        {request.approved_by_name ? <span className="font-medium">{request.approved_by_name}</span> : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="py-2 px-2 text-xs">
                        <MobileApprovalActionsDropdown requestId={request.id} status={request.status || ""} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
