import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Star } from "lucide-react";
import { supabase } from "@/shared/lib/supabaseClient";
import { useToast } from "@/shared/components/ui/use-toast";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useKOLCampaigns } from "../hooks/useKOLCampaigns";

interface KOLRatingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  kolId: string;
  kolName: string;
}

const StarRating = ({
  rating,
  onRatingChange,
}: {
  rating: number;
  onRatingChange: (rating: number) => void;
}) => {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-5 w-5 cursor-pointer ${
            star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
          }`}
          onClick={() => onRatingChange(star)}
        />
      ))}
    </div>
  );
};

export const KOLRatingsModal = ({ isOpen, onClose, kolId, kolName }: KOLRatingsModalProps) => {
  const { toast } = useToast();
  const { organizationId } = useCurrentOrg();
  const { campaigns, isLoading: campaignsLoading } = useKOLCampaigns();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    overall_rating: 5,
    professionalism_rating: 5,
    communication_rating: 5,
    content_quality_rating: 5,
    audience_engagement_rating: 5,
    brand_alignment_rating: 5,
    adherence_to_brief_rating: 5,
    roi_rating: 5,
    satisfaction_rating: 5,
    feedback: "",
    collaboration_highlights: "",
    areas_for_improvement: "",
    would_collaborate_again: true,
  });

  const [campaignId, setCampaignId] = useState("no-campaign");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organizationId) {
      toast({
        title: "Error",
        description: "Organization not found",
        variant: "destructive",
      });
      return;
    }

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        // eslint-disable-next-line no-console
        console.error("Session error:", sessionError);
        toast({
          title: "Authentication Error",
          description: "Please refresh the page and try again",
          variant: "destructive",
        });
        return;
      }

      if (!session?.user) {
        toast({
          title: "Error",
          description: "You must be logged in to submit a rating",
          variant: "destructive",
        });
        return;
      }

      const ratingData = {
        // Hitung overall_rating sebagai rata-rata semua dimensi,
        // lalu bulatkan ke INTEGER 1–5 (kolom di DB bertipe integer).
        overall_rating: (() => {
          const scores = [
            formData.professionalism_rating,
            formData.communication_rating,
            formData.content_quality_rating,
            formData.audience_engagement_rating,
            formData.brand_alignment_rating,
            formData.adherence_to_brief_rating,
            formData.roi_rating,
            formData.satisfaction_rating,
          ].filter((v) => typeof v === "number" && !Number.isNaN(v));
          if (scores.length === 0) return formData.overall_rating || 0;
          const avg = scores.reduce((sum, v) => sum + v, 0) / scores.length;
          const rounded = Math.round(avg);
          return Math.min(5, Math.max(1, rounded));
        })(),
        kol_profile_id: kolId,
        organization_id: organizationId,
        campaign_id: campaignId === "no-campaign" ? null : campaignId,
        professionalism_rating: formData.professionalism_rating,
        communication_rating: formData.communication_rating,
        content_quality_rating: formData.content_quality_rating,
        audience_engagement_rating: formData.audience_engagement_rating,
        brand_alignment_rating: formData.brand_alignment_rating,
        adherence_to_brief_rating: formData.adherence_to_brief_rating,
        roi_rating: formData.roi_rating,
        satisfaction_rating: formData.satisfaction_rating,
        feedback: formData.feedback,
        collaboration_highlights: formData.collaboration_highlights,
        areas_for_improvement: formData.areas_for_improvement,
        would_collaborate_again: formData.would_collaborate_again,
        rated_by: session.user.id,
      };

      // Cek apakah user ini sudah pernah memberi rating untuk KOL ini
      const {
        data: existingRatings,
        error: existingError,
      } = await supabase
        .from("kol_ratings")
        .select("id")
        .eq("kol_profile_id", kolId)
        .eq("organization_id", organizationId)
        .eq("rated_by", session.user.id);

      if (existingError) {
        // eslint-disable-next-line no-console
        console.error("Error checking existing rating:", existingError);
        toast({
          title: "Error",
          description: `Failed to check existing rating: ${existingError.message}`,
          variant: "destructive",
        });
        return;
      }

      const existingId =
        Array.isArray(existingRatings) && existingRatings.length > 0
          ? existingRatings[0]?.id
          : null;

      const mutation = existingId
        ? supabase
            .from("kol_ratings")
            .update(ratingData)
            .eq("id", existingId)
            .select()
            .single()
        : supabase
            .from("kol_ratings")
            .insert(ratingData)
            .select()
            .single();

      const { data, error } = await mutation;

      if (error) {
        // eslint-disable-next-line no-console
        console.error("Error adding rating:", error);
        toast({
          title: "Error",
          description: `Failed to add rating: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Rating added successfully",
      });

      // Selalu ambil data rating terbaru dari server setelah submit
      if (organizationId) {
        await queryClient.invalidateQueries(["kol-ratings", organizationId]);
      }

      onClose();

      setFormData({
        overall_rating: 5,
        professionalism_rating: 5,
        communication_rating: 5,
        content_quality_rating: 5,
        audience_engagement_rating: 5,
        brand_alignment_rating: 5,
        adherence_to_brief_rating: 5,
        roi_rating: 5,
        satisfaction_rating: 5,
        feedback: "",
        collaboration_highlights: "",
        areas_for_improvement: "",
        would_collaborate_again: true,
      });
      setCampaignId("no-campaign");
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error adding rating:", error);
      toast({
        title: "Error",
        description: "Failed to add rating. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rate KOL: {kolName}</DialogTitle>
          <DialogDescription>Give structured feedback and ratings for this collaboration.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="campaign_id">Campaign (Optional)</Label>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    campaignsLoading ? "Loading campaigns..." : "Select a campaign or leave empty"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no-campaign">No Campaign</SelectItem>
                {campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <div>
              <Label>Overall Rating</Label>
              <StarRating
                rating={formData.overall_rating}
                onRatingChange={(rating) =>
                  setFormData((prev) => ({ ...prev, overall_rating: rating }))
                }
              />
            </div>

            <div>
              <Label>Professionalism</Label>
              <StarRating
                rating={formData.professionalism_rating}
                onRatingChange={(rating) =>
                  setFormData((prev) => ({ ...prev, professionalism_rating: rating }))
                }
              />
            </div>

            <div>
              <Label>Communication</Label>
              <StarRating
                rating={formData.communication_rating}
                onRatingChange={(rating) =>
                  setFormData((prev) => ({ ...prev, communication_rating: rating }))
                }
              />
            </div>

            <div>
              <Label>Content Quality</Label>
              <StarRating
                rating={formData.content_quality_rating}
                onRatingChange={(rating) =>
                  setFormData((prev) => ({ ...prev, content_quality_rating: rating }))
                }
              />
            </div>

            <div>
              <Label>Audience Engagement</Label>
              <StarRating
                rating={formData.audience_engagement_rating}
                onRatingChange={(rating) =>
                  setFormData((prev) => ({ ...prev, audience_engagement_rating: rating }))
                }
              />
            </div>

            <div>
              <Label>Brand Alignment</Label>
              <StarRating
                rating={formData.brand_alignment_rating}
                onRatingChange={(rating) =>
                  setFormData((prev) => ({ ...prev, brand_alignment_rating: rating }))
                }
              />
            </div>

            <div>
              <Label>Adherence to Brief</Label>
              <StarRating
                rating={formData.adherence_to_brief_rating}
                onRatingChange={(rating) =>
                  setFormData((prev) => ({ ...prev, adherence_to_brief_rating: rating }))
                }
              />
            </div>
          </div>

          <div>
            <Label>ROI Rating</Label>
            <RadioGroup
              value={formData.roi_rating.toString()}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, roi_rating: Number.parseInt(value, 10) }))
              }
              className="flex flex-row gap-4"
            >
              {["1", "2", "3", "4", "5"].map((value) => (
                <div key={value} className="flex items-center space-x-2">
                  <RadioGroupItem value={value} id={`roi-${value}`} />
                  <Label htmlFor={`roi-${value}`}>{value}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label>Satisfaction Rating</Label>
            <RadioGroup
              value={formData.satisfaction_rating.toString()}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  satisfaction_rating: Number.parseInt(value, 10),
                }))
              }
              className="flex flex-row gap-4"
            >
              {["1", "2", "3", "4", "5"].map((value) => (
                <div key={value} className="flex items-center space-x-2">
                  <RadioGroupItem value={value} id={`satisfaction-${value}`} />
                  <Label htmlFor={`satisfaction-${value}`}>{value}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="feedback">General Feedback</Label>
            <Textarea
              id="feedback"
              value={formData.feedback}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, feedback: e.target.value }))
              }
              placeholder="Provide general feedback about the collaboration"
            />
          </div>

          <div>
            <Label htmlFor="collaboration_highlights">Collaboration Highlights</Label>
            <Textarea
              id="collaboration_highlights"
              value={formData.collaboration_highlights}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  collaboration_highlights: e.target.value,
                }))
              }
              placeholder="What went well in this collaboration?"
            />
          </div>

          <div>
            <Label htmlFor="areas_for_improvement">Areas for Improvement</Label>
            <Textarea
              id="areas_for_improvement"
              value={formData.areas_for_improvement}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  areas_for_improvement: e.target.value,
                }))
              }
              placeholder="What could be improved in future collaborations?"
            />
          </div>

          <div>
            <Label>Would you collaborate again?</Label>
            <RadioGroup
              value={formData.would_collaborate_again.toString()}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  would_collaborate_again: value === "true",
                }))
              }
              className="flex flex-row gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="true" id="collaborate-yes" />
                <Label htmlFor="collaborate-yes">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="false" id="collaborate-no" />
                <Label htmlFor="collaborate-no">No</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Submit Rating</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

