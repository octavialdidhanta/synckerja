import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { supabase } from "@/shared/lib/supabaseClient";
import { toast } from "sonner";

interface MarkPayrollRunPaidDialogProps {
  runId: string | null;
  runName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function MarkPayrollRunPaidDialog({
  runId,
  runName,
  open,
  onOpenChange,
  onSuccess,
}: MarkPayrollRunPaidDialogProps) {
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!runId) return;
    if (!reference.trim()) {
      toast.error("Nomor referensi transfer wajib diisi");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("mark_payroll_run_paid", {
        p_run_id: runId,
        p_payment_reference: reference.trim(),
        p_payment_method: "bank_transfer",
      });
      if (error) throw error;
      const result = data as { success?: boolean; message?: string };
      if (!result?.success) throw new Error(result?.message ?? "Mark paid failed");
      toast.success(result.message ?? "Payroll marked as paid");
      onOpenChange(false);
      setReference("");
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mark as paid");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark Payroll as Paid</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          Finalisasi pembayaran untuk run <strong>{runName ?? runId}</strong>. Semua kalkulasi
          pending akan ditandai paid.
        </p>
        <div className="space-y-2">
          <Label htmlFor="payment-ref">Referensi Transfer</Label>
          <Input
            id="payment-ref"
            placeholder="TRF-20260530-001"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Batal
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={loading}>
            {loading ? "Menyimpan..." : "Mark as Paid"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
