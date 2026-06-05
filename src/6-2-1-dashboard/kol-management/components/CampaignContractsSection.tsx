import { useState } from "react";
import { FileText, Plus } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useKOLContracts } from "../hooks/useKOLContracts";
import type { KOLCampaign } from "../hooks/useKOLCampaigns";
import CreateContractModal from "../modals/CreateContractModal";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  signed: "bg-green-100 text-green-800",
  active: "bg-emerald-100 text-emerald-800",
  completed: "bg-indigo-100 text-indigo-800",
  terminated: "bg-red-100 text-red-800",
};

interface CampaignContractsSectionProps {
  campaign: KOLCampaign;
}

export const CampaignContractsSection = ({ campaign }: CampaignContractsSectionProps) => {
  const { contracts, updateContractStatus } = useKOLContracts(campaign.id);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="border-t pt-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-medium text-gray-900">
          <FileText className="h-5 w-5" />
          Contracts
        </h3>
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Create
        </Button>
      </div>

      {contracts.length === 0 ? (
        <p className="text-sm text-gray-500">No contracts for this campaign yet.</p>
      ) : (
        <div className="space-y-2">
          {contracts.map((contract) => (
            <div
              key={contract.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{contract.contract_number}</p>
                <p className="text-xs text-gray-500">
                  {contract.kol_profile?.name || contract.kol_profile_id.slice(0, 8)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={statusColors[contract.status] || statusColors.draft}>
                  {contract.status}
                </Badge>
                <Select
                  value={contract.status}
                  onValueChange={(val) => updateContractStatus({ id: contract.id, status: val })}
                >
                  <SelectTrigger className="h-8 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["draft", "sent", "signed", "active", "completed", "terminated"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateContractModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        campaign={campaign}
      />
    </div>
  );
};
