import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/mobile/hooks/use-mobile";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/features/ui/dialog";
import { Button } from "@/features/ui/button";
import { Input } from "@/features/ui/input";
import { Label } from "@/features/ui/label";
import { Textarea } from "@/features/ui/textarea";
import { Checkbox } from "@/features/ui/checkbox";
import { useIncomeTransactions } from "@/features/4-1-dashboard/hooks";
import { useIncomeMasterData } from "@/features/4-1-dashboard/hooks";
import type { IncomeTransactionWithRelations } from "@/features/4-1-dashboard/types";
import { useBankAccounts } from "@/hooks/organized/useBankAccounts";
import { DrawerSelectField } from "@/mobile/components/DrawerSelectField";
import { Camera, FileText, Upload, X } from "lucide-react";
import { CameraModal } from "@/mobile/components/CameraModal";
import { MobileIncomeTransactionDateField } from "../components/MobileIncomeTransactionDateField";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { Alert, AlertDescription } from "@/features/ui/alert";
import { isOtherIncomeType } from "@/features/4-1-dashboard/utils/incomeOtherType";

const formSchema = z.object({
  transaction_date: z.string().min(1, "Transaction date is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  customer_name: z.string().optional(),
  payment_method: z.string().optional(),
  bank_account_id: z.string().optional(),
  income_type_id: z.string().optional(),
  category_id: z.string().optional(),
  custom_category_name: z.string().optional(),
  service_id: z.string().optional(),
  sub_service_id: z.string().optional(),
  is_recurring: z.boolean().default(false),
  recurring_frequency: z.string().optional(),
  description: z.string().optional(),
  receipt_file: z.instanceof(File).optional(),
}).superRefine((data, ctx) => {
  if (data.payment_method === "bank_transfer") {
    const id = data.bank_account_id?.trim();
    if (!id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "bank_account_required",
        path: ["bank_account_id"],
      });
    }
  }
});

type FormData = z.infer<typeof formSchema>;
const MAX_RECEIPT_SIZE = 10 * 1024 * 1024;

function validateReceiptFile(file: File): boolean {
  const type = file.type.toLowerCase();
  return type.startsWith("image/") || type === "application/pdf";
}

function dataUrlToImageFile(dataUrl: string, fileName: string): File {
  const [meta, base64] = dataUrl.split(",");
  const mimeMatch = /data:(.*?);base64/.exec(meta ?? "");
  const mime = mimeMatch?.[1] || "image/jpeg";
  const binary = atob(base64 ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], fileName, { type: mime });
}

