import type React from "react";
import { cn } from "@/shared/lib/utils";

interface PasswordStrengthMeterProps {
  password: string;
  showLabel?: boolean;
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  password,
  showLabel = true,
}) => {
  const calculateStrength = (pwd: string): number => {
    let strength = 0;
    if (pwd.length >= 8) strength += 1;
    if (pwd.length >= 12) strength += 1;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength += 1;
    if (/\d/.test(pwd)) strength += 1;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength += 1;
    return strength;
  };

  const strength = calculateStrength(password);

  const getStrengthInfo = () => {
    if (strength === 0) return { label: "Very Weak", color: "bg-destructive", width: "0%" };
    if (strength === 1) return { label: "Weak", color: "bg-destructive", width: "20%" };
    if (strength === 2) return { label: "Fair", color: "bg-orange-500", width: "40%" };
    if (strength === 3) return { label: "Good", color: "bg-amber-500", width: "60%" };
    if (strength === 4) return { label: "Strong", color: "bg-emerald-500", width: "80%" };
    return { label: "Very Strong", color: "bg-emerald-600", width: "100%" };
  };

  const strengthInfo = getStrengthInfo();

  return (
    <div className="space-y-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full transition-all duration-300", strengthInfo.color)}
          style={{ width: strengthInfo.width }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-muted-foreground">
          Password strength: <span className="font-medium">{strengthInfo.label}</span>
        </p>
      )}
    </div>
  );
};

export const getPasswordStrength = (pwd: string): "weak" | "medium" | "strong" => {
  let strength = 0;
  if (pwd.length >= 8) strength += 1;
  if (pwd.length >= 12) strength += 1;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength += 1;
  if (/\d/.test(pwd)) strength += 1;
  if (/[^a-zA-Z0-9]/.test(pwd)) strength += 1;

  if (strength <= 2) return "weak";
  if (strength <= 4) return "medium";
  return "strong";
};
