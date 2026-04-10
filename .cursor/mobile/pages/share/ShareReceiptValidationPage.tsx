import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { ChevronLeft, FileText, Loader2 } from "lucide-react";
import { Button } from "@/mobile/components/ui/button";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { ShareIntent } from "@/plugins/share-intent";
import { shareIntentFilesToFiles } from "@/mobile/shareIntent/shareFilesToWeb";
import { setShareBackGuard } from "@/mobile/shareIntent/shareBackGuard";
import { useOrganizationList } from "@/mobile/hooks/useOrganizationList";
import { OrganizationSelectDrawer } from "@/mobile/components/OrganizationSelectDrawer";
import { AddNewExpenseModal } from "@/mobile/pages/expenses/modal/AddNewExpenseModal";
import { useExpenses } from "@/features/4_2_dashboard/hooks";
import { MobileAddIncomeTransactionModal } from "@/mobile/pages/incomes/modal/MobileAddIncomeTransactionModal";
import { useStatusBarStyle } from "@/mobile/hooks/useStatusBarStyle";
import {
  analyzeExpenseReceiptWithAI,
  type ExpenseReceiptAutofillData,
} from "@/mobile/pages/expenses/services/analyzeExpenseReceiptWithAI";
import { useDebts } from "@/features/4_2_debt/hooks";
import { DebtPaymentModal } from "@/features/4_2_debt/components/DebtPaymentModal";
import { getPayableDebts } from "@/features/4_2_debt/utils/payableDebts";
import {
  submitDebtPayment,
  type DebtPaymentModalSubmitPayload,
} from "@/features/4_2_debt/services/submitDebtPayment";
import { useBankAccountBalances } from "@/hooks/organized/useBankAccountBalances";
import { useCurrentOrg } from "@/features/share/hooks/useCurrentOrg";
import { useCurrentUser } from "@/features/share/hooks/useCurrentUser";
import { toast } from "sonner";
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

type ShareValidationCache = {
  files: File[] | null;
  loadError: string | null;
};

let shareValidationCache: ShareValidationCache = {
  files: null,
  loadError: null,
};

