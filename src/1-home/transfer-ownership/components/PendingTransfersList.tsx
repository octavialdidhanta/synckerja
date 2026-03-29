import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { User } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PendingTransfer {
  id: string;
  created_at: string;
  message?: string;
  to_user?: {
    full_name: string;
    email: string;
  };
}

interface PendingTransfersListProps {
  transfers: PendingTransfer[];
  onCancelTransfer: (transferId: string) => void;
}

export function PendingTransfersList({ transfers, onCancelTransfer }: PendingTransfersListProps) {
  const { t, i18n } = useTranslation();

  if (transfers.length === 0) {
    return null;
  }

  const locale = i18n.language?.startsWith("id") ? "id-ID" : "en-US";

  return (
    <Card className="mt-6 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">{t("transferOwnership.pending.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transfers.map((transfer) => (
            <div key={transfer.id} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <User className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{transfer.to_user?.full_name}</p>
                    <p className="text-sm text-muted-foreground">{transfer.to_user?.email}</p>
                    {transfer.message ? <p className="mt-1 text-sm text-muted-foreground">{transfer.message}</p> : null}
                  </div>
                </div>
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => onCancelTransfer(transfer.id)}>
                  {t("transferOwnership.pending.cancel")}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("transferOwnership.pending.sent")}{" "}
                {new Date(transfer.created_at).toLocaleDateString(locale)}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
