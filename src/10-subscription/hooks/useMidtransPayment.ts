import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/shared/lib/supabaseClient";

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
const SUPABASE_PUBLISHABLE_KEY = String(
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
);

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        options?: {
          onSuccess?: (result: unknown) => void;
          onPending?: (result: unknown) => void;
          onError?: (result: unknown) => void;
          onClose?: () => void;
        },
      ) => void;
      hide?: () => void;
      [key: string]: unknown;
    };
  }
}

export interface PaymentParams {
  planId: string;
  planName: string;
  amount: number;
  memberCount: number;
  billingCycle: "monthly" | "yearly";
  proRateDetails?: {
    is_member_upgrade: boolean;
    previous_member_count: number;
    member_difference: number;
    remaining_days: number;
    prorate_amount: number;
    prorate_percentage: number;
  };
}

export interface UseMidtransPaymentOptions {
  onPaymentClose?: (path: string) => void;
  onPaymentStatusChange?: () => void;
}

export function useMidtransPayment(options?: UseMidtransPaymentOptions) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  /** Which pending order is opening Snap (management list — per-row loading). */
  const [openingPendingOrderId, setOpeningPendingOrderId] = useState<string | null>(null);
  /** Synchronous guard: state updates async, so double-clicks must not start two opens. */
  const openingPendingSnapRef = useRef(false);
  const onPaymentClose = options?.onPaymentClose;
  const onPaymentStatusChange = options?.onPaymentStatusChange;

  const loadMidtransScript = async (): Promise<void> => {
    if (window.snap) return;

    const { data: keyData, error } = await supabase.functions.invoke("get-midtrans-config");
    if (error) throw new Error("Failed to get Midtrans configuration");
    const clientKey = (keyData as { client_key?: string })?.client_key;
    if (!clientKey) throw new Error("Midtrans client key not configured");

    const snapSrc = clientKey.startsWith("SB-Mid-")
      ? "https://app.sandbox.midtrans.com/snap/snap.js"
      : "https://app.midtrans.com/snap/snap.js";

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = snapSrc;
      script.setAttribute("data-client-key", clientKey);
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Midtrans script"));
      document.head.appendChild(script);
    });
  };

  const initiateMidtransPayment = async (params: PaymentParams) => {
    if (isLoading || isPopupOpen) return;

    setIsLoading(true);
    setIsPopupOpen(true);

    try {
      if (!window.snap) await loadMidtransScript();

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      const functionUrl = `${SUPABASE_URL}/functions/v1/create-midtrans-payment`;
      const rawResponse = await fetch(functionUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(params),
      });

      if (!rawResponse.ok) {
        let errorDetails = "Unknown error";
        try {
          const errorBody = await rawResponse.json();
          if (errorBody.error) errorDetails = errorBody.error;
          if (errorBody.message) errorDetails += `\n${errorBody.message}`;
        } catch {
          try {
            errorDetails = await rawResponse.text();
          } catch {
            /* ignore */
          }
        }
        throw new Error(`Edge Function failed (${rawResponse.status}): ${errorDetails}`);
      }

      const data = await rawResponse.json();
      if (!data?.token) throw new Error("No payment token received from server");

      try {
        document
          .querySelectorAll(
            '[id*="snap"], [class*="snap"], .midtrans-overlay, .snap-overlay, iframe[src*="midtrans"]',
          )
          .forEach((el) => el.remove());
        window.snap?.hide?.();
        if (window.snap) {
          delete (window.snap as Record<string, unknown>)._current_popup;
          delete (window.snap as Record<string, unknown>)._state;
        }
      } catch {
        /* cleanup */
      }

      await new Promise((r) => setTimeout(r, 200));

      const successPath = "/subscription/overview";
      const fallbackPath = "/subscription/plans";

      const checkPaymentStatusFromMidtrans = async (orderId: string) => {
        try {
          const { data: d, error } = await supabase.functions.invoke("check-midtrans-payment-status", {
            body: { order_id: orderId },
          });
          if (!error && (d as { success?: boolean })?.success) return (d as { status?: string }).status;
        } catch {
          /* ignore */
        }
        return null;
      };

      const syncPaymentStatus = async (result: Record<string, unknown>, statusOverride?: "success" | "pending" | "failed") => {
        try {
          const orderId = (result?.order_id as string) || data.order_id;
          const realStatus = await checkPaymentStatusFromMidtrans(orderId);
          if (realStatus) return;

          const payload = {
            order_id: orderId,
            transaction_status: statusOverride || (result?.transaction_status as string) || "pending",
            transaction_id: (result?.transaction_id as string) || "",
            fraud_status: (result?.fraud_status as string) || "accept",
            settlement_time:
              (result?.settlement_time as string) ||
              (statusOverride === "success" ? new Date().toISOString() : null),
            transaction_time: (result?.transaction_time as string) || new Date().toISOString(),
            gross_amount: (result?.gross_amount as string) || String(params.amount),
            payment_type: (result?.payment_type as string) || "credit_card",
            bank: (result?.bank as string) || (result?.va_numbers as { bank?: string }[])?.[0]?.bank || null,
            approval_code: (result?.approval_code as string) || null,
          };

          await fetch(`${SUPABASE_URL}/functions/v1/process-midtrans-payment`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
              apikey: SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify(payload),
          });
        } catch {
          /* non-blocking */
        }
      };

      const snapConfig = {
        onSuccess: (result: unknown) => {
          void syncPaymentStatus(result as Record<string, unknown>, "success");
          setIsPopupOpen(false);
          onPaymentStatusChange?.();
          toast.success(t("subscription.plans.success.paymentSuccess"));
          if (onPaymentClose) setTimeout(() => onPaymentClose(successPath), 2000);
          else setTimeout(() => { window.location.href = `${window.location.origin}${successPath}`; }, 2000);
        },
        onPending: (result: unknown) => {
          void syncPaymentStatus(result as Record<string, unknown>, "pending");
          setIsPopupOpen(false);
          onPaymentStatusChange?.();
          toast.info(t("subscription.plans.info.paymentProcessing"));
          if (onPaymentClose) setTimeout(() => onPaymentClose(successPath), 1000);
          else setTimeout(() => { window.location.href = `${window.location.origin}${successPath}`; }, 1000);
        },
        onError: () => {
          setIsPopupOpen(false);
          toast.error(t("subscription.plans.error.paymentFailed"));
          if (onPaymentClose) onPaymentClose(fallbackPath);
          else window.location.href = `${window.location.origin}${fallbackPath}`;
        },
        onClose: () => {
          setIsPopupOpen(false);
          toast.info(t("subscription.plans.info.paymentCancelled"));
          if (onPaymentClose) onPaymentClose(fallbackPath);
          else window.location.href = `${window.location.origin}${fallbackPath}`;
        },
      };

      try {
        window.snap?.pay(data.token, snapConfig);
      } catch (snapError: unknown) {
        const msg = snapError instanceof Error ? snapError.message : "";
        if (msg && !msg.includes("postMessage")) throw snapError;
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : t("subscription.plans.error.paymentStartFailed");
      if (errorMessage.includes("temporary error") || errorMessage.includes("network")) {
        toast.error(t("subscription.plans.error.temporaryError"));
      } else if (errorMessage.includes("payment method")) {
        toast.error(t("subscription.plans.error.paymentMethodUnavailable"));
      } else {
        toast.error(t("subscription.plans.error.paymentStartFailedWithMessage", { message: errorMessage }));
      }
    } finally {
      setIsLoading(false);
      setIsPopupOpen(false);
    }
  };

  const openSnapForPendingOrder = async (orderId: string) => {
    if (openingPendingSnapRef.current || isLoading || isPopupOpen) return;
    openingPendingSnapRef.current = true;
    setOpeningPendingOrderId(orderId);

    try {
      if (!window.snap) await loadMidtransScript();

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      const rawResponse = await fetch(`${SUPABASE_URL}/functions/v1/get-midtrans-snap-token`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ order_id: orderId }),
      });

      if (!rawResponse.ok) {
        let errorDetails = "Unknown error";
        try {
          const errorBody = await rawResponse.json();
          if (errorBody.message) errorDetails = errorBody.message;
        } catch {
          errorDetails = await rawResponse.text();
        }
        throw new Error(errorDetails);
      }

      const snapData = await rawResponse.json();
      if (!snapData?.token) throw new Error("No payment token received");

      try {
        document
          .querySelectorAll(
            '[id*="snap"], [class*="snap"], .midtrans-overlay, .snap-overlay, iframe[src*="midtrans"]',
          )
          .forEach((el) => el.remove());
        window.snap?.hide?.();
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 200));

      const successPath = "/subscription/overview";
      const fallbackPath = "/subscription/plans";

      const checkPaymentStatusFromMidtrans = async (oid: string) => {
        try {
          const { data: d, error } = await supabase.functions.invoke("check-midtrans-payment-status", {
            body: { order_id: oid },
          });
          if (!error && (d as { success?: boolean })?.success) return (d as { status?: string }).status;
        } catch {
          /* ignore */
        }
        return null;
      };

      const syncPaymentStatus = async (result: Record<string, unknown>, statusOverride?: "success" | "pending" | "failed") => {
        try {
          const oid = (result?.order_id as string) ?? snapData.order_id;
          await checkPaymentStatusFromMidtrans(oid);
          const payload = {
            order_id: oid,
            transaction_status: statusOverride ?? (result?.transaction_status as string) ?? "pending",
            transaction_id: (result?.transaction_id as string) ?? "",
            fraud_status: (result?.fraud_status as string) ?? "accept",
            settlement_time:
              (result?.settlement_time as string) ?? (statusOverride === "success" ? new Date().toISOString() : null),
            transaction_time: (result?.transaction_time as string) ?? new Date().toISOString(),
            gross_amount: (result?.gross_amount as string) ?? "",
            payment_type: (result?.payment_type as string) ?? "credit_card",
            bank: (result?.bank as string) ?? (result?.va_numbers as { bank?: string }[])?.[0]?.bank ?? null,
            approval_code: (result?.approval_code as string) ?? null,
          };
          await fetch(`${SUPABASE_URL}/functions/v1/process-midtrans-payment`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
              apikey: SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify(payload),
          });
        } catch {
          /* non-blocking */
        }
      };

      const snapConfig = {
        onSuccess: (result: unknown) => {
          void syncPaymentStatus(result as Record<string, unknown>, "success");
          setIsPopupOpen(false);
          onPaymentStatusChange?.();
          toast.success(t("subscription.plans.success.paymentSuccess"));
          if (onPaymentClose) setTimeout(() => onPaymentClose(successPath), 2000);
          else setTimeout(() => { window.location.href = `${window.location.origin}${successPath}`; }, 2000);
        },
        onPending: (result: unknown) => {
          void syncPaymentStatus(result as Record<string, unknown>, "pending");
          setIsPopupOpen(false);
          onPaymentStatusChange?.();
          toast.info(t("subscription.plans.info.paymentProcessing"));
          if (onPaymentClose) setTimeout(() => onPaymentClose(successPath), 1000);
          else setTimeout(() => { window.location.href = `${window.location.origin}${successPath}`; }, 1000);
        },
        onError: () => {
          setIsPopupOpen(false);
          toast.error(t("subscription.plans.error.paymentFailed"));
          if (onPaymentClose) onPaymentClose(fallbackPath);
          else window.location.href = `${window.location.origin}${fallbackPath}`;
        },
        onClose: () => {
          setIsPopupOpen(false);
          toast.info(t("subscription.plans.info.paymentCancelled"));
          if (onPaymentClose) onPaymentClose(fallbackPath);
          else window.location.href = `${window.location.origin}${fallbackPath}`;
        },
      };

      try {
        window.snap?.pay(snapData.token, snapConfig);
      } catch (snapError: unknown) {
        const msg = snapError instanceof Error ? snapError.message : "";
        if (msg && !msg.includes("postMessage")) throw snapError;
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t("subscription.plans.error.paymentStartFailed");
      toast.error(t("subscription.plans.error.paymentStartFailedWithMessage", { message: msg }));
    } finally {
      openingPendingSnapRef.current = false;
      setOpeningPendingOrderId(null);
    }
  };

  return {
    initiateMidtransPayment,
    openSnapForPendingOrder,
    isLoading,
    isPopupOpen,
    openingPendingOrderId,
  };
}