interface MobileEditIncomeTransactionModalProps {
  income: IncomeTransactionWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileEditIncomeTransactionModal({
  income,
  open,
  onOpenChange,
}: MobileEditIncomeTransactionModalProps) {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();
  const { updateIncomeTransaction, isUpdating } = useIncomeTransactions();
  const { incomeTypes, incomeCategories, services, subServices } = useIncomeMasterData();
  const { bankAccounts } = useBankAccounts({ includeInactive: true });
  const [receiptFile, setReceiptFile] = useState<File | undefined>(undefined);
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(null);
  const [receiptCameraOpen, setReceiptCameraOpen] = useState(false);
  const [paymentMethodDrawerOpen, setPaymentMethodDrawerOpen] = useState(false);
  const [bankAccountDrawerOpen, setBankAccountDrawerOpen] = useState(false);
  const [incomeTypeDrawerOpen, setIncomeTypeDrawerOpen] = useState(false);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [serviceDrawerOpen, setServiceDrawerOpen] = useState(false);
  const [subServiceDrawerOpen, setSubServiceDrawerOpen] = useState(false);
  const [frequencyDrawerOpen, setFrequencyDrawerOpen] = useState(false);
  const receiptFileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      transaction_date: new Date().toISOString().split("T")[0],
      amount: 0,
      customer_name: "",
      payment_method: "",
      bank_account_id: "",
      income_type_id: "",
      category_id: "",
      custom_category_name: "",
      service_id: "",
      sub_service_id: "",
      is_recurring: false,
      recurring_frequency: "",
      description: "",
    },
  });

  const watchedServiceId = form.watch("service_id");
  const watchedIncomeTypeId = form.watch("income_type_id");
  const watchedIsRecurring = form.watch("is_recurring");

  const filteredSubServices = useMemo(
    () => subServices.filter((subService) => subService.service_id === watchedServiceId),
    [subServices, watchedServiceId]
  );
  const filteredIncomeCategories = useMemo(
    () => incomeCategories.filter((category) => category.income_types_id === watchedIncomeTypeId),
    [incomeCategories, watchedIncomeTypeId]
  );

  const selectedIncomeType = useMemo(
    () => incomeTypes.find((row) => row.id === watchedIncomeTypeId),
    [incomeTypes, watchedIncomeTypeId]
  );
  const isOtherIncomeTypeSelected = isOtherIncomeType(selectedIncomeType?.name);

  const paymentMethods = useMemo(
    () => [
      { value: "cash", label: t("incomes.paymentMethod.cash", "Cash") },
      { value: "bank_transfer", label: t("incomes.paymentMethod.bankTransfer", "Bank Transfer") },
      { value: "credit_card", label: t("incomes.paymentMethod.creditCard", "Credit Card") },
      { value: "debit_card", label: t("incomes.paymentMethod.debitCard", "Debit Card") },
      { value: "check", label: t("incomes.paymentMethod.check", "Check") },
      { value: "digital_wallet", label: t("incomes.paymentMethod.digitalWallet", "Digital Wallet") },
      { value: "other", label: t("incomes.paymentMethod.other", "Other") },
    ],
    [t]
  );

  const bankAccountSelectOptions = useMemo(() => {
    const rows = bankAccounts.map((b) => ({
      value: b.id,
      label: `${b.name}${b.account_number ? ` (${b.account_number})` : ""}`,
    }));
    const linkedId = income?.bank_account_id?.trim();
    if (!linkedId || rows.some((r) => r.value === linkedId)) {
      return rows;
    }
    const rel = income?.bank_accounts;
    const label =
      rel?.name != null && String(rel.name).length > 0
        ? `${rel.name}${rel.account_number ? ` (${rel.account_number})` : ""}`
        : t("incomes.previouslySelectedAccount", "Previously selected account");
    return [{ value: linkedId, label }, ...rows];
  }, [bankAccounts, income, t]);

  const lockFinancial = !!(income?.has_income_allocations);

  const recurringFrequencies = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
    { value: "yearly", label: "Yearly" },
  ];

  const selectedReceiptPreviewUrl = useMemo(
    () => (receiptFile && receiptFile.type.startsWith("image/") ? URL.createObjectURL(receiptFile) : null),
    [receiptFile]
  );

  useEffect(() => {
    return () => {
      if (selectedReceiptPreviewUrl) URL.revokeObjectURL(selectedReceiptPreviewUrl);
    };
  }, [selectedReceiptPreviewUrl]);

  useEffect(() => {
    if (!open || !income) return;
    const txDate =
      typeof income.transaction_date === "string" && income.transaction_date.length >= 10
        ? income.transaction_date.slice(0, 10)
        : income.transaction_date;
    const typeName = income.income_types?.name;
    const otherSaved = isOtherIncomeType(typeName);
    form.reset({
      transaction_date: txDate,
      amount: income.amount,
      customer_name: income.customer_name || "",
      payment_method: income.payment_method || "",
      bank_account_id: income.bank_account_id?.trim() || "",
      income_type_id: income.income_type_id || "",
      category_id: income.category_id || "",
      custom_category_name: otherSaved ? (income.income_categories?.name ?? "") : "",
      service_id: income.service_id || "",
      sub_service_id: income.sub_service_id || "",
      is_recurring: income.is_recurring,
      recurring_frequency: income.recurring_frequency || "",
      description: income.description || "",
    });
    setReceiptFile(undefined);
  }, [open, income, form]);

  useEffect(() => {
    let cancelled = false;

    const resolveExistingReceipt = async () => {
      if (!open || !income?.receipt_file_path) {
        setExistingReceiptUrl(null);
        return;
      }
      const path = income.receipt_file_path as string;
      if (path.startsWith("http")) {
        setExistingReceiptUrl(path);
        return;
      }
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase.storage.from("income-receipts").createSignedUrl(path, 60 * 30);
        if (!cancelled) {
          setExistingReceiptUrl(data?.signedUrl ?? null);
        }
      } catch {
        if (!cancelled) setExistingReceiptUrl(null);
      }
    };

    void resolveExistingReceipt();
    return () => {
      cancelled = true;
    };
  }, [open, income?.receipt_file_path]);

  const handleReceiptFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > MAX_RECEIPT_SIZE) return;
      if (!validateReceiptFile(file)) return;
      setReceiptFile(file);
      form.setValue("receipt_file", file);
      e.target.value = "";
    },
    [form]
  );

  const handleTakeReceiptPhoto = useCallback(() => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      receiptFileInputRef.current?.click();
      return;
    }
    setReceiptCameraOpen(true);
  }, []);

  const handleReceiptCameraCapture = useCallback(
    (imageData: string) => {
      const file = dataUrlToImageFile(imageData, `income_receipt_${Date.now()}.jpg`);
      if (file.size <= MAX_RECEIPT_SIZE && validateReceiptFile(file)) {
        setReceiptFile(file);
        form.setValue("receipt_file", file);
      }
      setReceiptCameraOpen(false);
    },
    [form]
  );

  const onSubmit = (values: FormData) => {
    if (!income) return;
    const bankId = values.bank_account_id?.trim() || null;
    const { category_id, custom_category_name, ...rest } = values;
    const submitType = incomeTypes.find((row) => row.id === rest.income_type_id);
    const otherSelected = isOtherIncomeType(submitType?.name);
    updateIncomeTransaction(
      {
        id: income.id,
        ...rest,
        bank_account_id: bankId,
        ...(otherSelected
          ? { custom_category_name: custom_category_name ?? "" }
          : { category_id }),
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          isMobile
            ? "fixed left-0 right-0 top-0 translate-x-0 translate-y-0 w-full max-w-none max-h-none rounded-none modal-above-safe-area flex flex-col p-0 gap-0 overflow-hidden"
            : "max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden"
        )}
        fullscreenAnimation={isMobile}
      >
        <DialogHeader className="flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left safe-area-top px-4 pt-4 pb-3">
          <DialogTitle className="text-lg font-semibold">Edit Income Transaction</DialogTitle>
          <DialogDescription>Update selected income transaction data</DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll px-4 py-4">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {lockFinancial ? (
              <Alert>
                <AlertDescription className="text-sm">
                  {t(
                    "incomes.edit.lockedFinancialHint",
                    "This income is linked to an expense or debt payment. Amount, account, and classification fields are locked until that payment is removed or changed."
                  )}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <MobileIncomeTransactionDateField
                label={t("incomes.transactionDate", "Transaction Date")}
                value={form.watch("transaction_date")}
                onChange={(v) => form.setValue("transaction_date", v, { shouldValidate: true })}
                errorMessage={form.formState.errors.transaction_date?.message}
                disabled={lockFinancial}
              />
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="text-sm"
                  value={form.watch("amount") ?? 0}
                  disabled={lockFinancial}
                  onChange={(e) => form.setValue("amount", parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Customer Name</Label>
                <Input className="text-sm" placeholder="Enter customer name" {...form.register("customer_name")} />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <DrawerSelectField
                  open={paymentMethodDrawerOpen}
                  onOpenChange={setPaymentMethodDrawerOpen}
                  title={t("incomes.paymentMethod", "Payment Method")}
                  value={form.watch("payment_method") || ""}
                  placeholder={t("incomes.selectPaymentMethod", "Select payment method")}
                  options={paymentMethods}
                  disabled={lockFinancial}
                  onSelect={(value) => {
                    form.setValue("payment_method", value, { shouldValidate: true });
                    if (value !== "bank_transfer") {
                      form.setValue("bank_account_id", "");
                    }
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("incomes.bankAccount", "Bank Account")}</Label>
              <DrawerSelectField
                open={bankAccountDrawerOpen}
                onOpenChange={setBankAccountDrawerOpen}
                title={t("incomes.bankAccount", "Bank Account")}
                value={form.watch("bank_account_id") || ""}
                placeholder={t("incomes.selectBankAccount", "Select bank account")}
                options={bankAccountSelectOptions}
                disabled={lockFinancial}
                onSelect={(value) => form.setValue("bank_account_id", value, { shouldValidate: true })}
              />
              {form.formState.errors.bank_account_id ? (
                <p className="text-xs text-red-600">
                  {form.formState.errors.bank_account_id.message === "bank_account_required"
                    ? t("incomes.bankAccountRequiredForTransfer", "Select a bank account for bank transfer")
                    : form.formState.errors.bank_account_id.message}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Income Type</Label>
                <DrawerSelectField
                  open={incomeTypeDrawerOpen}
                  onOpenChange={setIncomeTypeDrawerOpen}
                  title={t("incomes.incomeType", "Income Type")}
                  value={form.watch("income_type_id") || ""}
                  placeholder={t("incomes.selectIncomeType", "Select income type")}
                  options={incomeTypes.map((type) => ({ value: type.id, label: type.name }))}
                  disabled={lockFinancial}
                  onSelect={(value) => {
                    form.setValue("income_type_id", value);
                    form.setValue("category_id", "");
                    const next = incomeTypes.find((row) => row.id === value);
                    if (!isOtherIncomeType(next?.name)) {
                      form.setValue("custom_category_name", "");
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={isOtherIncomeTypeSelected ? "custom_category_name" : "category_id"}>
                  {t("common.category", "Category")}
                </Label>
                {isOtherIncomeTypeSelected ? (
                  <Input
                    id="custom_category_name"
                    className="text-sm"
                    placeholder={t("incomes.categoryCustomPlaceholder", "e.g. THR, bonus, gift")}
                    disabled={lockFinancial || !watchedIncomeTypeId}
                    {...form.register("custom_category_name")}
                  />
                ) : (
                  <DrawerSelectField
                    open={categoryDrawerOpen}
                    onOpenChange={setCategoryDrawerOpen}
                    title={t("common.category", "Category")}
                    value={form.watch("category_id") || ""}
                    placeholder={t("incomes.selectCategory", "Select category")}
                    options={filteredIncomeCategories.map((category) => ({
                      value: category.id,
                      label: category.name,
                    }))}
                    onSelect={(value) => form.setValue("category_id", value)}
                    disabled={lockFinancial || !watchedIncomeTypeId}
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Service</Label>
                <DrawerSelectField
                  open={serviceDrawerOpen}
                  onOpenChange={setServiceDrawerOpen}
                  title="Service"
                  value={form.watch("service_id") || ""}
                  placeholder="Select service"
                  options={services.map((service) => ({ value: service.id, label: service.name }))}
                  disabled={lockFinancial}
                  onSelect={(value) => {
                    form.setValue("service_id", value);
                    form.setValue("sub_service_id", "");
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Sub Service</Label>
                <DrawerSelectField
                  open={subServiceDrawerOpen}
                  onOpenChange={setSubServiceDrawerOpen}
                  title="Sub Service"
                  value={form.watch("sub_service_id") || ""}
                  placeholder="Select sub service"
                  options={filteredSubServices.map((subService) => ({ value: subService.id, label: subService.name }))}
                  onSelect={(value) => form.setValue("sub_service_id", value)}
                  disabled={lockFinancial || !watchedServiceId}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={watchedIsRecurring}
                  onCheckedChange={(checked) => form.setValue("is_recurring", checked as boolean)}
                  disabled={lockFinancial}
                />
                <Label className="text-sm">Recurring Transaction</Label>
              </div>
            </div>

            {watchedIsRecurring ? (
              <div className="space-y-2">
                <Label>Recurring Frequency</Label>
                <DrawerSelectField
                  open={frequencyDrawerOpen}
                  onOpenChange={setFrequencyDrawerOpen}
                  title="Recurring Frequency"
                  value={form.watch("recurring_frequency") || ""}
                  placeholder="Select frequency"
                  options={recurringFrequencies}
                  disabled={lockFinancial}
                  onSelect={(value) => form.setValue("recurring_frequency", value)}
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                className="text-sm resize-none"
                placeholder="Enter transaction description"
                {...form.register("description")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("incomes.receiptFile", "Receipt File")}</Label>
              <input
                ref={receiptFileInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                onChange={handleReceiptFileInputChange}
              />
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
                {receiptFile ? (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="relative aspect-square rounded-md border border-border overflow-hidden bg-muted">
                      {receiptFile.type.startsWith("image/") && selectedReceiptPreviewUrl ? (
                        <img src={selectedReceiptPreviewUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-1">
                          <FileText className="h-6 w-6 text-muted-foreground" />
                          <span className="text-[9px] text-muted-foreground line-clamp-2 break-all mt-0.5">
                            {receiptFile.name}
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        className="absolute top-0.5 right-0.5 rounded-full bg-background/90 p-0.5 shadow"
                        onClick={() => {
                          setReceiptFile(undefined);
                          form.setValue("receipt_file", undefined);
                        }}
                        aria-label={t("common.remove", "Remove")}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ) : existingReceiptUrl ? (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="relative aspect-square rounded-md border border-border overflow-hidden bg-muted">
                      {!/\.pdf$/i.test(existingReceiptUrl) ? (
                        <img src={existingReceiptUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-1">
                          <FileText className="h-6 w-6 text-muted-foreground" />
                          <span className="text-[9px] text-muted-foreground mt-0.5">PDF</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mb-2">
                    {t("expenses.receiptPhotoHint", "Take a photo of your receipt")}
                  </p>
                )}
                <p className="text-xs text-muted-foreground/80 mb-3">
                  {t("expenses.receiptPhotoFormatsExtended", "JPG / PNG / WEBP / PDF, max 10MB per file")}
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && (
                    <Button type="button" variant="outline" size="sm" onClick={handleTakeReceiptPhoto}>
                      <Camera className="h-4 w-4 mr-1.5" />
                      {t("expenses.takePhoto", "Take photo")}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => receiptFileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-1.5" />
                    {t("expenses.chooseFromFiles", "Choose file")}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isUpdating}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={form.handleSubmit(onSubmit)}
              disabled={isUpdating}
              className="min-w-[120px] flex items-center justify-center gap-1.5"
            >
              {isUpdating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{t("common.updating", "Updating...")}</span>
                </>
              ) : (
                t("common.update", "Update")
              )}
            </Button>
          </div>
        </div>
        <CameraModal
          open={receiptCameraOpen}
          onClose={() => setReceiptCameraOpen(false)}
          onCapture={handleReceiptCameraCapture}
          title={t("expenses.receiptCameraTitle", "Receipt photo")}
        />
      </DialogContent>
    </Dialog>
  );
}
