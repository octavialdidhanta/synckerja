import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Progress } from "@/shared/components/ui/progress";
import {
  Plus,
  Edit,
  Trash2,
  DollarSign,
  Calendar,
  Target,
  FileText,
  Users,
  CheckCircle,
  Clock,
  AlertTriangle,
  CreditCard,
} from "lucide-react";
import { useKOLPaymentTerms } from "@/shared/hooks/payment-terms/useKOLPaymentTerms";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { PaymentTermModal, type PaymentTermRow } from "../modals/PaymentTermModal";
import { PaymentUpdateModal } from "../modals/PaymentUpdateModal";

const KOLPaymentTermsTab = () => {
  const { t, dateLocale } = useAppTranslation();
  const { paymentTerms, deletePaymentTerm } = useKOLPaymentTerms();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<PaymentTermRow | null>(null);
  const [activeTab, setActiveTab] = useState<"templates" | "agreements">("templates");

  const formatAmount = (n: number) =>
    Number.isFinite(n) ? n.toLocaleString(dateLocale, { maximumFractionDigits: 0 }) : t("kolManagement.paymentTerms.notApplicable", "N/A");

  const templates = paymentTerms.filter((term: PaymentTermRow) => term.type === "template");
  const agreements = paymentTerms.filter((term: PaymentTermRow) => term.type === "agreement");

  const handleEdit = (term: PaymentTermRow) => {
    setSelectedTerm(term);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedTerm(null);
    setIsModalOpen(true);
  };

  const handleUpdatePayment = (term: PaymentTermRow) => {
    setSelectedTerm(term);
    setIsPaymentModalOpen(true);
  };

  const handleDelete = async (id: string, isActive: boolean) => {
    if (isActive) {
      window.alert(t("kolManagement.paymentTerms.deleteActiveBlocked"));
      return;
    }
    if (window.confirm(t("kolManagement.paymentTerms.deleteConfirm"))) {
      await deletePaymentTerm(id);
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "active":
        return "default";
      case "draft":
        return "secondary";
      case "signed":
        return "default";
      case "completed":
        return "outline";
      case "negotiating":
        return "secondary";
      case "agreed":
        return "default";
      default:
        return "outline";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-3 w-3" />;
      case "draft":
        return <Clock className="h-3 w-3" />;
      case "signed":
        return <CheckCircle className="h-3 w-3" />;
      case "completed":
        return <CheckCircle className="h-3 w-3" />;
      case "negotiating":
        return <AlertTriangle className="h-3 w-3" />;
      case "agreed":
        return <CheckCircle className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const calculateMilestoneProgress = (milestones: unknown) => {
    if (!milestones || !Array.isArray(milestones) || milestones.length === 0) return 0;
    const completedMilestones = milestones.filter((m: { status?: string }) => m.status === "completed").length;
    return Math.round((completedMilestones / milestones.length) * 100);
  };

  const cardListScrollClass =
    "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as "templates" | "agreements")}
      className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col gap-2 overflow-hidden sm:gap-3"
    >
      <div className="flex shrink-0 min-w-0 flex-wrap items-center gap-2">
        <TabsList className="inline-flex h-8 w-auto shrink-0 rounded-md border border-gray-200 bg-gray-100/80 p-0.5">
          <TabsTrigger
            value="templates"
            className="h-7 gap-1.5 rounded border-0 px-3 text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm data-[state=inactive]:text-gray-500"
          >
            <FileText className="h-3.5 w-3.5" />
            {t("kolManagement.paymentTerms.tabs.templates")} ({templates.length})
          </TabsTrigger>
          <TabsTrigger
            value="agreements"
            className="h-7 gap-1.5 rounded border-0 px-3 text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm data-[state=inactive]:text-gray-500"
          >
            <Users className="h-3.5 w-3.5" />
            {t("kolManagement.paymentTerms.tabs.agreements")} ({agreements.length})
          </TabsTrigger>
        </TabsList>
        <Button onClick={handleCreate} className="h-7 shrink-0 gap-1.5 rounded-md px-3 text-xs font-medium">
          <Plus className="h-3.5 w-3.5" />
          {t("kolManagement.paymentTerms.createPaymentTerm")}
        </Button>
      </div>

      <TabsContent
        value="templates"
        className="mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
      >
        {templates.length === 0 ? (
          <Card className="overflow-hidden">
            <CardContent className="flex flex-col items-center justify-center px-4 py-8 sm:px-8 sm:py-12">
              <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
                <FileText className="mb-4 h-12 w-12 shrink-0 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-semibold">{t("kolManagement.paymentTerms.emptyTemplates.title")}</h3>
                <p
                  className={`text-pretty text-sm leading-relaxed text-muted-foreground ${agreements.length > 0 ? "mb-3" : "mb-6"}`}
                >
                  {t("kolManagement.paymentTerms.emptyTemplates.description")}
                </p>
                {agreements.length > 0 ? (
                  <p className="mb-6 text-pretty text-sm leading-relaxed text-muted-foreground">
                    {t("kolManagement.paymentTerms.emptyTemplates.hintBeforeLink", undefined, {
                      count: agreements.length,
                    })}{" "}
                    <button
                      type="button"
                      className="font-medium text-primary underline underline-offset-2 hover:text-primary/90"
                      onClick={() => setActiveTab("agreements")}
                    >
                      {t("kolManagement.paymentTerms.tabs.agreements")}
                    </button>
                    {t("kolManagement.paymentTerms.emptyTemplates.hintAfterLink")}
                  </p>
                ) : null}
                <Button onClick={handleCreate} className="mt-1">
                  {t("kolManagement.paymentTerms.emptyTemplates.createTemplate")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className={cardListScrollClass}>
            <div className="flex min-w-0 flex-col gap-2 pb-1 sm:gap-3">
            {templates.map((term: PaymentTermRow) => (
              <Card key={String(term.id)} className="overflow-hidden transition-shadow hover:shadow-md">
                <CardHeader className="space-y-0 border-b border-border/60 p-3 pb-2.5 sm:p-5 sm:pb-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="flex flex-wrap items-center gap-1.5 text-base font-semibold leading-snug sm:gap-2 sm:text-lg">
                        <span className="break-words">
                          {term.template_name || t("kolManagement.paymentTerms.card.defaultTemplateName")}
                        </span>
                        <Badge variant="secondary" className="shrink-0">
                          {t("kolManagement.paymentTerms.badge.template")}
                        </Badge>
                      </CardTitle>
                      <p className="mt-1 text-xs leading-snug text-muted-foreground sm:mt-2 sm:text-sm sm:leading-relaxed">
                        {String(term.payment_model || "").replace("_", " ").toUpperCase()} • {t("kolManagement.paymentTerms.inlineBase")}:{" "}
                        {term.currency} {formatAmount(Number(term.base_amount ?? NaN))}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2 sm:justify-end">
                      <Badge
                        variant={getStatusVariant(String(term.status || ""))}
                        className="flex w-fit items-center gap-1 text-[10px] sm:text-xs"
                      >
                        {getStatusIcon(String(term.status || ""))}
                        {String(term.status || "draft").toUpperCase()}
                      </Badge>
                      <div className="flex items-center gap-0.5">
                        <Button variant="ghost" size="sm" type="button" className="h-8 w-8 p-0" onClick={() => handleEdit(term)}>
                          <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => handleDelete(String(term.id), String(term.status) === "active")}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive/80"
                        >
                          <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-2.5 sm:p-5 sm:pt-4">
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-3 sm:p-4">
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-x-3 gap-y-2 sm:grid-cols-[repeat(auto-fill,minmax(11.25rem,1fr))] sm:gap-x-5 sm:gap-y-3">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <DollarSign className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground">
                            {t("kolManagement.paymentTerms.field.baseAmount")}
                          </p>
                          <p className="mt-0.5 break-words text-sm font-semibold tabular-nums">
                            {term.currency} {formatAmount(Number(term.base_amount ?? NaN))}
                          </p>
                        </div>
                      </div>
                      <div className="flex min-w-0 items-start gap-2.5">
                        <Target className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground">
                            {t("kolManagement.paymentTerms.field.bonusAmount")}
                          </p>
                          <p className="mt-0.5 break-words text-sm font-semibold tabular-nums">
                            {term.currency} {formatAmount(Number(term.bonus_amount ?? NaN))}
                          </p>
                        </div>
                      </div>
                      <div className="flex min-w-0 items-start gap-2.5">
                        <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground">
                            {t("kolManagement.paymentTerms.field.paymentSchedule")}
                          </p>
                          <p className="mt-0.5 break-words text-sm font-semibold">
                            {String(term.payment_schedule || "").replace("_", " ").toUpperCase() ||
                              t("kolManagement.paymentTerms.notApplicable", "N/A")}
                          </p>
                        </div>
                      </div>
                      <div className="flex min-w-0 items-start gap-2.5">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground">{t("kolManagement.paymentTerms.field.model")}</p>
                          <p className="mt-0.5 break-words text-sm font-semibold">
                            {String(term.payment_model || "").replace("_", " ").toUpperCase() ||
                              t("kolManagement.paymentTerms.notApplicable", "N/A")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            </div>
          </div>
        )}
      </TabsContent>

      <TabsContent
        value="agreements"
        className="mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
      >
        {agreements.length === 0 ? (
          <Card className="overflow-hidden">
            <CardContent className="flex flex-col items-center justify-center px-4 py-8 sm:px-8 sm:py-12">
              <div className="mx-auto w-full max-w-md text-center">
                <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-semibold">{t("kolManagement.paymentTerms.emptyAgreements.title")}</h3>
                <p className="mb-6 text-pretty text-sm leading-relaxed text-muted-foreground">
                  {t("kolManagement.paymentTerms.emptyAgreements.description")}
                </p>
                <Button onClick={handleCreate}>{t("kolManagement.paymentTerms.emptyAgreements.createButton")}</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className={cardListScrollClass}>
            <div className="flex min-w-0 flex-col gap-2 pb-1 sm:gap-3">
            {agreements.map((term: PaymentTermRow) => (
              <Card key={String(term.id)} className="overflow-hidden transition-shadow hover:shadow-md">
                <CardHeader className="space-y-0 border-b border-border/60 p-3 pb-2.5 sm:p-5 sm:pb-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="flex flex-wrap items-center gap-1.5 text-base font-semibold leading-snug sm:gap-2 sm:text-lg">
                        <span className="break-words">
                          {(term.kol_profiles as { name?: string } | undefined)?.name ||
                            t("kolManagement.paymentTerms.agreements.unknownKol")}
                        </span>
                        <Badge className="shrink-0">{t("kolManagement.paymentTerms.badge.agreement")}</Badge>
                      </CardTitle>
                      <p className="mt-1 text-xs leading-snug text-muted-foreground sm:mt-2 sm:text-sm sm:leading-relaxed">
                        {String(term.payment_model || "").replace("_", " ").toUpperCase()} • {t("kolManagement.paymentTerms.totalPrefix")}:{" "}
                        {term.currency}{" "}
                        {formatAmount(
                          Number(term.base_amount || 0) +
                            Number(term.bonus_amount || 0) +
                            Number((term as { barter_value?: number }).barter_value || 0),
                        )}
                      </p>
                      {term.kol_content_posts ? (
                        <p className="mt-1 break-words text-[11px] leading-snug text-blue-600 sm:mt-1.5 sm:text-xs sm:leading-relaxed">
                          {t("kolManagement.paymentTerms.field.content")}:{" "}
                          {(term.kol_content_posts as { title?: string }).title}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2 sm:justify-end">
                      <Badge
                        variant={getStatusVariant(String(term.status || ""))}
                        className="flex w-fit items-center gap-1 text-[10px] sm:text-xs"
                      >
                        {getStatusIcon(String(term.status || ""))}
                        {String(term.status || "draft").toUpperCase()}
                      </Badge>
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          className="h-8 w-8 p-0"
                          onClick={() => handleUpdatePayment(term)}
                          title={t("kolManagement.paymentTerms.updatePaymentTitle")}
                        >
                          <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" type="button" className="h-8 w-8 p-0" onClick={() => handleEdit(term)}>
                          <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => handleDelete(String(term.id), String(term.status) === "active")}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive/80"
                        >
                          <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2.5 p-3 pt-2.5 sm:space-y-3 sm:p-5 sm:pt-4">
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-3 sm:p-4">
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-x-3 gap-y-2 sm:grid-cols-[repeat(auto-fill,minmax(11.25rem,1fr))] sm:gap-x-5 sm:gap-y-3">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <DollarSign className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground">
                            {t("kolManagement.paymentTerms.field.baseAmount")}
                          </p>
                          <p className="mt-0.5 break-words text-sm font-semibold tabular-nums">
                            {term.currency} {formatAmount(Number(term.base_amount ?? NaN))}
                          </p>
                        </div>
                      </div>
                      <div className="flex min-w-0 items-start gap-2.5">
                        <Target className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground">{t("kolManagement.paymentTerms.field.bonus")}</p>
                          <p className="mt-0.5 break-words text-sm font-semibold tabular-nums">
                            {term.currency} {formatAmount(Number(term.bonus_amount ?? NaN))}
                          </p>
                        </div>
                      </div>
                      <div className="flex min-w-0 items-start gap-2.5">
                        <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground">{t("kolManagement.paymentTerms.field.schedule")}</p>
                          <p className="mt-0.5 break-words text-sm font-semibold">
                            {String(term.payment_schedule || "").replace("_", " ").toUpperCase() ||
                              t("kolManagement.paymentTerms.notApplicable", "N/A")}
                          </p>
                        </div>
                      </div>
                      <div className="flex min-w-0 items-start gap-2.5">
                        <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground">{t("kolManagement.paymentTerms.field.dpPaid")}</p>
                          <p className="mt-0.5 break-words text-sm font-semibold tabular-nums">
                            {term.currency}{" "}
                            {formatAmount(Number((term as { down_payment_amount?: number }).down_payment_amount ?? 0))}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {(term as { down_payment_amount?: number }).down_payment_amount ? (
                    <div className="rounded-lg border border-border/50 bg-muted/15 p-3 sm:p-4">
                      {(() => {
                        const dp = Number((term as { down_payment_amount?: number }).down_payment_amount) || 0;
                        const denom = Number(term.base_amount || 0) + Number(term.bonus_amount || 0);
                        const pct = denom > 0 ? Math.round((dp / denom) * 100) : 0;
                        return (
                          <div className="space-y-2 sm:space-y-2.5">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                              <h4 className="text-sm font-semibold">{t("kolManagement.paymentTerms.paymentProgress")}</h4>
                              <span className="text-xs text-muted-foreground">
                                {t("kolManagement.paymentTerms.paidPercent", undefined, { pct })}
                              </span>
                            </div>
                            <Progress value={pct} className="h-2.5" />
                            <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:gap-4">
                              <span className="break-words">
                                {t("kolManagement.paymentTerms.dpShort")}: {term.currency}{" "}
                                {formatAmount(Number((term as { down_payment_amount?: number }).down_payment_amount ?? 0))}
                              </span>
                              <span className="break-words sm:text-right">
                                {t("kolManagement.paymentTerms.remainingShort")}: {term.currency}{" "}
                                {formatAmount(
                                  Number(term.base_amount || 0) +
                                    Number(term.bonus_amount || 0) -
                                    (Number((term as { down_payment_amount?: number }).down_payment_amount) || 0) -
                                    (Number((term as { deduction_amount?: number }).deduction_amount) || 0),
                                )}
                              </span>
                            </div>
                            {(Number((term as { deduction_amount?: number }).deduction_amount) || 0) > 0 ? (
                              <div className="flex items-start gap-2 text-xs text-orange-600">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span className="break-words leading-relaxed">
                                  {t("kolManagement.paymentTerms.deductionPrefix")}: {term.currency}{" "}
                                  {formatAmount(Number((term as { deduction_amount?: number }).deduction_amount ?? 0))} (
                                  {String((term as { deduction_reason?: string }).deduction_reason || "")})
                                </span>
                              </div>
                            ) : null}
                          </div>
                        );
                      })()}
                    </div>
                  ) : null}

                  {term.milestones && Array.isArray(term.milestones) && term.milestones.length > 0 ? (
                    <div className="rounded-lg border border-border/50 bg-muted/15 p-3 sm:p-4">
                      <div className="space-y-2 sm:space-y-2.5">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                          <h4 className="text-sm font-semibold">{t("kolManagement.paymentTerms.milestoneProgress")}</h4>
                          <span className="text-xs text-muted-foreground">
                            {t("kolManagement.paymentTerms.percentComplete", undefined, {
                              pct: calculateMilestoneProgress(term.milestones),
                            })}
                          </span>
                        </div>
                        <Progress
                          value={calculateMilestoneProgress(term.milestones)}
                          className="h-2.5"
                        />
                        <div className="max-h-36 min-h-0 space-y-2 overflow-y-auto overflow-x-hidden pr-1 seamless-scroll nested-scroll-touch-chain">
                          {term.milestones.map(
                            (
                              milestone: { status?: string; name?: string; percentage?: number },
                              index: number,
                            ) => (
                              <div
                                key={index}
                                className="flex items-start justify-between gap-3 text-xs leading-relaxed"
                              >
                                <span className="flex min-w-0 items-start gap-2">
                                  <div
                                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${milestone.status === "completed" ? "bg-primary" : "bg-muted"}`}
                                  />
                                  <span className="break-words">{milestone.name}</span>
                                </span>
                                <span className="shrink-0 tabular-nums text-muted-foreground">
                                  {milestone.percentage}%
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
            </div>
          </div>
        )}
      </TabsContent>

      <PaymentTermModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} paymentTerm={selectedTerm} />
      <PaymentUpdateModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        paymentTerm={selectedTerm}
      />
    </Tabs>
  );
};

export default KOLPaymentTermsTab;
