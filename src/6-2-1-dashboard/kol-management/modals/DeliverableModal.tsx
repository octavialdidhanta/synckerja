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
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { Package } from "lucide-react";
import { supabase } from "@/shared/lib/supabaseClient";
import { useToast } from "@/shared/components/ui/use-toast";
import {
  KOL_CONTENT_PLATFORM_OPTIONS,
  KOL_CONTENT_TYPE_OPTIONS,
} from "@/shared/constants/kolContentPostOptions";

interface KOLProfile {
  id: string;
  name: string;
  email?: string;
  profile_photo_url?: string;
  category?: string;
  followers_count?: number;
}

interface DeliverableModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  organizationId: string;
  kolProfile: KOLProfile;
  onDeliverableSet: () => void;
}

const DeliverableModal = ({
  open,
  onOpenChange,
  campaignId,
  organizationId,
  kolProfile,
  onDeliverableSet,
}: DeliverableModalProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    deliverable_type: "",
    platform: "",
    quantity: 1,
    description: "",
    due_date: "",
    status: "pending" as const,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.deliverable_type || !formData.platform) {
      toast({
        title: "Error",
        description: "Content type dan platform wajib diisi",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("kol_campaign_deliverables").insert({
        campaign_id: campaignId,
        kol_profile_id: kolProfile.id,
        deliverable_type: formData.deliverable_type,
        content_type: formData.deliverable_type,
        platform: formData.platform,
        quantity: formData.quantity,
        description: formData.description || null,
        due_date: formData.due_date || null,
        status: formData.status,
        organization_id: organizationId,
      });

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Deliverable berhasil disimpan",
      });

      onDeliverableSet();
      onOpenChange(false);
      setFormData({
        deliverable_type: "",
        platform: "",
        quantity: 1,
        description: "",
        due_date: "",
        status: "pending",
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : String((err as { message?: string })?.message || err);
      toast({
        title: "Gagal menyimpan deliverable",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-purple-600" />
            Set Deliverable Requirements
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center space-x-3 rounded-lg border bg-muted/20 p-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={kolProfile.profile_photo_url} />
              <AvatarFallback>
                {kolProfile.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-semibold">{kolProfile.name}</h3>
              <p className="text-sm text-muted-foreground">{kolProfile.email}</p>
              <div className="mt-1 flex gap-2">
                <Badge variant="secondary" className="text-xs">
                  {kolProfile.category || "General"}
                </Badge>
                {kolProfile.followers_count ? (
                  <Badge variant="outline" className="text-xs">
                    {kolProfile.followers_count.toLocaleString()} followers
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="content_type">Content Type *</Label>
                <Select
                  value={formData.deliverable_type}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, deliverable_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select content type" />
                  </SelectTrigger>
                  <SelectContent>
                    {KOL_CONTENT_TYPE_OPTIONS.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="platform">Platform *</Label>
                <Select
                  value={formData.platform}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, platform: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {KOL_CONTENT_PLATFORM_OPTIONS.map((platform) => (
                      <SelectItem key={platform.value} value={platform.value}>
                        {platform.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      quantity: Number.parseInt(e.target.value, 10) || 1,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, due_date: e.target.value }))
                  }
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={3}
                placeholder="Describe the deliverable requirements..."
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.deliverable_type || !formData.platform}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isSubmitting ? "Creating..." : "Set Deliverable"}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeliverableModal;
