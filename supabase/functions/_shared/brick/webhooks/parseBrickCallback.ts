import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ParsedBrickVaCallback = {
  eventId: string;
  status: string;
  amount: number;
  referenceId: string | null;
  paymentId: string | null;
  vaId: string | null;
  bankShortCode: string | null;
  accountNo: string | null;
  createdAt: string | null;
  raw: Record<string, unknown>;
};

export function parseBrickVaCallbackPayload(payload: Record<string, unknown>): ParsedBrickVaCallback | null {
  const data = (payload.data as Record<string, unknown>) ?? payload;
  const attrs = (data.attributes as Record<string, unknown>) ?? data;

  const paymentMethod = (attrs.paymentMethod as Record<string, unknown>) ?? {};
  const instructions = (paymentMethod.instructions as Record<string, unknown>) ?? {};

  const status = String(
    attrs.status ?? data.status ?? payload.status ?? "",
  ).toLowerCase();

  const amount = Number(attrs.amount ?? data.amount ?? 0);
  const referenceId = attrs.referenceId
    ? String(attrs.referenceId)
    : data.referenceId
      ? String(data.referenceId)
      : null;

  const paymentId = paymentMethod.paymentId
    ? String(paymentMethod.paymentId)
    : data.paymentId
      ? String(data.paymentId)
      : attrs.paymentId
        ? String(attrs.paymentId)
        : null;

  const vaId = data.id ? String(data.id) : attrs.id ? String(attrs.id) : null;

  const bankShortCode = instructions.bankShortCode
    ? String(instructions.bankShortCode)
    : data.bankShortCode
      ? String(data.bankShortCode)
      : attrs.bankShortCode
        ? String(attrs.bankShortCode)
        : null;

  const accountNo = instructions.accountNo
    ? String(instructions.accountNo)
    : data.accountNo
      ? String(data.accountNo)
      : attrs.accountNo
        ? String(attrs.accountNo)
        : null;

  const createdAt = attrs.createdAt
    ? String(attrs.createdAt)
    : data.createdAt
      ? String(data.createdAt)
      : null;

  if (!status && !paymentId && !vaId) return null;

  const eventId = paymentId ?? vaId ?? referenceId ?? `${status}-${amount}-${Date.now()}`;

  return {
    eventId,
    status,
    amount,
    referenceId,
    paymentId,
    vaId,
    bankShortCode,
    accountNo,
    createdAt,
    raw: payload,
  };
}
