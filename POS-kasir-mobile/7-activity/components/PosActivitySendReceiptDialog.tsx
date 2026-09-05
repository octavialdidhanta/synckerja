import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/shared/components/ui/drawer";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { personalCustomerName } from "@/pos-receipt-feedback/lib/isGenericCustomerName";
import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";
import { POS_ACTIVITY_I18N } from "../lib/posActivityCopy";

type Channel = "email" | "sms";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCustomerName?: string | null;
  defaultPhone?: string | null;
  busy?: boolean;
  onSend: (payload: {
    channel: Channel;
    email: string;
    phoneLocal: string;
    customerName: string;
  }) => void;
};

export function PosActivitySendReceiptDialog({
  open,
  onOpenChange,
  defaultCustomerName,
  defaultPhone,
  busy,
  onSend,
}: Props) {
  const { t } = useAppTranslation();
  const isPhone = usePosCashierIsPhoneLayout();
  const [channel, setChannel] = useState<Channel>("email");
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneLocal, setPhoneLocal] = useState("");

  useEffect(() => {
    if (!open) return;
    setChannel("email");
    setCustomerName(personalCustomerName(defaultCustomerName) ?? "");
    setEmail("");
    setPhoneLocal(defaultPhone?.replace(/\D/g, "").replace(/^62/, "") ?? "");
  }, [open, defaultCustomerName, defaultPhone]);

  const canSend =
    !busy &&
    (channel === "email" ? email.trim().length > 3 : phoneLocal.trim().length >= 8);

  const titleText = t(POS_ACTIVITY_I18N.sendTitle, "Send receipt");

  const form = (
    <>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={channel === "email" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setChannel("email")}
          disabled={busy}
        >
          {t(POS_ACTIVITY_I18N.sendEmail, "Email")}
        </Button>
        <Button
          type="button"
          variant={channel === "sms" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setChannel("sms")}
          disabled={busy}
        >
          {t(POS_ACTIVITY_I18N.sendSms, "SMS")}
        </Button>
      </div>

      <Input
        value={customerName}
        onChange={(e) => setCustomerName(e.target.value)}
        placeholder={t(
          POS_ACTIVITY_I18N.customerNamePlaceholder,
          "Customer name",
        )}
        disabled={busy}
      />

      {channel === "email" ? (
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t(POS_ACTIVITY_I18N.emailPlaceholder, "Email address")}
          autoFocus={!isPhone}
          disabled={busy}
        />
      ) : (
        <Input
          inputMode="tel"
          value={phoneLocal}
          onChange={(e) => setPhoneLocal(e.target.value)}
          placeholder={t(POS_ACTIVITY_I18N.phonePlaceholder, "Phone number")}
          autoFocus={!isPhone}
          disabled={busy}
        />
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => onOpenChange(false)}
        >
          {t(POS_ACTIVITY_I18N.cancel, "Cancel")}
        </Button>
        <Button
          type="button"
          disabled={!canSend}
          onClick={() =>
            onSend({
              channel,
              email: email.trim(),
              phoneLocal: phoneLocal.trim(),
              customerName: customerName.trim(),
            })
          }
        >
          {t(POS_ACTIVITY_I18N.send, "Send")}
        </Button>
      </div>
    </>
  );

  if (isPhone) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} dismissible={!busy} repositionInputs={false}>
        <DrawerContent
          aboveAppNav={false}
          smoothFast
          className="z-[70] flex max-h-[min(88dvh,860px)] flex-col gap-0 overflow-hidden rounded-t-2xl border-0 p-0 shadow-2xl"
          overlayClassName="z-[70]"
        >
          <div className="shrink-0 px-4 pb-2 pt-1">
            <DrawerTitle className="text-base font-semibold">{titleText}</DrawerTitle>
          </div>
          <div className="flex flex-col gap-3 px-4 pb-4" data-vaul-no-drag="">
            {form}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-3 rounded-xl p-4" aria-describedby={undefined}>
        <DialogTitle className="text-base font-semibold">{titleText}</DialogTitle>
        {form}
      </DialogContent>
    </Dialog>
  );
}
