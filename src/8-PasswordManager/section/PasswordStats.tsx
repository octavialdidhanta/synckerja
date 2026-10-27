import type React from "react";
import { Shield, Key, Star, AlertTriangle } from "lucide-react";

interface PasswordStatsProps {
  totalPasswords: number;
  strongPasswords: number;
  weakPasswords: number;
  favorites: number;
}

export const PasswordStats: React.FC<PasswordStatsProps> = ({
  totalPasswords,
  strongPasswords,
  weakPasswords,
  favorites,
}) => {
  const items = [
    {
      label: "Total",
      value: totalPasswords,
      icon: Key,
      iconWrap: "bg-brand-blue/10 text-brand-blue",
      card: "border-brand-blue/20 ring-1 ring-brand-blue/10",
    },
    {
      label: "Strong",
      value: strongPasswords,
      icon: Shield,
      iconWrap: "bg-emerald-500/15 text-emerald-600",
      card: "",
    },
    {
      label: "Weak",
      value: weakPasswords,
      icon: AlertTriangle,
      iconWrap: "bg-destructive/10 text-destructive",
      card: "",
    },
    {
      label: "Favorites",
      value: favorites,
      icon: Star,
      iconWrap: "bg-amber-500/15 text-amber-600",
      card: "",
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className={`flex h-10 items-center justify-between gap-2 rounded-md border bg-card px-3 shadow-sm ${item.card}`}
          >
            <div className="min-w-0 flex items-baseline gap-1.5">
              <span className="truncate text-xs text-muted-foreground">{item.label}</span>
              <span className="text-base font-bold leading-none tabular-nums">{item.value}</span>
            </div>
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${item.iconWrap}`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
