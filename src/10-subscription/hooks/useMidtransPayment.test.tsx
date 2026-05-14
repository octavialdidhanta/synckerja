import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useMidtransPayment } from "./useMidtransPayment";

vi.mock("react-i18next", () => {
  return {
    useTranslation: () => ({
      t: (k: string) => k,
    }),
  };
});

vi.mock("@/shared/lib/supabaseClient", () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { access_token: "test-access-token" } },
        })),
      },
      functions: {
        invoke: vi.fn(async () => ({
          data: { success: true, status: "success" },
          error: null,
        })),
      },
    },
  };
});

describe("useMidtransPayment", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();

    // Minimal envs used to build function URL.
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");

    (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn(async (input: RequestInfo) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/functions/v1/create-midtrans-payment")) {
        return new Response(JSON.stringify({ token: "snap-token", order_id: "ORD-1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/functions/v1/process-midtrans-payment")) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("not-found", { status: 404 });
    }) as unknown as typeof fetch;

    window.snap = {
      pay: (_token, options) => {
        // simulate successful snap callback
        options?.onSuccess?.({ order_id: "ORD-1", transaction_status: "settlement" });
      },
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    (globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch;
    delete window.snap;
    vi.clearAllMocks();
  });

  it("calls onPaymentStatusChange after attempting server-side status sync", async () => {
    const events: string[] = [];
    const onPaymentStatusChange = vi.fn(() => events.push("onPaymentStatusChange"));
    const onPaymentClose = vi.fn();

    const { result } = renderHook(() => useMidtransPayment({ onPaymentStatusChange, onPaymentClose }));

    let run: Promise<void> | undefined;
    act(() => {
      run = result.current.initiateMidtransPayment({
        planId: "plan-1",
        planName: "ScaleUp Plan",
        amount: 750000,
        memberCount: 2,
        billingCycle: "monthly",
        checkoutSuccessRelativePath: "/subscription/overview",
      });
    });

    // Resolve internal timeout awaited by the hook.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    await run;
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(onPaymentStatusChange).toHaveBeenCalledTimes(1);
  });
});

