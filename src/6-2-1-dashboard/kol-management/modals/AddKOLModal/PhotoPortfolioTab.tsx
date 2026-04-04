import { useState } from "react";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/components/ui/avatar";
import { Upload, X } from "lucide-react";
import { supabase } from "@/shared/lib/supabaseClient";
import { useToast } from "@/shared/components/ui/use-toast";

interface PhotoPortfolioTabProps {
  formData: any;
  setFormData: (updater: (prev: any) => any) => void;
}

const PhotoPortfolioTab = ({
  formData,
  setFormData,
}: PhotoPortfolioTabProps) => {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handlePhotoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`;
      const filePath = `kol-profiles/${fileName}`;

      const { error } = await supabase.storage
        .from("kol-profile-photos")
        .upload(filePath, file);

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage
        .from("kol-profile-photos")
        .getPublicUrl(filePath);

      setFormData((prev) => ({ ...prev, profile_photo_url: publicUrl }));

      toast({
        title: "Success",
        description: "Photo uploaded successfully",
      });
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast({
        title: "Error",
        description: "Failed to upload photo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    if (formData.profile_photo_url) {
      try {
        const url = new URL(formData.profile_photo_url);
        const filePath = url.pathname.split("/").slice(-2).join("/");

        await supabase.storage.from("kol-profile-photos").remove([filePath]);
      } catch (error) {
        console.error("Error removing photo:", error);
      }

      setFormData((prev) => ({ ...prev, profile_photo_url: undefined }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <Label className="text-base font-semibold">Profile Photo</Label>

        <div className="flex items-center gap-6">
          <Avatar className="h-24 w-24">
            <AvatarImage src={formData.profile_photo_url} alt="Profile" />
            <AvatarFallback className="bg-gray-100 text-lg text-gray-600">
              {formData.name
                ? formData.name
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .toUpperCase()
                : "KOL"}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() =>
                  document.getElementById("photo-upload")?.click()
                }
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? "Uploading..." : "Upload Photo"}
              </Button>

              {formData.profile_photo_url && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={removePhoto}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>

            <p className="text-xs text-gray-500">
              Upload a profile photo (max 5MB). JPG, PNG formats supported.
            </p>
          </div>
        </div>

        <input
          id="photo-upload"
          type="file"
          accept="image/*"
          onChange={handlePhotoUpload}
          className="hidden"
        />
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="website">Website/Portfolio URL</Label>
          <Input
            id="website"
            type="url"
            value={formData.website || ""}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, website: e.target.value }))
            }
            placeholder="https://portfolio.example.com"
          />
        </div>

        <div>
          <Label htmlFor="languages">Languages Spoken</Label>
          <Input
            id="languages"
            value={formData.languages || ""}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, languages: e.target.value }))
            }
            placeholder="Indonesian, English, Mandarin"
          />
        </div>

        <div>
          <Label htmlFor="specialties">Specialties/Niches</Label>
          <Input
            id="specialties"
            value={formData.specialties || ""}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                specialties: e.target.value,
              }))
            }
            placeholder="Beauty, Fashion, Lifestyle, Technology"
          />
        </div>

        <div>
          <Label htmlFor="communication_method">Preferred Communication</Label>
          <Input
            id="communication_method"
            value={formData.communication_method || ""}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                communication_method: e.target.value,
              }))
            }
            placeholder="WhatsApp, Email, Instagram DM"
          />
        </div>
      </div>
    </div>
  );
};

export default PhotoPortfolioTab;

