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
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Plus, Trash2, CheckCircle } from "lucide-react";
import { supabase } from "@/shared/lib/supabaseClient";
import { useToast } from "@/shared/components/ui/use-toast";

interface SocialMediaTabProps {
  socialAccounts: any[];
  setSocialAccounts: (accounts: any[]) => void;
  kolProfileId?: string;
}

const SocialMediaTab = ({
  socialAccounts,
  setSocialAccounts,
  kolProfileId,
}: SocialMediaTabProps) => {
  const [newAccount, setNewAccount] = useState({
    platform: "",
    username: "",
    profile_url: "",
    followers: "",
    engagement_rate: "",
    average_views: "",
    is_verified: false,
  });

  const { toast } = useToast();

  const addSocialAccount = async () => {
    if (!newAccount.platform || !newAccount.username) return;

    const prepared: any = {
      ...newAccount,
      followers: parseInt(newAccount.followers) || 0,
      engagement_rate: parseFloat(newAccount.engagement_rate) || 0,
      average_views: parseInt(newAccount.average_views) || 0,
    };

    try {
      if (kolProfileId) {
        const { data, error } = await supabase
          .from("kol_social_media_accounts")
          .insert({
            kol_profile_id: kolProfileId,
            platform: prepared.platform,
            username: prepared.username,
            profile_url: prepared.profile_url || null,
            followers: prepared.followers,
            engagement_rate: prepared.engagement_rate,
            average_views: prepared.average_views,
            is_verified: prepared.is_verified || false,
          })
          .select("id")
          .single();
        if (error) throw error;
        prepared.id = data?.id;
        toast({
          title: "Social account added",
          description: `${prepared.platform} @${prepared.username}`,
        });
      } else {
        prepared.id = Date.now();
      }

      setSocialAccounts([...socialAccounts, prepared]);
      setNewAccount({
        platform: "",
        username: "",
        profile_url: "",
        followers: "",
        engagement_rate: "",
        average_views: "",
        is_verified: false,
      });
    } catch (err: any) {
      console.error("Failed to add social account", err);
      toast({
        title: "Error",
        description: "Gagal menambah akun sosial.",
        variant: "destructive",
      });
    }
  };

  const removeSocialAccount = async (index: number) => {
    try {
      const account = socialAccounts[index];
      if (kolProfileId && account?.id && typeof account.id === "string") {
        const { error } = await supabase
          .from("kol_social_media_accounts")
          .delete()
          .eq("id", account.id);
        if (error) throw error;
      }
    } catch (err) {
      console.error("Failed to remove social account", err);
    } finally {
      setSocialAccounts(socialAccounts.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Social Media Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Platform *</Label>
              <Select
                value={newAccount.platform}
                onValueChange={(value) =>
                  setNewAccount((prev) => ({ ...prev, platform: value }))
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
              <Label>Username *</Label>
              <Input
                value={newAccount.username}
                onChange={(e) =>
                  setNewAccount((prev) => ({
                    ...prev,
                    username: e.target.value,
                  }))
                }
                placeholder="@username"
              />
            </div>
          </div>

          <div>
            <Label>Profile URL</Label>
            <Input
              value={newAccount.profile_url}
              onChange={(e) =>
                setNewAccount((prev) => ({
                  ...prev,
                  profile_url: e.target.value,
                }))
              }
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Followers</Label>
              <Input
                type="number"
                value={newAccount.followers}
                onChange={(e) =>
                  setNewAccount((prev) => ({
                    ...prev,
                    followers: e.target.value,
                  }))
                }
                placeholder="10000"
              />
            </div>
            <div>
              <Label>Engagement Rate (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={newAccount.engagement_rate}
                onChange={(e) =>
                  setNewAccount((prev) => ({
                    ...prev,
                    engagement_rate: e.target.value,
                  }))
                }
                placeholder="5.2"
              />
            </div>
            <div>
              <Label>Average Views</Label>
              <Input
                type="number"
                value={newAccount.average_views}
                onChange={(e) =>
                  setNewAccount((prev) => ({
                    ...prev,
                    average_views: e.target.value,
                  }))
                }
                placeholder="50000"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_verified"
              checked={newAccount.is_verified}
              onCheckedChange={(checked) =>
                setNewAccount((prev) => ({
                  ...prev,
                  is_verified: !!checked,
                }))
              }
            />
            <Label
              htmlFor="is_verified"
              className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              <CheckCircle className="h-4 w-4 text-blue-600" />
              Verified Account
            </Label>
          </div>

          <Button onClick={addSocialAccount} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Social Media Account
          </Button>
        </CardContent>
      </Card>

      {socialAccounts.length > 0 && (
        <div className="space-y-2">
          <Label className="text-base font-semibold">
            Added Social Media Accounts
          </Label>
          {socialAccounts.map((account, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 capitalize font-semibold">
                      {account.platform}
                      {account.is_verified && (
                        <CheckCircle className="h-4 w-4 text-blue-600" />
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      @{account.username}
                    </div>
                    <div className="text-xs text-gray-500">
                      {account.followers.toLocaleString()} followers •{" "}
                      {account.engagement_rate}% engagement
                      {account.is_verified && " • Verified"}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSocialAccount(index)}
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

export default SocialMediaTab;

