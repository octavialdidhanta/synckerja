export type PaymentRecordingShell = "sheet" | "dialog";

export type PaymentRecordingSheetProps = {
  open: boolean;
  onClose: () => void;
  salesActivityId: string;
  clientName?: string;
  viewOnly?: boolean;
  variant?: "default" | "livechat";
  shell?: PaymentRecordingShell;
  onFirstPaymentSuccess?: (payload: {
    title: string;
    description: string;
    service_id: string;
    sub_service_id: string | null;
  }) => void;
};
