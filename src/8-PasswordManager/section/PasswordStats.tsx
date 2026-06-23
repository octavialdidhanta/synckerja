import type React from "react";
import { Card } from "@/shared/components/ui/card";
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
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Card className="rounded-md border border-brand-blue/20 p-3 shadow-sm ring-1 ring-brand-blue/10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Total Passwords</p>
            <h3 className="mt-0.5 text-xl font-bold">{totalPasswords}</h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue/10">
            <Key className="h-5 w-5 text-brand-blue" />
          </div>
        </div>
      </Card>

      <Card className="rounded-md border p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Strong Passwords</p>
            <h3 className="mt-0.5 text-xl font-bold">{strongPasswords}</h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15">
            <Shield className="h-5 w-5 text-emerald-600" />
          </div>
        </div>
      </Card>

      <Card className="rounded-md border p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Weak Passwords</p>
            <h3 className="mt-0.5 text-xl font-bold">{weakPasswords}</h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
        </div>
      </Card>

      <Card className="rounded-md border p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Favorites</p>
            <h3 className="mt-0.5 text-xl font-bold">{favorites}</h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15">
            <Star className="h-5 w-5 text-amber-600" />
          </div>
        </div>
      </Card>
    </div>
  );
};
