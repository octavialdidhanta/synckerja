import type { IlumaEnvConfig } from "./ilumaEnv.ts";
import { ilumaRequest, type IlumaBankValidationResult } from "./ilumaClient.ts";
import {
  mapToIlumaBankCode,
  normalizeAccountHolder,
  normalizeBankAccountNumber,
} from "./ilumaBankCodes.ts";

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_MS = 15_000;

function parseIlumaResponse(raw: Record<string, unknown>): IlumaBankValidationResult {
  const status = String(raw.status ?? "PENDING").toUpperCase() as IlumaBankValidationResult["status"];
  const nameMatch = raw.name_matching_result != null
    ? String(raw.name_matching_result).toUpperCase() as IlumaBankValidationResult["name_matching_result"]
    : null;
  const isNormal = raw.is_normal_account;
  return {
    id: String(raw.id ?? ""),
    status,
    bank_code: String(raw.bank_code ?? ""),
    bank_account_number: String(raw.bank_account_number ?? ""),
    name_matching_result: nameMatch,
    is_normal_account: isNormal === true || isNormal === "true"
      ? true
      : isNormal === false || isNormal === "false"
      ? false
      : null,
    failure_reason: raw.failure_reason != null ? String(raw.failure_reason) : null,
    result: (raw.result as Record<string, unknown> | undefined) ?? null,
    raw,
  };
}

function mockValidate(
  bankCode: string,
  accountNumber: string,
  givenName: string,
): IlumaBankValidationResult {
  const num = normalizeBankAccountNumber(accountNumber);
  if (!num || num.length < 6) {
    return {
      id: `mock-${crypto.randomUUID()}`,
      status: "FAILED",
      bank_code: bankCode,
      bank_account_number: num,
      failure_reason: "BANK_ACCOUNT_NOT_FOUND_ERROR",
      raw: {},
    };
  }
  return {
    id: `mock-${crypto.randomUUID()}`,
    status: "SUCCESS",
    bank_code: bankCode,
    bank_account_number: num,
    name_matching_result: "MATCH",
    is_normal_account: true,
    result: { account_holder_name: givenName },
    raw: { mock: true },
  };
}

export async function createBankAccountValidationRequest(
  env: IlumaEnvConfig,
  input: {
    bankCode: string;
    accountNumber: string;
    givenName: string;
    referenceId?: string;
  },
): Promise<IlumaBankValidationResult> {
  const bankCode = mapToIlumaBankCode(input.bankCode);
  const bankAccountNumber = normalizeBankAccountNumber(input.accountNumber);
  const givenName = normalizeAccountHolder(input.givenName);

  if (!bankCode || !bankAccountNumber || !givenName) {
    throw new Error("Missing bank code, account number, or account holder for validation");
  }

  if (env.useMock) {
    return mockValidate(bankCode, bankAccountNumber, givenName);
  }

  const body: Record<string, unknown> = {
    bank_code: bankCode,
    bank_account_number: bankAccountNumber,
    given_name: givenName,
  };
  if (input.referenceId) body.reference_id = input.referenceId;

  const created = await ilumaRequest<Record<string, unknown>>(env, {
    method: "POST",
    path: "/v2/identity/bank_account_data_requests",
    body,
  });

  return parseIlumaResponse(created);
}

export async function getBankAccountValidationRequest(
  env: IlumaEnvConfig,
  requestId: string,
): Promise<IlumaBankValidationResult> {
  if (env.useMock) {
    throw new Error("Mock mode does not support polling by id");
  }
  const raw = await ilumaRequest<Record<string, unknown>>(env, {
    method: "GET",
    path: `/v2/identity/bank_account_data_requests/${encodeURIComponent(requestId)}`,
  });
  return parseIlumaResponse(raw);
}

export async function validateBankAccountWithPoll(
  env: IlumaEnvConfig,
  input: {
    bankCode: string;
    accountNumber: string;
    givenName: string;
    referenceId?: string;
  },
): Promise<IlumaBankValidationResult> {
  let result = await createBankAccountValidationRequest(env, input);
  if (result.status !== "PENDING" || env.useMock) {
    return result;
  }

  const started = Date.now();
  while (Date.now() - started < POLL_MAX_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    result = await getBankAccountValidationRequest(env, result.id);
    if (result.status !== "PENDING") {
      return result;
    }
  }

  return result;
}

export function extractValidatedHolderName(result: IlumaBankValidationResult): string | null {
  const fromResult = result.result?.account_holder_name ?? result.result?.account_name
    ?? result.result?.name;
  if (fromResult != null && String(fromResult).trim()) {
    return String(fromResult).trim();
  }
  return null;
}
