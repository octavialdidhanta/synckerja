export type ImapProviderConfig = {
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
};

const HOSTINGER: ImapProviderConfig = {
  imapHost: "imap.hostinger.com",
  imapPort: 993,
  smtpHost: "smtp.hostinger.com",
  smtpPort: 465,
  smtpSecure: true,
};

const GMAIL: ImapProviderConfig = {
  imapHost: "imap.gmail.com",
  imapPort: 993,
  smtpHost: "smtp.gmail.com",
  smtpPort: 465,
  smtpSecure: true,
};

const OUTLOOK: ImapProviderConfig = {
  imapHost: "outlook.office365.com",
  imapPort: 993,
  smtpHost: "smtp.office365.com",
  smtpPort: 587,
  smtpSecure: false,
};

const YAHOO: ImapProviderConfig = {
  imapHost: "imap.mail.yahoo.com",
  imapPort: 993,
  smtpHost: "smtp.mail.yahoo.com",
  smtpPort: 465,
  smtpSecure: true,
};

export function resolveImapProvider(
  provider: string | null | undefined,
  overrides?: {
    imapHost?: string | null;
    imapPort?: number | null;
    smtpHost?: string | null;
    smtpPort?: number | null;
  },
): ImapProviderConfig {
  const p = (provider ?? "").trim().toLowerCase();
  let base: ImapProviderConfig = HOSTINGER;
  if (p.includes("gmail")) base = GMAIL;
  else if (p.includes("outlook") || p.includes("office")) base = OUTLOOK;
  else if (p.includes("yahoo") || p.includes("aol")) base = YAHOO;
  else if (p.includes("hostinger")) base = HOSTINGER;

  return {
    imapHost: overrides?.imapHost?.trim() || base.imapHost,
    imapPort: overrides?.imapPort && overrides.imapPort > 0 ? overrides.imapPort : base.imapPort,
    smtpHost: overrides?.smtpHost?.trim() || base.smtpHost,
    smtpPort: overrides?.smtpPort && overrides.smtpPort > 0 ? overrides.smtpPort : base.smtpPort,
    smtpSecure: base.smtpSecure,
  };
}

/** User-facing IMAP auth failure — provider-aware (Gmail needs App Password, not web login). */
export function formatImapAuthError(
  provider: string | null | undefined,
  imapResponse = "",
): string {
  const p = (provider ?? "").trim().toLowerCase();
  const r = imapResponse.toLowerCase();

  if (p.includes("gmail") || r.includes("gmail") || r.includes("google")) {
    return [
      "Gmail menolak login IMAP.",
      "Password login Gmail biasa tidak bisa dipakai — buat App Password:",
      "Google Account → Keamanan → Verifikasi 2 langkah (aktifkan) → App Password → Mail.",
      "Pastikan IMAP aktif: Gmail → Settings → Forwarding and POP/IMAP → Enable IMAP.",
    ].join(" ");
  }

  if (p.includes("outlook") || p.includes("office") || r.includes("outlook") || r.includes("office365")) {
    return "Outlook menolak login IMAP. Aktifkan IMAP di pengaturan Outlook dan gunakan password Microsoft yang benar (atau app password jika 2FA aktif).";
  }

  if (p.includes("yahoo") || r.includes("yahoo")) {
    return "Yahoo menolak login IMAP. Gunakan app password Yahoo (bukan password login biasa) dan pastikan IMAP aktif di pengaturan akun.";
  }

  if (p.includes("hostinger") || r.includes("hostinger")) {
    return "Email atau password salah. Pastikan password akun email Hostinger benar (bukan password panel hPanel).";
  }

  return "Email atau password salah, atau IMAP belum diaktifkan di provider email Anda.";
}
