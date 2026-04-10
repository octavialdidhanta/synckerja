import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/features/ui/dialog";
import { Badge } from "@/features/ui/badge";
import { Button } from "@/features/ui/button";
import { Label } from "@/features/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/features/ui/select";
import { Textarea } from "@/features/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/features/ui/card";
import { Separator } from "@/features/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/features/ui/tabs";
import { formatToRupiah } from "@/utils/formatCurrency";
import { format } from "date-fns";
import { PurchaseRequest, useUpdatePurchaseRequestStatus } from "@/features/9_request-form/hooks/usePurchaseRequests";
import { useExpenseTypes } from "@/features/4_2_dashboard/hooks/useExpenseTypes";
import { useExpenseCategories } from "@/features/4_2_dashboard/hooks/useExpenseCategories";
import { useDebtsForExpense } from "@/features/4_2_dashboard/hooks/useDebtsForExpense";
import { useBankAccounts } from "@/hooks/organized/useBankAccounts";
import { useBankAccountBalances } from "@/hooks/organized/useBankAccountBalances";
import { useCurrentUserRole } from "@/features/share/hooks/useCurrentUserRole";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { useToast } from "@/features/ui/use-toast";
import { Calendar, User, Building, DollarSign, FileText, Target, Zap, TrendingUp, ThumbsUp, ThumbsDown } from "lucide-react";
import { PurchaseRequestPDFViewer } from "@/features/4_2_approvals/PurchaseRequestPDFViewer";
import { useIsMobile } from "@/mobile/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface MobilePurchaseRequestDetailsModalProps {
  request: PurchaseRequest | null;
  isOpen: boolean;
  onClose: () => void;
}

