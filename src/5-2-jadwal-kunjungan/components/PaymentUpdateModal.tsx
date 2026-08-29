import { PaymentRecordingSheet } from "@/shared/sales-payments";
import type { PaymentRecordingSheetProps } from "@/shared/sales-payments";

type PaymentUpdateModalProps = Omit<PaymentRecordingSheetProps, "shell">;

/** Backward-compatible dialog wrapper around shared payment recording UI. */
export const PaymentUpdateModal = (props: PaymentUpdateModalProps) => (
  <PaymentRecordingSheet {...props} shell="dialog" />
);
