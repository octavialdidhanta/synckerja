import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import { Progress } from "@/shared/components/ui/progress";
import { useToast } from "@/shared/components/ui/use-toast";
import { supabase } from "@/shared/lib/supabaseClient";
import { useKOLProfiles } from "../hooks/useKOLProfiles";
import BasicInfoTab from "./AddKOLModal/BasicInfoTab";
import SocialMediaTab from "./AddKOLModal/SocialMediaTab";
import RatesTab from "./AddKOLModal/RatesTab";
import PhotoPortfolioTab from "./AddKOLModal/PhotoPortfolioTab";

interface EnhancedAddKOLModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EnhancedAddKOLModal = ({
  open,
  onOpenChange,
}: EnhancedAddKOLModalProps) => {
  const { createProfile } = useKOLProfiles();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    bio: "",
    category: "",
    location: "",
    age: "",
    gender: "",
    notes: "",
    status: "active" as "active" | "inactive" | "blacklisted",
    profile_photo_url: undefined as string | undefined,
    website: "",
    languages: "",
    specialties: "",
    niche: "",
    communication_method: "",
  });

  const [socialAccounts, setSocialAccounts] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      bio: "",
      category: "",
      location: "",
      age: "",
      gender: "",
      notes: "",
      status: "active",
      profile_photo_url: undefined,
      website: "",
      languages: "",
      specialties: "",
      niche: "",
      communication_method: "",
    });
    setSocialAccounts([]);
    setRates([]);
    setActiveTab("basic");
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      toast({
        title: "Error",
        description: "Name is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const profile = await createProfile({
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        bio: formData.bio || undefined,
        category: formData.category || undefined,
        location: formData.location || undefined,
        age: formData.age ? parseInt(formData.age) : undefined,
        gender: formData.gender || undefined,
        notes: formData.notes || undefined,
        status: formData.status,
        profile_photo_url: formData.profile_photo_url,
        website_url: formData.website || undefined,
        languages_spoken: formData.languages || undefined,
        niche: formData.niche || undefined,
        specialties: formData.specialties || undefined,
        preferred_communication: formData.communication_method || undefined,
        followers_count: undefined,
        engagement_rate: undefined,
        average_views: undefined,
        total_posts: undefined,
      } as any);

      if (!profile) {
        throw new Error("Failed to create KOL profile");
      }

      for (const account of socialAccounts) {
        await supabase.from("kol_social_media_accounts").insert({
          kol_profile_id: profile.id,
          platform: account.platform,
          username: account.username,
          profile_url: account.profile_url || null,
          followers: account.followers || 0,
          engagement_rate: account.engagement_rate || 0,
          average_views: account.average_views || 0,
          is_verified: account.is_verified || false,
        });
      }

      for (const rate of rates) {
        await supabase.from("kol_rates").insert({
          kol_profile_id: profile.id,
          platform: rate.platform,
          content_type: rate.content_type,
          rate_amount: rate.rate_amount,
          currency: rate.currency,
          rate_type: rate.rate_type,
        });
      }

      resetForm();
      onOpenChange(false);

      queryClient.invalidateQueries({ queryKey: ["kol-management-data"] });
      queryClient.invalidateQueries({ queryKey: ["kol-profiles-with-social"] });

      toast({
        title: "Success",
        description: `KOL "${formData.name}" has been created successfully with ${socialAccounts.length} social media accounts and ${rates.length} rates`,
      });
    } catch (error) {
      console.error("Error creating KOL:", error);
      toast({
        title: "Error",
        description: "Failed to create KOL profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getProgress = () => {
    let completed = 0;
    const total = 4;

    if (formData.name) completed++;
    if (socialAccounts.length > 0) completed++;
    if (rates.length > 0) completed++;
    if (formData.profile_photo_url) completed++;

    return (completed / total) * 100;
  };

  const tabs = [
    { id: "basic", label: "Basic Info", required: true },
    { id: "social", label: "Social Media", required: false },
    { id: "rates", label: "Rates", required: false },
    { id: "photo", label: "Photo & Portfolio", required: false },
  ];

  const progress = getProgress();
  const isProfileComplete = progress >= 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[640px] w-[640px] max-h-[90vh] max-w-[90vw] flex-col overflow-hidden rounded-xl p-0">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex h-full min-h-0 flex-col"
        >
          <DialogHeader className="sticky top-0 z-10 flex-shrink-0 border-b bg-background px-6 pb-4 pt-6">
            <DialogTitle>Add New KOL</DialogTitle>
            <DialogDescription>
              Create a comprehensive KOL profile with social media accounts and
              rates.
            </DialogDescription>
            <div className="mt-4">
              <div className="mb-2 flex justify-between text-sm text-gray-600">
                <span>Profile Completion</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="mt-4">
              <TabsList className="grid w-full grid-cols-4">
                {tabs.map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="text-xs"
                  >
                    {tab.label}
                    {tab.required && (
                      <span className="ml-1 text-red-500">*</span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </DialogHeader>

          <div className="seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="w-full px-6 pb-4 pt-4">
              <TabsContent value="basic" className="mt-0 w-full">
                <BasicInfoTab
                  formData={formData}
                  setFormData={(updater) =>
                    setFormData((prev) => updater(prev))
                  }
                />
              </TabsContent>

              <TabsContent value="social" className="mt-0 w-full">
                <SocialMediaTab
                  socialAccounts={socialAccounts}
                  setSocialAccounts={setSocialAccounts}
                />
              </TabsContent>

              <TabsContent value="rates" className="mt-0 w-full">
                <RatesTab rates={rates} setRates={setRates} />
              </TabsContent>

              <TabsContent value="photo" className="mt-0 w-full">
                <PhotoPortfolioTab
                  formData={formData}
                  setFormData={(updater) =>
                    setFormData((prev) => updater(prev))
                  }
                />
              </TabsContent>
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 z-10 flex-shrink-0 border-t bg-background px-6 py-3">
            <div className="flex w-full items-center justify-between">
              {/* Left: Previous */}
              <div className="flex gap-2">
                {activeTab !== "basic" && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const currentIndex = tabs.findIndex(
                        (tab) => tab.id === activeTab,
                      );
                      if (currentIndex > 0) {
                        setActiveTab(tabs[currentIndex - 1].id);
                      }
                    }}
                  >
                    Previous
                  </Button>
                )}
              </div>

              {/* Right: Cancel, Next, Create */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                {activeTab !== "photo" && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const currentIndex = tabs.findIndex(
                        (tab) => tab.id === activeTab,
                      );
                      if (currentIndex < tabs.length - 1) {
                        setActiveTab(tabs[currentIndex + 1].id);
                      }
                    }}
                  >
                    Next
                  </Button>
                )}
                {isProfileComplete && (
                  <Button
                    onClick={handleSubmit}
                    disabled={loading || !formData.name}
                  >
                    {loading ? "Creating..." : "Create KOL"}
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default EnhancedAddKOLModal;


