import { Check, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import type { OperationalEmailRecipient } from "../types";

type RecipientListProps = {
  recipients: OperationalEmailRecipient[];
  onDelete: (id: string) => void;
  deletingId?: string | null;
  disabled?: boolean;
};

export function RecipientList({
  recipients,
  onDelete,
  deletingId = null,
  disabled = false,
}: RecipientListProps) {
  const { t } = useAppTranslation();

  if (recipients.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        {t("settings.emailNotifications.recipients.empty", "No email recipients added yet.")}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border">
      {recipients.map((recipient, index) => {
        const isVerified = recipient.status === "verified";
        const isDeleting = deletingId === recipient.id;

        return (
          <div
            key={recipient.id}
            className={cn(
              "flex items-center justify-between gap-3 px-4 py-3",
              index % 2 === 0 ? "bg-muted/30" : "bg-background",
            )}
          >
            <span className="min-w-0 truncate text-sm text-foreground">{recipient.email}</span>
            <div className="flex shrink-0 items-center gap-2">
              {isVerified ? (
                <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
                  <Check className="h-4 w-4" aria-hidden />
                  {t("settings.emailNotifications.recipients.verified", "Verified")}
                </span>
              ) : (
                <>
                  <span className="text-sm font-medium text-amber-600">
                    {t(
                      "settings.emailNotifications.recipients.waiting",
                      "Waiting for Verification",
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    disabled={disabled || isDeleting}
                    onClick={() => onDelete(recipient.id)}
                    aria-label={t("settings.emailNotifications.recipients.delete", "Delete recipient")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
