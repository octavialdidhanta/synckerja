import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { ensureTaxConfigurationId } from "../lib/ensureTaxConfiguration";

interface CreatePayrollRunDialogProps {
  children?: React.ReactNode;
}

interface PayrollPeriod {
  id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  status: string;
}

export function CreatePayrollRunDialog({ children }: CreatePayrollRunDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { organization } = useCentralizedUserData();
  const organizationId = organization?.id ?? null;
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    run_name: "",
    payroll_period_id: "",
    run_date: new Date().toISOString().split("T")[0],
    calculation_method: "automatic",
    notes: "",
  });

  const { data: payrollPeriods } = useQuery({
    queryKey: ["payroll-periods-for-run", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("payroll_periods")
        .select("*")
        .eq("organization_id", organizationId)
        .in("status", ["draft", "approved"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PayrollPeriod[];
    },
    enabled: !!organizationId && open,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) {
      toast.error("Organization not found");
      return;
    }

    if (!formData.payroll_period_id) {
      toast.error("Please select a payroll period");
      return;
    }

    setIsLoading(true);
    try {
      const taxConfigId = await ensureTaxConfigurationId(organizationId);

      const { data: newPayrollRun, error } = await supabase
        .from("payroll_runs")
        .insert([
          {
            run_name: formData.run_name,
            payroll_period_id: formData.payroll_period_id,
            run_date: formData.run_date,
            calculation_method: formData.calculation_method,
            notes: formData.notes || null,
            organization_id: organizationId,
            status: "draft",
            tax_configuration_id: taxConfigId,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      if (newPayrollRun) {
        const { error: rpcError } = await supabase.rpc("calculate_payroll_run_totals", {
          run_id: newPayrollRun.id,
        });
        if (rpcError) {
          /* optional RPC — see supabase/PAYROLL_RPCS.md */
        }
      }

      toast.success("Payroll run created successfully");

      setFormData({
        run_name: "",
        payroll_period_id: "",
        run_date: new Date().toISOString().split("T")[0],
        calculation_method: "automatic",
        notes: "",
      });

      queryClient.invalidateQueries({ queryKey: ["payroll-runs-overview", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["payroll-runs", organizationId] });

      setOpen(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to create payroll run");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            New Payroll Run
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Payroll Run</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="run_name">Run Name</Label>
            <Input
              id="run_name"
              value={formData.run_name}
              onChange={(e) => handleInputChange("run_name", e.target.value)}
              placeholder="e.g., Regular Payroll January 2024"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payroll_period_id">Payroll Period</Label>
            <Select
              value={formData.payroll_period_id}
              onValueChange={(value) => handleInputChange("payroll_period_id", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a payroll period" />
              </SelectTrigger>
              <SelectContent>
                {payrollPeriods?.map((period) => (
                  <SelectItem key={period.id} value={period.id}>
                    {period.period_name} ({new Date(period.start_date).toLocaleDateString()} -{" "}
                    {new Date(period.end_date).toLocaleDateString()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="run_date">Run Date</Label>
              <Input
                id="run_date"
                type="date"
                value={formData.run_date}
                onChange={(e) => handleInputChange("run_date", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calculation_method">Calculation Method</Label>
              <Select
                value={formData.calculation_method}
                onValueChange={(value) => handleInputChange("calculation_method", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="automatic">Automatic</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              placeholder="Additional notes about this payroll run..."
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Payroll Run"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
