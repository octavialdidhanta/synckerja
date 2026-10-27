import type React from "react";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  Eye,
  EyeOff,
  Copy,
  Star,
  Edit,
  Trash2,
  ExternalLink,
  Check,
} from "lucide-react";
import { useToast } from "@/shared/components/ui/use-toast";
import type { Password, Category } from "../types";
import { cn } from "@/shared/lib/utils";
import { getPasswordStrength } from "./PasswordStrengthMeter";

interface PasswordCardProps {
  password: Password;
  categories: Category[];
  onEdit: (password: Password) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export const PasswordCard: React.FC<PasswordCardProps> = ({
  password,
  categories,
  onEdit,
  onDelete,
  onToggleFavorite,
}) => {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((cat) => cat.id === categoryId);
    return category ? category.name : categoryId;
  };

  const strength = getPasswordStrength(password.password);
  const strengthColors = {
    weak: "border-destructive/30 bg-destructive/10 text-destructive",
    medium: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
    strong: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  };

  return (
    <div className="rounded-md border bg-card p-2.5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold leading-tight">{password.title}</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => onToggleFavorite(password.id)}
            >
              <Star
                className={cn(
                  "h-3.5 w-3.5",
                  password.isFavorite && "fill-amber-400 text-amber-500",
                )}
              />
            </Button>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              {getCategoryName(password.category)}
            </Badge>
            <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", strengthColors[strength])}>
              {strength.charAt(0).toUpperCase() + strength.slice(1)}
            </Badge>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 rounded bg-muted/50 px-2 py-1.5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] leading-none text-muted-foreground">Username</p>
            <p className="mt-0.5 truncate text-sm font-medium leading-tight">{password.username}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={() => copyToClipboard(password.username, "username")}
          >
            {copiedField === "username" ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-2 rounded bg-muted/50 px-2 py-1.5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] leading-none text-muted-foreground">Password</p>
            <p className="mt-0.5 font-mono text-sm leading-tight">
              {showPassword ? password.password : "••••••••••••"}
            </p>
          </div>
          <div className="flex flex-shrink-0 gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => copyToClipboard(password.password, "password")}
            >
              {copiedField === "password" ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        {password.url ? (
          <div className="flex items-center justify-between rounded bg-muted/50 px-2 py-1.5">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] leading-none text-muted-foreground">Website</p>
              <a
                href={password.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 flex items-center gap-1 truncate text-sm leading-tight text-brand-blue hover:underline"
              >
                {password.url}
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </a>
            </div>
          </div>
        ) : null}

        {password.notes ? (
          <div className="rounded bg-muted/50 px-2 py-1.5">
            <p className="text-[10px] leading-none text-muted-foreground">Notes</p>
            <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-foreground">{password.notes}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex items-center justify-between border-t pt-2">
        <p className="text-[10px] text-muted-foreground">
          Updated {new Date(password.updatedAt).toLocaleDateString()}
        </p>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => onEdit(password)}>
            <Edit className="mr-1 h-3 w-3" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 px-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onDelete(password.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};
