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
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useKOLCampaigns } from "../hooks/useKOLCampaigns";

interface CreateCampaignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateCampaignModal = ({
  open,
  onOpenChange,
}: CreateCampaignModalProps) => {
  const { createCampaign } = useKOLCampaigns();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    budget: "",
    start_date: "",
    end_date: "",
    objectives: "",
    target_reach: "",
    target_engagement: "",
    target_conversion: "",
    status: "draft" as "draft" | "active" | "completed" | "cancelled",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;

    const campaignData = {
      ...formData,
      budget: formData.budget ? Number(formData.budget) : undefined,
      target_reach: formData.target_reach
        ? Number(formData.target_reach)
        : undefined,
      target_engagement: formData.target_engagement
        ? Number(formData.target_engagement)
        : undefined,
      target_conversion: formData.target_conversion
        ? Number(formData.target_conversion)
        : undefined,
    };

    try {
      await createCampaign.mutateAsync(campaignData as any);
      setFormData({
        name: "",
        description: "",
        budget: "",
        start_date: "",
        end_date: "",
        objectives: "",
        target_reach: "",
        target_engagement: "",
        target_conversion: "",
        status: "draft",
      });
      onOpenChange(false);
    } catch (error) {
      // error toast already handled in hook
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error("Error creating campaign:", error);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Campaign</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Campaign Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="Enter campaign name"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                handleInputChange("description", e.target.value)
              }
              placeholder="Describe your campaign"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="budget">Budget</Label>
              <Input
                id="budget"
                type="number"
                value={formData.budget}
                onChange={(e) => handleInputChange("budget", e.target.value)}
                placeholder="Campaign budget"
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  handleInputChange("status", value as any)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) =>
                  handleInputChange("start_date", e.target.value)
                }
              />
            </div>
            <div>
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) =>
                  handleInputChange("end_date", e.target.value)
                }
              />
            </div>
          </div>

          <div>
            <Label htmlFor="objectives">Campaign Objectives</Label>
            <Textarea
              id="objectives"
              value={formData.objectives}
              onChange={(e) =>
                handleInputChange("objectives", e.target.value)
              }
              placeholder="Define your campaign goals"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="target_reach">Target Reach</Label>
              <Input
                id="target_reach"
                type="number"
                value={formData.target_reach}
                onChange={(e) =>
                  handleInputChange("target_reach", e.target.value)
                }
                placeholder="Expected reach"
              />
            </div>
            <div>
              <Label htmlFor="target_engagement">Target Engagement (%)</Label>
              <Input
                id="target_engagement"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={formData.target_engagement}
                onChange={(e) =>
                  handleInputChange("target_engagement", e.target.value)
                }
                placeholder="e.g. 15.5"
              />
              <p className="mt-1 text-xs text-slate-500">
                Enter engagement rate as percentage (0-100%)
              </p>
            </div>
            <div>
              <Label htmlFor="target_conversion">Target Conversion</Label>
              <Input
                id="target_conversion"
                type="number"
                value={formData.target_conversion}
                onChange={(e) =>
                  handleInputChange("target_conversion", e.target.value)
                }
                placeholder="Expected conversions"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createCampaign.isPending}>
            {createCampaign.isPending ? "Creating..." : "Create Campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

