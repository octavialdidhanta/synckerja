export const SUB_ACCOUNT_EMAIL_EXISTS_CODE = "sub_account_email_already_exists";

export function normalizeSubAccountEmail(email: string): string {
  return email.trim().toLowerCase();
}

type SubAccountEmailRow = { email?: string | null };

export function isSubAccountEmailTaken(
  email: string,
  subAccounts: SubAccountEmailRow[] | null | undefined,
): boolean {
  const normalized = normalizeSubAccountEmail(email);
  if (!normalized) return false;
  return (subAccounts ?? []).some(
    (row) => normalizeSubAccountEmail(String(row.email ?? "")) === normalized,
  );
}

export function isSubAccountEmailExistsError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string };
  if (err.code === SUB_ACCOUNT_EMAIL_EXISTS_CODE) return true;
  const message = String(err.message ?? "");
  return (
    message === SUB_ACCOUNT_EMAIL_EXISTS_CODE ||
    message.includes(SUB_ACCOUNT_EMAIL_EXISTS_CODE)
  );
}

export function getSubAccountEmailErrorMessage(
  error: unknown,
  t: (key: string, fallback: string) => string,
): string {
  if (isSubAccountEmailExistsError(error)) {
    return t(
      "xendit.subAccountEmailAlreadyExists",
      "Email sudah terdaftar untuk bisnis ini",
    );
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
