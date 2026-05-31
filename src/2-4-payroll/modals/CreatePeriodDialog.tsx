import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Calendar } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";

interface CreatePeriodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreatePeriodDialog({ open, onOpenChange, onSuccess }: CreatePeriodDialogProps) {
  const { organization } = useCentralizedUserData();
  const organizationId = organization?.id ?? null;
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    period_name: "",
    period_type: "monthly" as "monthly" | "weekly" | "biweekly",
    start_date: "",
    end_date: "",
    pay_date: "",
    cut_off: "",
    is_active: false,
    is_bonus_period: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organizationId) {
      toast.error("Organization not found");
      return;
    }

    setIsLoading(true);

    try {
      if (formData.is_active) {
        await supabase
          .from("payroll_periods")
          .update({ status: "draft" })
          .eq("organization_id", organizationId)
          .eq("status", "approved");
      }

      const { error } = await supabase.from("payroll_periods").insert({
        organization_id: organizationId,
        period_name: formData.period_name,
        period_type: formData.period_type,
        start_date: formData.start_date,
        end_date: formData.end_date,
        pay_date: formData.pay_date,
        cut_off: formData.cut_off || undefined,
        status: formData.is_active ? "approved" : "draft",
        is_bonus_period: formData.is_bonus_period,
      });

      if (error) {
        toast.error("Failed to create payroll period");
        return;
      }

      toast.success(
        `Payroll period created successfully${formData.is_active ? " and set as active" : ""}`,
      );

      setFormData({
        period_name: "",
        period_type: "monthly",
        start_date: "",
        end_date: "",
        pay_date: "",
        cut_off: "",
        is_active: false,
        is_bonus_period: false,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast.error("Failed to create payroll period");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Create New Payroll Period
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="period_name">Period Name</Label>
            <Input
              id="period_name"
              value={formData.period_name}
              onChange={(e) => setFormData({ ...formData, period_name: e.target.value })}
              placeholder="e.g., January 2024"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="period_type">Period Type</Label>
            <Select
              value={formData.period_type}
              onValueChange={(value: "monthly" | "weekly" | "biweekly") =>
                setFormData({ ...formData, period_type: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Bi-weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pay_date">Pay Date</Label>
              <Input
                id="pay_date"
                type="date"
                value={formData.pay_date}
                onChange={(e) => setFormData({ ...formData, pay_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cut_off">Cut Off Date (Optional)</Label>
              <Input
                id="cut_off"
                type="date"
                value={formData.cut_off}
                onChange={(e) => setFormData({ ...formData, cut_off: e.target.value })}
              />
            </div>
          </div>

          <div className="border-border space-y-3 border-t pt-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked as boolean })}
              />
              <Label htmlFor="is_active" className="text-sm font-medium">
                Set as Active Period
              </Label>
            </div>
            <p className="text-muted-foreground ml-6 text-xs">
              {formData.is_active
                ? "This period will be set as active and used for new attendance records"
                : "This period will be created as draft and can be activated later"}
            </p>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_bonus_period"
                checked={formData.is_bonus_period}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_bonus_period: checked as boolean })
                }
              />
              <Label htmlFor="is_bonus_period" className="text-sm font-medium">
                Periode Bonus / THR
              </Label>
              <p className="text-muted-foreground text-xs">
                Centang untuk payroll Lebaran/THR. THR manual: tambah komponen tunjangan THR di master
                payroll karyawan. THR otomatis: sesuai setting org (proportional / full month).
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Period"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
