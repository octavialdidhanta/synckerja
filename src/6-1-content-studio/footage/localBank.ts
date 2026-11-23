/**
 * Plays original footage straight from the laptop bank-footage folder.
 * The folder is remembered per organization (see shared/localFolder). Nothing is uploaded.
 */
import { createLocalFolder, localFolderSupported, type FolderState } from "../shared/localFolder";

const bankFor = createLocalFolder("bank_footage_dir", "bank_footage");

export type BankState = FolderState;
export const localBankSupported = localFolderSupported;
export const loadBankState = (organizationId: string | null | undefined) => bankFor(organizationId).load();
export const connectBank = (organizationId: string | null | undefined, forcePick = false) =>
  bankFor(organizationId).connect(forcePick);
/** Resolves a file_key such as "PIK1/sate babi/clip.mp4" inside the org's chosen folder. */
export const openBankFile = (organizationId: string | null | undefined, fileKey: string) => bankFor(organizationId).open(fileKey);
