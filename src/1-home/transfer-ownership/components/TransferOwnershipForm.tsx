import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { Crown, AlertTriangle, Loader2, Users } from "lucide-react";
import { toast } from "@/shared/hooks/use-toast";
import { cn } from "@/shared/lib/utils";

type TransferFormValues = {
  newOwnerId: string;
  message?: string;
};

interface Member {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
}

interface TransferOwnershipFormProps {
  members: Member[];
  onTransferComplete: () => void;
  initiateTransfer: (toUserId: string, message?: string) => Promise<boolean>;
  loading: boolean;
  membersLoading?: boolean;
}

const primaryGoldClass =
  "w-full bg-amber-500 font-semibold text-white shadow-sm hover:bg-amber-600 focus-visible:ring-amber-500/40 dark:bg-amber-600 dark:hover:bg-amber-500";

export function TransferOwnershipForm({
  members,
  onTransferComplete,
  initiateTransfer,
  loading,
  membersLoading = false,
}: TransferOwnershipFormProps) {
  const { t } = useTranslation();
  const [isConfirming, setIsConfirming] = useState(false);

  const transferSchema = useMemo(
    () =>
      z.object({
        newOwnerId: z.string().min(1, t("transferOwnership.form.validation.pickMember")),
        message: z.string().optional(),
      }),
    [t],
  );

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      newOwnerId: "",
      message: "",
    },
  });

  const eligibleMembers = members.filter((member) => member.role.toLowerCase() !== "owner");

  const onSubmit = async (values: TransferFormValues) => {
    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }

    if (membersLoading) {
      toast({
        title: t("transferOwnership.toast.warning.title"),
        description: t("transferOwnership.toast.warning.membersLoading"),
        variant: "destructive",
      });
      setIsConfirming(false);
      return;
    }

    const success = await initiateTransfer(values.newOwnerId, values.message || undefined);

    if (success) {
      onTransferComplete();
      setIsConfirming(false);
      form.reset();
    } else {
      setIsConfirming(false);
    }
  };

  const handleCancel = () => {
    setIsConfirming(false);
  };

  const getSelectedMember = () => eligibleMembers.find((m) => m.user_id === form.getValues("newOwnerId"));

  if (membersLoading) {
    return (
      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <Crown className="h-5 w-5 text-amber-500" aria-hidden />
            {t("transferOwnership.form.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-10">
            <Loader2 className="mr-2 h-6 w-6 animate-spin text-brand-blue" />
            <span className="text-muted-foreground">{t("transferOwnership.form.loadingMembers")}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (eligibleMembers.length === 0) {
    return (
      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <Crown className="h-5 w-5 text-amber-500" aria-hidden />
            {t("transferOwnership.form.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center space-y-4 py-10">
            <Users className="h-12 w-12 text-muted-foreground" aria-hidden />
            <div className="text-center">
              <h3 className="mb-2 text-lg font-medium text-foreground">{t("transferOwnership.form.noEligibleTitle")}</h3>
              <p className="max-w-md text-sm text-muted-foreground">{t("transferOwnership.form.noEligibleBodyOnlyOrg")}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <Crown className="h-5 w-5 text-amber-500" aria-hidden />
          {isConfirming ? t("transferOwnership.form.confirmTitle") : t("transferOwnership.form.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isConfirming ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 dark:bg-amber-500/5">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" aria-hidden />
                <div>
                  <h3 className="text-sm font-medium text-amber-900 dark:text-amber-200">
                    {t("transferOwnership.form.warningTitle")}
                  </h3>
                  <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-100/80">{t("transferOwnership.form.warningBody")}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">{t("transferOwnership.form.targetLabel")}</p>
              <div className="rounded-lg border border-brand-blue/20 bg-brand-blue/5 p-3 dark:border-brand-blue/30 dark:bg-brand-blue/10">
                {(() => {
                  const target = getSelectedMember();
                  return target ? (
                    <div>
                      <p className="font-semibold text-foreground">{target.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {target.email} • {target.role}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("transferOwnership.form.targetNotFound")}</p>
                  );
                })()}
              </div>
            </div>

            {form.getValues("message") ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">{t("transferOwnership.form.messageLabel")}</p>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-sm text-foreground">{form.getValues("message")}</p>
                </div>
              </div>
            ) : null}

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={handleCancel} disabled={loading} className="flex-1">
                {t("transferOwnership.form.cancel")}
              </Button>
              <Button
                type="button"
                onClick={() => void onSubmit(form.getValues())}
                disabled={loading}
                className={cn("flex-1", primaryGoldClass)}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("transferOwnership.form.processing")}
                  </>
                ) : (
                  t("transferOwnership.form.confirmYes")
                )}
              </Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="newOwnerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">{t("transferOwnership.form.pickNewOwner")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="border-input bg-background">
                          <SelectValue placeholder={t("transferOwnership.form.pickMemberPlaceholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {eligibleMembers.map((member) => (
                          <SelectItem key={member.user_id} value={member.user_id}>
                            <div className="flex flex-col py-0.5 text-left">
                              <span className="font-medium">{member.full_name}</span>
                              <span className="text-xs text-muted-foreground">
                                {member.email} • {member.role}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{t("transferOwnership.form.chooseFromOrgHint", { count: eligibleMembers.length })}</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">{t("transferOwnership.form.messageOptional")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("transferOwnership.form.messagePlaceholder")}
                        className="min-h-[100px] resize-none border-input bg-background"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={loading || membersLoading} className={primaryGoldClass}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("transferOwnership.form.processing")}
                  </>
                ) : (
                  t("transferOwnership.form.continue")
                )}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
