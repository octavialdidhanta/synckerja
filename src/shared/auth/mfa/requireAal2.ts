import { hasAal2Session } from "./mfaUtils";

/** Returns true when session is already at AAL2 (MFA verified). */
export async function checkAal2(): Promise<boolean> {
  return hasAal2Session();
}
