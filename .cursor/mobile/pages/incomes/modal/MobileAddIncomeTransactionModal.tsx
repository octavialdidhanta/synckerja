import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/mobile/hooks/use-mobile";
import { Alert, AlertDescription } from "@/features/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/features/ui/dialog";
import { Button } from "@/features/ui/button";
import { Input } from "@/features/ui/input";
import { Label } from "@/features/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/features/ui/select";
import { Textarea } from "@/features/ui/textarea";
import { Checkbox } from "@/features/ui/checkbox";
import { DrawerSelectField } from "@/mobile/components/DrawerSelectField";
import { AlertCircle, Camera, FileText, Upload, X } from "lucide-react";
import { useIncomeTransactions } from "@/features/4-1-dashboard/hooks";
import { useIncomeMasterData } from "@/features/4-1-dashboard/hooks";
import { useBankAccounts } from "@/hooks/organized/useBankAccounts";
import { useBankAccountBalances } from "@/hooks/organized/useBankAccountBalances";
import { formatInputNumber, parseInputNumber } from "@/features/8_2_pricing-tools/utils/pricingUtils";
import type { CreateIncomeTransactionData } from "@/features/4-1-dashboard/types";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { CameraModal } from "@/mobile/components/CameraModal";
import { MobileIncomeTransactionDateField } from "../components/MobileIncomeTransactionDateField";
import { toast } from "sonner";
import { pickReceiptImageFiles } from "@/mobile/utils/pickReceiptFromGallery";
import { format } from "date-fns";
import type { ExpenseReceiptAutofillData } from "@/mobile/pages/expenses/services/analyzeExpenseReceiptWithAI";
import { isOtherIncomeType } from "@/features/4-1-dashboard/utils/incomeOtherType";

const formSchema = z.object({
  transaction_date: z.string().min(1, "Transaction date is required"),
  amount: z
    .preprocess((val) => {
      if (val === "" || val === null || val === undefined) return undefined;
      if (typeof val === "number") return Number.isNaN(val) ? undefined : val;
      if (typeof val === "string") {
        const numericValue = val.replace(/[^\d]/g, "");
        if (!numericValue) return undefined;
        const num = Number(numericValue);
        return Number.isNaN(num) ? undefined : num;
      }
      return undefined;
    }, z.number().min(0.01, "Amount must be greater than 0"))
    .refine((val) => val !== undefined, { message: "Amount is required" }),
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
const RECEIPT_ALLOWED = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const RECEIPT_ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];

function hasAllowedReceiptType(file: File): boolean {
  const type = (file.type ?? "").toLowerCase();
  if (type && RECEIPT_ALLOWED.includes(type)) return true;
  const fileName = file.name.toLowerCase();
  return RECEIPT_ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
}

function getReceiptValidationError(file: File): "size" | "type" | null {
  if (file.size > MAX_RECEIPT_SIZE) return "size";
  if (!hasAllowedReceiptType(file)) return "type";
  return null;
}

function dataUrlToImageFile(dataUrl: string, fileName: string): File {
  const [meta, base64] = dataUrl.split(",");
  const mimeMatch = /data:(.*?);base64/.exec(meta ?? "");
  const mime = mimeMatch?.[1] || "image/jpeg";
  const binary = atob(base64 ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], fileName, { type: mime });
}

interface MobileAddIncomeTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  initialReceiptFile?: File | null;
  /** Change when shared files change (e.g. name:size). */
  initialReceiptFilesKey?: string;
  shareFlowLocked?: boolean;
  onShareFlowSuccess?: () => void | Promise<void>;
  aiAutofillStatus?: "idle" | "loading" | "success" | "error";
  aiAutofillData?: ExpenseReceiptAutofillData;
  aiAutofillRequestId?: number;
}

