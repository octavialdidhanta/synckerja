import { useEffect, useMemo, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { useToast } from "@/shared/components/ui/use-toast";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { AddEmailRecipientDialog } from "./AddEmailRecipientDialog";
import { NotificationToggleRow } from "./NotificationToggleRow";
import { RecipientList } from "./RecipientList";
import { useOperationalEmailRecipients } from "../hooks/useOperationalEmailRecipients";
import { useOperationalEmailSettings } from "../hooks/useOperationalEmailSettings";
import { mapOperationalEmailRpcError } from "../lib/validateRecipientEmail";
import { OPERATIONAL_EMAIL_RPC_ERRORS } from "../types";

export function EmailNotificationsSettings() {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { isOwner, isAdmin } = useCentralizedUserData();
  const canManage = isOwner || isAdmin;

  const { settings, isLoading, save, isSaving } = useOperationalEmailSettings();
  const {
    recipients,
    isLoading: recipientsLoading,
    addRecipient,
    isAdding,
    deleteRecipient,
    isDeleting,
  } = useOperationalEmailRecipients();

  const [dailySales, setDailySales] = useState(true);
  const [dailyGrossProfit, setDailyGrossProfit] = useState(true);
  const [inventoryAlerts, setInventoryAlerts] = useState(true);
  const [promoUpdate, setPromoUpdate] = useState(true);
  const [shiftRecap, setShiftRecap] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setDailySales(settings.daily_sales_summary_enabled);
    setDailyGrossProfit(settings.daily_gross_profit_enabled);
    setInventoryAlerts(settings.inventory_alerts_enabled);
    setPromoUpdate(settings.promo_update_enabled);
    setShiftRecap(settings.shift_recap_email_enabled);
  }, [settings]);

  const isDirty = useMemo(() => {
    if (!settings) return false;
    return (
      dailySales !== settings.daily_sales_summary_enabled ||
      dailyGrossProfit !== settings.daily_gross_profit_enabled ||
      inventoryAlerts !== settings.inventory_alerts_enabled ||
      promoUpdate !== settings.promo_update_enabled ||
      shiftRecap !== settings.shift_recap_email_enabled
    );
  }, [dailySales, dailyGrossProfit, inventoryAlerts, promoUpdate, shiftRecap, settings]);

  const busy = saving || isSaving || isLoading || recipientsLoading || isAdding || isDeleting;

  const resolveRpcErrorMessage = (error: unknown): string => {
    const message = error instanceof Error ? error.message : String(error ?? "");
    const code = mapOperationalEmailRpcError(message);
    if (code && code in OPERATIONAL_EMAIL_RPC_ERRORS) {
      const key = OPERATIONAL_EMAIL_RPC_ERRORS[code as keyof typeof OPERATIONAL_EMAIL_RPC_ERRORS];
      return t(key, message);
    }
    return message || t("common.errorGeneric", "Something went wrong.");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({
        daily_sales_summary_enabled: dailySales,
        inventory_alerts_enabled: inventoryAlerts,
        promo_update_enabled: promoUpdate,
        daily_gross_profit_enabled: dailyGrossProfit,
        shift_recap_email_enabled: shiftRecap,
      });
      toast({
        title: t(
          "settings.emailNotifications.saved",
          "Setting has been successfully updated",
        ),
      });
    } catch (error) {
      toast({
        title: resolveRpcErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddRecipient = async (email: string) => {
    try {
      await addRecipient(email);
      toast({
        title: t(
          "settings.emailNotifications.recipients.inviteSent",
          "Verification email has been sent.",
        ),
      });
    } catch (error) {
      toast({
        title: resolveRpcErrorMessage(error),
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleDeleteRecipient = async (recipientId: string) => {
    setDeletingId(recipientId);
    try {
      await deleteRecipient(recipientId);
      toast({
        title: t("settings.emailNotifications.recipients.deleted", "Recipient removed."),
      });
    } catch (error) {
      toast({
        title: resolveRpcErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (!canManage) {
    return (
      <div className="rounded-md border border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        {t(
          "settings.emailNotifications.noAccess",
          "Only Business Owner and Administrator can manage email notifications.",
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-8">
        <h2 className="text-lg font-semibold text-gray-900">
          {t("settings.emailNotifications.heading", "Email Notifications")}
        </h2>

        <section className="space-y-4">
          <div>
            <p className="border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("settings.emailNotifications.manageSection", "Manage Email Notification")}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              {t(
                "settings.emailNotifications.manageDescription",
                "Receive emails on new products or how your business is performing. Emails are automatically sent to your account email.",
              )}
            </p>
          </div>

          <div className="rounded-md border border-border px-4">
            <NotificationToggleRow
              id="email-notif-daily-sales"
              title={t("settings.emailNotifications.dailySales.title", "Daily Sales Summary")}
              description={t(
                "settings.emailNotifications.dailySales.description",
                "Receive emails about your sales.",
              )}
              checked={dailySales}
              onCheckedChange={setDailySales}
              disabled={busy}
            />
            <NotificationToggleRow
              id="email-notif-daily-gross-profit"
              title={t(
                "settings.emailNotifications.dailyGrossProfit.title",
                "Daily Gross Profit",
              )}
              description={t(
                "settings.emailNotifications.dailyGrossProfit.description",
                "Include net sales, COGS, and gross profit in the daily email.",
              )}
              checked={dailyGrossProfit}
              onCheckedChange={setDailyGrossProfit}
              disabled={busy}
            />
            <NotificationToggleRow
              id="email-notif-shift-recap"
              title={t(
                "settings.emailNotifications.shiftRecap.title",
                "Shift recap email",
              )}
              description={t(
                "settings.emailNotifications.shiftRecap.description",
                "Receive an email when a cashier closes a shift on POS (includes cash reconciliation).",
              )}
              footnote={t(
                "settings.emailNotifications.shiftRecap.footnote",
                "* Sent to Business Owner, Administrator, verified alert recipients, and the cashier who closed the shift.",
              )}
              checked={shiftRecap}
              onCheckedChange={setShiftRecap}
              disabled={busy}
            />
            <NotificationToggleRow
              id="email-notif-inventory"
              title={t("settings.emailNotifications.inventory.title", "Inventory Alerts")}
              description={t(
                "settings.emailNotifications.inventory.description",
                "Get an email when items become low or out of stock, plus a daily recap at 00:15.",
              )}
              checked={inventoryAlerts}
              onCheckedChange={setInventoryAlerts}
              disabled={busy}
            />
            <NotificationToggleRow
              id="email-notif-promo"
              title={t("settings.emailNotifications.promo.title", "Promo Update Notification")}
              description={t(
                "settings.emailNotifications.promo.description",
                "Receive emails at the beginning of next day when a promo is updated.",
              )}
              footnote={t(
                "settings.emailNotifications.promo.footnote",
                "* Email Notification will be sent to Business Owner and Administrator email.",
              )}
              checked={promoUpdate}
              onCheckedChange={setPromoUpdate}
              disabled={busy}
            />
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <p className="border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("settings.emailNotifications.recipients.section", "Manage Recipient Alert Email")}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              {t(
                "settings.emailNotifications.recipients.description",
                "Email notification will only be sent to recipient that already verified their email. Please check your email inbox or SPAM folder and make sure to mark us as not spam sender to receive our email notifications.",
              )}
            </p>
          </div>

          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => setDialogOpen(true)}
            disabled={busy}
          >
            {t("settings.emailNotifications.recipients.addButton", "Add Email Recipient")}
          </Button>

          <RecipientList
            recipients={recipients}
            onDelete={(id) => void handleDeleteRecipient(id)}
            deletingId={deletingId}
            disabled={busy}
          />
        </section>
      </div>

      <div className="mt-6 flex shrink-0 justify-end border-t pt-4">
        <Button
          type="button"
          variant="default"
          className="min-w-[96px]"
          onClick={() => void handleSave()}
          disabled={busy || !isDirty}
        >
          {t("common.save", "Save")}
        </Button>
      </div>

      <AddEmailRecipientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={handleAddRecipient}
        busy={isAdding}
      />
    </div>
  );
}
