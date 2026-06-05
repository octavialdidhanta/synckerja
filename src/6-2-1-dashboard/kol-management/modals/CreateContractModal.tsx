import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useKOLContracts } from "../hooks/useKOLContracts";
import type { KOLCampaign } from "../hooks/useKOLCampaigns";
import { supabase } from "@/shared/lib/supabaseClient";

interface CreateContractModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: KOLCampaign;
  kolProfileId?: string | null;
  kolName?: string;
}

const CreateContractModal = ({
  open,
  onOpenChange,
  campaign,
  kolProfileId,
  kolName,
}: CreateContractModalProps) => {
  const { createContract } = useKOLContracts(campaign.id);
  const [selectedKolId, setSelectedKolId] = useState(kolProfileId || "");
  const [startDate, setStartDate] = useState(campaign.start_date?.split("T")[0] || "");
  const [endDate, setEndDate] = useState(campaign.end_date?.split("T")[0] || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open && kolProfileId) setSelectedKolId(kolProfileId);
  }, [open, kolProfileId]);

  const assignedKols =
    campaign.kol_campaign_assignments?.map((a) => a.kol_profile_id).filter(Boolean) || [];

  const handleSubmit = async () => {
    if (!selectedKolId) return;
    setIsSubmitting(true);
    try {
      const { data: paymentTerm } = await supabase
        .from("kol_payment_terms")
        .select("base_amount, bonus_amount, payment_model, performance_thresholds")
        .eq("campaign_id", campaign.id)
        .eq("kol_profile_id", selectedKolId)
        .eq("type", "agreement")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: deliverables } = await supabase
        .from("kol_campaign_deliverables")
        .select("deliverable_type, platform, quantity, total_price, description")
        .eq("campaign_id", campaign.id)
        .eq("kol_profile_id", selectedKolId);

      await createContract({
        campaign_id: campaign.id,
        kol_profile_id: selectedKolId,
        contract_start_date: startDate || null,
        contract_end_date: endDate || null,
        contract_terms: {
          campaign_name: campaign.name,
          base_amount: paymentTerm?.base_amount ?? 0,
          bonus_amount: paymentTerm?.bonus_amount ?? 0,
          payment_model: paymentTerm?.payment_model ?? "fixed",
        },
        kpi_metrics: paymentTerm?.performance_thresholds ?? {},
        deliverables: { items: deliverables ?? [] },
        content_requirements: { objectives: campaign.objectives ?? "" },
        status: "draft",
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Contract — {campaign.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>KOL</Label>
            {kolProfileId ? (
              <p className="mt-1 text-sm text-gray-700">{kolName || "Selected KOL"}</p>
            ) : (
              <Select value={selectedKolId} onValueChange={setSelectedKolId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select assigned KOL" />
                </SelectTrigger>
                <SelectContent>
                  {assignedKols.map((id) => (
                    <SelectItem key={id} value={id}>
                      {id.slice(0, 8)}…
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                className="mt-1"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                className="mt-1"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedKolId || isSubmitting}
            className="bg-brand-blue text-white hover:bg-brand-blue/90"
          >
            {isSubmitting ? "Creating…" : "Create Contract"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateContractModal;
