import { useState } from "react";
import { useToast } from "@/shared/hooks/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  readPosSelectedOutlet,
  readPosSelectedOutletId,
} from "@/pos-mobile/1-outlet-select/lib/posSelectedOutletStorage";
import { PosPrinterUnavailableError } from "@/pos-mobile/shared/printing/PosPrinterBridge";
import { printPosTestPage } from "@/pos-mobile/shared/printing/posPrintService";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { POS_SETTINGS_I18N } from "../../../lib/posSettingsCopy";
import { createPosSavedPrinter } from "../../../lib/printer/posPrinterStorage";
import { usePosBluetoothScan } from "../../../lib/printer/usePosBluetoothScan";
import { usePosPrinterSettings } from "../../../lib/printer/usePosPrinterSettings";
import type { PosBluetoothDevice, PosSavedPrinter } from "../../../lib/printer/posPrinterTypes";
import { PosAvailablePrintersBlock } from "./PosAvailablePrintersBlock";
import { PosBluetoothDiscoverSheet } from "./PosBluetoothDiscoverSheet";
import { PosOrderTicketSettingsBlock } from "./PosOrderTicketSettingsBlock";
import { PosPrinterEditSheet } from "./PosPrinterEditSheet";
import { PosTicketCategoriesSheet } from "./PosTicketCategoriesSheet";
import { PosTicketCopiesSheet } from "./PosTicketCopiesSheet";

/**
 * Hardware → Printer settings panel (available printers + order ticket prefs).
 */
export function PosPrinterSettingsPanel() {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const outletId = readPosSelectedOutletId();
  const { settings, persist, upsertPrinter } = usePosPrinterSettings(outletId);
  const scan = usePosBluetoothScan();

  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [copiesOpen, setCopiesOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [editing, setEditing] = useState<PosSavedPrinter | null>(null);
  const [pendingDevice, setPendingDevice] = useState<PosBluetoothDevice | null>(null);
  const [testPrinting, setTestPrinting] = useState(false);

  const openEdit = (printer: PosSavedPrinter) => {
    setEditing(printer);
    setEditOpen(true);
  };

  const onRefresh = async () => {
    setDiscoverOpen(true);
    setPendingDevice(null);
    await scan.startScan();
  };

  const onDiscoverDone = () => {
    if (!pendingDevice) {
      setDiscoverOpen(false);
      void scan.stopScan();
      return;
    }
    const existing = settings.printers.find((p) => p.address === pendingDevice.address);
    const isNew = !existing;
    const printer =
      existing ??
      createPosSavedPrinter({
        address: pendingDevice.address,
        systemName: pendingDevice.name,
      });
    // Persist immediately so Cancel on the edit sheet does not drop the assignment.
    // Default roles include receipt_bill + order_ticket (Print Bill ready).
    if (isNew) {
      upsertPrinter(printer);
      toast({
        title: t(
          POS_SETTINGS_I18N.printerAssignedSaved,
          "Printer saved. Receipt/Bill is on — you can print bills now.",
        ),
      });
    }
    void scan.stopScan();
    setDiscoverOpen(false);
    openEdit(printer);
  };

  const onTestPrint = async (printer: PosSavedPrinter) => {
    if (testPrinting) return;
    setTestPrinting(true);
    // Persist draft address/roles before testing so Print Bill uses the same target.
    upsertPrinter(printer);
    setEditing(printer);
    try {
      await scan.stopScan();
      const outlet = readPosSelectedOutlet();
      await printPosTestPage({
        printer,
        outletName: outlet?.name ?? "Synckerja POS",
      });
      toast({
        title: t(POS_SETTINGS_I18N.printerTestPrintOk, "Test print sent — check the printer"),
      });
    } catch (err) {
      if (err instanceof PosPrinterUnavailableError) {
        toast({
          title: t(
            POS_SETTINGS_I18N.printerBluetoothUnavailable,
            "Bluetooth printers are only available in the Synckerja Android app.",
          ),
          variant: "destructive",
        });
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        toast({
          title: t(
            POS_SETTINGS_I18N.printerTestPrintFail,
            "Could not connect or print. Pair the printer in system Bluetooth, turn it on, then try again.",
          ),
          description: msg,
          variant: "destructive",
        });
      }
    } finally {
      setTestPrinting(false);
    }
  };

  const onlyBluetooth = settings.printers.every((p) => p.transport === "bluetooth");

  return (
    <div className={POS_PANEL.body}>
      <PosAvailablePrintersBlock
        printers={settings.printers}
        refreshing={scan.scanning}
        onRefresh={() => void onRefresh()}
        onSelect={openEdit}
      />

      <PosOrderTicketSettingsBlock
        ticketCopies={settings.ticketCopies}
        printTicketOnPay={settings.printTicketOnPay}
        printTicketPerProduct={settings.printTicketPerProduct}
        perProductDisabled={onlyBluetooth || settings.printers.length === 0}
        onOpenCopies={() => setCopiesOpen(true)}
        onPrintTicketOnPayChange={(printTicketOnPay) =>
          persist({ ...settings, printTicketOnPay })
        }
        onPrintTicketPerProductChange={(printTicketPerProduct) => {
          if (onlyBluetooth) {
            toast({
              title: t(
                POS_SETTINGS_I18N.printerTicketPerProductHint,
                "Only for • EPSON TM-T82 • TSP-650 II",
              ),
            });
            return;
          }
          persist({ ...settings, printTicketPerProduct });
        }}
      />

      <PosBluetoothDiscoverSheet
        open={discoverOpen}
        onOpenChange={(open) => {
          setDiscoverOpen(open);
          if (!open) void scan.stopScan();
        }}
        available={scan.available}
        adapterOn={scan.adapterOn}
        scanning={scan.scanning}
        devices={scan.devices}
        error={scan.error}
        selectedAddress={pendingDevice?.address ?? null}
        onSelect={setPendingDevice}
        onDone={onDiscoverDone}
        onDetails={() => {
          toast({
            title: t(POS_SETTINGS_I18N.printerBluetoothTitle, "Bluetooth"),
            description: t(
              POS_SETTINGS_I18N.printerBluetoothEmpty,
              "Pair the printer in system Bluetooth settings first, then select it here.",
            ),
          });
        }}
      />

      <PosPrinterEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        printer={editing}
        testPrinting={testPrinting}
        onTestPrint={(p) => void onTestPrint(p)}
        onSave={(printer) => {
          upsertPrinter(printer);
          setEditing(printer);
          const othersHaveReceipt = settings.printers.some(
            (p) =>
              (p.id !== printer.id && p.address !== printer.address) &&
              p.roles.receipt_bill,
          );
          if (!printer.roles.receipt_bill && !othersHaveReceipt) {
            toast({
              title: t(
                POS_SETTINGS_I18N.printerReceiptBillOffWarn,
                "Receipt/Bill is off. Print Bill will fail until you turn it on for a printer.",
              ),
            });
          }
        }}
        onOpenCategories={() => setCategoriesOpen(true)}
      />

      <PosTicketCategoriesSheet
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        outletId={outletId ?? "_"}
        printer={editing}
        onChange={(printer) => {
          setEditing(printer);
          upsertPrinter(printer);
        }}
      />

      <PosTicketCopiesSheet
        open={copiesOpen}
        onOpenChange={setCopiesOpen}
        value={settings.ticketCopies}
        onSave={(ticketCopies) => persist({ ...settings, ticketCopies })}
      />
    </div>
  );
}
