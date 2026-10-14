import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Crown } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";

interface IncomingTransfer {
  id: string;
  created_at: string;
  message?: string | null;
  from_user_name?: string;
  from_user_email?: string;
  organization_name?: string;
}

interface IncomingTransfersListProps {
  transfers: IncomingTransfer[];
  accepting: boolean;
  onAccept: (transferId: string) => void;
}

export function IncomingTransfersList({ transfers, accepting, onAccept }: IncomingTransfersListProps) {
  const { t, i18n } = useTranslation();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const locale = i18n.language?.startsWith("id") ? "id-ID" : "en-US";

  if (transfers.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{t("transferOwnership.incoming.emptyTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("transferOwnership.incoming.emptyBody")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {transfers.map((transfer) => {
        const confirming = confirmingId === transfer.id;
        return (
          <Card key={transfer.id} className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">{transfer.organization_name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">{t("transferOwnership.incoming.from")}</p>
                <p className="font-medium text-foreground">{transfer.from_user_name}</p>
                {transfer.from_user_email ? (
                  <p className="text-muted-foreground">{transfer.from_user_email}</p>
                ) : null}
              </div>
              {transfer.message ? <p className="text-sm text-muted-foreground">{transfer.message}</p> : null}
              <p className="text-xs text-muted-foreground">
                {t("transferOwnership.pending.sent")} {new Date(transfer.created_at).toLocaleDateString(locale)}
              </p>
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
                {t("transferOwnership.incoming.warning")}
              </p>
              {confirming ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="bg-amber-500 font-semibold text-white hover:bg-amber-600"
                    disabled={accepting}
                    onClick={() => onAccept(transfer.id)}
                  >
                    <Crown className="mr-2 h-4 w-4" aria-hidden />
                    {accepting ? t("transferOwnership.incoming.accepting") : t("transferOwnership.incoming.confirmYes")}
                  </Button>
                  <Button variant="outline" disabled={accepting} onClick={() => setConfirmingId(null)}>
                    {t("transferOwnership.form.cancel")}
                  </Button>
                </div>
              ) : (
                <Button className="bg-amber-500 font-semibold text-white hover:bg-amber-600" onClick={() => setConfirmingId(transfer.id)}>
                  <Crown className="mr-2 h-4 w-4" aria-hidden />
                  {t("transferOwnership.incoming.accept")}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
