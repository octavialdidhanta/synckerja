import type React from "react";
import { useState } from "react";
import { Card } from "@/shared/components/ui/card";
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
    <Card className="rounded-md border p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="text-base font-semibold">{password.title}</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onToggleFavorite(password.id)}
            >
              <Star
                className={cn(
                  "h-4 w-4",
                  password.isFavorite && "fill-amber-400 text-amber-500",
                )}
              />
            </Button>
          </div>
          <Badge variant="outline" className="text-xs">
            {getCategoryName(password.category)}
          </Badge>
        </div>
        <Badge variant="outline" className={cn("text-xs", strengthColors[strength])}>
          {strength.charAt(0).toUpperCase() + strength.slice(1)}
        </Badge>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between rounded bg-muted/50 p-2">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xs text-muted-foreground">Username</p>
            <p className="truncate text-sm font-medium">{password.username}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={() => copyToClipboard(password.username, "username")}
          >
            {copiedField === "username" ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="flex items-center justify-between rounded bg-muted/50 p-2">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xs text-muted-foreground">Password</p>
            <p className="font-mono text-sm">
              {showPassword ? password.password : "••••••••••••"}
            </p>
          </div>
          <div className="flex flex-shrink-0 gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => copyToClipboard(password.password, "password")}
            >
              {copiedField === "password" ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {password.url && (
          <div className="flex items-center justify-between rounded bg-muted/50 p-2">
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-xs text-muted-foreground">Website</p>
              <a
                href={password.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 truncate text-sm text-brand-blue hover:underline"
              >
                {password.url}
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </a>
            </div>
          </div>
        )}

        {password.notes && (
          <div className="rounded bg-muted/50 p-2">
            <p className="mb-1 text-xs text-muted-foreground">Notes</p>
            <p className="line-clamp-2 text-sm text-foreground">{password.notes}</p>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <p className="text-xs text-muted-foreground">
          Updated {new Date(password.updatedAt).toLocaleDateString()}
        </p>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => onEdit(password)}>
            <Edit className="mr-1 h-3 w-3" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onDelete(password.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
