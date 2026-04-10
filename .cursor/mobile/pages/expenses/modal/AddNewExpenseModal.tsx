import { useState, useRef, useCallback, Fragment, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/features/ui/dialog";
import { Button } from "@/mobile/components/ui/button";
import { Input } from "@/mobile/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/features/ui/select";
import { Textarea } from "@/features/ui/textarea";
import { Checkbox } from "@/features/ui/checkbox";
import { useIsMobile } from "@/mobile/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/features/ui/alert";
import { AlertCircle, Camera, FileText, Upload, X } from "lucide-react";
import { CameraModal } from "@/mobile/components/CameraModal";
import { pickReceiptImageFiles } from "@/mobile/utils/pickReceiptFromGallery";
import {
  addExpenseSchema,
  type AddExpenseFormData,
  RECURRING_FREQUENCIES,
} from "@/features/4_2_dashboard/AddExpenseForm";
import {
  useExpenses,
  type CreateExpenseData,
  type Expense,
} from "@/features/4_2_dashboard/hooks";
import { isRecurringBillPayNowEligible } from "@/features/4_2_reminder-bills/utils/reminderBillsUtils";
import { useExpenseTypes } from "@/features/4_2_dashboard/hooks/useExpenseTypes";
import { useExpenseCategories } from "@/features/4_2_dashboard/hooks/useExpenseCategories";
import { useCurrentOrg } from "@/features/share/hooks/useCurrentOrg";
import { useDepartmentsCrud } from "@/features/2-1-employees/MyInfo/Employment/hooks/crudMaster/useDepartmentsCrud";
import { useDebtsForExpense } from "@/features/4_2_dashboard/hooks/useDebtsForExpense";
import { useBankAccounts } from "@/hooks/organized/useBankAccounts";
import { useBankAccountBalances } from "@/hooks/organized/useBankAccountBalances";
import { Calendar } from "@/features/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/features/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/mobile/components/ui/drawer";
import { Calendar as CalendarIcon, ChevronDown, Check } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/mobile/components/ui/alert-dialog";
import { setShareBackGuard } from "@/mobile/shareIntent/shareBackGuard";
import type { ExpenseReceiptAutofillData } from "@/mobile/pages/expenses/services/analyzeExpenseReceiptWithAI";
import { IncomeAllocationOptionalSection } from "@/features/4-1-dashboard/components/IncomeAllocationOptionalSection";

export interface AddNewExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillData?: AddExpensePrefillPayload;
  onAfterCreateExpenseSuccess?: (payload: AddExpenseAfterSuccessPayload) => void | Promise<void>;
  /** Pre-filled receipts (e.g. Android share). */
  initialReceiptFiles?: File[];
  /** Change when initial files change (e.g. concatenated name:size). */
  initialReceiptFilesKey?: string;
  /** Block dismiss until success; user must confirm cancel. */
  shareFlowLocked?: boolean;
  onShareFlowSuccess?: () => void | Promise<void>;
  aiAutofillStatus?: "idle" | "loading" | "success" | "error";
  aiAutofillData?: ExpenseReceiptAutofillData;
  aiAutofillRequestId?: number;
  /**
   * When true and viewport is not mobile: square shell (equal width/height, capped by viewport)
   * and sharp corners. Omit/false: default wide rectangle + rounded corners. Mobile unchanged.
   */
  desktopSquareCorners?: boolean;
}

export interface AddExpensePrefillPayload {
  source_bill_id: string;
  expense_name?: string;
  amount?: number;
  expense_type?: string;
  category?: string;
  department?: string;
  recurring_frequency?: string;
  /** Bill next due; prefill first payment date for Paynow. */
  next_payment_date?: string;
  bill_create_date?: string;
}

export interface AddExpenseAfterSuccessPayload {
  /** Master recurring row to advance after settlement payment. */
  linked_recurring_source_id?: string;
  create_date: string;
  created_expense_id: string;
}

