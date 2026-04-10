/** Native gallery picker not available on web build. */
export async function pickReceiptImageFiles(): Promise<File[]> {
  return [];
}
