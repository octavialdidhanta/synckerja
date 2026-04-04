import { useState } from "react";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/shared/lib/supabaseClient";
import { useToast } from "@/shared/components/ui/use-toast";

interface RatesTabProps {
  rates: any[];
  setRates: (rates: any[]) => void;
  kolProfileId?: string;
}

const RatesTab = ({ rates, setRates, kolProfileId }: RatesTabProps) => {
  const { toast } = useToast();
  const [newRate, setNewRate] = useState({
    platform: "",
    content_type: "",
    rate_amount: "",
    currency: "IDR",
    rate_type: "per_post",
  });

  const addRate = () => {
    if (newRate.platform && newRate.content_type && newRate.rate_amount) {
      setRates([
        ...rates,
        {
          ...newRate,
          rate_amount: parseFloat(newRate.rate_amount),
          isNew: true,
        },
      ]);
      setNewRate({
        platform: "",
        content_type: "",
        rate_amount: "",
        currency: "IDR",
        rate_type: "per_post",
      });
    }
  };

  const removeRate = async (index: number) => {
    const rate = rates[index];
    const confirmed = window.confirm(
      `Are you sure you want to delete this rate?\n\n${rate.platform} - ${rate.content_type}\n${rate.currency} ${rate.rate_amount.toLocaleString()}`,
    );

    if (!confirmed) return;

    try {
      if (rate.id && kolProfileId && typeof rate.id === "string" && rate.id.length > 10) {
        const { error } = await supabase
          .from("kol_rates")
          .delete()
          .eq("id", rate.id);

        if (error) {
          console.error("Error deleting rate from database:", error);
          toast({
            title: "Error",
            description: "Failed to delete rate from database",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Success",
          description: "Rate deleted successfully",
        });
      }

      setRates(rates.filter((_, i) => i !== index));
    } catch (error) {
      console.error("Error in removeRate:", error);
      toast({
        title: "Error",
        description: "Failed to delete rate",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Rate Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Platform *</Label>
              <Select
                value={newRate.platform}
                onValueChange={(value) =>
                  setNewRate((prev) => ({ ...prev, platform: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="twitter">Twitter</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Content Type *</Label>
              <Select
                value={newRate.content_type}
                onValueChange={(value) =>
                  setNewRate((prev) => ({ ...prev, content_type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Content Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="post">Post</SelectItem>
                  <SelectItem value="story">Story</SelectItem>
                  <SelectItem value="reel">Reel/Short Video</SelectItem>
                  <SelectItem value="video">Long Video</SelectItem>
                  <SelectItem value="live">Live Stream</SelectItem>
                  <SelectItem value="review">Product Review</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Rate Amount *</Label>
              <Input
                type="number"
                value={newRate.rate_amount}
                onChange={(e) =>
                  setNewRate((prev) => ({
                    ...prev,
                    rate_amount: e.target.value,
                  }))
                }
                placeholder="500000"
              />
            </div>
            <div>
              <Label>Currency</Label>
              <Select
                value={newRate.currency}
                onValueChange={(value) =>
                  setNewRate((prev) => ({ ...prev, currency: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IDR">IDR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rate Type</Label>
              <Select
                value={newRate.rate_type}
                onValueChange={(value) =>
                  setNewRate((prev) => ({ ...prev, rate_type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_post">Per Post</SelectItem>
                  <SelectItem value="per_story">Per Story</SelectItem>
                  <SelectItem value="per_hour">Per Hour</SelectItem>
                  <SelectItem value="per_day">Per Day</SelectItem>
                  <SelectItem value="per_campaign">Per Campaign</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={addRate} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Rate
          </Button>
        </CardContent>
      </Card>

      {rates.length > 0 && (
        <div className="space-y-2">
          <Label className="text-base font-semibold">Added Rates</Label>
          {rates.map((rate, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="capitalize font-semibold">
                      {rate.platform} - {rate.content_type}
                    </div>
                    <div className="text-sm text-gray-600">
                      {rate.currency} {rate.rate_amount.toLocaleString()} (
                      {rate.rate_type.replace("_", " ")})
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRate(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default RatesTab;

