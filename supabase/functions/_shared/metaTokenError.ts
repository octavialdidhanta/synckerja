/** Detect Meta Graph API errors that require the user to reconnect OAuth. */
export function isMetaTokenInvalidError(error?: {
  message?: string;
  code?: number;
  type?: string;
} | null): boolean {
  if (!error) return false;
  const code = error.code;
  if (code === 190 || code === 102) return true;
  const msg = (error.message ?? "").toLowerCase();
  const type = (error.type ?? "").toLowerCase();
  if (type !== "oauthexception" && type !== "facebookapiexception") {
    return /access token|session has expired|error validating access token/i.test(msg);
  }
  return (
    msg.includes("access token") ||
    msg.includes("session has expired") ||
    msg.includes("error validating access token") ||
    msg.includes("token is invalid")
  );
}

export const META_TOKEN_RECONNECT_MESSAGE =
  "Token Meta sudah tidak valid. Buka halaman Connect dan reconnect akun Facebook/Instagram.";
