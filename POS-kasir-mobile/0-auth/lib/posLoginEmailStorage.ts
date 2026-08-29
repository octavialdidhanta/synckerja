const POS_LOGIN_EMAIL_KEY = "synckerja_pos_login_email";

export function stashPosLoginEmail(email: string): void {
  try {
    sessionStorage.setItem(POS_LOGIN_EMAIL_KEY, email.trim());
  } catch {
    /* ignore quota / private mode */
  }
}

export function readPosLoginEmail(): string | null {
  try {
    const raw = sessionStorage.getItem(POS_LOGIN_EMAIL_KEY);
    const trimmed = raw?.trim() ?? "";
    return trimmed || null;
  } catch {
    return null;
  }
}

export function clearPosLoginEmail(): void {
  try {
    sessionStorage.removeItem(POS_LOGIN_EMAIL_KEY);
  } catch {
    /* ignore */
  }
}
