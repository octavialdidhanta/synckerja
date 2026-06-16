import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { supabase } from "@/shared/lib/supabaseClient";
import { ensureOrganizationOwnerEmployee } from "@/shared/lib/ensureOrganizationOwnerEmployee";
import { toast } from "@/shared/hooks/use-toast";

export interface OrganizationFormProps {
  formId?: string;
  hideSubmitButton?: boolean;
  /** Mobile shell: 4px between section cards (space-y-1), tighter card padding — matches android-mobile layout rules. */
  compactMobileSections?: boolean;
  onLoadingChange?: (loading: boolean) => void;
  onAcceptTermsChange?: (accepted: boolean) => void;
}

interface OrganizationFormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  description: string;
  industry: string;
  acceptTerms: boolean;
}

const initialFormData: OrganizationFormData = {
  name: "",
  email: "",
  phone: "",
  address: "",
  website: "",
  description: "",
  industry: "",
  acceptTerms: false,
};

const inputClass =
  "h-12 border-slate-200 bg-white text-sm focus-visible:ring-[hsl(var(--brand-blue))]";

export default function OrganizationForm({
  formId,
  hideSubmitButton,
  compactMobileSections = false,
  onLoadingChange,
  onAcceptTermsChange,
}: OrganizationFormProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<OrganizationFormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const brandBlue = "hsl(var(--brand-blue))";
  const brandRed = "hsl(var(--brand-red))";

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  useEffect(() => {
    onAcceptTermsChange?.(formData.acceptTerms);
  }, [formData.acceptTerms, onAcceptTermsChange]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", user.id)
        .maybeSingle();
      setFormData((prev) => ({
        ...prev,
        email: (profile?.email as string) || user.email || "",
      }));
    })();
  }, []);

  const handleInputChange = (field: keyof OrganizationFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const createOrganization = async (data: OrganizationFormData) => {
    if (!data.acceptTerms) {
      toast({ title: t("onboarding.org.terms"), variant: "destructive" });
      return false;
    }
    if (!data.phone.trim()) {
      toast({ title: t("onboarding.org.phoneRequired"), variant: "destructive" });
      return false;
    }
    try {
      setLoading(true);
      setError(null);

      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        throw new Error("Not authenticated");
      }

      const userId = user.id;
      const now = new Date().toISOString();
      const fullName =
        (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "User";

      const { data: org, error: orgErr } = await supabase
        .from("organizations")
        .insert({
          user_id: userId,
          created_by: userId,
          company_name: data.name.trim(),
          industry: data.industry.trim(),
          email: data.email.trim() || null,
          phone_number: data.phone.trim(),
          address: data.address.trim() || null,
          website: data.website.trim() || null,
          description: data.description.trim() || null,
          terms_accepted: true,
          terms_accepted_at: now,
        })
        .select("id")
        .single();

      if (orgErr || !org) {
        console.error(orgErr);
        throw new Error(t("onboarding.org.error"));
      }

      const orgId = org.id;

      const { error: depErr } = await supabase.from("departments").insert({
        name: data.name.trim(),
        organization_id: orgId,
        created_by: userId,
        is_default: true,
        is_active: true,
      });

      if (depErr) {
        console.error(depErr);
        throw new Error(t("onboarding.org.error"));
      }

      const { error: uoErr } = await supabase.from("user_organizations").insert({
        user_id: userId,
        organization_id: orgId,
        is_active: true,
      });

      if (uoErr) {
        console.error(uoErr);
        throw new Error(t("onboarding.org.error"));
      }

      const { error: urErr } = await supabase.from("user_roles").insert({
        user_id: userId,
        organization_id: orgId,
        role: "owner",
      });

      if (urErr) {
        console.error(urErr);
        throw new Error(t("onboarding.org.error"));
      }

      await ensureOrganizationOwnerEmployee({
        organizationId: orgId,
        userId,
        fullName,
        email: user.email ?? null,
      });

      const { error: profileActiveErr } = await supabase
        .from("profiles")
        .update({ active_organization_id: orgId })
        .eq("user_id", userId);

      if (profileActiveErr) {
        console.warn("profiles active_organization_id:", profileActiveErr);
      }

      toast({
        title: t("onboarding.org.createdTitle"),
        description: t("onboarding.org.createdDesc", { name: data.name.trim() }),
      });

      if (typeof window !== "undefined") {
        sessionStorage.setItem("organizationJustCreated", "true");
        sessionStorage.setItem("newOrganizationId", orgId);
        sessionStorage.setItem("forceRefreshUserData", "true");
      }

      navigate("/create-plan", { replace: true });
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("onboarding.org.error");
      setError(message);
      toast({ title: t("onboarding.org.error"), description: message, variant: "destructive" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createOrganization(formData);
  };

  const sectionClass = compactMobileSections
    ? "space-y-2 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"
    : "space-y-4 rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6 sm:space-y-5";

  const formGapClass = compactMobileSections ? "space-y-1" : "space-y-5 sm:space-y-6";
  const sectionHeadingClass = compactMobileSections
    ? "text-base font-semibold leading-none text-slate-900"
    : "text-base font-semibold text-slate-900 sm:text-lg";

  return (
    <form id={formId} onSubmit={handleSubmit} className={formGapClass}>
      <section className={sectionClass}>
        <h2 className={sectionHeadingClass}>
          {t("onboarding.org.basicSection")}
        </h2>
        <div className="space-y-2">
          <Label htmlFor="org-name" className="text-slate-800">
            {t("onboarding.org.companyName")} *
          </Label>
          <Input
            id="org-name"
            className={inputClass}
            value={formData.name}
            onChange={(e) => handleInputChange("name", e.target.value)}
            placeholder={t("onboarding.org.companyNamePlaceholder")}
            disabled={loading}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-email" className="text-slate-800">
            {t("onboarding.org.orgEmail")} *
          </Label>
          <Input
            id="org-email"
            type="email"
            className={inputClass}
            value={formData.email}
            onChange={(e) => handleInputChange("email", e.target.value)}
            placeholder={t("onboarding.org.orgEmailPlaceholder")}
            disabled={loading}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-phone" className="text-slate-800">
            {t("onboarding.org.phone")} *
          </Label>
          <Input
            id="org-phone"
            className={inputClass}
            value={formData.phone}
            onChange={(e) => handleInputChange("phone", e.target.value)}
            disabled={loading}
            required
          />
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className={sectionHeadingClass}>
          {t("onboarding.org.extraSection")}
        </h2>
        <div className="space-y-2">
          <Label htmlFor="org-address" className="text-slate-800">
            {t("onboarding.org.address")}
          </Label>
          <Input
            id="org-address"
            className={inputClass}
            value={formData.address}
            onChange={(e) => handleInputChange("address", e.target.value)}
            placeholder={t("onboarding.org.addressPlaceholder")}
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-website" className="text-slate-800">
            {t("onboarding.org.website")}
          </Label>
          <Input
            id="org-website"
            className={inputClass}
            value={formData.website}
            onChange={(e) => handleInputChange("website", e.target.value)}
            placeholder={t("onboarding.org.websitePlaceholder")}
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-industry" className="text-slate-800">
            {t("onboarding.org.industry")} *
          </Label>
          <Input
            id="org-industry"
            className={inputClass}
            value={formData.industry}
            onChange={(e) => handleInputChange("industry", e.target.value)}
            placeholder={t("onboarding.org.industryPlaceholder")}
            disabled={loading}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-description" className="text-slate-800">
            {t("onboarding.org.description")}
          </Label>
          <Textarea
            id="org-description"
            value={formData.description}
            onChange={(e) => handleInputChange("description", e.target.value)}
            placeholder={t("onboarding.org.descriptionPlaceholder")}
            disabled={loading}
            className="min-h-[100px] border-slate-200 bg-white text-sm focus-visible:ring-[hsl(var(--brand-blue))]"
          />
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive sm:p-4">
          {error}
        </div>
      )}

      <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 sm:p-4">
        <Checkbox
          id="org-terms"
          checked={formData.acceptTerms}
          onCheckedChange={(c) => handleInputChange("acceptTerms", c === true)}
          disabled={loading}
          className="border-slate-300 data-[state=checked]:border-[hsl(var(--brand-blue))] data-[state=checked]:bg-[hsl(var(--brand-blue))] data-[state=checked]:text-white"
        />
        <div className="text-sm font-medium leading-snug text-slate-800">
          <Label htmlFor="org-terms" className="cursor-pointer font-medium">
            {t("onboarding.org.termsPrefix")}{" "}
            <Link
              to="/terms-and-conditions"
              className="font-semibold hover:underline"
              style={{ color: brandBlue }}
            >
              {t("onboarding.org.termsLink")}
            </Link>
          </Label>
        </div>
      </div>

      {!hideSubmitButton && (
        <Button
          type="submit"
          className="h-12 w-full text-base font-semibold text-white shadow-md transition-colors hover:opacity-[0.92]"
          style={{ backgroundColor: brandRed }}
          disabled={loading || !formData.acceptTerms}
        >
          {loading ? t("onboarding.org.submitting") : t("onboarding.org.submit")}
        </Button>
      )}
    </form>
  );
}
