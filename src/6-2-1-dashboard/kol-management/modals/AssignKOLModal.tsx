import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Search, Users, CheckCircle, Settings } from "lucide-react";
import { useKOLProfiles } from "../hooks/useKOLProfiles";
import { useOptimizedKOLOperations } from "../hooks/useOptimizedKOLOperations";
import { useKOLCampaigns, type KOLCampaign } from "../hooks/useKOLCampaigns";
import { useToast } from "@/shared/components/ui/use-toast";
import DeliverableModal from "./DeliverableModal";

interface AssignKOLModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: KOLCampaign;
}

const AssignKOLModal = ({ open, onOpenChange, campaign }: AssignKOLModalProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedKOLs, setSelectedKOLs] = useState<string[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [deliverableModalOpen, setDeliverableModalOpen] = useState(false);
  const [selectedKOLForDeliverable, setSelectedKOLForDeliverable] = useState<any>(null);

  const { profiles: kolProfiles, loading: kolLoading } = useKOLProfiles();
  const { campaigns } = useKOLCampaigns();
  const { assignKOLToCampaign } = useOptimizedKOLOperations();
  const { toast } = useToast();

  const assignedKOLIds = useMemo(() => {
    const row =
      campaigns.find((c) => c.id === campaign.id) ?? campaign;
    return row.kol_campaign_assignments?.map((a) => a.kol_profile_id) ?? [];
  }, [campaigns, campaign]);

  const filteredKOLs = useMemo(
    () =>
      kolProfiles.filter((kol) => {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          kol.name.toLowerCase().includes(term) ||
          (kol.email?.toLowerCase().includes(term) || false);
        const isActive = kol.status === "active";
        return matchesSearch && isActive;
      }),
    [kolProfiles, searchTerm],
  );

  const handleKOLToggle = (kolId: string) => {
    setSelectedKOLs((prev) =>
      prev.includes(kolId) ? prev.filter((id) => id !== kolId) : [...prev, kolId],
    );
  };

  const handleSelectAll = () => {
    const availableKOLs = filteredKOLs
      .filter((kol) => !assignedKOLIds.includes(kol.id))
      .map((kol) => kol.id);

    setSelectedKOLs((prev) =>
      prev.length === availableKOLs.length ? [] : availableKOLs,
    );
  };

  const handleAssign = async () => {
    if (selectedKOLs.length === 0) return;

    setIsAssigning(true);
    try {
      for (const kolId of selectedKOLs) {
        // eslint-disable-next-line no-await-in-loop
        await assignKOLToCampaign.mutateAsync({
          campaignId: campaign.id,
          kolProfileId: kolId,
        });
      }
      setSelectedKOLs([]);
      toast({
        title: "Berhasil",
        description: `KOL berhasil ditugaskan ke kampanye "${campaign.name}".`,
      });
      onOpenChange(false);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error assigning KOLs:", error);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleAssignedKOLClick = (kol: any) => {
    setSelectedKOLForDeliverable(kol);
    setDeliverableModalOpen(true);
  };

  const handleDeliverableSet = () => {
    // placeholder hook for post-deliverable actions
  };

  const availableKOLs = filteredKOLs.filter((kol) => !assignedKOLIds.includes(kol.id));
  const assignedKOLs = filteredKOLs.filter((kol) => assignedKOLIds.includes(kol.id));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="flex max-h-[80vh] max-w-2xl flex-col"
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              Assign KOLs to Campaign
            </DialogTitle>
            <p className="truncate text-sm text-muted-foreground">{campaign.name}</p>
          </DialogHeader>

          <div className="flex-1 min-h-0 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
              <Input
                placeholder="Search KOLs by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>{availableKOLs.length} available</span>
              <span>{assignedKOLs.length} already assigned</span>
              <span>{selectedKOLs.length} selected</span>
            </div>

            {availableKOLs.length > 0 && (
              <div className="flex items-center space-x-2 border-b py-2">
                <Checkbox
                  id="select-all"
                  checked={selectedKOLs.length === availableKOLs.length}
                  onCheckedChange={handleSelectAll}
                />
                <label
                  htmlFor="select-all"
                  className="cursor-pointer text-sm font-medium"
                >
                  Select All Available ({availableKOLs.length})
                </label>
              </div>
            )}

            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-2">
                {kolLoading ? (
                  <div className="py-8 text-center text-muted-foreground">
                    Loading KOLs...
                  </div>
                ) : filteredKOLs.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No KOLs found
                  </div>
                ) : (
                  <>
                    {availableKOLs.map((kol) => (
                      <div
                        key={kol.id}
                        className="flex items-center space-x-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={selectedKOLs.includes(kol.id)}
                          onCheckedChange={() => handleKOLToggle(kol.id)}
                        />
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={kol.profile_photo_url} />
                          <AvatarFallback>
                            {kol.name
                              .split(" ")
                              .map((n: string) => n[0])
                              .join("")
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{kol.name}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {kol.email}
                          </p>
                          <div className="mt-1 flex gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {kol.category || "General"}
                            </Badge>
                            {kol.followers_count && (
                              <Badge variant="outline" className="text-xs">
                                {kol.followers_count.toLocaleString()} followers
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {assignedKOLs.length > 0 && (
                      <>
                        <div className="border-t py-2">
                          <p className="text-sm font-medium text-muted-foreground">
                            Already Assigned (Click to set deliverables)
                          </p>
                        </div>
                        {assignedKOLs.map((kol) => (
                          <div
                            key={kol.id}
                            className="flex cursor-pointer items-center space-x-3 rounded-lg border bg-muted/30 p-3 opacity-75 transition-all hover:bg-muted/50 hover:opacity-100"
                            onClick={() => handleAssignedKOLClick(kol)}
                          >
                            <div className="flex items-center space-x-2">
                              <CheckCircle className="h-5 w-5 text-green-600" />
                              <Settings className="h-4 w-4 text-purple-600" />
                            </div>
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={kol.profile_photo_url} />
                              <AvatarFallback>
                                {kol.name
                                  .split(" ")
                                  .map((n: string) => n[0])
                                  .join("")
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{kol.name}</p>
                              <p className="truncate text-sm text-muted-foreground">
                                {kol.email}
                              </p>
                              <div className="mt-1 flex gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  Assigned
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className="text-xs text-purple-600"
                                >
                                  Click to set deliverable
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={selectedKOLs.length === 0 || isAssigning}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isAssigning
                ? "Assigning..."
                : `Assign ${selectedKOLs.length} KOL${
                    selectedKOLs.length !== 1 ? "s" : ""
                  }`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedKOLForDeliverable && (
        <DeliverableModal
          open={deliverableModalOpen}
          onOpenChange={setDeliverableModalOpen}
          campaignId={campaign.id}
          kolProfile={selectedKOLForDeliverable}
          onDeliverableSet={handleDeliverableSet}
        />
      )}
    </>
  );
};

export default AssignKOLModal;

