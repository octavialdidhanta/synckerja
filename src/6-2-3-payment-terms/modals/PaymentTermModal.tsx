import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { useKOLPaymentTerms } from "@/shared/hooks/payment-terms/useKOLPaymentTerms";
import {
  formatIdrThousandsFromDigits,
  idrDigitsOnly,
  parseIdrInputToNumber,
} from "@/shared/lib/idrInputFormat";

export type PaymentTermRow = Record<string, unknown> & {
  id?: string;
  type?: string;
  template_name?: string | null;
  payment_model?: string;
  currency?: string | null;
  base_amount?: number | null;
  bonus_amount?: number | null;
  barter_value?: number | null;
  payment_schedule?: string | null;
  terms_and_conditions?: string | null;
  status?: string | null;
  performance_thresholds?: unknown;
  bonus_conditions?: unknown;
  effective_start_date?: string | null;
  effective_end_date?: string | null;
  campaign_id?: string | null;
  kol_profile_id?: string | null;
  milestones?: unknown;
};

interface PaymentTermModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentTerm?: PaymentTermRow | null;
}

const formatAmountField = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "";
  const digits = String(Math.trunc(Number(value)));
  return formatIdrThousandsFromDigits(digits);
};

export const PaymentTermModal = ({ isOpen, onClose, paymentTerm }: PaymentTermModalProps) => {
  const { createPaymentTerm, updatePaymentTerm } = useKOLPaymentTerms();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    type: "template",
    template_name: "",
    payment_model: "fixed",
    currency: "IDR",
    base_amount: "",
    bonus_amount: "",
    barter_value: "",
    payment_schedule: "net_30",
    terms_and_conditions: "",
    status: "draft",
    performance_thresholds: {} as unknown,
    bonus_conditions: {} as unknown,
    effective_start_date: "",
    effective_end_date: "",
    campaign_id: null as string | null,
    kol_profile_id: null as string | null,
  });

  const [performanceThresholds, setPerformanceThresholds] = useState([
    { metric: "reach", threshold: "", bonus_percentage: "" },
  ]);

  const [milestones, setMilestones] = useState([
    { name: "", percentage: "", due_date: "", description: "" },
  ]);

  useEffect(() => {
    if (!isOpen) return;

    if (paymentTerm) {
      setFormData({
        type: paymentTerm.type || "agreement",
        template_name: paymentTerm.template_name || "",
        payment_model: paymentTerm.payment_model || "fixed",
        currency: paymentTerm.currency || "IDR",
        base_amount: formatAmountField(paymentTerm.base_amount),
        bonus_amount: formatAmountField(paymentTerm.bonus_amount),
        barter_value: formatAmountField(
          (paymentTerm as { barter_value?: number | null }).barter_value,
        ),
        payment_schedule: paymentTerm.payment_schedule || "net_30",
        terms_and_conditions: paymentTerm.terms_and_conditions || "",
        status: paymentTerm.status || "draft",
        performance_thresholds: paymentTerm.performance_thresholds || {},
        bonus_conditions: paymentTerm.bonus_conditions || {},
        effective_start_date: paymentTerm.effective_start_date
          ? String(paymentTerm.effective_start_date).slice(0, 10)
          : "",
        effective_end_date: paymentTerm.effective_end_date
          ? String(paymentTerm.effective_end_date).slice(0, 10)
          : "",
        campaign_id: paymentTerm.campaign_id || null,
        kol_profile_id: paymentTerm.kol_profile_id || null,
      });

      if (paymentTerm.performance_thresholds) {
        const raw = paymentTerm.performance_thresholds;
        let thresholds: { metric: string; threshold: string; bonus_percentage: string }[] = [];

        if (Array.isArray(raw)) {
          thresholds = (raw as { metric?: string; threshold?: number; bonus_percentage?: number }[]).map(
            (t) => ({
              metric:
                String(t.metric || "").toLowerCase() === "conversion" ? "conversions" : String(t.metric || ""),
              threshold:
                t.threshold !== undefined && t.threshold !== null
                  ? formatIdrThousandsFromDigits(String(Math.trunc(Number(t.threshold))))
                  : "",
              bonus_percentage:
                t.bonus_percentage !== undefined && t.bonus_percentage !== null
                  ? String(t.bonus_percentage)
                  : "",
            }),
          );
        } else if (typeof raw === "object") {
          thresholds = Object.entries(
            raw as Record<string, { threshold?: number; bonus_percentage?: number }>,
          ).map(([metric, data]) => ({
            metric: metric === "conversion" ? "conversions" : metric,
            threshold:
              data?.threshold !== undefined && data?.threshold !== null
                ? formatIdrThousandsFromDigits(String(Math.trunc(Number(data.threshold))))
                : "",
            bonus_percentage:
              data?.bonus_percentage !== undefined && data?.bonus_percentage !== null
                ? String(data.bonus_percentage)
                : "",
          }));
        }

        setPerformanceThresholds(
          thresholds.length > 0 ? thresholds : [{ metric: "reach", threshold: "", bonus_percentage: "" }],
        );
      }

      if (paymentTerm.milestones && Array.isArray(paymentTerm.milestones) && paymentTerm.milestones.length > 0) {
        setMilestones(
          (paymentTerm.milestones as Record<string, unknown>[]).map((m) => ({
            name: String(m.name ?? ""),
            percentage: m.percentage != null && m.percentage !== "" ? String(m.percentage) : "",
            due_date: m.due_date ? String(m.due_date).slice(0, 10) : "",
            description: String(m.description ?? ""),
          })),
        );
      } else {
        setMilestones([{ name: "", percentage: "", due_date: "", description: "" }]);
      }
    } else {
      setFormData({
        type: "template",
        template_name: "",
        payment_model: "fixed",
        currency: "IDR",
        base_amount: "",
        bonus_amount: "",
        barter_value: "",
        payment_schedule: "net_30",
        terms_and_conditions: "",
        status: "draft",
        performance_thresholds: {},
        bonus_conditions: {},
        effective_start_date: "",
        effective_end_date: "",
        campaign_id: null,
        kol_profile_id: null,
      });
      setPerformanceThresholds([{ metric: "reach", threshold: "", bonus_percentage: "" }]);
      setMilestones([{ name: "", percentage: "", due_date: "", description: "" }]);
    }
  }, [paymentTerm, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const thresholdsObj = performanceThresholds.reduce(
        (acc, threshold) => {
          if (threshold.metric && threshold.threshold && threshold.bonus_percentage !== "") {
            const thKey =
              threshold.metric === "conversions" ? "conversions" : threshold.metric;
            acc[thKey] = {
              threshold: parseIdrInputToNumber(String(threshold.threshold)),
              bonus_percentage: parseFloat(String(threshold.bonus_percentage)),
            };
          }
          return acc;
        },
        {} as Record<string, { threshold: number; bonus_percentage: number }>,
      );

      const milestonesData = milestones
        .filter((m) => m.name && m.percentage)
        .map((m) => ({
          name: m.name,
          percentage: parseFloat(String(m.percentage)),
          due_date: m.due_date || null,
          description: m.description || null,
        }));

      const baseNum = parseIdrInputToNumber(String(formData.base_amount || ""));
      const bonusNum = parseIdrInputToNumber(String(formData.bonus_amount || ""));
      const barterNum = parseIdrInputToNumber(String(formData.barter_value || ""));

      const submitData: Record<string, unknown> = {
        ...formData,
        type: formData.type === "agreement" ? "agreement" : "template",
        base_amount: Number.isFinite(baseNum) ? baseNum : null,
        bonus_amount: Number.isFinite(bonusNum) ? bonusNum : null,
        barter_value: Number.isFinite(barterNum) ? barterNum : null,
        performance_thresholds: thresholdsObj,
        milestones: milestonesData,
        effective_start_date: formData.effective_start_date || null,
        effective_end_date: formData.effective_end_date || null,
      };

      if (paymentTerm?.id) {
        await updatePaymentTerm(String(paymentTerm.id), submitData);
      } else {
        await createPaymentTerm(submitData);
      }

      onClose();
    } catch (error) {
      console.error("Error saving payment term:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addPerformanceThreshold = () => {
    setPerformanceThresholds([
      ...performanceThresholds,
      { metric: "", threshold: "", bonus_percentage: "" },
    ]);
  };

  const removePerformanceThreshold = (index: number) => {
    setPerformanceThresholds(performanceThresholds.filter((_, i) => i !== index));
  };

  const updatePerformanceThreshold = (index: number, field: string, value: string) => {
    const updated = [...performanceThresholds];
    updated[index] = { ...updated[index], [field]: value };
    setPerformanceThresholds(updated);
  };

  const addMilestone = () => {
    setMilestones([...milestones, { name: "", percentage: "", due_date: "", description: "" }]);
  };

  const removeMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const updateMilestone = (index: number, field: string, value: string) => {
    const updated = [...milestones];
    updated[index] = { ...updated[index], [field]: value };
    setMilestones(updated);
  };

  const validateMilestones = () => {
    const totalPercentage = milestones
      .filter((m) => m.name && m.percentage)
      .reduce((sum, m) => sum + parseFloat(m.percentage || "0"), 0);
    return { isValid: totalPercentage === 100, totalPercentage };
  };

  const setAmountField = (field: "base_amount" | "bonus_amount" | "barter_value", raw: string) => {
    const digits = idrDigitsOnly(raw);
    setFormData({
      ...formData,
      [field]: digits === "" ? "" : formatIdrThousandsFromDigits(digits),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="sticky top-0 z-10 flex-shrink-0 border-b bg-background px-6 pb-3 pt-5">
          <DialogTitle>{paymentTerm ? "Edit Payment Term" : "Create Payment Term"}</DialogTitle>
          <DialogDescription>
            {paymentTerm
              ? "Update payment term details, thresholds, and milestones."
              : "Create a new payment term with performance thresholds and payment milestones for KOL collaboration."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-3 seamless-scroll [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <form id="payment-term-form" onSubmit={handleSubmit} className="space-y-4 pb-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="template">Template</SelectItem>
                    <SelectItem value="agreement">Agreement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.type === "template" ? (
                <div className="space-y-1">
                  <Label htmlFor="template_name">Template Name *</Label>
                  <Input
                    id="template_name"
                    value={formData.template_name}
                    onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                    placeholder="Standard KOL Template"
                    required={formData.type === "template"}
                  />
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="payment_model">Payment Model *</Label>
                <Select
                  value={formData.payment_model}
                  onValueChange={(value) => setFormData({ ...formData, payment_model: value })}
                >
                  <SelectTrigger id="payment_model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Fee</SelectItem>
                    <SelectItem value="fixed_plus_bonus">Fixed + Bonus</SelectItem>
                    <SelectItem value="performance_based">Performance Based</SelectItem>
                    <SelectItem value="tiered">Tiered</SelectItem>
                    <SelectItem value="barter_plus_fee">Barter + Fee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData({ ...formData, currency: value })}
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IDR">IDR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="base_amount">Base Amount</Label>
                <Input
                  id="base_amount"
                  inputMode="numeric"
                  autoComplete="off"
                  value={formData.base_amount}
                  onChange={(e) => setAmountField("base_amount", e.target.value)}
                  placeholder="5.000.000"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bonus_amount">Bonus Amount</Label>
                <Input
                  id="bonus_amount"
                  inputMode="numeric"
                  autoComplete="off"
                  value={formData.bonus_amount}
                  onChange={(e) => setAmountField("bonus_amount", e.target.value)}
                  placeholder="1.000.000"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="barter_value">Barter Value</Label>
                <Input
                  id="barter_value"
                  inputMode="numeric"
                  autoComplete="off"
                  value={formData.barter_value}
                  onChange={(e) => setAmountField("barter_value", e.target.value)}
                  placeholder="500.000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="payment_schedule">Payment Schedule</Label>
                <Select
                  value={formData.payment_schedule}
                  onValueChange={(value) => setFormData({ ...formData, payment_schedule: value })}
                >
                  <SelectTrigger id="payment_schedule">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="net_30">Net 30</SelectItem>
                    <SelectItem value="net_15">Net 15</SelectItem>
                    <SelectItem value="net_7">Net 7</SelectItem>
                    <SelectItem value="immediate">Immediate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="negotiating">Negotiating</SelectItem>
                    <SelectItem value="agreed">Agreed</SelectItem>
                    <SelectItem value="signed">Signed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="terms_and_conditions">Terms and Conditions</Label>
              <Textarea
                id="terms_and_conditions"
                value={formData.terms_and_conditions}
                onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
                placeholder="Enter terms and conditions..."
                rows={3}
              />
            </div>

            <Card className="border border-border/80 shadow-sm">
              <CardHeader className="pb-2 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Performance Thresholds</CardTitle>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addPerformanceThreshold}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add Threshold
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pb-3 pt-0">
                {performanceThresholds.map((threshold, index) => (
                  <div key={index} className="flex items-end gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label>Metric</Label>
                      <Select
                        value={threshold.metric}
                        onValueChange={(value) => updatePerformanceThreshold(index, "metric", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select metric" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="reach">Reach</SelectItem>
                          <SelectItem value="engagement">Engagement</SelectItem>
                          <SelectItem value="conversions">Conversions</SelectItem>
                          <SelectItem value="views">Views</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label>
                        {threshold.metric === "engagement"
                          ? "Target Engagement (jumlah interaksi)"
                          : threshold.metric === "reach"
                            ? "Target Reach (jumlah)"
                            : threshold.metric === "conversions" || threshold.metric === "conversion"
                              ? "Target Conversion (jumlah)"
                              : "Threshold"}
                      </Label>
                      <Input
                        inputMode="numeric"
                        autoComplete="off"
                        value={threshold.threshold}
                        onChange={(e) => {
                          const digits = idrDigitsOnly(e.target.value);
                          updatePerformanceThreshold(
                            index,
                            "threshold",
                            digits === "" ? "" : formatIdrThousandsFromDigits(digits),
                          );
                        }}
                        placeholder={
                          threshold.metric === "engagement" ? "5.000" : "100.000"
                        }
                      />
                      {threshold.metric === "engagement" ? (
                        <p className="text-xs text-muted-foreground">
                          Jumlah interaksi (bukan %). Campaign target engagement tetap dalam persen.
                        </p>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label>Bonus %</Label>
                      <Input
                        type="number"
                        value={threshold.bonus_percentage}
                        onChange={(e) => updatePerformanceThreshold(index, "bonus_percentage", e.target.value)}
                        placeholder="10"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => removePerformanceThreshold(index)}
                      disabled={performanceThresholds.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border border-border/80 shadow-sm">
              <CardHeader className="pb-2 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">Payment Milestones</CardTitle>
                    {milestones.some((m) => m.name && m.percentage) ? (
                      <div className="mt-0.5 flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            validateMilestones().isValid
                              ? "bg-primary/10 text-primary"
                              : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          Total: {validateMilestones().totalPercentage}%
                          {validateMilestones().isValid ? " ✓" : " ⚠️"}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addMilestone}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add Milestone
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pb-3 pt-0">
                {milestones.map((milestone, index) => (
                  <div key={index} className="grid grid-cols-12 items-end gap-2">
                    <div className="col-span-12 space-y-1 sm:col-span-3">
                      <Label>Milestone Name</Label>
                      <Input
                        value={milestone.name}
                        onChange={(e) => updateMilestone(index, "name", e.target.value)}
                        placeholder="Project Kickoff"
                      />
                    </div>
                    <div className="col-span-12 space-y-1 sm:col-span-2">
                      <Label>Payment %</Label>
                      <Input
                        type="number"
                        value={milestone.percentage}
                        onChange={(e) => updateMilestone(index, "percentage", e.target.value)}
                        placeholder="30"
                        max={100}
                        className={
                          !validateMilestones().isValid && milestone.percentage ? "border-destructive" : ""
                        }
                      />
                    </div>
                    <div className="col-span-12 space-y-1 sm:col-span-2">
                      <Label>Due Date</Label>
                      <Input
                        type="date"
                        value={milestone.due_date}
                        onChange={(e) => updateMilestone(index, "due_date", e.target.value)}
                      />
                    </div>
                    <div className="col-span-12 space-y-1 sm:col-span-4">
                      <Label>Description</Label>
                      <Input
                        value={milestone.description}
                        onChange={(e) => updateMilestone(index, "description", e.target.value)}
                        placeholder="Initial content delivery"
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-1 sm:flex sm:justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMilestone(index)}
                        disabled={milestones.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </form>
        </div>

        <DialogFooter className="flex-shrink-0 border-t bg-background px-6 py-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="payment-term-form" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : paymentTerm ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