export const MobilePurchaseRequestDetailsModal = ({ request, isOpen, onClose }: MobilePurchaseRequestDetailsModalProps) => {
  const isMobile = useIsMobile();
  const [selectedExpenseTypeId, setSelectedExpenseTypeId] = useState<string>(request?.expense_type_id || "");
  const [selectedExpenseCategoryId, setSelectedExpenseCategoryId] = useState<string>(request?.expense_category_id || "");
  const [selectedWithdrawalFromBalance, setSelectedWithdrawalFromBalance] = useState<string | undefined>(request?.withdrawal_from_balance);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | undefined>(request?.bank_account_id);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectionTextarea, setShowRejectionTextarea] = useState(false);

  const { expenseTypes } = useExpenseTypes();
  const { expenseCategories } = useExpenseCategories(selectedExpenseTypeId);
  const { debts: debtsForExpense } = useDebtsForExpense();
  const { bankAccounts } = useBankAccounts();
  const { balances: bankAccountBalances } = useBankAccountBalances();
  const { data: userRole } = useCurrentUserRole();
  const { t } = useAppTranslation();
  const updateStatus = useUpdatePurchaseRequestStatus();
  const { toast } = useToast();

  useEffect(() => {
    if (request?.expense_type_id) setSelectedExpenseTypeId(request.expense_type_id);
    if (request?.expense_category_id) setSelectedExpenseCategoryId(request.expense_category_id);
    setSelectedWithdrawalFromBalance(request?.withdrawal_from_balance);
    setSelectedBankAccountId(request?.bank_account_id);
  }, [request?.expense_type_id, request?.expense_category_id, request?.withdrawal_from_balance, request?.bank_account_id]);

  useEffect(() => {
    setSelectedExpenseCategoryId("");
  }, [selectedExpenseTypeId]);

  if (!request) return null;

  const canApprove = userRole && ["owner", "admin", "hr"].includes(userRole);
  const canTakeAction = canApprove && (request.status === "submitted" || request.status === "pending_approval");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "pending_approval":
      case "submitted":
        return <Badge className="bg-blue-100 text-blue-800">Pending Approval</Badge>;
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  const handleApprove = async () => {
    if (!selectedExpenseTypeId || !selectedExpenseCategoryId) {
      toast({ title: "Required", description: "Please complete expense classification.", variant: "destructive" });
      return;
    }
    try {
      await updateStatus.mutateAsync({
        id: request.id,
        status: "approved",
        approvalNotes,
        expenseTypeId: selectedExpenseTypeId,
        expenseCategoryId: selectedExpenseCategoryId,
        withdrawalFromBalance: selectedWithdrawalFromBalance,
        bankAccountId: selectedBankAccountId,
      });
      toast({ title: "Request Approved", description: "Purchase request has been approved successfully." });
      onClose();
    } catch {
      toast({ title: "Error", description: "Failed to approve request. Please try again.", variant: "destructive" });
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({ title: "Rejection Reason Required", description: "Please provide a reason for rejection.", variant: "destructive" });
      return;
    }
    try {
      await updateStatus.mutateAsync({
        id: request.id,
        status: "rejected",
        rejectionReason,
      });
      toast({ title: "Request Rejected", description: "Purchase request has been rejected." });
      onClose();
    } catch {}
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          isMobile
            ? "fixed left-0 right-0 top-0 translate-x-0 translate-y-0 w-full max-w-none max-h-none rounded-none modal-above-safe-area flex flex-col p-0 gap-0 overflow-hidden"
            : "max-w-4xl max-h-[85vh] flex flex-col"
        )}
        fullscreenAnimation={isMobile}
      >
        <DialogHeader
          className={cn(
            "flex-shrink-0 border-b",
            isMobile
              ? "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left safe-area-top px-4 pt-4 pb-3"
              : ""
          )}
        >
          <DialogTitle className="flex items-center justify-between text-base font-semibold">
            <span>Request Details</span>
            {getStatusBadge(request.status)}
          </DialogTitle>
          <DialogDescription className="sr-only">Request details and approval actions</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 flex flex-col min-h-0 px-4 py-3">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details" className="text-sm">Detail</TabsTrigger>
            <TabsTrigger value="pdf" className="text-sm">PDF</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="flex-1 overflow-y-auto mt-4 seamless-scroll">
            <div className="space-y-4">
              <Card className="border-slate-200">
                <CardHeader className="px-4 py-3 pb-2"><CardTitle className="text-sm font-semibold">Basic Information</CardTitle></CardHeader>
                <CardContent className="px-4 py-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Info icon={<FileText className="h-4 w-4 text-slate-500 mt-0.5" />} label="Title" value={request.request_title} />
                    <Info icon={<DollarSign className="h-4 w-4 text-slate-500 mt-0.5" />} label="Amount" value={formatToRupiah(request.amount_idr)} />
                    <Info icon={<User className="h-4 w-4 text-slate-500 mt-0.5" />} label="Requester" value={request.requester_name} />
                    <Info icon={<Building className="h-4 w-4 text-slate-500 mt-0.5" />} label="Department" value={request.department_name || "Not specified"} />
                    <Info icon={<Calendar className="h-4 w-4 text-slate-500 mt-0.5" />} label="Created" value={format(new Date(request.created_at), "MMM dd, yyyy")} />
                    {request.is_recurring ? (
                      <Info icon={<TrendingUp className="h-4 w-4 text-purple-600 mt-0.5" />} label="Frequency" value={request.recurring_frequency || "-"} />
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader className="px-4 py-3 pb-2"><CardTitle className="text-sm font-semibold">Description</CardTitle></CardHeader>
                <CardContent className="px-4 py-3"><p className="text-slate-700 whitespace-pre-wrap text-sm">{request.description || "No description provided"}</p></CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Card className="border-slate-200">
                  <CardHeader className="px-4 py-3 pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Target className="h-4 w-4" />Company Benefit</CardTitle></CardHeader>
                  <CardContent className="px-4 py-3"><p className="text-slate-700 whitespace-pre-wrap text-sm">{request.company_benefit || "Not specified"}</p></CardContent>
                </Card>
                <Card className="border-slate-200">
                  <CardHeader className="px-4 py-3 pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Zap className="h-4 w-4" />Expected Outcome</CardTitle></CardHeader>
                  <CardContent className="px-4 py-3"><p className="text-slate-700 whitespace-pre-wrap text-sm">{request.expected_outcome || "Not specified"}</p></CardContent>
                </Card>
              </div>

              {canTakeAction ? (
                <>
                  <Separator className="my-3" />
                  <Card className="border-slate-200">
                    <CardHeader className="px-4 py-3 pb-2"><CardTitle className="text-sm font-semibold">Expense Classification</CardTitle></CardHeader>
                    <CardContent className="px-4 py-3 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Expense Type <span className="text-red-500">*</span></Label>
                          <Select value={selectedExpenseTypeId} onValueChange={setSelectedExpenseTypeId}>
                            <SelectTrigger><SelectValue placeholder="Select expense type" /></SelectTrigger>
                            <SelectContent>{expenseTypes.map((type) => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Expense Category <span className="text-red-500">*</span></Label>
                          <Select value={selectedExpenseCategoryId} onValueChange={setSelectedExpenseCategoryId}>
                            <SelectTrigger><SelectValue placeholder="Select expense category" /></SelectTrigger>
                            <SelectContent>{expenseCategories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{t("expenses.withdrawalFromBalanceOptional")}</Label>
                        <Select
                          value={selectedWithdrawalFromBalance ? `debt_${selectedWithdrawalFromBalance}` : selectedBankAccountId ? `bank_${selectedBankAccountId}` : "none"}
                          onValueChange={(value) => {
                            if (value === "none") {
                              setSelectedWithdrawalFromBalance(undefined);
                              setSelectedBankAccountId(undefined);
                            } else if (value.startsWith("debt_")) {
                              setSelectedWithdrawalFromBalance(value.replace("debt_", ""));
                              setSelectedBankAccountId(undefined);
                            } else if (value.startsWith("bank_")) {
                              setSelectedBankAccountId(value.replace("bank_", ""));
                              setSelectedWithdrawalFromBalance(undefined);
                            }
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder={t("expenses.selectSourceOptional")} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t("expenses.none")}</SelectItem>
                            {bankAccounts.map((bank) => {
                              const balance = bankAccountBalances.find((b) => b.bank_account_id === bank.id)?.balance ?? 0;
                              const text = bank.account_number ? `${bank.name} - ${bank.account_number} (Rp ${balance.toLocaleString("id-ID")} available)` : `${bank.name} (Rp ${balance.toLocaleString("id-ID")} available)`;
                              return <SelectItem key={`bank_${bank.id}`} value={`bank_${bank.id}`}>{text}</SelectItem>;
                            })}
                            {debtsForExpense.map((debt) => (
                              <SelectItem key={`debt_${debt.id}`} value={`debt_${debt.id}`}>
                                {debt.debt_name} (Rp {(debt.available_limit ?? 0).toLocaleString("id-ID")} available)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200">
                    <CardHeader className="px-4 py-3 pb-2"><CardTitle className="text-sm font-semibold">Approval Information</CardTitle></CardHeader>
                    <CardContent className="px-4 py-3 space-y-3">
                      {!showRejectionTextarea ? (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Approval Notes <span className="text-slate-500 text-xs font-normal">(Optional)</span></Label>
                          <Textarea value={approvalNotes} onChange={(e) => setApprovalNotes(e.target.value)} placeholder="Add any notes or comments for this approval..." rows={3} className="resize-none text-sm" />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Rejection Reason <span className="text-red-500">*</span></Label>
                          <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Please provide a clear reason for rejecting this request..." rows={3} className="resize-none text-sm" />
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="flex gap-2 justify-end">
                    {!showRejectionTextarea ? (
                      <>
                        <Button type="button" variant="outline" onClick={() => setShowRejectionTextarea(true)} className="text-red-600 border-red-300 hover:bg-red-50">
                          <ThumbsDown className="mr-2 h-4 w-4" />Reject
                        </Button>
                        <Button type="button" onClick={handleApprove} disabled={updateStatus.isPending || !selectedExpenseTypeId || !selectedExpenseCategoryId} className="bg-green-600 hover:bg-green-700 text-white">
                          <ThumbsUp className="mr-2 h-4 w-4" />{updateStatus.isPending ? "Approving..." : "Approve"}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button type="button" variant="outline" onClick={() => { setShowRejectionTextarea(false); setRejectionReason(""); }}>
                          Cancel
                        </Button>
                        <Button type="button" variant="destructive" onClick={handleReject} disabled={updateStatus.isPending || !rejectionReason.trim()}>
                          <ThumbsDown className="mr-2 h-4 w-4" />{updateStatus.isPending ? "Rejecting..." : "Confirm Reject"}
                        </Button>
                      </>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="pdf" className="flex-1 overflow-hidden mt-4">
            <div className="h-full min-h-[600px]">
              <PurchaseRequestPDFViewer request={request} />
            </div>
          </TabsContent>
        </Tabs>

        <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-sm">Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 mb-1">{label}</p>
        <p className="font-medium text-sm text-slate-900 break-words">{value}</p>
      </div>
    </div>
  );
}
