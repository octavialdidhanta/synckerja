import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/shared/lib/supabaseClient";
import { useMfaStepUp } from "@/shared/auth/mfa";

export const NEW_PASSWORD_MIN = 8;

export type ChangePasswordErrors = {
  current?: string;
  new?: string;
  confirm?: string;
  general?: string;
};

export function useChangePasswordSettings() {
  const { t } = useTranslation();
  const { ensureAal2 } = useMfaStepUp();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<ChangePasswordErrors>({});

  const validatePasswords = useCallback(() => {
    const newErrors: ChangePasswordErrors = {};

    if (!currentPassword) {
      newErrors.current = t("settings.security.validation.currentRequired");
    }

    if (!newPassword) {
      newErrors.new = t("settings.security.validation.newRequired");
    } else if (newPassword.length < NEW_PASSWORD_MIN) {
      newErrors.new = t("settings.security.validation.newTooShort");
    }

    if (!confirmPassword) {
      newErrors.confirm = t("settings.security.validation.confirmRequired");
    } else if (newPassword !== confirmPassword) {
      newErrors.confirm = t("settings.security.validation.confirmMismatch");
    }

    if (currentPassword && newPassword && currentPassword === newPassword) {
      newErrors.new = t("settings.security.validation.sameAsCurrent");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [confirmPassword, currentPassword, newPassword, t]);

  const resetForm = useCallback(() => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setErrors({});
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validatePasswords()) return;

      setIsLoading(true);
      setErrors({});

      try {
        if (!(await ensureAal2())) {
          setErrors({ general: t("settings.security.twoFactor.stepUpCancelled") });
          return;
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user?.email) {
          setErrors({ general: t("settings.security.error.unableVerify") });
          return;
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });

        if (signInError) {
          setErrors({ current: t("settings.security.validation.currentIncorrect") });
          return;
        }

        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (updateError) {
          setErrors({ general: updateError.message || t("settings.security.error.updateFailed") });
          return;
        }

        toast.success(t("settings.security.toast.updateSuccess"));
        resetForm();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t("settings.security.error.updateFailed");
        setErrors({ general: message });
      } finally {
        setIsLoading(false);
      }
    },
    [currentPassword, ensureAal2, newPassword, resetForm, t, validatePasswords],
  );

  return {
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    showCurrentPassword,
    setShowCurrentPassword,
    showNewPassword,
    setShowNewPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    isLoading,
    errors,
    handleSubmit,
    resetForm,
  };
}
