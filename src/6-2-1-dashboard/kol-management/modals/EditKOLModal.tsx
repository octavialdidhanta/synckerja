import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { X, Plus } from "lucide-react";
import { useToast } from "@/shared/components/ui/use-toast";
import { useKOLProfileOperations } from "../hooks/useKOLProfileOperations";
import { useKOLProfiles } from "../hooks/useKOLProfiles";
import { supabase } from "@/shared/lib/supabaseClient";

interface EditKOLModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kolId: string | null;
}

interface SocialAccount {
  id?: string;
  platform: string;
  username: string;
  followers: number;
  engagement_rate: number;
}

export const EditKOLModal = ({ open, onOpenChange, kolId }: EditKOLModalProps) => {
  const { toast } = useToast();
  const { profiles, socialAccounts } = useKOLProfiles();

  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    age: "",
    gender: "",
    category: "",
    bio: "",
    status: "",
    rate_range: "",
  });

  const [socialData, setSocialData] = useState<SocialAccount[]>([]);

  const currentKOL = profiles.find((p) => p.id === kolId);
  const currentSocialAccounts = socialAccounts.filter((acc) => acc.kol_profile_id === kolId);

  useEffect(() => {
    if (open && currentKOL) {
      setFormData({
        name: currentKOL.name || "",
        email: currentKOL.email || "",
        phone: currentKOL.phone || "",
        age: currentKOL.age?.toString() || "",
        gender: currentKOL.gender || "",
        category: currentKOL.category || "",
        bio: currentKOL.bio || "",
        status: (currentKOL.status as string) || "active",
        rate_range: "",
      });

      setSocialData(
        currentSocialAccounts.map((acc) => ({
          id: acc.id,
          platform: acc.platform,
          username: acc.username,
          followers: acc.followers || 0,
          engagement_rate: acc.engagement_rate || 0,
        })),
      );
    }
  }, [open, currentKOL, currentSocialAccounts]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSocialAccountChange = (index: number, field: string, value: string | number) => {
    setSocialData((prev) =>
      prev.map((account, i) => (i === index ? { ...account, [field]: value } : account)),
    );
  };

  const addSocialAccount = () => {
    setSocialData((prev) => [
      ...prev,
      {
        platform: "Instagram",
        username: "",
        followers: 0,
        engagement_rate: 0,
      },
    ]);
  };

  const removeSocialAccount = async (index: number) => {
    const account = socialData[index];

    if (account.id) {
      const { error } = await supabase
        .from("kol_social_media_accounts")
        .delete()
        .eq("id", account.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to delete social account",
          variant: "destructive",
        });
        return;
      }
    }

    setSocialData((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kolId || !currentKOL) return;

    setIsLoading(true);

    try {
      await supabase
        .from("kol_profiles")
        .update({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          age: formData.age ? parseInt(formData.age, 10) : null,
          gender: formData.gender,
          category: formData.category,
          bio: formData.bio,
          status: formData.status || "active",
        })
        .eq("id", kolId);

      for (const account of socialData) {
        if (account.id) {
          const { error } = await supabase
            .from("kol_social_media_accounts")
            .update({
              platform: account.platform,
              username: account.username,
              followers: account.followers,
              engagement_rate: account.engagement_rate,
            })
            .eq("id", account.id);

          if (error) throw error;
        } else {
          const { error } = await supabase.from("kol_social_media_accounts").insert({
            kol_profile_id: kolId,
            platform: account.platform,
            username: account.username,
            followers: account.followers,
            engagement_rate: account.engagement_rate,
          });

          if (error) throw error;
        }
      }

      toast({
        title: "Success",
        description: "KOL profile updated successfully",
      });

      onOpenChange(false);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error updating KOL:", error);
      toast({
        title: "Error",
        description: "Failed to update KOL profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentKOL) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit KOL Profile</DialogTitle>
          <DialogDescription>Update basic info and social media accounts for this KOL.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  value={formData.age}
                  onChange={(e) => handleInputChange("age", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) => handleInputChange("gender", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => handleInputChange("category", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleInputChange("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="blacklisted">Blacklisted</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => handleInputChange("bio", e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Social Media Accounts</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addSocialAccount}>
                <Plus className="mr-2 h-4 w-4" />
                Add Account
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {socialData.map((account, index) => (
                <div
                  key={account.id ?? index}
                  className="grid grid-cols-1 gap-4 rounded-lg border p-4 md:grid-cols-5"
                >
                  <div>
                    <Label>Platform</Label>
                    <Select
                      value={account.platform}
                      onValueChange={(value) =>
                        handleSocialAccountChange(index, "platform", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Instagram">Instagram</SelectItem>
                        <SelectItem value="TikTok">TikTok</SelectItem>
                        <SelectItem value="YouTube">YouTube</SelectItem>
                        <SelectItem value="Twitter">Twitter</SelectItem>
                        <SelectItem value="Facebook">Facebook</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Username</Label>
                    <Input
                      value={account.username}
                      onChange={(e) =>
                        handleSocialAccountChange(index, "username", e.target.value)
                      }
                      placeholder="@username"
                    />
                  </div>

                  <div>
                    <Label>Followers</Label>
                    <Input
                      type="number"
                      value={account.followers}
                      onChange={(e) =>
                        handleSocialAccountChange(
                          index,
                          "followers",
                          Number.parseInt(e.target.value || "0", 10),
                        )
                      }
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <Label>Engagement Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={account.engagement_rate}
                      onChange={(e) =>
                        handleSocialAccountChange(
                          index,
                          "engagement_rate",
                          Number.parseFloat(e.target.value || "0"),
                        )
                      }
                      placeholder="0.0"
                    />
                  </div>

                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeSocialAccount(index)}
                      className="w-full"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {socialData.length === 0 && (
                <div className="py-8 text-center text-muted-foreground">
                  No social media accounts added. Click &quot;Add Account&quot; to get started.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Updating..." : "Update KOL Profile"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditKOLModal;