export default function ShareReceiptValidationPage() {
  useStatusBarStyle("light");
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const { activeOrganization, loading: orgLoading } = useOrganizationList();
  const { updateRecurringBillAfterPayNow } = useExpenses();
  const { debts, isLoading: debtsLoading, refetch: refetchDebts } = useDebts();
  const { updateBalance } = useBankAccountBalances();
  const { organizationId } = useCurrentOrg();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(shareValidationCache.files === null);
  const [files, setFiles] = useState<File[]>(shareValidationCache.files ?? []);
  const [loadError, setLoadError] = useState<string | null>(shareValidationCache.loadError);
  const [orgDrawerOpen, setOrgDrawerOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [isAnalyzingIncomeReceipt, setIsAnalyzingIncomeReceipt] = useState(false);
  const [incomeAutofillData, setIncomeAutofillData] = useState<ExpenseReceiptAutofillData | null>(null);
  const [incomeAnalysisRequestId, setIncomeAnalysisRequestId] = useState(0);
  const [isAnalyzingReceipt, setIsAnalyzingReceipt] = useState(false);
  const [autofillData, setAutofillData] = useState<ExpenseReceiptAutofillData | null>(null);
  const [analysisRequestId, setAnalysisRequestId] = useState(0);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [debtModalOpen, setDebtModalOpen] = useState(false);
  const [isAnalyzingDebtReceipt, setIsAnalyzingDebtReceipt] = useState(false);
  const [debtAutofillData, setDebtAutofillData] = useState<ExpenseReceiptAutofillData | null>(null);
  const [debtAnalysisRequestId, setDebtAnalysisRequestId] = useState(0);
  const [isDebtPaymentSubmitting, setIsDebtPaymentSubmitting] = useState(false);

  const activeOrgName = activeOrganization?.company_name ?? "—";
  const payableDebts = useMemo(() => getPayableDebts(debts), [debts]);
  const hasPayableDebts = payableDebts.length > 0;

  const didLoadRef = useRef(false);

  const loadPayload = useCallback(async () => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;

    if (shareValidationCache.files !== null) {
      setFiles(shareValidationCache.files);
      setLoadError(shareValidationCache.loadError);
      setLoading(false);
      return;
    }

    if (!Capacitor.isNativePlatform()) {
      const message = t(
        "shareReceipt.webNotSupported",
        "Buka dari aplikasi Android untuk membagikan berkas."
      );
      setLoadError(message);
      shareValidationCache = { files: [], loadError: message };
      setLoading(false);
      return;
    }
    if (files.length === 0) setLoading(true);
    setLoadError(null);
    try {
      const { files: raw } = await ShareIntent.getPendingPayload();
      if (raw.length === 0) {
        const message = t("shareReceipt.noFiles", "Tidak ada berkas untuk divalidasi.");
        setLoadError(message);
        setFiles([]);
        shareValidationCache = { files: [], loadError: message };
        return;
      }
      const next = await shareIntentFilesToFiles(raw);
      setFiles(next);
      shareValidationCache = { files: next, loadError: null };
    } catch (e) {
      console.error(e);
      const message = t("shareReceipt.loadFailed", "Gagal memuat berkas yang dibagikan.");
      setLoadError(message);
      shareValidationCache = { files: [], loadError: message };
    } finally {
      setLoading(false);
    }
  }, [t, files.length]);

  useEffect(() => {
    void loadPayload();
  }, [loadPayload]);

  const initialReceiptKey = useMemo(
    () => files.map((f) => `${f.name}:${f.size}`).join("|"),
    [files]
  );

  const imagePreviewUrls = useMemo(
    () =>
      files.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : null)),
    [files]
  );

  useEffect(() => {
    return () => {
      imagePreviewUrls.forEach((u) => {
        if (u) URL.revokeObjectURL(u);
      });
    };
  }, [imagePreviewUrls]);

  useEffect(() => {
    if (expenseModalOpen || incomeModalOpen || debtModalOpen) {
      setShareBackGuard(null);
      return;
    }
    setShareBackGuard(() => {
      setLeaveConfirmOpen(true);
      return true;
    });
    return () => setShareBackGuard(null);
  }, [expenseModalOpen, incomeModalOpen, debtModalOpen]);

  const handleLeaveConfirm = async () => {
    setLeaveConfirmOpen(false);
    setDebtModalOpen(false);
    await ShareIntent.clearPending();
    shareValidationCache = { files: null, loadError: null };
    setShareBackGuard(null);
    navigate("/", { replace: true });
  };

  const handleShareFlowSuccess = async () => {
    await ShareIntent.clearPending();
    shareValidationCache = { files: null, loadError: null };
    setExpenseModalOpen(false);
    setIncomeModalOpen(false);
    setDebtModalOpen(false);
    navigate("/expenses/dashboard", { replace: true });
  };

  const handleShareIncomeFlowSuccess = async () => {
    await ShareIntent.clearPending();
    shareValidationCache = { files: null, loadError: null };
    setIncomeModalOpen(false);
    setDebtModalOpen(false);
    navigate("/incomes/transaction", { replace: true });
  };

  const handleDebtShareFlowSuccess = async () => {
    await ShareIntent.clearPending();
    shareValidationCache = { files: null, loadError: null };
    setDebtModalOpen(false);
    navigate("/expenses/debt", { replace: true });
  };

  const handleAnalyzeAndOpenDebtPayment = async () => {
    setDebtModalOpen(true);
    setDebtAutofillData(null);
    setIsAnalyzingDebtReceipt(true);
    setDebtAnalysisRequestId((prev) => prev + 1);

    const result = await analyzeExpenseReceiptWithAI({
      receiptFiles: files,
    });

    if (result.success && result.data) {
      setDebtAutofillData(result.data);
      toast.success(
        t(
          "shareReceipt.debtAiAutofillReady",
          "Payment draft filled from receipt."
        )
      );
    } else {
      toast.error(
        result.error ||
          t(
            "shareReceipt.debtAiAutofillFailed",
            "AI analysis failed. Transaction ID may be missing."
          )
      );
    }

    setIsAnalyzingDebtReceipt(false);
  };

  const handleDebtPaymentSubmit = async (
    paymentData: DebtPaymentModalSubmitPayload
  ): Promise<boolean> => {
    const debt = debts.find((d) => d.id === paymentData.debtId);
    if (!debt || !organizationId || !user?.id) return false;

    setIsDebtPaymentSubmitting(true);
    try {
      const ok = await submitDebtPayment({
        organizationId,
        userId: user.id,
        debtId: paymentData.debtId,
        paymentAmount: paymentData.paymentAmount,
        paymentDate: paymentData.paymentDate,
        paymentMethod: paymentData.paymentMethod,
        notes: paymentData.notes ?? null,
        transactionReference: paymentData.transactionReference ?? null,
        receiptFile: paymentData.receiptFile ?? null,
        income_allocation: paymentData.incomeAllocation ?? null,
        debtDisplayName: debt.debt_name,
        updateBalance,
        onAfterSuccess: async () => {
          await refetchDebts();
          await queryClient.invalidateQueries({ queryKey: ["income-transactions", organizationId] });
        },
        messages: {
          duplicateTransactionRef: t(
            "debt.payment.duplicateTransactionRef",
            "This transaction ID is already recorded for this organization."
          ),
          receiptUploadFailed: t(
            "debt.payment.receiptUploadFailed",
            "Failed to upload receipt."
          ),
          paymentInsertFailed: t(
            "debt.payment.insertFailed",
            "Failed to record payment."
          ),
          bankAccountRequired: t(
            "debt.payment.bankAccountRequired",
            "Pilih rekening sumber dana untuk melanjutkan pembayaran."
          ),
          rollbackFailed: t(
            "debt.payment.rollbackFailed",
            "Pembayaran tidak selesai. Muat ulang halaman dan coba lagi."
          ),
          allocationLinkFailed: t(
            "debt.payment.allocationLinkFailed",
            "Could not link this payment to the selected income. The payment was not saved. Check amounts and account, then try again."
          ),
        },
      });
      if (ok) {
        await handleDebtShareFlowSuccess();
      }
      return ok;
    } finally {
      setIsDebtPaymentSubmitting(false);
    }
  };

  const isImage = (f: File) => f.type.startsWith("image/");

  const handleAnalyzeAndOpenExpense = async () => {
    setExpenseModalOpen(true);
    setAutofillData(null);
    setIsAnalyzingReceipt(true);
    setAnalysisRequestId((prev) => prev + 1);

    const result = await analyzeExpenseReceiptWithAI({
      receiptFiles: files,
    });

    if (result.success && result.data) {
      setAutofillData(result.data);
      toast.success(
        t("shareReceipt.aiAutofillReady", "Draft expense berhasil diisi otomatis dari receipt.")
      );
    } else {
      toast.error(
        result.error ||
          t(
            "shareReceipt.aiAutofillFailed",
            "Analisis AI gagal. Silakan isi form manual."
          )
      );
    }

    setIsAnalyzingReceipt(false);
  };

  const handleAnalyzeAndOpenIncome = async () => {
    setIncomeModalOpen(true);
    setIncomeAutofillData(null);
    setIsAnalyzingIncomeReceipt(true);
    setIncomeAnalysisRequestId((prev) => prev + 1);

    const result = await analyzeExpenseReceiptWithAI({
      receiptFiles: files,
    });

    if (result.success && result.data) {
      setIncomeAutofillData(result.data);
      toast.success(
        t(
          "shareReceipt.aiAutofillReadyIncome",
          "Draft pemasukan berhasil diisi otomatis dari receipt."
        )
      );
    } else {
      toast.error(
        result.error ||
          t(
            "shareReceipt.aiAutofillFailed",
            "Analisis AI gagal. Silakan isi form manual."
          )
      );
    }

    setIsAnalyzingIncomeReceipt(false);
  };

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <header className="flex-shrink-0 flex items-center gap-2 px-4 pt-4 pb-3 border-b border-border safe-area-top bg-card">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => setLeaveConfirmOpen(true)}
          aria-label={t("common.back", "Kembali")}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold text-foreground truncate">
            {t("shareReceipt.title", "Validasi receipt")}
          </h1>
          <p className="text-xs text-muted-foreground">
            {t("shareReceipt.subtitle", "Pilih tujuan sebelum menyimpan")}
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto seamless-scroll nested-scroll-touch-chain px-4 py-4 space-y-4">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">{t("shareReceipt.loading", "Memuat berkas…")}</span>
          </div>
        )}

        {!loading && loadError && (
          <p className="text-sm text-destructive text-center py-6">{loadError}</p>
        )}

        {!loading && !loadError && files.length > 0 && (
          <>
            <section className="rounded-xl border border-border bg-card p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("shareReceipt.currentOrganization", "Organisasi saat ini")}
              </p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground truncate">{activeOrgName}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={orgLoading}
                  onClick={() => setOrgDrawerOpen(true)}
                >
                  {t("shareReceipt.changeOrg", "Ubah")}
                </Button>
              </div>
            </section>

            <section>
              <p className="text-sm font-medium mb-2">{t("shareReceipt.preview", "Pratinjau")}</p>
              <div className="grid grid-cols-3 gap-2">
                {files.map((f, i) => (
                  <div
                    key={`${f.name}-${i}`}
                    className="aspect-square rounded-lg border border-border overflow-hidden bg-muted flex items-center justify-center"
                  >
                    {isImage(f) && imagePreviewUrls[i] ? (
                      <img
                        src={imagePreviewUrls[i]!}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-2 text-center">
                        <FileText className="h-8 w-8 text-muted-foreground mb-1" />
                        <span className="text-[10px] text-muted-foreground line-clamp-2 break-all">
                          {f.name}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-sm font-medium">{t("shareReceipt.destination", "Tujuan")}</p>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  type="button"
                  className="w-full justify-center"
                  onClick={() => void handleAnalyzeAndOpenExpense()}
                  disabled={isAnalyzingReceipt || isAnalyzingIncomeReceipt}
                >
                  {isAnalyzingReceipt ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {t("shareReceipt.analyzingReceipt", "Menganalisis receipt...")}
                    </>
                  ) : (
                    t("shareReceipt.toExpense", "Simpan sebagai pengeluaran (Expense)")
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  disabled={isAnalyzingIncomeReceipt || isAnalyzingReceipt}
                  onClick={() => void handleAnalyzeAndOpenIncome()}
                >
                  {isAnalyzingIncomeReceipt ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {t("shareReceipt.analyzingReceiptIncome", "Menganalisis receipt untuk pemasukan…")}
                    </>
                  ) : (
                    t("shareReceipt.toIncome", "Simpan sebagai pemasukan (Income)")
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-violet-400/70 text-violet-900 dark:border-violet-600 dark:text-violet-100"
                  disabled={
                    debtsLoading ||
                    !hasPayableDebts ||
                    isAnalyzingDebtReceipt ||
                    isAnalyzingReceipt ||
                    isAnalyzingIncomeReceipt
                  }
                  onClick={() => void handleAnalyzeAndOpenDebtPayment()}
                >
                  {isAnalyzingDebtReceipt ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {t(
                        "shareReceipt.analyzingReceiptDebt",
                        "Analyzing receipt for debt…"
                      )}
                    </>
                  ) : debtsLoading ? (
                    t("shareReceipt.debtLoadingDebts", "Loading debts…")
                  ) : !hasPayableDebts ? (
                    t(
                      "shareReceipt.debtNoPayable",
                      "No active debt available to pay"
                    )
                  ) : (
                    t("shareReceipt.toDebt", "Save as debt payment")
                  )}
                </Button>
                {!debtsLoading && !hasPayableDebts ? (
                  <p className="text-xs text-muted-foreground text-center px-1">
                    {t(
                      "shareReceipt.debtNoPayableHint",
                      "Add or activate a debt in Expenses → Debt to use this option."
                    )}
                  </p>
                ) : null}
              </div>
            </section>
          </>
        )}
      </div>

      <OrganizationSelectDrawer open={orgDrawerOpen} onOpenChange={setOrgDrawerOpen} />

      <AddNewExpenseModal
        open={expenseModalOpen}
        onOpenChange={setExpenseModalOpen}
        initialReceiptFiles={files}
        initialReceiptFilesKey={initialReceiptKey}
        shareFlowLocked
        aiAutofillData={autofillData ?? undefined}
        aiAutofillStatus={isAnalyzingReceipt ? "loading" : autofillData ? "success" : "idle"}
        aiAutofillRequestId={analysisRequestId}
        onShareFlowSuccess={handleShareFlowSuccess}
        onAfterCreateExpenseSuccess={async ({ linked_recurring_source_id, create_date }) => {
          if (!linked_recurring_source_id) return;
          await updateRecurringBillAfterPayNow(linked_recurring_source_id, create_date);
        }}
      />

      <MobileAddIncomeTransactionModal
        open={incomeModalOpen}
        onOpenChange={setIncomeModalOpen}
        initialReceiptFile={files[0] ?? null}
        initialReceiptFilesKey={initialReceiptKey}
        shareFlowLocked
        aiAutofillData={incomeAutofillData ?? undefined}
        aiAutofillStatus={
          isAnalyzingIncomeReceipt
            ? "loading"
            : incomeAutofillData
              ? "success"
              : incomeAnalysisRequestId > 0
                ? "error"
                : "idle"
        }
        aiAutofillRequestId={incomeAnalysisRequestId}
        onShareFlowSuccess={handleShareIncomeFlowSuccess}
      />

      <DebtPaymentModal
        isOpen={debtModalOpen}
        onClose={() => setDebtModalOpen(false)}
        onSubmit={handleDebtPaymentSubmit}
        debts={debts}
        isLoading={isDebtPaymentSubmitting}
        shareFlowLocked
        initialReceiptFiles={files}
        initialReceiptFilesKey={initialReceiptKey}
        aiAutofillData={debtAutofillData ?? undefined}
        aiAutofillStatus={
          isAnalyzingDebtReceipt
            ? "loading"
            : debtAutofillData
              ? "success"
              : debtAnalysisRequestId > 0
                ? "error"
                : "idle"
        }
        aiAutofillRequestId={debtAnalysisRequestId}
      />

      <AlertDialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <AlertDialogContent className="z-[100]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("shareReceipt.leaveTitle", "Batalkan berbagi?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "shareReceipt.leaveDescription",
                "Berkas yang dibagikan akan dibuang dari alur ini."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Batal")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleLeaveConfirm()}>
              {t("shareReceipt.leaveConfirm", "Keluar")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
