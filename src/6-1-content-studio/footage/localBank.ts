/**
 * Plays original footage straight from laptop folders.
 * - bank-footage: keys like "PIK1/sate babi/clip.mp4"
 * - FOOTAGE UPLOAD (inbox): keys like "INBOX/clip.mp4" → file "clip.mp4" in the inbox folder
 * Each folder is remembered per organization (see shared/localFolder). Nothing is uploaded.
 */
import { createLocalFolder, localFolderSupported, type FolderState } from "../shared/localFolder";

const bankFor = createLocalFolder("bank_footage_dir", "bank_footage");
const inboxFor = createLocalFolder("footage_inbox_dir", "footage_inbox");

export type BankState = FolderState;
export const localBankSupported = localFolderSupported;

export const isInboxFileKey = (fileKey: string) => fileKey.replace(/\\/g, "/").startsWith("INBOX/");

/** Path inside the chosen folder (strip leading INBOX/ for upload folder). */
export function localRelPath(fileKey: string): string {
  const norm = fileKey.replace(/\\/g, "/");
  if (norm.startsWith("INBOX/")) return norm.slice("INBOX/".length);
  return norm;
}

export const loadBankState = (organizationId: string | null | undefined) => bankFor(organizationId).load();
export const connectBank = (organizationId: string | null | undefined, forcePick = false) =>
  bankFor(organizationId).connect(forcePick);

export const loadInboxState = (organizationId: string | null | undefined) => inboxFor(organizationId).load();
export const connectInbox = (organizationId: string | null | undefined, forcePick = false) =>
  inboxFor(organizationId).connect(forcePick);

/** Opens a file_key from bank or inbox, depending on the INBOX/ prefix. */
export async function openBankFile(organizationId: string | null | undefined, fileKey: string): Promise<File> {
  const rel = localRelPath(fileKey);
  if (isInboxFileKey(fileKey)) return inboxFor(organizationId).open(rel);
  return bankFor(organizationId).open(rel);
}
