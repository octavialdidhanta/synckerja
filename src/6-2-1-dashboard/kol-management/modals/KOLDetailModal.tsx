import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Badge } from "@/shared/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Save, Edit, X, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/shared/lib/supabaseClient";
import { useToast } from "@/shared/components/ui/use-toast";
import { useKOLProfiles } from "../hooks/useKOLProfiles";

interface KOLDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kolId: string | null;
}

interface KOLProfile {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  bio?: string;
  profile_photo_url?: string;
  category?: string;
  status: "active" | "inactive" | "blacklisted";
  location?: string;
  age?: number;
  gender?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  total_posts?: number;
}

interface SocialMediaAccount {
  id: string;
  kol_profile_id: string;
  platform: string;
  username: string;
  profile_url?: string;
  followers: number;
  engagement_rate: number;
  average_views: number;
  is_verified: boolean;
}

interface KOLRate {
  id: string;
  kol_profile_id: string;
  platform: string;
  content_type: string;
  rate_amount: number;
  currency: string;
  rate_type: string;
}

const KOLDetailModal = ({ open, onOpenChange, kolId }: KOLDetailModalProps) => {
  const [kolProfile, setKolProfile] = useState<KOLProfile | null>(null);
  const [socialAccounts, setSocialAccounts] = useState<SocialMediaAccount[]>([]);
  const [rates, setRates] = useState<KOLRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { socialAccounts: cachedSocialAccounts } = useKOLProfiles();

  useEffect(() => {
    if (open && kolId) {
      if (cachedSocialAccounts.length > 0) {
        const initialAccounts = cachedSocialAccounts.filter(
          (acc) => acc.kol_profile_id === kolId,
        ) as unknown as SocialMediaAccount[];
        if (initialAccounts.length > 0) {
          setSocialAccounts(initialAccounts);
        }
      }
      void fetchAllData();
    }
  }, [open, kolId, cachedSocialAccounts]);

  const fetchAllData = async () => {
    if (!kolId) return;

    setLoading(true);
    try {
      await Promise.all([fetchKOLProfile(kolId), fetchSocialAccounts(kolId), fetchRates(kolId)]);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error fetching KOL data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchKOLProfile = async (id: string) => {
    const { data, error } = await supabase.from("kol_profiles").select("*").eq("id", id).single();

    if (error) throw error;

    const typedProfile: KOLProfile = {
      ...data,
      status: data.status as "active" | "inactive" | "blacklisted",
    };

    setKolProfile(typedProfile);
  };

  const fetchSocialAccounts = async (id: string) => {
    const { data, error } = await supabase
      .from("kol_social_media_accounts")
      .select("*")
      .eq("kol_profile_id", id);

    if (error) throw error;
    setSocialAccounts(data || []);
  };

  const fetchRates = async (id: string) => {
    const { data, error } = await supabase.from("kol_rates").select("*").eq("kol_profile_id", id);

    if (error) throw error;
    setRates(data || []);
  };

  const handleSaveProfile = async () => {
    if (!kolProfile) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("kol_profiles")
        .update({
          name: kolProfile.name,
          email: kolProfile.email,
          phone: kolProfile.phone,
          bio: kolProfile.bio,
          category: kolProfile.category,
          status: kolProfile.status,
          location: kolProfile.location,
          age: kolProfile.age,
          gender: kolProfile.gender,
          notes: kolProfile.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", kolProfile.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "KOL profile updated successfully",
      });

      setIsEditing(false);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error updating KOL profile:", error);
      toast({
        title: "Error",
        description: "Failed to update KOL profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddSocialAccount = async () => {
    if (!kolId) return;

    const newAccount = {
      kol_profile_id: kolId,
      platform: "",
      username: "",
      profile_url: "",
      followers: 0,
      engagement_rate: 0,
      average_views: 0,
      is_verified: false,
    };

    const { data, error } = await supabase
      .from("kol_social_media_accounts")
      .insert([newAccount])
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add social media account",
        variant: "destructive",
      });
      return;
    }

    setSocialAccounts((prev) => [...prev, data]);
  };

  const handleUpdateSocialAccount = async (
    accountId: string,
    updates: Partial<SocialMediaAccount>,
  ) => {
    const { error } = await supabase
      .from("kol_social_media_accounts")
      .update(updates)
      .eq("id", accountId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update social media account",
        variant: "destructive",
      });
      return;
    }

    setSocialAccounts((prev) =>
      prev.map((account) => (account.id === accountId ? { ...account, ...updates } : account)),
    );
  };

  const handleDeleteSocialAccount = async (accountId: string) => {
    const { error } = await supabase
      .from("kol_social_media_accounts")
      .delete()
      .eq("id", accountId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete social media account",
        variant: "destructive",
      });
      return;
    }

    setSocialAccounts((prev) => prev.filter((account) => account.id !== accountId));
  };

  const handleAddRate = async () => {
    if (!kolId) return;

    const newRate = {
      kol_profile_id: kolId,
      platform: "",
      content_type: "",
      rate_amount: 0,
      currency: "IDR",
      rate_type: "per_post",
    };

    const { data, error } = await supabase.from("kol_rates").insert([newRate]).select().single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add rate",
        variant: "destructive",
      });
      return;
    }

    setRates((prev) => [...prev, data]);
  };

  const handleUpdateRate = async (rateId: string, updates: Partial<KOLRate>) => {
    const { error } = await supabase.from("kol_rates").update(updates).eq("id", rateId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update rate",
        variant: "destructive",
      });
      return;
    }

    setRates((prev) =>
      prev.map((rate) => (rate.id === rateId ? { ...rate, ...updates } : rate)),
    );
  };

  const handleDeleteRate = async (rateId: string) => {
    const { error } = await supabase.from("kol_rates").delete().eq("id", rateId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete rate",
        variant: "destructive",
      });
      return;
    }

    setRates((prev) => prev.filter((rate) => rate.id !== rateId));
  };

  if (loading || !kolProfile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[640px] w-[640px] max-h-[90vh] max-w-[90vw] flex-col overflow-hidden rounded-xl">
          <DialogHeader>
            <DialogTitle>Loading KOL details</DialogTitle>
            <DialogDescription>Fetching latest KOL profile information.</DialogDescription>
          </DialogHeader>
          <div className="flex h-24 items-center justify-center text-gray-500">Loading...</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[640px] w-[640px] max-h-[90vh] max-w-[90vw] flex-col overflow-hidden rounded-xl">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>KOL Profile Details</DialogTitle>
          <Button
            onClick={() => setIsEditing(!isEditing)}
            variant="outline"
            size="sm"
            type="button"
          >
            {isEditing ? <X className="mr-2 h-4 w-4" /> : <Edit className="mr-2 h-4 w-4" />}
            {isEditing ? "Cancel" : "Edit"}
          </Button>
        </DialogHeader>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="social">Social Media</TabsTrigger>
            <TabsTrigger value="rates">Rates</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="mb-6 flex items-center space-x-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={kolProfile.profile_photo_url} />
                    <AvatarFallback className="text-lg">
                      {kolProfile.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-semibold">{kolProfile.name}</h3>
                    <Badge variant={kolProfile.status === "active" ? "default" : "secondary"}>
                      {kolProfile.status}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Name</label>
                    {isEditing ? (
                      <Input
                        value={kolProfile.name}
                        onChange={(e) =>
                          setKolProfile({ ...kolProfile, name: e.target.value } as KOLProfile)
                        }
                      />
                    ) : (
                      <p className="mt-1">{kolProfile.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium">Email</label>
                    {isEditing ? (
                      <Input
                        value={kolProfile.email || ""}
                        onChange={(e) =>
                          setKolProfile({ ...kolProfile, email: e.target.value } as KOLProfile)
                        }
                        type="email"
                      />
                    ) : (
                      <p className="mt-1">{kolProfile.email || "-"}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium">Phone</label>
                    {isEditing ? (
                      <Input
                        value={kolProfile.phone || ""}
                        onChange={(e) =>
                          setKolProfile({ ...kolProfile, phone: e.target.value } as KOLProfile)
                        }
                      />
                    ) : (
                      <p className="mt-1">{kolProfile.phone || "-"}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium">Category</label>
                    {isEditing ? (
                      <Input
                        value={kolProfile.category || ""}
                        onChange={(e) =>
                          setKolProfile({ ...kolProfile, category: e.target.value } as KOLProfile)
                        }
                      />
                    ) : (
                      <p className="mt-1">{kolProfile.category || "-"}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium">Location</label>
                    {isEditing ? (
                      <Input
                        value={kolProfile.location || ""}
                        onChange={(e) =>
                          setKolProfile({ ...kolProfile, location: e.target.value } as KOLProfile)
                        }
                      />
                    ) : (
                      <p className="mt-1">{kolProfile.location || "-"}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium">Status</label>
                    {isEditing ? (
                      <Select
                        value={kolProfile.status}
                        onValueChange={(value: "active" | "inactive" | "blacklisted") =>
                          setKolProfile({ ...kolProfile, status: value } as KOLProfile)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="blacklisted">Blacklisted</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="mt-1 capitalize">{kolProfile.status}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium">Age</label>
                    {isEditing ? (
                      <Input
                        value={kolProfile.age ?? ""}
                        onChange={(e) =>
                          setKolProfile({
                            ...kolProfile,
                            age: Number.parseInt(e.target.value || "0", 10) || undefined,
                          } as KOLProfile)
                        }
                        type="number"
                      />
                    ) : (
                      <p className="mt-1">{kolProfile.age || "-"}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium">Gender</label>
                    {isEditing ? (
                      <Select
                        value={kolProfile.gender || ""}
                        onValueChange={(value) =>
                          setKolProfile({ ...kolProfile, gender: value } as KOLProfile)
                        }
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
                    ) : (
                      <p className="mt-1 capitalize">{kolProfile.gender || "-"}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Bio</label>
                  {isEditing ? (
                    <Textarea
                      value={kolProfile.bio || ""}
                      onChange={(e) =>
                        setKolProfile({ ...kolProfile, bio: e.target.value } as KOLProfile)
                      }
                      rows={3}
                    />
                  ) : (
                    <p className="mt-1">{kolProfile.bio || "-"}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium">Notes</label>
                  {isEditing ? (
                    <Textarea
                      value={kolProfile.notes || ""}
                      onChange={(e) =>
                        setKolProfile({ ...kolProfile, notes: e.target.value } as KOLProfile)
                      }
                      rows={3}
                    />
                  ) : (
                    <p className="mt-1">{kolProfile.notes || "-"}</p>
                  )}
                </div>

                {isEditing && (
                  <div className="flex justify-end">
                    <Button type="button" onClick={handleSaveProfile} disabled={saving}>
                      <Save className="mr-2 h-4 w-4" />
                      {saving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="social" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Social Media Accounts</CardTitle>
                <Button
                  type="button"
                  onClick={handleAddSocialAccount}
                  size="sm"
                  disabled={!isEditing}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Account
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {socialAccounts.map((account) => (
                    <Card key={account.id} className="p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium">Platform</label>
                          <Input
                            disabled={!isEditing}
                            value={account.platform}
                            onChange={(e) =>
                              handleUpdateSocialAccount(account.id, {
                                platform: e.target.value,
                              })
                            }
                            placeholder="Instagram, TikTok, etc."
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Username</label>
                          <Input
                            disabled={!isEditing}
                            value={account.username}
                            onChange={(e) =>
                              handleUpdateSocialAccount(account.id, {
                                username: e.target.value,
                              })
                            }
                            placeholder="@username"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Profile URL</label>
                          <Input
                            disabled={!isEditing}
                            value={account.profile_url || ""}
                            onChange={(e) =>
                              handleUpdateSocialAccount(account.id, {
                                profile_url: e.target.value,
                              })
                            }
                            placeholder="https://..."
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Followers</label>
                          <Input
                            disabled={!isEditing}
                            type="number"
                            value={account.followers}
                            onChange={(e) =>
                              handleUpdateSocialAccount(account.id, {
                                followers: Number.parseInt(e.target.value || "0", 10),
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Engagement Rate (%)</label>
                          <Input
                            disabled={!isEditing}
                            type="number"
                            step="0.1"
                            value={account.engagement_rate}
                            onChange={(e) =>
                              handleUpdateSocialAccount(account.id, {
                                engagement_rate: Number.parseFloat(e.target.value || "0"),
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Average Views</label>
                          <Input
                            disabled={!isEditing}
                            type="number"
                            value={account.average_views}
                            onChange={(e) =>
                              handleUpdateSocialAccount(account.id, {
                                average_views: Number.parseInt(e.target.value || "0", 10),
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            disabled={!isEditing}
                            checked={account.is_verified}
                            onChange={(e) =>
                              handleUpdateSocialAccount(account.id, {
                                is_verified: e.target.checked,
                              })
                            }
                          />
                          <span className="text-sm">Verified Account</span>
                        </label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteSocialAccount(account.id)}
                          disabled={!isEditing}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </Card>
                  ))}
                  {socialAccounts.length === 0 && (
                    <p className="py-8 text-center text-gray-500">
                      No social media accounts added yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rates" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Rate Information</CardTitle>
                <Button
                  type="button"
                  onClick={handleAddRate}
                  size="sm"
                  disabled={!isEditing}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Rate
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {rates.map((rate) => (
                    <Card key={rate.id} className="p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium">Platform</label>
                          <Input
                            disabled={!isEditing}
                            value={rate.platform}
                            onChange={(e) =>
                              handleUpdateRate(rate.id, { platform: e.target.value })
                            }
                            placeholder="Instagram, TikTok, etc."
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Content Type</label>
                          <Input
                            disabled={!isEditing}
                            value={rate.content_type}
                            onChange={(e) =>
                              handleUpdateRate(rate.id, { content_type: e.target.value })
                            }
                            placeholder="Post, Story, Reel, etc."
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Rate Amount</label>
                          <Input
                            disabled={!isEditing}
                            type="number"
                            value={rate.rate_amount}
                            onChange={(e) =>
                              handleUpdateRate(rate.id, {
                                rate_amount: Number.parseFloat(e.target.value || "0"),
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Currency</label>
                          <Select
                            value={rate.currency}
                            onValueChange={(value) =>
                              handleUpdateRate(rate.id, { currency: value })
                            }
                            disabled={!isEditing}
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
                          <label className="text-sm font-medium">Rate Type</label>
                          <Select
                            value={rate.rate_type}
                            onValueChange={(value) =>
                              handleUpdateRate(rate.id, { rate_type: value })
                            }
                            disabled={!isEditing}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="per_post">Per Post</SelectItem>
                              <SelectItem value="per_story">Per Story</SelectItem>
                              <SelectItem value="per_campaign">Per Campaign</SelectItem>
                              <SelectItem value="per_month">Per Month</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteRate(rate.id)}
                            disabled={!isEditing}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                  {rates.length === 0 && (
                    <p className="py-8 text-center text-gray-500">No rates added yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default KOLDetailModal;

