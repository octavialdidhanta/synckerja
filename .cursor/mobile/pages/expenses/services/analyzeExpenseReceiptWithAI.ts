import { supabase, SUPABASE_URL } from "@/integrations/supabase/client";

export interface ExpenseReceiptAutofillData {
  expenseName?: string;
  amount?: number;
  createDate?: string;
  description?: string;
  /** Bank / invoice reference from receipt (debt payment dedupe). Verbatim from AI; do not trim. */
  transactionId?: string;
  transactionIdNeedsReview?: boolean;
  referenceNumber?: string;
  referenceNumberNeedsReview?: boolean;
  paymentCode?: string;
  paymentCodeNeedsReview?: boolean;
}

export interface AnalyzeExpenseReceiptWithAIResult {
  success: boolean;
  data?: ExpenseReceiptAutofillData;
  error?: string;
}

interface ReceiptFilePayload {
  name: string;
  mimeType: string;
  base64: string;
}

const MAX_FILES = 3;

function autofillDataHasUsefulContent(data: ExpenseReceiptAutofillData): boolean {
  if (typeof data.amount === "number" && data.amount > 0) return true;
  if (data.expenseName && data.expenseName.length > 0) return true;
  if (data.description && data.description.length > 0) return true;
  if (data.createDate && data.createDate.length > 0) return true;
  if (data.transactionId != null && data.transactionId.length > 0) return true;
  if (data.referenceNumber != null && data.referenceNumber.length > 0) return true;
  if (data.paymentCode != null && data.paymentCode.length > 0) return true;
  if (data.transactionIdNeedsReview || data.referenceNumberNeedsReview || data.paymentCodeNeedsReview) {
    return true;
  }
  return false;
}

function normalizeAutofillData(input: unknown): ExpenseReceiptAutofillData | undefined {
  if (!input || typeof input !== "object") return undefined;
  const source = input as Record<string, unknown>;
  const expenseName = typeof source.expenseName === "string" ? source.expenseName.trim() : "";
  const description = typeof source.description === "string" ? source.description.trim() : "";
  const createDate = typeof source.createDate === "string" ? source.createDate.trim() : "";
  const amount =
    typeof source.amount === "number"
      ? source.amount
      : typeof source.amount === "string"
        ? Number(source.amount)
        : undefined;

  const normalized: ExpenseReceiptAutofillData = {};
  if (expenseName) normalized.expenseName = expenseName;
  if (description) normalized.description = description;
  if (createDate) normalized.createDate = createDate;
  if (typeof source.transactionId === "string" && source.transactionId.length > 0) {
    normalized.transactionId = source.transactionId;
  }
  if (typeof source.referenceNumber === "string" && source.referenceNumber.length > 0) {
    normalized.referenceNumber = source.referenceNumber;
  }
  if (typeof source.paymentCode === "string" && source.paymentCode.length > 0) {
    normalized.paymentCode = source.paymentCode;
  }
  if (source.transactionIdNeedsReview === true) normalized.transactionIdNeedsReview = true;
  if (source.referenceNumberNeedsReview === true) normalized.referenceNumberNeedsReview = true;
  if (source.paymentCodeNeedsReview === true) normalized.paymentCodeNeedsReview = true;
  if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) {
    normalized.amount = amount;
  }

  return autofillDataHasUsefulContent(normalized) ? normalized : undefined;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unable to read file"));
        return;
      }
      const [, base64 = ""] = result.split(",");
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

async function buildReceiptPayload(files: File[]): Promise<ReceiptFilePayload[]> {
  const limited = files.slice(0, MAX_FILES);
  const payload: ReceiptFilePayload[] = [];
  for (const file of limited) {
    const base64 = await fileToBase64(file);
    payload.push({
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      base64,
    });
  }
  return payload;
}

export async function analyzeExpenseReceiptWithAI(params: {
  receiptFiles: File[];
  ocrText?: string;
}): Promise<AnalyzeExpenseReceiptWithAIResult> {
  try {
    const files = params.receiptFiles.filter(Boolean);
    if (files.length === 0) {
      return {
        success: false,
        error: "Tidak ada receipt untuk dianalisis.",
      };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      return {
        success: false,
        error: "Sesi login tidak valid. Silakan login ulang.",
      };
    }

    const receiptFiles = await buildReceiptPayload(files);
    const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze-expense-receipt-ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        receiptFiles,
        ocrText: params.ocrText?.trim() || undefined,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return {
        success: false,
        error: "Response server tidak valid. Coba lagi.",
      };
    }

    if (!response.ok) {
      const serverError = typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : "";
      return {
        success: false,
        error: serverError || `Analisis receipt gagal (${response.status}).`,
      };
    }

    const data = normalizeAutofillData((payload as { data?: unknown }).data);
    if (!data) {
      return {
        success: false,
        error: "AI belum menemukan data yang bisa diisi otomatis.",
      };
    }

    return { success: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
      return {
        success: false,
        error: "Koneksi gagal. Periksa internet lalu coba lagi.",
      };
    }
    return {
      success: false,
      error: msg || "Analisis receipt gagal.",
    };
  }
}
