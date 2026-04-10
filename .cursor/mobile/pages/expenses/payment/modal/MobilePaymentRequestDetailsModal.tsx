import { useEffect, useRef, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/features/ui/dialog";
import { Badge } from "@/features/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/features/ui/card";
import { Separator } from "@/features/ui/separator";
import { Button } from "@/features/ui/button";
import { Label } from "@/features/ui/label";
import { Input } from "@/features/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/features/ui/select";
import { format } from "date-fns";
import {
  CreditCard,
  User,
  Building,
  Calendar,
  FileText,
  DollarSign,
  Zap,
  TrendingUp,
  Upload,
  X,
  CheckCircle,
  Lock,
  Key,
} from "lucide-react";
import { formatToRupiah } from "@/utils/formatCurrency";
import { useCurrentOrg } from "@/features/share/hooks/useCurrentOrg";
import { useCurrentUser } from "@/features/share/hooks/useCurrentUser";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { useToast } from "@/features/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useExpenses } from "@/features/4_2_dashboard/hooks/useExpenses";
import { useDebtsForExpense } from "@/features/4_2_dashboard/hooks/useDebtsForExpense";
import { useBankAccounts } from "@/hooks/organized/useBankAccounts";
import { useBankAccountBalances } from "@/hooks/organized/useBankAccountBalances";
import { useUpdatePurchaseRequestStatus, type PurchaseRequest } from "@/features/9_request-form/hooks/usePurchaseRequests";
import { useIsMobile } from "@/mobile/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { IncomeAllocationOptionalSection } from "@/features/4-1-dashboard/components/IncomeAllocationOptionalSection";

interface MobilePaymentRequestDetailsModalProps {
  request: PurchaseRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export function MobilePaymentRequestDetailsModal({ request, isOpen, onClose, onRefresh }: MobilePaymentRequestDetailsModalProps) {
  const isMobile = useIsMobile();
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false);
  const [processWithdrawalFromBalance, setProcessWithdrawalFromBalance] = useState<string | undefined>(request?.withdrawal_from_balance);
  const [processBankAccountId, setProcessBankAccountId] = useState<string | undefined>(request?.bank_account_id);
  const [incomeAllocIncomeId, setIncomeAllocIncomeId] = useState("");
  const [incomeAllocAmountStr, setIncomeAllocAmountStr] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { organizationId } = useCurrentOrg();
  const { user } = useCurrentUser();
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const updateStatus = useUpdatePurchaseRequestStatus();
  const { createExpense, isCreating: isCreatingExpense } = useExpenses();
  const { debts: debtsForExpense, isLoading: debtsLoading } = useDebtsForExpense();
  const { bankAccounts, loading: bankAccountsLoading } = useBankAccounts();
  const { balances: bankAccountBalances, loading: balancesLoading } = useBankAccountBalances();

  useEffect(() => {
    if (!request) return;
    setProcessWithdrawalFromBalance(request.withdrawal_from_balance);
    setProcessBankAccountId(request.bank_account_id);
    setInvoiceFile(null);
    setIncomeAllocIncomeId("");
    setIncomeAllocAmountStr("");
  }, [request?.id, request?.withdrawal_from_balance, request?.bank_account_id]);

  if (!request) return null;

  const getStatusBadge = () => {
    if (request.paid_at || request.payment_status === "paid") {
      return <Badge className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">Paid</Badge>;
    }
    if (request.payment_status === "processing") {
      return <Badge className="bg-purple-100 text-purple-800 text-xs font-medium px-2 py-0.5 rounded-full">Processing</Badge>;
    }
    return <Badge className="bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5 rounded-full">Pending</Badge>;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Invalid File Type", description: "Please upload PDF/image file.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Max 10MB.", variant: "destructive" });
      return;
    }
    setInvoiceFile(file);
  };

  const handleRemoveFile = () => {
    setInvoiceFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleViewInvoice = async (filePath: string) => {
    const { data, error } = await supabase.storage.from("purchase-documents").createSignedUrl(filePath, 3600);
    if (error) {
      toast({ title: "Error", description: "Failed to open invoice.", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleUploadInvoice = async () => {
    if (!organizationId || !user) return;
    const hasInvoice = !!invoiceFile || !!request.invoice_file_path;
    if (!request.paid_at && !hasInvoice) {
      toast({ title: "Invoice required", description: "Please select invoice file.", variant: "destructive" });
      return;
    }
    if (!request.paid_at && !processWithdrawalFromBalance && !processBankAccountId) {
      toast({ title: t("expenses.withdrawalFromBalanceRequired", "Withdrawal source required"), description: t("expenses.withdrawalRequiredToast", "Please choose funding source."), variant: "destructive" });
      return;
    }

    const expenseTypeName = request.expense_types?.name ?? "";
    const expenseCategoryName = request.expense_categories?.name ?? "";
    if (!expenseTypeName || !expenseCategoryName) {
      toast({ title: "Error", description: "Request missing expense type/category.", variant: "destructive" });
      return;
    }

    setIsUploadingInvoice(true);
    try {
      let fileName: string;
      if (request.invoice_file_path) {
        fileName = request.invoice_file_path;
      } else if (invoiceFile) {
        fileName = `invoices/${organizationId}/${request.id}/${Date.now()}-${invoiceFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
        const { error: uploadError } = await supabase.storage.from("purchase-documents").upload(fileName, invoiceFile, { cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;
      } else {
        setIsUploadingInvoice(false);
        return;
      }

      await updateStatus.mutateAsync({
        id: request.id,
        status: request.status,
        invoiceFilePath: fileName,
        withdrawalFromBalance: processWithdrawalFromBalance,
        bankAccountId: processBankAccountId,
        markAsPaid: false,
      });

      const { data: existingExpense } = await supabase.from("expenses").select("id").eq("purchase_request_id", request.id).maybeSingle();
      if (!existingExpense) {
        let income_allocation: { income_transaction_id: string; amount: number } | undefined;
        if (processBankAccountId && incomeAllocIncomeId.trim()) {
          const raw = incomeAllocAmountStr.trim().replace(/\s/g, "").replace(/,/g, ".");
          const amt = parseFloat(raw);
          if (Number.isFinite(amt) && amt > 0) {
            income_allocation = { income_transaction_id: incomeAllocIncomeId.trim(), amount: amt };
          }
        }
        const created = await createExpense({
          expense_name: request.request_title,
          amount: request.amount_idr,
          expense_type: expenseTypeName,
          category: expenseCategoryName,
          department: request.department_name ?? undefined,
          create_date: format(new Date(), "yyyy-MM-dd"),
          is_recurring: false,
          description: request.description ?? undefined,
          withdrawal_from_balance: processWithdrawalFromBalance,
          bank_account_id: processBankAccountId,
          purchase_request_id: request.id,
          income_allocation,
        });
        if (!created) {
          toast({ title: "Expense creation failed", description: "Invoice saved, retry processing.", variant: "destructive" });
          onRefresh?.();
          setIsUploadingInvoice(false);
          return;
        }
      }

      await updateStatus.mutateAsync({ id: request.id, status: request.status, markAsPaid: true });

      toast({ title: "Success", description: "Payment processed." });
      setInvoiceFile(null);
      setProcessWithdrawalFromBalance(undefined);
      setProcessBankAccountId(undefined);
      setIncomeAllocIncomeId("");
      setIncomeAllocAmountStr("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      onClose();
      onRefresh?.();
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to process payment.", variant: "destructive" });
      onRefresh?.();
    } finally {
      setIsUploadingInvoice(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          isMobile
            ? "fixed left-0 right-0 top-0 translate-x-0 translate-y-0 w-full max-w-none max-h-none rounded-none modal-above-safe-area flex flex-col p-0 gap-0 overflow-hidden"
            : "max-w-2xl max-h-[80vh] overflow-y-auto"
        )}
        fullscreenAnimation={isMobile}
      >
        <DialogHeader className={cn("flex-shrink-0 border-b", isMobile ? "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left safe-area-top px-4 pt-4 pb-3" : "")}>
          <DialogTitle className="flex items-center justify-between text-sm font-semibold">
            <span>Payment Request Details</span>
            {getStatusBadge()}
          </DialogTitle>
          <DialogDescription className="sr-only">Payment request details</DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll px-4 py-4 space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="px-4 py-3 pb-2"><CardTitle className="text-[13px] font-semibold">Basic Information</CardTitle></CardHeader>
            <CardContent className="px-4 py-3">
              <div className="grid grid-cols-1 gap-3">
                <Info icon={<FileText className="h-4 w-4 text-slate-500 mt-0.5" />} label="Title" value={request.request_title} />
                <Info icon={<DollarSign className="h-4 w-4 text-slate-500 mt-0.5" />} label="Amount" value={formatToRupiah(request.amount_idr)} />
                <Info icon={<User className="h-4 w-4 text-slate-500 mt-0.5" />} label="Requester" value={request.requester_name} />
                <Info icon={<Building className="h-4 w-4 text-slate-500 mt-0.5" />} label="Department" value={request.department_name || "Not specified"} />
                <Info icon={<Calendar className="h-4 w-4 text-slate-500 mt-0.5" />} label="Approved Date" value={format(new Date(request.approved_at || request.created_at || ""), "MMM dd, yyyy")} />
                <Info icon={<CreditCard className="h-4 w-4 text-slate-500 mt-0.5" />} label="Type" value={request.request_type === "reimbursement" ? request.reimbursement_type || "Reimbursement" : request.purchase_type || "Purchase"} />
                {request.is_recurring ? <Info icon={<TrendingUp className="h-4 w-4 text-purple-600 mt-0.5" />} label="Frequency" value={request.recurring_frequency || "-"} /> : null}
              </div>
            </CardContent>
          </Card>

          {(request.account_username || request.account_password) && (
            <Card className="border-slate-200">
              <CardHeader className="px-4 py-3 pb-2"><CardTitle className="text-[13px] font-semibold flex items-center gap-2"><Key className="h-4 w-4" />Account Information</CardTitle></CardHeader>
              <CardContent className="px-4 py-3">
                <div className="grid grid-cols-1 gap-3">
                  {request.account_username ? <Info icon={<User className="h-4 w-4 text-slate-500 mt-0.5" />} label="Username/Email" value={request.account_username} /> : null}
                  {request.account_password ? <Info icon={<Lock className="h-4 w-4 text-slate-500 mt-0.5" />} label="Account Password" value={request.account_password} /> : null}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-slate-200">
            <CardHeader className="px-4 py-3 pb-2"><CardTitle className="text-[13px] font-semibold">Description</CardTitle></CardHeader>
            <CardContent className="px-4 py-3"><p className="text-xs text-slate-700 whitespace-pre-wrap">{request.description || "No description provided"}</p></CardContent>
          </Card>

          {request.expected_outcome ? (
            <Card className="border-slate-200">
              <CardHeader className="px-4 py-3 pb-2"><CardTitle className="text-[13px] font-semibold flex items-center gap-2"><Zap className="h-4 w-4" />Expected Outcome</CardTitle></CardHeader>
              <CardContent className="px-4 py-3"><p className="text-xs text-slate-700 whitespace-pre-wrap">{request.expected_outcome}</p></CardContent>
            </Card>
          ) : null}

          <Card className="border-slate-200">
            <CardHeader className="px-4 py-3 pb-2"><CardTitle className="text-[13px] font-semibold">Payment Information</CardTitle></CardHeader>
            <CardContent className="px-4 py-3 space-y-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">Payment Status</p>
                {getStatusBadge()}
              </div>
              {request.paid_at ? (
                <Info icon={<Calendar className="h-4 w-4 text-slate-500 mt-0.5" />} label="Paid Date" value={format(new Date(request.paid_at), "MMM dd, yyyy HH:mm")} />
              ) : null}
              {request.invoice_file_path ? (
                <button type="button" onClick={() => handleViewInvoice(request.invoice_file_path!)} className="text-blue-600 hover:text-blue-700 hover:underline text-xs flex items-center gap-2">
                  <FileText className="h-4 w-4" />View Invoice
                </button>
              ) : null}
            </CardContent>
          </Card>

          {!request.paid_at && (
            <>
              <Separator className="my-2" />
              <Card className="border-slate-200">
                <CardHeader className="px-4 py-3 pb-2">
                  <CardTitle className="text-[13px] font-semibold">{t("expenses.withdrawalFromBalanceRequired", "Withdrawal From Balance (Required)")} <span className="text-red-500">*</span></CardTitle>
                </CardHeader>
                <CardContent className="px-4 py-3 space-y-3">
                  <Label className="text-xs font-medium">{t("expenses.fundingSource", "Funding Source")} <span className="text-red-500">*</span></Label>
                  <Select
                    value={processWithdrawalFromBalance ? `debt_${processWithdrawalFromBalance}` : processBankAccountId ? `bank_${processBankAccountId}` : "none"}
                    onValueChange={(value) => {
                      setIncomeAllocIncomeId("");
                      setIncomeAllocAmountStr("");
                      if (value === "none") {
                        setProcessWithdrawalFromBalance(undefined);
                        setProcessBankAccountId(undefined);
                      } else if (value.startsWith("debt_")) {
                        setProcessWithdrawalFromBalance(value.replace("debt_", ""));
                        setProcessBankAccountId(undefined);
                      } else if (value.startsWith("bank_")) {
                        setProcessBankAccountId(value.replace("bank_", ""));
                        setProcessWithdrawalFromBalance(undefined);
                      }
                    }}
                    disabled={debtsLoading || bankAccountsLoading || balancesLoading}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder={(debtsLoading || bankAccountsLoading) ? t("expenses.loading", "Loading...") : t("expenses.selectSourceRequired", "Select Source (Required)")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("expenses.none", "None")}</SelectItem>
                      {bankAccounts.length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">{t("expenses.bankAccounts", "Bank Accounts")}</div>
                          {bankAccounts.map((bank) => {
                            const bal = bankAccountBalances.find((b) => b.bank_account_id === bank.id)?.balance ?? 0;
                            const text = bank.account_number ? `${bank.name} - ${bank.account_number} (Rp ${bal.toLocaleString("id-ID")} available)` : `${bank.name} (Rp ${bal.toLocaleString("id-ID")} available)`;
                            return <SelectItem key={`bank_${bank.id}`} value={`bank_${bank.id}`}>{text}</SelectItem>;
                          })}
                        </>
                      )}
                      {debtsForExpense.length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">{t("expenses.debts", "Debts")}</div>
                          {debtsForExpense.map((debt) => (
                            <SelectItem key={`debt_${debt.id}`} value={`debt_${debt.id}`}>
                              {debt.debt_name} (Rp {(debt.available_limit ?? 0).toLocaleString("id-ID")} available)
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <IncomeAllocationOptionalSection
                bankAccountId={processBankAccountId}
                referenceAmount={request.amount_idr}
                referenceDate={format(new Date(), "yyyy-MM-dd")}
                selectedIncomeId={incomeAllocIncomeId}
                onSelectedIncomeId={setIncomeAllocIncomeId}
                allocationAmountStr={incomeAllocAmountStr}
                onAllocationAmountStrChange={setIncomeAllocAmountStr}
              />

              <Card className="border-slate-200">
                <CardHeader className="px-4 py-3 pb-2"><CardTitle className="text-[13px] font-semibold">Upload Invoice</CardTitle></CardHeader>
                <CardContent className="px-4 py-3 space-y-3">
                  <Label className="text-xs font-medium">Invoice File <span className="text-red-500">*</span></Label>
                  <div className="flex items-center gap-2">
                    <Input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.gif" onChange={handleFileSelect} className="flex-1 text-xs" />
                    {invoiceFile ? (
                      <Button type="button" variant="ghost" size="sm" onClick={handleRemoveFile} className="h-8 w-8 p-0">
                        <X className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                  {invoiceFile ? (
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <FileText className="h-4 w-4" />
                      <span className="flex-1 truncate">{invoiceFile.name}</span>
                      <span className="text-xs text-slate-500">{(invoiceFile.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                  ) : null}
                  <Button
                    type="button"
                    onClick={handleUploadInvoice}
                    disabled={(!invoiceFile && !request?.invoice_file_path) || isUploadingInvoice || updateStatus.isPending || isCreatingExpense || (!processWithdrawalFromBalance && !processBankAccountId)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white text-xs h-9"
                  >
                    {isUploadingInvoice || updateStatus.isPending || isCreatingExpense ? (
                      <>
                        <Upload className="mr-2 h-4 w-4 animate-pulse" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Upload Invoice & Mark as Paid
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" className="text-xs h-8" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 mb-1">{label}</p>
        <p className="font-medium text-[13px] text-slate-900 break-words">{value}</p>
      </div>
    </div>
  );
}
