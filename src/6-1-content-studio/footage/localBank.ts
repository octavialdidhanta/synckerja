/**
 * Plays original footage straight from the laptop bank-footage folder.
 * See shared/localFolder for how the folder is remembered. Nothing is uploaded.
 */
import { createLocalFolder, localFolderSupported, type FolderState } from "../shared/localFolder";

const bank = createLocalFolder("bank_footage_dir", "bank_footage");

export type BankState = FolderState;
export const localBankSupported = localFolderSupported;
export const loadBankState = bank.load;
export const connectBank = bank.connect;
/** Resolves a file_key such as "PIK1/sate babi/clip.mp4" inside the chosen folder. */
export const openBankFile = bank.open;