export function MobileAddIncomeTransactionModal({
  open,
  onOpenChange,
  onSuccess,
  initialReceiptFile = null,
  initialReceiptFilesKey,
  shareFlowLocked = false,
  onShareFlowSuccess,
  aiAutofillStatus = "idle",
  aiAutofillData,
  aiAutofillRequestId = 0,
}: MobileAddIncomeTransactionModalProps) {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();
  const { createIncomeTransaction, isCreating } = useIncomeTransactions();
  const { incomeTypes, incomeCategories, services, subServices } = useIncomeMasterData();
  const { bankAccounts } = useBankAccounts();
  const { refetch: refetchBalances } = useBankAccountBalances();
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [paymentMethodDrawerOpen, setPaymentMethodDrawerOpen] = useState(false);
  const [bankAccountDrawerOpen, setBankAccountDrawerOpen] = useState(false);
  const [incomeTypeDrawerOpen, setIncomeTypeDrawerOpen] = useState(false);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [serviceDrawerOpen, setServiceDrawerOpen] = useState(false);
  const [subServiceDrawerOpen, setSubServiceDrawerOpen] = useState(false);
  const [recurringFrequencyDrawerOpen, setRecurringFrequencyDrawerOpen] = useState(false);
  const [receiptCameraOpen, setReceiptCameraOpen] = useState(false);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const receiptSectionRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);
  const lastAppliedAiRequestRef = useRef<number | null>(null);
  const [transactionRefDisplay, setTransactionRefDisplay] = useState("");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      transaction_date: new Date().toISOString().split("T")[0],
      amount: "" as never,
      is_recurring: false,
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
    () => incomeTypes.find((t) => t.id === watchedIncomeTypeId),
    [incomeTypes, watchedIncomeTypeId]
  );
  const isOtherIncomeTypeSelected = isOtherIncomeType(selectedIncomeType?.name);

  const shareSubmitBlocked =
    shareFlowLocked &&
    (aiAutofillStatus === "loading" ||
      !transactionRefDisplay.trim() ||
      !receiptFile);

  const showAiIdentifierReviewHint = useMemo(
    () =>
      Boolean(
        shareFlowLocked &&
          aiAutofillStatus === "success" &&
          aiAutofillData &&
          (aiAutofillData.transactionIdNeedsReview === true ||
            aiAutofillData.referenceNumberNeedsReview === true ||
            aiAutofillData.paymentCodeNeedsReview === true)
      ),
    [shareFlowLocked, aiAutofillStatus, aiAutofillData]
  );

  const paymentMethodOptions = useMemo(
    () => [
      { value: "cash", label: t("incomes.paymentMethod.cash", "Cash") },
      { value: "bank_transfer", label: t("incomes.paymentMethod.bankTransfer", "Bank Transfer") },
      { value: "credit_card", label: t("incomes.paymentMethod.creditCard", "Credit Card") },
      { value: "debit_card", label: t("incomes.paymentMethod.debitCard", "Debit Card") },
      { value: "digital_wallet", label: t("incomes.paymentMethod.digitalWallet", "Digital Wallet") },
    ],
    [t]
  );

  const receiptPreviewUrl = useMemo(
    () => (receiptFile && receiptFile.type.startsWith("image/") ? URL.createObjectURL(receiptFile) : null),
    [receiptFile]
  );

  useEffect(() => {
    return () => {
      if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    };
  }, [receiptPreviewUrl]);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      lastAppliedAiRequestRef.current = null;
      form.reset({
        transaction_date: new Date().toISOString().split("T")[0],
        amount: "" as never,
        is_recurring: false,
      });
      setReceiptFile(null);
      setTransactionRefDisplay("");
      return;
    }
    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;
    if (!justOpened) return;
    setTransactionRefDisplay("");
    lastAppliedAiRequestRef.current = null;
  }, [open, form]);

  useEffect(() => {
    if (!open || !shareFlowLocked) return;
    setReceiptFile(initialReceiptFile ?? null);
  }, [open, shareFlowLocked, initialReceiptFilesKey, initialReceiptFile]);

  useEffect(() => {
    if (!shareFlowLocked || !open || aiAutofillStatus === "loading") return;
    if (lastAppliedAiRequestRef.current === aiAutofillRequestId) return;
    lastAppliedAiRequestRef.current = aiAutofillRequestId;
    const d = aiAutofillData;
    if (!d) return;
    if (d.transactionId) setTransactionRefDisplay(d.transactionId);
  }, [shareFlowLocked, open, aiAutofillStatus, aiAutofillRequestId, aiAutofillData]);

  useEffect(() => {
    if (!open || !aiAutofillData || aiAutofillStatus !== "success") return;
    const dirtyFields = form.formState.dirtyFields;

    if (
      !dirtyFields.customer_name &&
      !form.getValues("customer_name")?.trim() &&
      aiAutofillData.expenseName
    ) {
      form.setValue("customer_name", aiAutofillData.expenseName, { shouldDirty: false });
    }

    if (!dirtyFields.amount && !form.getValues("amount") && typeof aiAutofillData.amount === "number") {
      const normalizedAmount = Math.max(0, Math.round(aiAutofillData.amount));
      if (normalizedAmount > 0) {
        form.setValue("amount", normalizedAmount, { shouldValidate: true, shouldDirty: false });
      }
    }

    if (!dirtyFields.transaction_date && aiAutofillData.createDate) {
      const parsedDate = new Date(aiAutofillData.createDate);
      if (!Number.isNaN(parsedDate.getTime())) {
        form.setValue("transaction_date", format(parsedDate, "yyyy-MM-dd"), { shouldDirty: false });
      }
    }

    const refLines: string[] = [];
    if (aiAutofillData.referenceNumber) {
      refLines.push(
        `${t("shareReceipt.aiRefLinePrefix", "Ref")}: ${aiAutofillData.referenceNumber}`
      );
    }
    if (aiAutofillData.paymentCode) {
      refLines.push(
        `${t("shareReceipt.aiPaymentCodeLinePrefix", "Payment code")}: ${aiAutofillData.paymentCode}`
      );
    }
    const extraDesc = refLines.join("\n");
    const baseDesc = aiAutofillData.description?.trim() ?? "";
    const mergedDesc = extraDesc
      ? baseDesc
        ? `${baseDesc}\n${extraDesc}`
        : extraDesc
      : baseDesc;

    if (!dirtyFields.description && !form.getValues("description")?.trim() && mergedDesc) {
      form.setValue("description", mergedDesc, { shouldDirty: false });
    }
  }, [open, aiAutofillData, aiAutofillStatus, aiAutofillRequestId, form, t]);

  const handleOpenChange = (next: boolean) => {
    if (!next && shareFlowLocked) {
      return;
    }
    onOpenChange(next);
  };

  const handleTakeReceiptPhoto = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      setReceiptCameraOpen(true);
      return;
    }
    toast.error(t("expenses.photoCaptureFailed", "Photo capture failed"));
  }, [t]);

  const handleReceiptCameraCapture = useCallback((imageData: string) => {
    try {
      const file = dataUrlToImageFile(imageData, `income_receipt_${Date.now()}.jpg`);
      const validationError = getReceiptValidationError(file);
      if (validationError === "size") {
        toast.error(t("expenses.receiptTooLarge", "File must be less than 10MB"));
        setReceiptCameraOpen(false);
        return;
      }
      if (validationError === "type") {
        toast.error(t("expenses.receiptInvalidType", "Only JPG, PNG, WEBP, or PDF are allowed"));
        setReceiptCameraOpen(false);
        return;
      }
      setReceiptFile(file);
      toast.success(t("expenses.receiptPhotoTaken", "Receipt photo taken"));
      requestAnimationFrame(() => {
        receiptSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } catch {
      toast.error(t("expenses.photoCaptureFailed", "Photo capture failed"));
    }
    setReceiptCameraOpen(false);
  }, [t]);

  const handlePickReceiptFromGallery = useCallback(async () => {
    try {
      const files = await pickReceiptImageFiles({ maxItems: 10, mediaType: "imageOnly" });
      if (!files.length) return;

      const file = files[0];
      const validationError = getReceiptValidationError(file);
      if (validationError === "size") {
        toast.error(t("expenses.receiptTooLarge", "File must be less than 10MB"));
        return;
      }
      if (validationError === "type") {
        toast.error(t("expenses.receiptInvalidType", "Only JPG, PNG, WEBP, or PDF are allowed"));
        return;
      }

      setReceiptFile(file);
      requestAnimationFrame(() => {
        receiptSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } catch {
      toast.error(t("expenses.receiptPickFailed", "Failed to pick receipt file"));
    }
  }, [t]);

  const onSubmit = (data: FormData) => {
    if (shareFlowLocked) {
      if (aiAutofillStatus === "loading") return;
      if (!transactionRefDisplay.trim()) {
        toast.error(
          t(
            "incomes.shareTransactionIdRequired",
            "Transaction ID was not detected on the receipt. Try again or choose another destination."
          )
        );
        return;
      }
      if (!receiptFile) {
        toast.error(t("incomes.shareReceiptRequired", "Add at least one receipt file."));
        return;
      }
    }

    const amountValue =
      typeof data.amount === "string" && data.amount !== ""
        ? parseInputNumber(data.amount)
        : typeof data.amount === "number"
          ? data.amount
          : 0;

    const toUndefinedIfEmpty = (value: string | undefined | null): string | undefined =>
      value === "" || value === null ? undefined : value;

    const submitIncomeType = incomeTypes.find((t) => t.id === data.income_type_id);
    const otherTypeSelected = isOtherIncomeType(submitIncomeType?.name);

    const transactionData: CreateIncomeTransactionData = {
      transaction_date: data.transaction_date,
      amount: amountValue,
      customer_name: data.customer_name || undefined,
      payment_method: data.payment_method || undefined,
      bank_account_id: toUndefinedIfEmpty(data.bank_account_id),
      income_type_id: toUndefinedIfEmpty(data.income_type_id),
      category_id: otherTypeSelected ? undefined : toUndefinedIfEmpty(data.category_id),
      custom_category_name:
        otherTypeSelected && data.custom_category_name?.trim()
          ? data.custom_category_name.trim()
          : undefined,
      service_id: toUndefinedIfEmpty(data.service_id),
      sub_service_id: toUndefinedIfEmpty(data.sub_service_id),
      is_recurring: data.is_recurring,
      recurring_frequency: data.recurring_frequency || undefined,
      description: data.description || undefined,
      receipt_file: receiptFile || undefined,
      transaction_reference:
        shareFlowLocked && transactionRefDisplay.trim() ? transactionRefDisplay : undefined,
    };

    createIncomeTransaction(transactionData, {
      onSuccess: async () => {
        refetchBalances();
        form.reset();
        setReceiptFile(null);
        setTransactionRefDisplay("");
        if (shareFlowLocked) {
          await onShareFlowSuccess?.();
        } else {
          onOpenChange(false);
        }
        onSuccess?.();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          isMobile
            ? "fixed left-0 right-0 top-0 translate-x-0 translate-y-0 w-full max-w-none max-h-none rounded-none modal-above-safe-area flex flex-col p-0 gap-0 overflow-hidden"
            : "max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden"
        )}
        fullscreenAnimation={isMobile}
      >
        <DialogHeader className="flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left safe-area-top px-4 pt-4 pb-3">
          <DialogTitle className="text-lg font-semibold">
            {t("incomes.addTransactionTitle", "Add New Income Transaction")}
          </DialogTitle>
          <DialogDescription>
            {t("incomes.addTransactionSubtitle", "Create a new income transaction record")}
          </DialogDescription>
        </DialogHeader>

        <div ref={scrollBodyRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll px-4 py-4">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {shareFlowLocked && aiAutofillStatus === "loading" ? (
              <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-700 dark:text-blue-200 flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                <span>{t("expenses.aiAnalyzingReceipt", "Menganalisis receipt dengan AI...")}</span>
              </div>
            ) : null}
            {shareFlowLocked ? (
              <div className="space-y-2">
                <Label htmlFor="income_transaction_ref_display">{t("incomes.transactionIdLabel", "Transaction ID")}</Label>
                <Input
                  id="income_transaction_ref_display"
                  value={transactionRefDisplay}
                  readOnly
                  disabled
                  className="text-sm bg-muted"
                  placeholder={t("incomes.transactionIdPlaceholder", "Detected from receipt by AI")}
                />
                {!transactionRefDisplay.trim() && aiAutofillStatus !== "loading" ? (
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    {t(
                      "incomes.transactionIdMissingHint",
                      "No reference found yet. Wait for analysis to finish or choose another destination."
                    )}
                  </p>
                ) : null}
                {showAiIdentifierReviewHint ? (
                  <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      {t(
                        "shareReceipt.aiIdentifierReviewHint",
                        "AI flagged reference numbers or codes on the receipt for manual verification against the original image (e.g. truncated or uncertain ID)."
                      )}
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <MobileIncomeTransactionDateField
                label={t("incomes.transactionDate", "Transaction Date")}
                value={form.watch("transaction_date")}
                onChange={(v) => form.setValue("transaction_date", v, { shouldValidate: true })}
                errorMessage={form.formState.errors.transaction_date?.message}
              />

              <div className="space-y-2">
                <Label htmlFor="amount">{t("incomes.amount", "Amount")}</Label>
                <Controller
                  name="amount"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      id="amount"
                      type="text"
                      value={
                        field.value === undefined || field.value === null || field.value === ""
                          ? ""
                          : formatInputNumber(field.value)
                      }
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "") field.onChange("");
                        else field.onChange(parseInputNumber(value));
                      }}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      className="text-sm"
                      placeholder={t("incomes.amountPlaceholder", "0")}
                    />
                  )}
                />
                {form.formState.errors.amount ? (
                  <p className="text-xs text-red-600">{form.formState.errors.amount.message}</p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="customer_name">{t("incomes.customerName", "Customer Name")}</Label>
                <Input
                  id="customer_name"
                  {...form.register("customer_name")}
                  className="text-sm"
                  placeholder={t("incomes.customerNamePlaceholder", "Enter customer name")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_method">{t("incomes.paymentMethod", "Payment Method")}</Label>
                <DrawerSelectField
                  open={paymentMethodDrawerOpen}
                  onOpenChange={setPaymentMethodDrawerOpen}
                  title={t("incomes.paymentMethod", "Payment Method")}
                  value={form.watch("payment_method") || ""}
                  placeholder={t("incomes.selectPaymentMethod", "Select payment method")}
                  options={paymentMethodOptions}
                  onSelect={(value) => {
                    form.setValue("payment_method", value, { shouldValidate: true });
                    if (value !== "bank_transfer") {
                      form.setValue("bank_account_id", undefined);
                    }
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank_account_id">{t("incomes.bankAccount", "Bank Account")}</Label>
              <DrawerSelectField
                open={bankAccountDrawerOpen}
                onOpenChange={setBankAccountDrawerOpen}
                title={t("incomes.bankAccount", "Bank Account")}
                value={form.watch("bank_account_id") || ""}
                placeholder={t("incomes.selectBankAccount", "Select bank account")}
                options={bankAccounts.map((bankAccount) => ({
                  value: bankAccount.id,
                  label: `${bankAccount.name}${bankAccount.account_number ? ` (${bankAccount.account_number})` : ""}`,
                }))}
                onSelect={(value) => form.setValue("bank_account_id", value, { shouldValidate: true })}
              />
              {form.formState.errors.bank_account_id ? (
                <p className="text-xs text-red-600">
                  {form.formState.errors.bank_account_id.message === "bank_account_required"
                    ? t(
                        "incomes.bankAccountRequiredForTransfer",
                        "Select a bank account for bank transfer"
                      )
                    : form.formState.errors.bank_account_id.message}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="income_type_id">{t("incomes.incomeType", "Income Type")}</Label>
                <DrawerSelectField
                  open={incomeTypeDrawerOpen}
                  onOpenChange={setIncomeTypeDrawerOpen}
                  title={t("incomes.incomeType", "Income Type")}
                  value={form.watch("income_type_id") || ""}
                  placeholder={t("incomes.selectIncomeType", "Select income type")}
                  options={incomeTypes.map((type) => ({ value: type.id, label: type.name }))}
                  onSelect={(value) => {
                    form.setValue("income_type_id", value);
                    form.setValue("category_id", undefined);
                    const next = incomeTypes.find((t) => t.id === value);
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
                    disabled={!watchedIncomeTypeId}
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
                    disabled={!watchedIncomeTypeId}
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="service_id">{t("common.service", "Service")}</Label>
                <DrawerSelectField
                  open={serviceDrawerOpen}
                  onOpenChange={setServiceDrawerOpen}
                  title={t("common.service", "Service")}
                  value={form.watch("service_id") || ""}
                  placeholder={t("incomes.selectService", "Select service")}
                  options={services.map((service) => ({ value: service.id, label: service.name }))}
                  onSelect={(value) => {
                    form.setValue("service_id", value);
                    form.setValue("sub_service_id", undefined);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sub_service_id">{t("common.subService", "Sub Service")}</Label>
                <DrawerSelectField
                  open={subServiceDrawerOpen}
                  onOpenChange={setSubServiceDrawerOpen}
                  title={t("common.subService", "Sub Service")}
                  value={form.watch("sub_service_id") || ""}
                  placeholder={t("incomes.selectSubService", "Select sub service")}
                  options={filteredSubServices.map((subService) => ({ value: subService.id, label: subService.name }))}
                  onSelect={(value) => form.setValue("sub_service_id", value)}
                  disabled={!watchedServiceId}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_recurring"
                  checked={watchedIsRecurring}
                  onCheckedChange={(checked) => form.setValue("is_recurring", checked as boolean)}
                />
                <Label htmlFor="is_recurring" className="text-sm">
                  {t("incomes.recurringTransaction", "Recurring Transaction")}
                </Label>
              </div>
            </div>

            {watchedIsRecurring ? (
              <div className="space-y-2">
                <Label htmlFor="recurring_frequency">{t("incomes.recurringFrequency", "Recurring Frequency")}</Label>
                <DrawerSelectField
                  open={recurringFrequencyDrawerOpen}
                  onOpenChange={setRecurringFrequencyDrawerOpen}
                  title={t("incomes.recurringFrequency", "Recurring Frequency")}
                  value={form.watch("recurring_frequency") || ""}
                  placeholder={t("incomes.selectFrequency", "Select frequency")}
                  options={[
                    { value: "daily", label: t("incomes.frequencyDaily", "Daily") },
                    { value: "weekly", label: t("incomes.frequencyWeekly", "Weekly") },
                    { value: "monthly", label: t("incomes.frequencyMonthly", "Monthly") },
                    { value: "quarterly", label: t("incomes.frequencyQuarterly", "Quarterly") },
                    { value: "yearly", label: t("incomes.frequencyYearly", "Yearly") },
                  ]}
                  onSelect={(value) => form.setValue("recurring_frequency", value)}
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="description">{t("common.description", "Description")}</Label>
              <Textarea
                id="description"
                {...form.register("description")}
                className="text-sm"
                placeholder={t("incomes.descriptionPlaceholder", "Enter transaction description")}
                rows={3}
              />
            </div>

            <div ref={receiptSectionRef} className="space-y-2">
              <Label>{t("incomes.receiptFile", "Receipt File")}</Label>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
                {receiptFile ? (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="relative aspect-square rounded-md border border-border overflow-hidden bg-muted">
                      {receiptFile.type.startsWith("image/") && receiptPreviewUrl ? (
                        <img src={receiptPreviewUrl} alt="" className="w-full h-full object-cover" />
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
                        onClick={() => setReceiptFile(null)}
                        aria-label={t("common.remove", "Remove")}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
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
                  <Button type="button" variant="outline" size="sm" onClick={handleTakeReceiptPhoto}>
                    <Camera className="h-4 w-4 mr-1.5" />
                    {t("expenses.takePhoto", "Take photo")}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handlePickReceiptFromGallery}>
                    <Upload className="h-4 w-4 mr-1.5" />
                    {t("expenses.chooseFile", "Choose File")}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={isCreating && shareFlowLocked}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={form.handleSubmit(onSubmit)}
              disabled={isCreating || shareSubmitBlocked}
              className="min-w-[120px] flex items-center justify-center gap-1.5"
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{t("incomes.creatingTransaction", "Creating...")}</span>
                </>
              ) : (
                t("incomes.createTransaction", "Create Transaction")
              )}
            </Button>
          </div>
        </div>
        <CameraModal
          isOpen={receiptCameraOpen}
          onClose={() => setReceiptCameraOpen(false)}
          onCapture={handleReceiptCameraCapture}
          title={t("expenses.receiptCameraTitle", "Receipt photo")}
          facingMode="environment"
        />
      </DialogContent>
    </Dialog>
  );
}