/** First 8 hex chars of UUID (no dashes), uppercase — for compact display. */
export function shortExpenseIdForDisplay(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function formatAmount(value: string): string {
  const numericValue = value.replace(/\D/g, "");
  if (!numericValue) return "";
  return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parseAmount(value: string): number {
  return parseFloat(value.replace(/\D/g, "")) || 0;
}

/** Konversi data URL hasil canvas CameraModal menjadi File receipt */
function dataUrlToImageFile(dataUrl: string, filename: string): File {
  const parts = dataUrl.split(",");
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch?.[1] ?? "image/jpeg";
  const bstr = atob(parts[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) u8arr[i] = bstr.charCodeAt(i);
  return new File([u8arr], filename, { type: mime });
}

/**
 * Add New Expense modal. Same logic as desktop ExpenseDashboard form.
 * Fullscreen on mobile per .cursor/rules/modal-android-fullscreen.mdc.
 */
const RECEIPT_ALLOWED = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const RECEIPT_ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];

function hasAllowedReceiptType(file: File): boolean {
  const t = (file.type ?? "").toLowerCase();
  if (t && RECEIPT_ALLOWED.includes(t)) return true;
  const fileName = (file.name ?? "").toLowerCase();
  return RECEIPT_ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
}

function getReceiptValidationError(file: File): "size" | "type" | null {
  if (file.size > 10 * 1024 * 1024) return "size";
  if (!hasAllowedReceiptType(file)) return "type";
  return null;
}

export function AddNewExpenseModal({
  open,
  onOpenChange,
  prefillData,
  onAfterCreateExpenseSuccess,
  initialReceiptFiles,
  initialReceiptFilesKey,
  shareFlowLocked = false,
  onShareFlowSuccess,
  aiAutofillStatus = "idle",
  aiAutofillData,
  aiAutofillRequestId = 0,
  desktopSquareCorners = false,
}: AddNewExpenseModalProps) {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();
  const { organizationId } = useCurrentOrg();
  const { createExpense, isCreating, expenses } = useExpenses();
  const { expenseTypes, isLoading: expenseTypesLoading } = useExpenseTypes();
  const [selectedExpenseTypeId, setSelectedExpenseTypeId] = useState<string>("");
  const { expenseCategories, refetch: refetchExpenseCategories } =
    useExpenseCategories(selectedExpenseTypeId);
  const { data: departments = [], isLoading: departmentsLoading } =
    useDepartmentsCrud(organizationId);
  const { debts: debtsForExpense, isLoading: debtsLoading } = useDebtsForExpense();
  const { bankAccounts, loading: bankAccountsLoading } = useBankAccounts();
  const { balances: bankAccountBalances, loading: balancesLoading, refetch: refetchBalances } =
    useBankAccountBalances();

  const [amountDisplay, setAmountDisplay] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => new Date());
  const [firstPaymentDate, setFirstPaymentDate] = useState<Date | undefined>();
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [shareCancelConfirmOpen, setShareCancelConfirmOpen] = useState(false);
  /** Kamera in-app (getUserMedia) seperti halaman Absensi — tidak membuka aplikasi kamera native */
  const [receiptCameraOpen, setReceiptCameraOpen] = useState(false);
  const receiptSectionRef = useRef<HTMLDivElement>(null);
  /** True saat overlay kamera receipt terbuka; cegah Radix menutup dialog (outside/focus) */
  const isReceiptInteractionRef = useRef(false);
  const receiptProtectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOpenRef = useRef(false);
  const lastAppliedAiRequestRef = useRef<number | null>(null);
  const [transactionRefDisplay, setTransactionRefDisplay] = useState("");
  const [incomeAllocIncomeId, setIncomeAllocIncomeId] = useState("");
  const [incomeAllocAmountStr, setIncomeAllocAmountStr] = useState("");

  /** Delay setelah tutup kamera in-app sebelum ref proteksi di-clear */
  const RECEIPT_PROTECTION_DELAY_MS = 2000;
  const clearReceiptProtectionAfterDelay = useCallback(() => {
    if (receiptProtectionTimeoutRef.current) clearTimeout(receiptProtectionTimeoutRef.current);
    receiptProtectionTimeoutRef.current = setTimeout(() => {
      receiptProtectionTimeoutRef.current = null;
      isReceiptInteractionRef.current = false;
    }, RECEIPT_PROTECTION_DELAY_MS);
  }, []);

  /** Append receipt file(s) after validation (images + PDF, max 10MB each). */
  const addReceiptFilesSafe = useCallback((incoming: File | File[]) => {
    const list = Array.isArray(incoming) ? incoming : [incoming];
    const next: File[] = [];
    for (const file of list) {
      const validationError = getReceiptValidationError(file);
      if (validationError === "size") {
        toast.error(t("expenses.receiptTooLarge", "File must be less than 10MB"));
        continue;
      }
      if (validationError === "type") {
        toast.error(
          t("expenses.receiptInvalidType", "Only JPG, PNG, WEBP, or PDF are allowed")
        );
        continue;
      }
      next.push(file);
    }
    if (next.length === 0) return;
    setReceiptFiles((prev) => [...prev, ...next]);
  }, [t]);

  useEffect(() => {
    if (!open) return;
    if (shareFlowLocked && initialReceiptFiles?.length) {
      setReceiptFiles(initialReceiptFiles.filter((file) => getReceiptValidationError(file) === null));
    } else if (!shareFlowLocked) {
      setReceiptFiles([]);
    }
  }, [open, shareFlowLocked, initialReceiptFilesKey, initialReceiptFiles]);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      lastAppliedAiRequestRef.current = null;
      return;
    }
    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;
    if (!justOpened) return;
    setTransactionRefDisplay("");
    lastAppliedAiRequestRef.current = null;
  }, [open]);

  useEffect(() => {
    if (!shareFlowLocked || !open || aiAutofillStatus === "loading") return;
    if (lastAppliedAiRequestRef.current === aiAutofillRequestId) return;
    lastAppliedAiRequestRef.current = aiAutofillRequestId;
    const d = aiAutofillData;
    if (!d) return;
    if (d.transactionId) setTransactionRefDisplay(d.transactionId);
  }, [shareFlowLocked, open, aiAutofillStatus, aiAutofillRequestId, aiAutofillData]);

  const receiptPreviewUrls = useMemo(
    () =>
      receiptFiles.map((f) =>
        f.type.startsWith("image/") ? URL.createObjectURL(f) : null
      ),
    [receiptFiles]
  );

  useEffect(() => {
    return () => {
      receiptPreviewUrls.forEach((u) => {
        if (u) URL.revokeObjectURL(u);
      });
    };
  }, [receiptPreviewUrls]);

  useEffect(() => {
    if (!open || !shareFlowLocked) return;
    setShareBackGuard(() => {
      setShareCancelConfirmOpen(true);
      return true;
    });
    return () => setShareBackGuard(null);
  }, [open, shareFlowLocked]);
  const [isCreateDatePickerOpen, setIsCreateDatePickerOpen] = useState(false);
  const [isFirstPaymentDatePickerOpen, setIsFirstPaymentDatePickerOpen] = useState(false);
  const [typeDrawerOpen, setTypeDrawerOpen] = useState(false);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [departmentDrawerOpen, setDepartmentDrawerOpen] = useState(false);
  const [withdrawalDrawerOpen, setWithdrawalDrawerOpen] = useState(false);
  const [recurringLinkDrawerOpen, setRecurringLinkDrawerOpen] = useState(false);

  const eligibleRecurringBillsForLink = useMemo(() => {
    return expenses.filter(
      (e) =>
        e.is_recurring &&
        !e.recurring_settlement_for_expense_id &&
        isRecurringBillPayNowEligible(e)
    );
  }, [expenses]);

  const form = useForm<AddExpenseFormData>({
    resolver: zodResolver(addExpenseSchema),
    defaultValues: {
      expense_name: "",
      amount: undefined as unknown as number,
      expense_type: "",
      category: "",
      department: "",
      withdrawal_from_balance: undefined,
      bank_account_id: undefined,
      create_date: format(new Date(), "yyyy-MM-dd"),
      is_recurring: false,
      recurring_frequency: "",
      first_payment_date: "",
      linked_recurring_expense_id: "",
      description: "",
    },
  });

  const isRecurring = form.watch("is_recurring");
  const linkedRecurringExpenseId = form.watch("linked_recurring_expense_id");
  const linkedExpenseForLabel = linkedRecurringExpenseId
    ? expenses.find((e) => e.id === linkedRecurringExpenseId)
    : undefined;

  const applyLinkedRecurringFromExpense = useCallback(
    (expenseRow: Expense) => {
      form.setValue("linked_recurring_expense_id", expenseRow.id, { shouldDirty: true });
      if (expenseRow.recurring_frequency) {
        form.setValue("recurring_frequency", expenseRow.recurring_frequency, { shouldDirty: true });
      }
      const fp = expenseRow.next_payment_date || expenseRow.create_date;
      if (fp) {
        const ymd = fp.includes("T") ? format(new Date(fp), "yyyy-MM-dd") : fp.slice(0, 10);
        form.setValue("first_payment_date", ymd, { shouldDirty: true });
        const d = new Date(ymd);
        if (!Number.isNaN(d.getTime())) setFirstPaymentDate(d);
      }
    },
    [form]
  );

  useEffect(() => {
    if (!open || !aiAutofillData || aiAutofillStatus !== "success") return;
    const dirtyFields = form.formState.dirtyFields;

    if (!dirtyFields.expense_name && !form.getValues("expense_name") && aiAutofillData.expenseName) {
      form.setValue("expense_name", aiAutofillData.expenseName, { shouldDirty: false });
    }

    if (!dirtyFields.amount && !form.getValues("amount") && typeof aiAutofillData.amount === "number") {
      const normalizedAmount = Math.max(0, Math.round(aiAutofillData.amount));
      if (normalizedAmount > 0) {
        form.setValue("amount", normalizedAmount, { shouldValidate: true, shouldDirty: false });
        setAmountDisplay(formatAmount(String(normalizedAmount)));
      }
    }

    if (!dirtyFields.create_date && aiAutofillData.createDate) {
      const parsedDate = new Date(aiAutofillData.createDate);
      if (!Number.isNaN(parsedDate.getTime())) {
        form.setValue("create_date", format(parsedDate, "yyyy-MM-dd"), { shouldDirty: false });
        setSelectedDate(parsedDate);
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

  const handleExpenseTypeChange = (value: string) => {
    form.setValue("expense_type", value);
    setSelectedExpenseTypeId(expenseTypes.find((t) => t.name === value)?.id ?? "");
    form.setValue("category", "");
  };

  const handleSubmit = async (data: AddExpenseFormData) => {
    if (shareFlowLocked) {
      if (aiAutofillStatus === "loading") return;
      if (!transactionRefDisplay.trim()) {
        toast.error(
          t(
            "expenses.shareTransactionIdRequired",
            "Transaction ID was not detected on the receipt. Try again or choose another destination."
          )
        );
        return;
      }
      if (receiptFiles.length === 0) {
        toast.error(t("expenses.shareReceiptRequired", "Add at least one receipt file."));
        return;
      }
    }

    if (data.withdrawal_from_balance && data.withdrawal_from_balance !== "none") {
      const selectedDebt = debtsForExpense.find((d) => d.id === data.withdrawal_from_balance);
      if (selectedDebt && (selectedDebt.available_limit ?? 0) < data.amount) {
        toast.error(
          `Insufficient available limit. Available: Rp ${(selectedDebt.available_limit ?? 0).toLocaleString("id-ID")}, Required: Rp ${data.amount.toLocaleString("id-ID")}`
        );
        return;
      }
    }
    if (data.bank_account_id) {
      const balance = bankAccountBalances.find((b) => b.bank_account_id === data.bank_account_id);
      const availableBalance = balance?.balance ?? 0;
      if (availableBalance < data.amount) {
        toast.error(
          `Insufficient balance. Available: Rp ${availableBalance.toLocaleString("id-ID")}, Required: Rp ${data.amount.toLocaleString("id-ID")}`
        );
        return;
      }
    }

    const linkedRecurringRaw = (data.linked_recurring_expense_id ?? "").trim();
    if (data.is_recurring && linkedRecurringRaw) {
      if (!data.recurring_frequency?.trim() || !data.first_payment_date?.trim()) {
        toast.error(
          t(
            "expenses.recurringLinkFieldsRequired",
            "Select frequency and first payment date when paying an existing recurring bill."
          )
        );
        return;
      }
    }

    const selectedExpenseType = expenseTypes.find((type) => type.name === data.expense_type);

    let income_allocation: CreateExpenseData["income_allocation"];
    if (data.bank_account_id && incomeAllocIncomeId.trim()) {
      const raw = incomeAllocAmountStr.trim().replace(/\s/g, "").replace(/,/g, ".");
      const amt = parseFloat(raw);
      if (Number.isFinite(amt) && amt > 0) {
        income_allocation = { income_transaction_id: incomeAllocIncomeId.trim(), amount: amt };
      }
    }

    const expenseData: CreateExpenseData = {
      expense_name: data.expense_name ?? "",
      amount: data.amount ?? 0,
      expense_type: data.expense_type ?? "",
      category: data.category ?? "",
      department: data.department,
      create_date: data.create_date ?? format(new Date(), "yyyy-MM-dd"),
      is_recurring: data.is_recurring ?? false,
      recurring_frequency: data.recurring_frequency,
      first_payment_date: data.first_payment_date,
      description: data.description,
      receipt_files: receiptFiles.length ? receiptFiles : undefined,
      withdrawal_from_balance:
        data.withdrawal_from_balance && data.withdrawal_from_balance !== "none"
          ? data.withdrawal_from_balance
          : undefined,
      bank_account_id: data.bank_account_id ?? undefined,
      recurring_settlement_for_expense_id:
        data.is_recurring && linkedRecurringRaw ? linkedRecurringRaw : undefined,
      transaction_reference:
        shareFlowLocked && transactionRefDisplay.trim() ? transactionRefDisplay : undefined,
      income_allocation,
    };

    const createdExpense = await createExpense(expenseData);
    if (createdExpense) {
      const createdExpenseId = (() => {
        if (typeof createdExpense !== "object" || !createdExpense) return "";
        const expenseWithId = createdExpense as { id?: unknown };
        return expenseWithId.id ? String(expenseWithId.id) : "";
      })();
      await onAfterCreateExpenseSuccess?.({
        linked_recurring_source_id:
          data.is_recurring && linkedRecurringRaw ? linkedRecurringRaw : undefined,
        create_date: data.create_date ?? format(new Date(), "yyyy-MM-dd"),
        created_expense_id: createdExpenseId,
      });
      refetchBalances();
      await onShareFlowSuccess?.();
      onOpenChange(false);
      form.reset({
        expense_name: "",
        amount: undefined as unknown as number,
        expense_type: "",
        category: "",
        department: "",
        withdrawal_from_balance: undefined,
        bank_account_id: undefined,
        create_date: format(new Date(), "yyyy-MM-dd"),
        is_recurring: false,
        recurring_frequency: "",
        first_payment_date: "",
        linked_recurring_expense_id: "",
        description: "",
      });
      setAmountDisplay("");
      setReceiptFiles([]);
      setSelectedDate(undefined);
      setFirstPaymentDate(undefined);
      setSelectedExpenseTypeId("");
      setTransactionRefDisplay("");
      setIncomeAllocIncomeId("");
      setIncomeAllocAmountStr("");
    }
  };

  useEffect(() => {
    if (!open) return;

    if (prefillData) {
      const nextCreateDate = format(new Date(), "yyyy-MM-dd");
      form.setValue("expense_name", prefillData.expense_name ?? "", { shouldDirty: false });
      form.setValue("amount", prefillData.amount ?? (undefined as unknown as number), { shouldDirty: false });
      form.setValue("expense_type", prefillData.expense_type ?? "", { shouldDirty: false });
      form.setValue("category", prefillData.category ?? "", { shouldDirty: false });
      form.setValue("department", prefillData.department ?? "", { shouldDirty: false });
      form.setValue("create_date", nextCreateDate, { shouldDirty: false });
      form.setValue("is_recurring", true, { shouldDirty: false });
      form.setValue("linked_recurring_expense_id", prefillData.source_bill_id, { shouldDirty: false });
      form.setValue("recurring_frequency", prefillData.recurring_frequency ?? "", { shouldDirty: false });
      const firstPayRaw =
        prefillData.next_payment_date ||
        prefillData.bill_create_date ||
        nextCreateDate;
      const ymd =
        firstPayRaw.includes("T") && firstPayRaw.length > 10
          ? format(new Date(firstPayRaw), "yyyy-MM-dd")
          : firstPayRaw.slice(0, 10);
      form.setValue("first_payment_date", ymd, { shouldDirty: false });
      const fd = new Date(ymd);
      if (!Number.isNaN(fd.getTime())) setFirstPaymentDate(fd);
      else setFirstPaymentDate(undefined);

      setAmountDisplay(
        typeof prefillData.amount === "number" && prefillData.amount > 0
          ? formatAmount(String(prefillData.amount))
          : ""
      );
      setSelectedDate(new Date());
      setSelectedExpenseTypeId(
        prefillData.expense_type
          ? expenseTypes.find((item) => item.name === prefillData.expense_type)?.id ?? ""
          : ""
      );
      return;
    }

    if (shareFlowLocked) return;

    form.setValue("linked_recurring_expense_id", "", { shouldDirty: false });
    form.setValue("is_recurring", false, { shouldDirty: false });
    form.setValue("recurring_frequency", "", { shouldDirty: false });
    form.setValue("first_payment_date", "", { shouldDirty: false });
    setFirstPaymentDate(undefined);
  }, [open, prefillData, shareFlowLocked, form, expenseTypes]);

  /**
   * Kamera dalam WebView (getUserMedia) — user tetap di dalam aplikasi.
   * Tanpa getUserMedia: hanya pemilih berkas / galeri (tetap alur WebView).
   */
  const handleTakeReceiptPhoto = () => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      isReceiptInteractionRef.current = true;
      setReceiptCameraOpen(true);
      return;
    }
    toast.message(
      t("expenses.receiptUseFilePicker", "Pilih gambar dari berkas"),
      {
        description: t(
          "expenses.receiptUseFilePickerHint",
          "Kamera langsung tidak tersedia di perangkat ini. Gunakan “Pilih file”."
        ),
      }
    );
    void handlePickReceiptFromGallery();
  };

  const handleReceiptCameraCapture = (imageData: string) => {
    try {
      const file = dataUrlToImageFile(imageData, `receipt_${Date.now()}.jpg`);
      addReceiptFilesSafe(file);
      toast.success(t("expenses.receiptPhotoTaken", "Receipt photo taken"));
      clearReceiptProtectionAfterDelay();
      requestAnimationFrame(() => {
        receiptSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } catch {
      toast.error(t("expenses.photoCaptureFailed", "Photo capture failed"));
    }
  };

  const handleReceiptCameraClose = () => {
    setReceiptCameraOpen(false);
    clearReceiptProtectionAfterDelay();
  };

  const handlePickReceiptFromGallery = async () => {
    try {
      const files = await pickReceiptImageFiles({ maxItems: 20, mediaType: "imageOnly" });
      if (!files.length) return;
      for (const file of files) {
        addReceiptFilesSafe(file);
      }
      requestAnimationFrame(() => {
        receiptSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } catch {
      toast.error(t("expenses.receiptPickFailed", "Failed to pick receipt file"));
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && shareFlowLocked) {
      setShareCancelConfirmOpen(true);
      return;
    }
    if (!next) {
      if (receiptProtectionTimeoutRef.current) {
        clearTimeout(receiptProtectionTimeoutRef.current);
        receiptProtectionTimeoutRef.current = null;
      }
      isReceiptInteractionRef.current = false;
      setAmountDisplay("");
      setIsCreateDatePickerOpen(false);
      setIsFirstPaymentDatePickerOpen(false);
      setIncomeAllocIncomeId("");
      setIncomeAllocAmountStr("");
    }
    onOpenChange(next);
  };

  const confirmShareFlowCancel = () => {
    setShareCancelConfirmOpen(false);
    if (receiptProtectionTimeoutRef.current) {
      clearTimeout(receiptProtectionTimeoutRef.current);
      receiptProtectionTimeoutRef.current = null;
    }
    isReceiptInteractionRef.current = false;
    setAmountDisplay("");
    setIsCreateDatePickerOpen(false);
    setIsFirstPaymentDatePickerOpen(false);
    setReceiptFiles([]);
    setTransactionRefDisplay("");
    setIncomeAllocIncomeId("");
    setIncomeAllocAmountStr("");
    onOpenChange(false);
  };

  const hasWithdrawal =
    (form.watch("withdrawal_from_balance") && form.watch("withdrawal_from_balance") !== "none") ||
    !!form.watch("bank_account_id");

  const shareSubmitBlocked =
    shareFlowLocked &&
    (aiAutofillStatus === "loading" ||
      !transactionRefDisplay.trim() ||
      receiptFiles.length === 0);

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

  return (
    <Fragment>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "w-full max-w-none m-0 rounded-none translate-x-0 translate-y-0 flex flex-col p-0 gap-0 border-none bg-background shadow-xl focus:outline-none overflow-hidden",
          isMobile
            ? "fixed left-0 right-0 top-0 modal-above-safe-area h-screen"
            : cn(
                "sm:translate-x-[-50%] sm:translate-y-[-50%] sm:left-[50%] sm:top-[50%] sm:flex sm:flex-col sm:overflow-hidden",
                desktopSquareCorners
                  ? "sm:w-[min(88vw,88vh,42rem,90vh)] sm:h-[min(88vw,88vh,42rem,90vh)] sm:max-w-none sm:max-h-[90vh] sm:rounded-none"
                  : "sm:max-w-lg sm:h-auto sm:max-h-[90vh] sm:rounded-lg"
              )
        )}
        fullscreenAnimation={isMobile}
        onInteractOutside={(e) => {
          if (shareFlowLocked || isReceiptInteractionRef.current) e.preventDefault();
        }}
        onFocusOutside={(e) => {
          if (shareFlowLocked || isReceiptInteractionRef.current) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (shareFlowLocked || isReceiptInteractionRef.current) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (shareFlowLocked) e.preventDefault();
        }}
      >
        <DialogHeader
          className={cn(
            "flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left",
            isMobile ? "safe-area-top px-4 pt-4 pb-3" : "px-4 pt-4 pb-3"
          )}
        >
          <DialogTitle className="text-lg font-semibold">
            {t("expenses.addNewExpenseTitle", "Add New Expense")}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("expenses.addNewExpenseSubtitle", "Enter the details for your new expense entry.")}
          </p>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain px-4 py-4 space-y-4">
            {shareFlowLocked && aiAutofillStatus === "loading" ? (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span>{t("expenses.aiAnalyzingReceipt", "Menganalisis receipt dengan AI...")}</span>
              </div>
            ) : null}
            {shareFlowLocked ? (
              <div>
                <label htmlFor="expense_transaction_ref_display" className="block text-sm font-medium mb-2">
                  {t("expenses.transactionIdLabel", "Transaction ID")}
                </label>
                <Input
                  id="expense_transaction_ref_display"
                  value={transactionRefDisplay}
                  readOnly
                  disabled
                  className="w-full text-sm bg-muted"
                  placeholder={t("expenses.transactionIdPlaceholder", "Detected from receipt by AI")}
                />
                {!transactionRefDisplay.trim() && aiAutofillStatus !== "loading" ? (
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                    {t(
                      "expenses.transactionIdMissingHint",
                      "No reference found yet. Wait for analysis to finish or choose another destination."
                    )}
                  </p>
                ) : null}
                {showAiIdentifierReviewHint ? (
                  <Alert className="mt-2 border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
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
            <div>
              <label className="block text-sm font-medium mb-2">
                {t("expenses.expenseName", "Expense Name")} <span className="text-red-500">*</span>
              </label>
              <Input
                {...form.register("expense_name")}
                placeholder={t("expenses.placeholderExpenseName", "Enter expense name")}
                className="w-full text-sm"
              />
              {form.formState.errors.expense_name && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.expense_name.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                {t("expenses.amount", "Amount")} <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                placeholder={t("expenses.placeholderAmount", "Enter amount")}
                value={amountDisplay}
                onChange={(e) => {
                  const formatted = formatAmount(e.target.value);
                  setAmountDisplay(formatted);
                  const parsed = parseAmount(formatted);
                  form.setValue("amount", parsed > 0 ? parsed : (undefined as unknown as number), {
                    shouldValidate: true,
                  });
                }}
                className="w-full text-sm"
              />
              {form.formState.errors.amount && (
                <p className="text-sm text-red-500 mt-1">{form.formState.errors.amount.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                {t("expenses.createDate", "Create Date")} <span className="text-red-500">*</span>
              </label>
              {isMobile ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal text-sm",
                      !selectedDate && "text-muted-foreground"
                    )}
                    onClick={() => setIsCreateDatePickerOpen(true)}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate
                      ? format(selectedDate, "MM/dd/yyyy")
                      : format(new Date(), "MM/dd/yyyy")}
                  </Button>
                  <Dialog open={isCreateDatePickerOpen} onOpenChange={setIsCreateDatePickerOpen}>
                    <DialogContent
                      overlayClassName="z-[60]"
                      className="z-[60] w-auto max-w-[min(92vw,380px)] p-0 gap-0 overflow-hidden border rounded-lg shadow-lg bg-background"
                    >
                      <DialogTitle className="sr-only">
                        {t("expenses.createDate", "Create Date")}
                      </DialogTitle>
                      <div className="p-0">
                        <Calendar
                          mode="single"
                          selected={selectedDate ?? new Date()}
                          onSelect={(date) => {
                            setSelectedDate(date);
                            if (date) {
                              form.setValue("create_date", format(date, "yyyy-MM-dd"));
                              setIsCreateDatePickerOpen(false);
                            }
                          }}
                          initialFocus
                        />
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              ) : (
                <Popover open={isCreateDatePickerOpen} onOpenChange={setIsCreateDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal text-sm",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate
                        ? format(selectedDate, "MM/dd/yyyy")
                        : format(new Date(), "MM/dd/yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate ?? new Date()}
                      onSelect={(date) => {
                        setSelectedDate(date);
                        if (date) {
                          form.setValue("create_date", format(date, "yyyy-MM-dd"));
                          setIsCreateDatePickerOpen(false);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* Type: parent. On mobile use drawer, else Select. */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {t("expenses.type", "Expense Type")} <span className="text-red-500">*</span>
              </label>
              {isMobile ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between text-sm font-normal"
                    disabled={expenseTypesLoading}
                    onClick={() => setTypeDrawerOpen(true)}
                  >
                    <span className={cn(!form.watch("expense_type") && "text-muted-foreground")}>
                      {expenseTypesLoading
                        ? t("expenses.loadingExpenseTypes", "Loading expense types...")
                        : form.watch("expense_type") ||
                          t("expenses.placeholderExpenseType", "Select expense type")}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                  <Drawer open={typeDrawerOpen} onOpenChange={setTypeDrawerOpen}>
                    <DrawerContent
                      className="z-[60]"
                      overlayClassName="z-[60]"
                    >
                      <DrawerHeader className="text-left">
                        <DrawerTitle>
                          {t("expenses.type", "Expense Type")}
                        </DrawerTitle>
                      </DrawerHeader>
                      <div className="max-h-[60vh] overflow-y-auto px-4 pb-4">
                        <div className="flex flex-col gap-0 rounded-md border bg-card">
                          {expenseTypes.map((type) => (
                            <button
                              key={type.id}
                              type="button"
                              onClick={() => {
                                handleExpenseTypeChange(type.name);
                                setTypeDrawerOpen(false);
                              }}
                              className={cn(
                                "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0",
                                form.watch("expense_type") === type.name
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "hover:bg-muted/50"
                              )}
                            >
                              <span className="truncate">{type.name}</span>
                              {form.watch("expense_type") === type.name ? (
                                <Check className="h-4 w-4 shrink-0 text-primary" />
                              ) : null}
                            </button>
                          ))}
                        </div>
                      </div>
                    </DrawerContent>
                  </Drawer>
                </>
              ) : (
                <Select onValueChange={handleExpenseTypeChange} disabled={expenseTypesLoading}>
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue
                      placeholder={
                        expenseTypesLoading
                          ? t("expenses.loadingExpenseTypes", "Loading expense types...")
                          : t("expenses.placeholderExpenseType", "Select expense type")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseTypes.map((type) => (
                      <SelectItem key={type.id} value={type.name}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {form.formState.errors.expense_type && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.expense_type.message}
                </p>
              )}
            </div>

            {/* Category: child of Type. On mobile use drawer (options depend on selected type), else Select. */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {t("expenses.category", "Category")} <span className="text-red-500">*</span>
              </label>
              {isMobile ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between text-sm font-normal"
                    disabled={!selectedExpenseTypeId || expenseCategories.length === 0}
                    onClick={() => selectedExpenseTypeId && setCategoryDrawerOpen(true)}
                  >
                    <span
                      className={cn(
                        !form.watch("category") && "text-muted-foreground"
                      )}
                    >
                      {!selectedExpenseTypeId
                        ? t("expenses.selectExpenseTypeFirst", "Select expense type first")
                        : expenseCategories.length === 0
                          ? t("expenses.noCategoriesAvailable", "No categories available")
                          : form.watch("category") ||
                            t("expenses.placeholderCategory", "Select category")}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                  <Drawer open={categoryDrawerOpen} onOpenChange={setCategoryDrawerOpen}>
                    <DrawerContent
                      className="z-[60]"
                      overlayClassName="z-[60]"
                    >
                      <DrawerHeader className="text-left">
                        <DrawerTitle>
                          {t("expenses.category", "Category")}
                        </DrawerTitle>
                        {selectedExpenseTypeId && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {t("expenses.type", "Expense Type")}: {form.watch("expense_type")}
                          </p>
                        )}
                      </DrawerHeader>
                      <div className="max-h-[60vh] overflow-y-auto px-4 pb-4">
                        <div className="flex flex-col gap-0 rounded-md border bg-card">
                          {expenseCategories.map((cat) => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                form.setValue("category", cat.name);
                                setCategoryDrawerOpen(false);
                              }}
                              className={cn(
                                "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0",
                                form.watch("category") === cat.name
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "hover:bg-muted/50"
                              )}
                            >
                              <span className="truncate">{cat.name}</span>
                              {form.watch("category") === cat.name ? (
                                <Check className="h-4 w-4 shrink-0 text-primary" />
                              ) : null}
                            </button>
                          ))}
                        </div>
                      </div>
                    </DrawerContent>
                  </Drawer>
                </>
              ) : (
                <Select
                  onValueChange={(v) => form.setValue("category", v)}
                  disabled={!selectedExpenseTypeId || expenseCategories.length === 0}
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue
                      placeholder={
                        !selectedExpenseTypeId
                          ? t("expenses.selectExpenseTypeFirst", "Select expense type first")
                          : expenseCategories.length === 0
                            ? t("expenses.noCategoriesAvailable", "No categories available")
                            : t("expenses.placeholderCategory", "Select category")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {form.formState.errors.category && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.category.message}
                </p>
              )}
            </div>

            {/* Department: optional. On mobile use drawer, else Select. */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {t("expenses.department", "Department")}
              </label>
              {isMobile ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between text-sm font-normal"
                    disabled={departmentsLoading}
                    onClick={() => setDepartmentDrawerOpen(true)}
                  >
                    <span
                      className={cn(
                        !form.watch("department") && "text-muted-foreground"
                      )}
                    >
                      {departmentsLoading
                        ? t("expenses.loadingDepartments", "Loading departments...")
                        : form.watch("department") ||
                          t("expenses.placeholderDepartment", "Select department (optional)")}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                  <Drawer open={departmentDrawerOpen} onOpenChange={setDepartmentDrawerOpen}>
                    <DrawerContent className="z-[60]" overlayClassName="z-[60]">
                      <DrawerHeader className="text-left">
                        <DrawerTitle>
                          {t("expenses.department", "Department")}
                        </DrawerTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("expenses.optional", "Optional")}
                        </p>
                      </DrawerHeader>
                      <div className="max-h-[60vh] overflow-y-auto px-4 pb-4">
                        <div className="flex flex-col gap-0 rounded-md border bg-card">
                          <button
                            type="button"
                            onClick={() => {
                              form.setValue("department", "");
                              setDepartmentDrawerOpen(false);
                            }}
                            className={cn(
                              "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border",
                              !form.watch("department")
                                ? "bg-primary/10 text-primary font-medium"
                                : "hover:bg-muted/50"
                            )}
                          >
                            <span className="text-muted-foreground">
                              {t("expenses.placeholderDepartment", "Select department (optional)")}
                            </span>
                            {!form.watch("department") ? (
                              <Check className="h-4 w-4 shrink-0 text-primary" />
                            ) : null}
                          </button>
                          {departments.map((d) => (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => {
                                form.setValue("department", d.name);
                                setDepartmentDrawerOpen(false);
                              }}
                              className={cn(
                                "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0",
                                form.watch("department") === d.name
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "hover:bg-muted/50"
                              )}
                            >
                              <span className="truncate">{d.name}</span>
                              {form.watch("department") === d.name ? (
                                <Check className="h-4 w-4 shrink-0 text-primary" />
                              ) : null}
                            </button>
                          ))}
                        </div>
                      </div>
                    </DrawerContent>
                  </Drawer>
                </>
              ) : (
                <Select
                  onValueChange={(v) => form.setValue("department", v)}
                  disabled={departmentsLoading}
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue
                      placeholder={
                        departmentsLoading
                          ? t("expenses.loadingDepartments", "Loading departments...")
                          : t("expenses.placeholderDepartment", "Select department (optional)")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.name}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                {t("expenses.withdrawalFromBalance", "Withdrawal From Balance")}{" "}
                <span className="text-red-500">*</span>
              </label>
              {isMobile ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between text-sm font-normal"
                    disabled={debtsLoading || bankAccountsLoading || balancesLoading}
                    onClick={() => setWithdrawalDrawerOpen(true)}
                  >
                    <span
                      className={cn(
                        "truncate",
                        !form.watch("withdrawal_from_balance") &&
                          !form.watch("bank_account_id") &&
                          "text-muted-foreground"
                      )}
                    >
                      {debtsLoading || bankAccountsLoading || balancesLoading
                        ? t("expenses.loading", "Loading...")
                        : (() => {
                            const debtId = form.watch("withdrawal_from_balance");
                            const bankId = form.watch("bank_account_id");
                            if (debtId) {
                              const d = debtsForExpense.find((x) => x.id === debtId);
                              if (d)
                                return `${d.debt_name} (Rp ${(d.available_limit ?? 0).toLocaleString("id-ID")} available)`;
                            }
                            if (bankId) {
                              const b = bankAccounts.find((x) => x.id === bankId);
                              const bal = bankAccountBalances.find((x) => x.bank_account_id === bankId);
                              if (b)
                                return `${b.name}${b.account_number ? ` - ${b.account_number}` : ""} (Rp ${(bal?.balance ?? 0).toLocaleString("id-ID")} available)`;
                            }
                            return t("expenses.selectSourceRequired", "Select source (required)");
                          })()}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                  <Drawer open={withdrawalDrawerOpen} onOpenChange={setWithdrawalDrawerOpen}>
                    <DrawerContent className="z-[60]" overlayClassName="z-[60]">
                      <DrawerHeader className="text-left">
                        <DrawerTitle>
                          {t("expenses.withdrawalFromBalance", "Withdrawal From Balance")}
                        </DrawerTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("expenses.selectSourceRequired", "Select source (required)")}
                        </p>
                      </DrawerHeader>
                      <div className="max-h-[60vh] overflow-y-auto px-4 pb-4">
                        <div className="flex flex-col gap-0 rounded-md border bg-card">
                          <button
                            type="button"
                            onClick={() => {
                              setIncomeAllocIncomeId("");
                              setIncomeAllocAmountStr("");
                              form.setValue("withdrawal_from_balance", undefined);
                              form.setValue("bank_account_id", undefined);
                              setWithdrawalDrawerOpen(false);
                            }}
                            className={cn(
                              "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border",
                              !form.watch("withdrawal_from_balance") &&
                                !form.watch("bank_account_id")
                                ? "bg-primary/10 text-primary font-medium"
                                : "hover:bg-muted/50"
                            )}
                          >
                            <span className="text-muted-foreground">
                              {t("expenses.withdrawalFilter.none", "None")}
                            </span>
                            {!form.watch("withdrawal_from_balance") &&
                            !form.watch("bank_account_id") ? (
                              <Check className="h-4 w-4 shrink-0 text-primary" />
                            ) : null}
                          </button>
                          {bankAccounts.length > 0 && (
                            <>
                              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/30 border-b border-border">
                                {t("expenses.bankAccounts", "Bank Accounts")}
                              </div>
                              {bankAccounts.map((b) => {
                                const bal = bankAccountBalances.find(
                                  (x) => x.bank_account_id === b.id
                                );
                                const v = bal?.balance ?? 0;
                                const text = b.account_number
                                  ? `${b.name} - ${b.account_number} (Rp ${v.toLocaleString("id-ID")} available)`
                                  : `${b.name} (Rp ${v.toLocaleString("id-ID")} available)`;
                                const isSelected = form.watch("bank_account_id") === b.id;
                                return (
                                  <button
                                    key={`bank_${b.id}`}
                                    type="button"
                                    onClick={() => {
                                      setIncomeAllocIncomeId("");
                                      setIncomeAllocAmountStr("");
                                      form.setValue("bank_account_id", b.id);
                                      form.setValue("withdrawal_from_balance", undefined);
                                      setWithdrawalDrawerOpen(false);
                                    }}
                                    className={cn(
                                      "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0",
                                      isSelected
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "hover:bg-muted/50"
                                    )}
                                  >
                                    <span className="truncate">{text}</span>
                                    {isSelected ? (
                                      <Check className="h-4 w-4 shrink-0 text-primary" />
                                    ) : null}
                                  </button>
                                );
                              })}
                            </>
                          )}
                          {debtsForExpense.length > 0 && (
                            <>
                              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/30 border-b border-border">
                                {t("expenses.debts", "Debts")}
                              </div>
                              {debtsForExpense.map((d) => {
                                const text = `${d.debt_name} (Rp ${(d.available_limit ?? 0).toLocaleString("id-ID")} available)`;
                                const isSelected = form.watch("withdrawal_from_balance") === d.id;
                                return (
                                  <button
                                    key={`debt_${d.id}`}
                                    type="button"
                                    onClick={() => {
                                      setIncomeAllocIncomeId("");
                                      setIncomeAllocAmountStr("");
                                      form.setValue("withdrawal_from_balance", d.id);
                                      form.setValue("bank_account_id", undefined);
                                      setWithdrawalDrawerOpen(false);
                                    }}
                                    className={cn(
                                      "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0",
                                      isSelected
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "hover:bg-muted/50"
                                    )}
                                  >
                                    <span className="truncate">{text}</span>
                                    {isSelected ? (
                                      <Check className="h-4 w-4 shrink-0 text-primary" />
                                    ) : null}
                                  </button>
                                );
                              })}
                            </>
                          )}
                        </div>
                      </div>
                    </DrawerContent>
                  </Drawer>
                </>
              ) : (
                <Select
                  onValueChange={(value) => {
                    setIncomeAllocIncomeId("");
                    setIncomeAllocAmountStr("");
                    if (value === "none") {
                      form.setValue("withdrawal_from_balance", undefined);
                      form.setValue("bank_account_id", undefined);
                    } else if (value.startsWith("debt_")) {
                      form.setValue("withdrawal_from_balance", value.replace("debt_", ""));
                      form.setValue("bank_account_id", undefined);
                    } else if (value.startsWith("bank_")) {
                      form.setValue("bank_account_id", value.replace("bank_", ""));
                      form.setValue("withdrawal_from_balance", undefined);
                    }
                  }}
                  disabled={debtsLoading || bankAccountsLoading || balancesLoading}
                  value={
                    form.watch("withdrawal_from_balance")
                      ? `debt_${form.watch("withdrawal_from_balance")}`
                      : form.watch("bank_account_id")
                        ? `bank_${form.watch("bank_account_id")}`
                        : "none"
                  }
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue
                      placeholder={
                        debtsLoading || bankAccountsLoading
                          ? t("expenses.loading", "Loading...")
                          : t("expenses.selectSourceRequired", "Select source (required)")
                      }
                    >
                      {(() => {
                        const debtId = form.watch("withdrawal_from_balance");
                        const bankId = form.watch("bank_account_id");
                        if (debtId) {
                          const d = debtsForExpense.find((x) => x.id === debtId);
                          if (d)
                            return `${d.debt_name} (Rp ${(d.available_limit ?? 0).toLocaleString("id-ID")} available)`;
                        }
                        if (bankId) {
                          const b = bankAccounts.find((x) => x.id === bankId);
                          const bal = bankAccountBalances.find((x) => x.bank_account_id === bankId);
                          if (b)
                            return `${b.name}${b.account_number ? ` - ${b.account_number}` : ""} (Rp ${(bal?.balance ?? 0).toLocaleString("id-ID")} available)`;
                        }
                        return "";
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("expenses.withdrawalFilter.none", "None")}</SelectItem>
                    {bankAccounts.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          {t("expenses.bankAccounts", "Bank Accounts")}
                        </div>
                        {bankAccounts.map((b) => {
                          const bal = bankAccountBalances.find((x) => x.bank_account_id === b.id);
                          const v = bal?.balance ?? 0;
                          const text = b.account_number
                            ? `${b.name} - ${b.account_number} (Rp ${v.toLocaleString("id-ID")} available)`
                            : `${b.name} (Rp ${v.toLocaleString("id-ID")} available)`;
                          return (
                            <SelectItem key={`bank_${b.id}`} value={`bank_${b.id}`}>
                              {text}
                            </SelectItem>
                          );
                        })}
                      </>
                    )}
                    {debtsForExpense.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          {t("expenses.debts", "Debts")}
                        </div>
                        {debtsForExpense.map((d) => (
                          <SelectItem key={`debt_${d.id}`} value={`debt_${d.id}`}>
                            {d.debt_name} (Rp {(d.available_limit ?? 0).toLocaleString("id-ID")}{" "}
                            available)
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              )}
              {form.formState.errors.withdrawal_from_balance && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.withdrawal_from_balance.message}
                </p>
              )}
            </div>

            <IncomeAllocationOptionalSection
              bankAccountId={form.watch("bank_account_id")}
              referenceAmount={form.watch("amount") ?? 0}
              referenceDate={form.watch("create_date")}
              selectedIncomeId={incomeAllocIncomeId}
              onSelectedIncomeId={setIncomeAllocIncomeId}
              allocationAmountStr={incomeAllocAmountStr}
              onAllocationAmountStrChange={setIncomeAllocAmountStr}
            />

            <div className="flex items-center space-x-2">
              <Checkbox
                id="recurring-mobile"
                checked={isRecurring}
                onCheckedChange={(checked) => {
                  const on = checked === true;
                  form.setValue("is_recurring", on);
                  if (!on) {
                    form.setValue("linked_recurring_expense_id", "");
                  }
                }}
              />
              <label htmlFor="recurring-mobile" className="text-sm font-medium">
                {t("expenses.thisIsRecurring", "This is a recurring expense")}
              </label>
            </div>

            {isRecurring && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t("expenses.recurringBillLink", "Link to recurring bill")}
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">
                    {t(
                      "expenses.recurringBillLinkHint",
                      "Overdue or due within 7 days. Leave empty to create a new recurring schedule."
                    )}
                  </p>
                  {isMobile ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between text-sm font-normal"
                        onClick={() => setRecurringLinkDrawerOpen(true)}
                      >
                        <span className="truncate text-left">
                          {linkedExpenseForLabel
                            ? `${shortExpenseIdForDisplay(linkedExpenseForLabel.id)} · ${linkedExpenseForLabel.expense_name}`
                            : t("expenses.recurringLinkNone", "No linked bill (new schedule)")}
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                      <Drawer open={recurringLinkDrawerOpen} onOpenChange={setRecurringLinkDrawerOpen}>
                        <DrawerContent className="z-[60]" overlayClassName="z-[60]">
                          <DrawerHeader className="text-left">
                            <DrawerTitle>
                              {t("expenses.selectRecurringBill", "Select recurring bill")}
                            </DrawerTitle>
                          </DrawerHeader>
                          <div className="max-h-[60vh] overflow-y-auto px-4 pb-4">
                            <div className="flex flex-col gap-0 rounded-md border bg-card">
                              <button
                                type="button"
                                onClick={() => {
                                  form.setValue("linked_recurring_expense_id", "", { shouldDirty: true });
                                  setRecurringLinkDrawerOpen(false);
                                }}
                                className={cn(
                                  "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border",
                                  !linkedRecurringExpenseId
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "hover:bg-muted/50"
                                )}
                              >
                                <span className="text-muted-foreground truncate">
                                  {t("expenses.recurringLinkNone", "No linked bill (new schedule)")}
                                </span>
                                {!linkedRecurringExpenseId ? (
                                  <Check className="h-4 w-4 shrink-0 text-primary" />
                                ) : null}
                              </button>
                              {eligibleRecurringBillsForLink.map((row) => (
                                <button
                                  key={row.id}
                                  type="button"
                                  onClick={() => {
                                    applyLinkedRecurringFromExpense(row);
                                    setRecurringLinkDrawerOpen(false);
                                  }}
                                  className={cn(
                                    "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0",
                                    linkedRecurringExpenseId === row.id
                                      ? "bg-primary/10 text-primary font-medium"
                                      : "hover:bg-muted/50"
                                  )}
                                >
                                  <span className="truncate">
                                    {shortExpenseIdForDisplay(row.id)} · {row.expense_name}
                                  </span>
                                  {linkedRecurringExpenseId === row.id ? (
                                    <Check className="h-4 w-4 shrink-0 text-primary" />
                                  ) : null}
                                </button>
                              ))}
                            </div>
                          </div>
                        </DrawerContent>
                      </Drawer>
                    </>
                  ) : (
                    <Select
                      value={linkedRecurringExpenseId || "__none__"}
                      onValueChange={(v) => {
                        if (v === "__none__") {
                          form.setValue("linked_recurring_expense_id", "");
                        } else {
                          const row = eligibleRecurringBillsForLink.find((x) => x.id === v);
                          if (row) applyLinkedRecurringFromExpense(row);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full text-sm">
                        <SelectValue
                          placeholder={t("expenses.selectRecurringBill", "Select recurring bill")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          {t("expenses.recurringLinkNone", "No linked bill (new schedule)")}
                        </SelectItem>
                        {eligibleRecurringBillsForLink.map((row) => (
                          <SelectItem key={row.id} value={row.id}>
                            {shortExpenseIdForDisplay(row.id)} · {row.expense_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t("expenses.recurringFrequency", "Recurring Frequency")}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={form.watch("recurring_frequency") || undefined}
                    onValueChange={(v) => form.setValue("recurring_frequency", v)}
                  >
                    <SelectTrigger className="w-full text-sm">
                      <SelectValue
                        placeholder={t("expenses.selectFrequency", "Select frequency")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {RECURRING_FREQUENCIES.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t("expenses.firstPaymentDate", "First Payment Date")}
                  </label>
                  <Popover
                    open={isFirstPaymentDatePickerOpen}
                    onOpenChange={setIsFirstPaymentDatePickerOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal text-sm",
                          !firstPaymentDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {firstPaymentDate
                          ? format(firstPaymentDate, "MM/dd/yyyy")
                          : "mm/dd/yyyy"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={firstPaymentDate}
                        onSelect={(date) => {
                          setFirstPaymentDate(date ?? undefined);
                          if (date)
                            form.setValue("first_payment_date", format(date, "yyyy-MM-dd"));
                          setIsFirstPaymentDatePickerOpen(false);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">
                {t("expenses.tableDescription", "Description")}
              </label>
              <Textarea
                {...form.register("description")}
                placeholder={t("expenses.placeholderDescription", "Additional details (optional)")}
                className="min-h-[80px] resize-none text-sm"
              />
            </div>

            <div ref={receiptSectionRef}>
              <label className="block text-sm font-medium mb-2">
                {t("expenses.receipt", "Receipt")}
              </label>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
                {receiptFiles.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {receiptFiles.map((f, idx) => (
                      <div
                        key={`${f.name}-${idx}`}
                        className="relative aspect-square rounded-md border border-border overflow-hidden bg-muted"
                      >
                        {f.type.startsWith("image/") && receiptPreviewUrls[idx] ? (
                          <img
                            src={receiptPreviewUrls[idx]!}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-1">
                            <FileText className="h-6 w-6 text-muted-foreground" />
                            <span className="text-[9px] text-muted-foreground line-clamp-2 break-all mt-0.5">
                              {f.name}
                            </span>
                          </div>
                        )}
                        <button
                          type="button"
                          className="absolute top-0.5 right-0.5 rounded-full bg-background/90 p-0.5 shadow"
                          onClick={() =>
                            setReceiptFiles((prev) => prev.filter((_, i) => i !== idx))
                          }
                          aria-label={t("common.remove", "Hapus")}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleTakeReceiptPhoto}
                    >
                      <Camera className="h-4 w-4 mr-1.5" />
                      {t("expenses.takePhoto", "Take photo")}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handlePickReceiptFromGallery}
                  >
                    <Upload className="h-4 w-4 mr-1.5" />
                    {t("expenses.chooseFile", "Choose File")}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenChange(false)}
                disabled={isCreating}
              >
                {shareFlowLocked
                  ? t("expenses.cancelShareFlow", "Batalkan")
                  : t("expenses.cancel", "Cancel")}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isCreating || !hasWithdrawal || shareSubmitBlocked}
                className="min-w-[120px] flex items-center justify-center gap-1.5"
              >
                {isCreating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{t("expenses.creating", "Adding...")}</span>
                  </>
                ) : (
                  t("expenses.addExpenseButton", "Add Expense")
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    <AlertDialog open={shareCancelConfirmOpen} onOpenChange={setShareCancelConfirmOpen}>
      <AlertDialogContent className="z-[100]">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("expenses.shareCancelTitle", "Batalkan tambah pengeluaran?")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              "expenses.shareCancelDescription",
              "Receipt yang sudah dipilih akan dibuang dari formulir ini."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.keepEditing", "Lanjutkan")}</AlertDialogCancel>
          <AlertDialogAction onClick={confirmShareFlowCancel}>
            {t("expenses.shareCancelConfirm", "Batalkan")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <CameraModal
      isOpen={receiptCameraOpen}
      onClose={handleReceiptCameraClose}
      onCapture={handleReceiptCameraCapture}
      title={t("expenses.receiptCameraTitle", "Receipt photo")}
      facingMode="environment"
      overlayClassName="z-[60]"
      contentClassName="z-[60]"
    />
    </Fragment>
  );
}
