import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/features/ui/dialog';
import { Button } from '@/mobile/components/ui/button';
import { Input } from '@/mobile/components/ui/input';
import { Label } from '@/mobile/components/ui/label';
import { Key, Eye, EyeOff, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/features/ui/use-toast';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';
import { useIsMobile } from '@/mobile/hooks/use-mobile';
import { cn } from '@/lib/utils';

type TranslateFn = ReturnType<typeof useAppTranslation>['t'];

interface ChangePasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PasswordStrengthIndicator = ({ password, translate }: { password: string; translate: TranslateFn }) => {
  const getStrength = () => {
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const strength = getStrength();
  const getStrengthText = () => {
    if (strength < 2) return translate('settings.security.passwordStrength.weak', 'Weak');
    if (strength < 4) return translate('settings.security.passwordStrength.fair', 'Fair');
    if (strength < 5) return translate('settings.security.passwordStrength.good', 'Good');
    return translate('settings.security.passwordStrength.strong', 'Strong');
  };

  const getStrengthColor = () => {
    if (strength < 2) return 'bg-red-500';
    if (strength < 4) return 'bg-amber-500';
    if (strength < 5) return 'bg-blue-500';
    return 'bg-green-500';
  };

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 mb-1">
        <div className="text-sm text-muted-foreground">
          {translate('settings.security.passwordStrength.label', 'Password strength:')}
        </div>
        <div className="text-sm font-medium">{getStrengthText()}</div>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className={cn('h-2 rounded-full transition-all', getStrengthColor())}
          style={{ width: `${(strength / 6) * 100}%` }}
        />
      </div>
    </div>
  );
};

export const ChangePasswordModal = ({ open, onOpenChange }: ChangePasswordModalProps) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    current?: string;
    new?: string;
    confirm?: string;
    general?: string;
  }>({});
  const { t } = useAppTranslation();
  const { toast } = useToast();

  const validatePasswords = () => {
    const newErrors: typeof errors = {};

    if (!currentPassword) {
      newErrors.current = t('settings.security.validation.currentRequired', 'Current password is required');
    }

    if (!newPassword) {
      newErrors.new = t('settings.security.validation.newRequired', 'New password is required');
    } else if (newPassword.length < 6) {
      newErrors.new = t('settings.security.validation.newTooShort', 'Password must be at least 6 characters');
    }

    if (!confirmPassword) {
      newErrors.confirm = t('settings.security.validation.confirmRequired', 'Please confirm your new password');
    } else if (newPassword !== confirmPassword) {
      newErrors.confirm = t('settings.security.validation.confirmMismatch', 'Passwords do not match');
    }

    if (currentPassword && newPassword && currentPassword === newPassword) {
      newErrors.new = t(
        'settings.security.validation.sameAsCurrent',
        'New password must be different from current password'
      );
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatePasswords()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user?.email) {
        throw new Error(t('settings.security.error.unableVerify', 'Unable to verify current user'));
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErrors({ current: t('settings.security.validation.currentIncorrect', 'Current password is incorrect') });
        } else {
          setErrors({ general: error.message });
        }
        return;
      }

      toast({
        title: t('settings.security.toast.updateSuccess', 'Password updated successfully'),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('settings.security.error.updateFailed', 'Failed to update password');
      setErrors({ general: message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
      onOpenChange(false);
    }
  };

  const isMobile = useIsMobile();

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      if (!isLoading) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setErrors({});
      }
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'w-full max-w-none m-0 rounded-none translate-x-0 translate-y-0 flex flex-col p-0 gap-0 z-30',
          // Tanpa h-[100dvh] agar modal-above-safe-area mengontrol tinggi; footer tetap di atas pita navigasi
          'fixed left-0 right-0 top-0 modal-above-safe-area sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:max-w-md sm:h-auto sm:max-h-[90vh] sm:min-h-0'
        )}
        overlayClassName="!z-30"
        fullscreenAnimation={isMobile}
        hideCloseButton
      >
        <DialogHeader className="flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left px-4 pt-4 pb-3 safe-area-top">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full -ml-1"
              onClick={handleClose}
              disabled={isLoading}
              aria-label={t('common.cancel', 'Cancel')}
            >
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </Button>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold flex-1 min-w-0">
              <Key className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span className="truncate">{t('settings.security.changePassword.title', 'Change Password')}</span>
            </DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleChangePassword} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll px-4 py-4 space-y-4">
            {errors.general && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{errors.general}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="mobile-current-password">
                {t('settings.security.form.currentPasswordLabel', 'Current Password')}
              </Label>
              <div className="relative">
                <Input
                  id="mobile-current-password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={cn('text-sm pr-10', errors.current && 'border-destructive')}
                  placeholder=""
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {errors.current && <p className="text-sm text-destructive">{errors.current}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobile-new-password">
                {t('settings.security.form.newPasswordLabel', 'New Password')}
              </Label>
              <div className="relative">
                <Input
                  id="mobile-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={cn('text-sm pr-10', errors.new && 'border-destructive')}
                  placeholder=""
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {errors.new && <p className="text-sm text-destructive">{errors.new}</p>}
              <PasswordStrengthIndicator password={newPassword} translate={t} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobile-confirm-password">
                {t('settings.security.form.confirmPasswordLabel', 'Confirm New Password')}
              </Label>
              <div className="relative">
                <Input
                  id="mobile-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={cn('text-sm pr-10', errors.confirm && 'border-destructive')}
                  placeholder=""
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {errors.confirm && <p className="text-sm text-destructive">{errors.confirm}</p>}
            </div>
          </div>

          <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={isLoading}>
                {t('settings.security.actions.cancel', 'Cancel')}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isLoading}
                className="min-w-[120px] flex items-center justify-center gap-1.5"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{t('settings.security.actions.updating', 'Updating...')}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    {t('settings.security.actions.update', 'Update Password')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
