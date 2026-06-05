import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useKOLPaymentTerms } from "@/shared/hooks/payment-terms/useKOLPaymentTerms";
import { supabase } from "@/shared/lib/supabaseClient";
import { DollarSign, Calendar, AlertTriangle } from "lucide-react";
import {
  formatIdrThousandsFromDigits,
  idrDigitsOnly,
  parseIdrInputToNumber,
} from "@/shared/lib/idrInputFormat";
import type { PaymentTermRow } from "./PaymentTermModal";

type KolProfileLite = { name?: string | null };
type ContentPostLite = { title?: string | null };

interface PaymentUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentTerm: PaymentTermRow | null;
}

const formatId = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString("id-ID", { maximumFractionDigits: 0 }) : "0";

export const PaymentUpdateModal = ({ isOpen, onClose, paymentTerm }: PaymentUpdateModalProps) => {
  const { updatePaymentStatus } = useKOLPaymentTerms();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    remaining_amount: 0,
    final_payment_date: "",
    deduction_amount: "",
    deduction_reason: "",
    status: "draft",
  });

  useEffect(() => {
    if (!isOpen || !paymentTerm) return;
    const ded = Number((paymentTerm as { deduction_amount?: number }).deduction_amount || 0);
    setFormData({
      remaining_amount:
        (paymentTerm as { remaining_amount?: number }).remaining_amount ??
        Number(paymentTerm.base_amount || 0),
      final_payment_date: (paymentTerm as { final_payment_date?: string }).final_payment_date
        ? String((paymentTerm as { final_payment_date?: string }).final_payment_date).split("T")[0]
        : "",
      deduction_amount:
        ded > 0 ? formatIdrThousandsFromDigits(String(Math.trunc(ded))) : "",
      deduction_reason: String((paymentTerm as { deduction_reason?: string }).deduction_reason || ""),
      status: String(paymentTerm.status || "draft"),
    });
  }, [isOpen, paymentTerm]);

  if (!paymentTerm) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const baseTotal = Number(paymentTerm.base_amount || 0) + Number(paymentTerm.bonus_amount || 0);
      const deduction = parseIdrInputToNumber(String(formData.deduction_amount || ""));
      const deductionNum = Number.isFinite(deduction) ? deduction : 0;

      let downPaymentAmount = Number(
        (paymentTerm as { down_payment_amount?: number }).down_payment_amount || 0,
      );

      if (formData.status === "dp_paid" && downPaymentAmount <= 0) {
        const { data: milestones } = await supabase
          .from("payment_milestones")
          .select("amount, milestone_order, milestone_name, status")
          .eq("payment_terms_id", paymentTerm.id)
          .order("milestone_order", { ascending: true });

        const firstMilestone = (milestones || []).find(
          (m) =>
            m.milestone_order === 1 ||
            String(m.milestone_name || "")
              .toLowerCase()
              .includes("dp") ||
            String(m.milestone_name || "")
              .toLowerCase()
              .includes("down"),
        );
        const fallbackMilestone = (milestones || [])[0];
        const source = firstMilestone || fallbackMilestone;
        if (source?.amount) {
          downPaymentAmount = Number(source.amount);
        }
      }

      const calculatedRemaining = baseTotal - downPaymentAmount - deductionNum;

      const cleanedData: Record<string, unknown> = {
        final_payment_date:
          formData.final_payment_date.trim() === "" ? null : formData.final_payment_date,
        remaining_amount: Math.max(0, calculatedRemaining),
        deduction_amount: deductionNum,
        deduction_reason: formData.deduction_reason,
        status: formData.status,
        down_payment_amount:
          formData.status === "dp_paid" && downPaymentAmount > 0 ? downPaymentAmount : undefined,
        down_payment_date:
          formData.status === "dp_paid" && !(paymentTerm as { down_payment_date?: string }).down_payment_date
            ? new Date().toISOString().split("T")[0]
            : (paymentTerm as { down_payment_date?: string }).down_payment_date,
      };

      await updatePaymentStatus(String(paymentTerm.id), cleanedData);
      onClose();
    } catch (error) {
      console.error("Error updating payment:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const totalAmount = Number(paymentTerm.base_amount || 0) + Number(paymentTerm.bonus_amount || 0);
  const downPaymentAmount = Number((paymentTerm as { down_payment_amount?: number }).down_payment_amount || 0);
  const remainingAfterDP = totalAmount - downPaymentAmount;
  const deductionNum = parseIdrInputToNumber(String(formData.deduction_amount || ""));
  const ded = Number.isFinite(deductionNum) ? deductionNum : 0;
  const finalAmount = remainingAfterDP - ded;

  const kolName = (paymentTerm.kol_profiles as KolProfileLite | undefined)?.name;
  const postTitle = (paymentTerm.kol_content_posts as ContentPostLite | undefined)?.title;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Update Payment - {kolName || "Unknown KOL"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-3">
            <h3 className="mb-2 font-semibold">Payment Summary</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-600">Total Amount:</span>
                <span className="ml-2 font-semibold">
                  {paymentTerm.currency} {formatId(totalAmount)}
                </span>
              </div>
              <div>
                <span className="text-slate-600">Down Payment:</span>
                <span className="ml-2 font-semibold">
                  {paymentTerm.currency} {formatId(downPaymentAmount)}
                </span>
              </div>
              <div>
                <span className="text-slate-600">KOL Name:</span>
                <span className="ml-2 font-semibold">{kolName || "Unknown"}</span>
              </div>
              <div>
                <span className="text-slate-600">Content Post:</span>
                <span className="ml-2 font-semibold">{postTitle || "No Post"}</span>
              </div>
              <div>
                <span className="text-slate-600">Payment Model:</span>
                <span className="ml-2 font-semibold">
                  {String(paymentTerm.payment_model || "").replace("_", " ").toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-slate-600">Remaining After DP:</span>
                <span className="ml-2 font-semibold">
                  {paymentTerm.currency} {formatId(remainingAfterDP)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Deductions (Target Not Met)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="deduction_amount">Deduction Amount</Label>
                <Input
                  id="deduction_amount"
                  inputMode="numeric"
                  autoComplete="off"
                  value={formData.deduction_amount}
                  onChange={(e) => {
                    const digits = idrDigitsOnly(e.target.value);
                    handleInputChange(
                      "deduction_amount",
                      digits === "" ? "" : formatIdrThousandsFromDigits(digits),
                    );
                  }}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="deduction_reason">Deduction Reason</Label>
                <Select
                  value={formData.deduction_reason ? formData.deduction_reason : "__none__"}
                  onValueChange={(value) =>
                    handleInputChange("deduction_reason", value === "__none__" ? "" : value)
                  }
                >
                  <SelectTrigger id="deduction_reason">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    <SelectItem value="engagement_target_not_met">Engagement Target Not Met</SelectItem>
                    <SelectItem value="reach_target_not_met">Reach Target Not Met</SelectItem>
                    <SelectItem value="conversion_target_not_met">Conversion Target Not Met</SelectItem>
                    <SelectItem value="content_quality_issue">Content Quality Issue</SelectItem>
                    <SelectItem value="timeline_violation">Timeline Violation</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <Calendar className="h-4 w-4" />
              Final Payment
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Final Amount</Label>
                <div className="rounded border bg-slate-100 p-2">
                  <span className="font-semibold">
                    {paymentTerm.currency} {formatId(finalAmount)}
                  </span>
                  <span className="ml-2 text-sm text-slate-600">
                    (Remaining: {formatId(remainingAfterDP)} − Deduction: {formatId(ded)})
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="final_payment_date">Final Payment Date</Label>
                <Input
                  id="final_payment_date"
                  type="date"
                  value={formData.final_payment_date}
                  onChange={(e) => handleInputChange("final_payment_date", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="pay_status">Payment Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => handleInputChange("status", value)}
            >
              <SelectTrigger id="pay_status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="agreed">Agreed</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="dp_paid">DP Paid</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 border-t pt-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Updating..." : "Update Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
