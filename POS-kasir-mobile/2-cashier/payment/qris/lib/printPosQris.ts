import { printPosQrisSlip } from "@/pos-mobile/shared/printing/posPrintService";

export async function printPosQrisFromDialog(args: {
  outletId: string;
  outletName: string;
  outletAddress?: string | null;
  amountLabel: string;
  qrString: string;
}): Promise<void> {
  await printPosQrisSlip(args);
}
