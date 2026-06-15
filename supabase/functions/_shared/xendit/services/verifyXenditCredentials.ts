import { xenditRequestProbe } from "../xenditClient.ts";
import type { XenditEnvConfig } from "../xenditEnv.ts";
import { parseXenditApiErrorBody } from "../xenditErrors.ts";

export type XenditVerifyResult = {
  ok: boolean;
  keyKind: XenditEnvConfig["keyKind"];
  isSandbox: boolean;
  balance: { ok: boolean; status: number; message: string };
  xenPlatform: { ok: boolean; status: number; message: string };
  summary: string;
};

export async function verifyXenditCredentials(env: XenditEnvConfig): Promise<XenditVerifyResult> {
  const balanceProbe = await xenditRequestProbe(env.secretKey, {
    method: "GET",
    path: "/balance",
  });

  const xenProbe = await xenditRequestProbe(env.secretKey, {
    method: "GET",
    path: "/v2/accounts?limit=1",
  });

  const balanceMsg = balanceProbe.ok
    ? "Secret key accepted"
    : parseXenditApiErrorBody(balanceProbe.body);

  const xenMsg = xenProbe.ok
    ? "xenPlatform list accounts OK"
    : parseXenditApiErrorBody(xenProbe.body);

  let summary: string;
  if (balanceProbe.ok && xenProbe.ok) {
    summary = "Ready to create sub-accounts.";
  } else if (balanceProbe.ok && !xenProbe.ok) {
    summary =
      "Secret key is valid but xenPlatform is not available on this master account (or API key lacks xenPlatform permission). Activate xenPlatform in Xendit Dashboard; for Indonesia OWNED sub-accounts contact help@xendit.co.";
  } else {
    summary =
      "Secret key rejected by Xendit. Use master account Secret key (xnd_development_ for sandbox), no quotes, not public key, not sub-account key.";
  }

  return {
    ok: balanceProbe.ok && xenProbe.ok,
    keyKind: env.keyKind,
    isSandbox: env.isSandbox,
    balance: { ok: balanceProbe.ok, status: balanceProbe.status, message: balanceMsg },
    xenPlatform: { ok: xenProbe.ok, status: xenProbe.status, message: xenMsg },
    summary,
  };
}
