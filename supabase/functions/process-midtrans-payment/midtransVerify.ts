/**
 * Never trust the body of a request to process-midtrans-payment: anyone can POST
 * `{ order_id, transaction_status: "settlement" }` to this public URL.
 *
 * The only trusted source is Midtrans itself. For every request we:
 *  1. ask the Midtrans Core API for this order's status with our server key,
 *  2. check the signature_key in that answer (SHA-512 of order_id + status_code + gross_amount + server key),
 *  3. check the gross amount matches what we charged,
 * and only then use the answer's fields. The request body only tells us which order to look up.
 */

export type TrustedMidtransStatus = {
  order_id: string;
  transaction_status: string;
  status_code: string;
  gross_amount: string;
  transaction_id?: string;
  fraud_status?: string;
  settlement_time?: string;
  transaction_time?: string;
  payment_type?: string;
  bank?: string;
  approval_code?: string;
};

export type MidtransVerifyResult =
  | { ok: true; status: TrustedMidtransStatus }
  | { ok: false; httpStatus: number; reason: string };

export async function midtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
): Promise<string> {
  const data = new TextEncoder().encode(`${orderId}${statusCode}${grossAmount}${serverKey}`);
  const digest = await crypto.subtle.digest("SHA-512", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function str(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s ? s : undefined;
}

/** Midtrans sends gross_amount as "150000.00"; payments.amount is numeric (Snap charges it rounded to whole rupiah). */
export function amountsMatch(grossAmount: string, expected: unknown): boolean {
  const got = Number(grossAmount);
  const want = Number(expected);
  return Number.isFinite(got) && Number.isFinite(want) && Math.abs(got - want) < 1;
}

/** Pulls the bank name from the shapes Midtrans uses (bank, va_numbers[0].bank). */
function bankOf(raw: Record<string, unknown>): string | undefined {
  const direct = str(raw.bank);
  if (direct) return direct;
  const va = Array.isArray(raw.va_numbers) ? (raw.va_numbers[0] as Record<string, unknown> | undefined) : undefined;
  return str(va?.bank);
}

export async function verifyMidtransTransaction(input: {
  orderId: string;
  expectedAmount: unknown;
  serverKey: string;
  coreApiBaseUrl: string;
  fetchImpl?: typeof fetch;
}): Promise<MidtransVerifyResult> {
  const { orderId, expectedAmount, serverKey, coreApiBaseUrl } = input;
  const doFetch = input.fetchImpl ?? fetch;
  if (!serverKey) return { ok: false, httpStatus: 500, reason: "MIDTRANS_SERVER_KEY not configured" };

  let response: Response;
  try {
    response = await doFetch(`${coreApiBaseUrl}/v2/${encodeURIComponent(orderId)}/status`, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Basic ${btoa(`${serverKey}:`)}` },
    });
  } catch (error) {
    return { ok: false, httpStatus: 502, reason: `Midtrans status request failed: ${(error as Error).message}` };
  }
  if (!response.ok) {
    return { ok: false, httpStatus: 502, reason: `Midtrans status HTTP ${response.status}` };
  }

  const raw = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw) return { ok: false, httpStatus: 502, reason: "Midtrans status was not JSON" };

  const statusCode = str(raw.status_code);
  // Midtrans answers unknown orders with HTTP 200 and status_code 404 in the body.
  if (statusCode === "404") return { ok: false, httpStatus: 404, reason: "Order not found at Midtrans" };

  const status: Partial<TrustedMidtransStatus> = {
    order_id: str(raw.order_id),
    transaction_status: str(raw.transaction_status),
    status_code: statusCode,
    gross_amount: str(raw.gross_amount),
  };
  if (status.order_id !== orderId) return { ok: false, httpStatus: 400, reason: "Midtrans order_id mismatch" };
  if (!status.transaction_status || !status.status_code || !status.gross_amount) {
    return { ok: false, httpStatus: 502, reason: "Midtrans status is missing fields" };
  }

  const signature = str(raw.signature_key);
  const expected = await midtransSignature(orderId, status.status_code, status.gross_amount, serverKey);
  if (!signature || !constantTimeEqual(signature.toLowerCase(), expected)) {
    return { ok: false, httpStatus: 401, reason: "Midtrans signature mismatch" };
  }
  if (!amountsMatch(status.gross_amount, expectedAmount)) {
    return { ok: false, httpStatus: 400, reason: "Paid amount does not match the order" };
  }

  return {
    ok: true,
    status: {
      ...(status as TrustedMidtransStatus),
      transaction_id: str(raw.transaction_id),
      fraud_status: str(raw.fraud_status),
      settlement_time: str(raw.settlement_time),
      transaction_time: str(raw.transaction_time),
      payment_type: str(raw.payment_type),
      bank: bankOf(raw),
      approval_code: str(raw.approval_code),
    },
  };
}

/**
 * Maps a verified Midtrans status to payments.status.
 * A card "capture" only counts as paid when fraud_status is accept (or absent); "challenge" waits.
 */
export function finalPaymentStatus(transactionStatus: string, fraudStatus?: string): "success" | "pending" | "failed" {
  if (transactionStatus === "settlement") return "success";
  if (transactionStatus === "capture") {
    if (!fraudStatus || fraudStatus === "accept") return "success";
    return fraudStatus === "deny" ? "failed" : "pending";
  }
  if (["cancel", "expire", "deny", "failure"].includes(transactionStatus)) return "failed";
  return "pending";
}
