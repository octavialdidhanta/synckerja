import type React from "react";
import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Eye, EyeOff } from "lucide-react";
import type { Password, PasswordFormData } from "../types";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";
import { PasswordGenerator } from "./PasswordGenerator";

interface AddPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: PasswordFormData) => void | Promise<void>;
  editPassword?: Password | null;
  categories: Array<{ id: string; name: string }>;
}

export const AddPasswordDialog: React.FC<AddPasswordDialogProps> = ({
  open,
  onOpenChange,
  onSave,
  editPassword,
  categories,
}) => {
  const defaultCategoryId = useMemo(() => {
    const general = categories.find((c) => c.name.trim().toLowerCase() === "general");
    return general?.id ?? categories[0]?.id ?? "";
  }, [categories]);

  const emptyFormData: PasswordFormData = useMemo(
    () => ({
      title: "",
      username: "",
      password: "",
      url: "",
      category: defaultCategoryId,
      notes: "",
      isFavorite: false,
    }),
    [defaultCategoryId],
  );

  const [formData, setFormData] = useState<PasswordFormData>(emptyFormData);
  const [showPassword, setShowPassword] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!open) {
      setFormData(emptyFormData);
      setShowPassword(false);
      setIsInitialized(false);
      return;
    }

    if (open && !isInitialized) {
      if (editPassword) {
        setFormData({
          title: editPassword.title,
          username: editPassword.username,
          password: editPassword.password,
          url: editPassword.url || "",
          category: editPassword.category,
          notes: editPassword.notes || "",
          isFavorite: editPassword.isFavorite,
        });
      } else {
        setFormData(emptyFormData);
      }
      setIsInitialized(true);
    }
  }, [open, editPassword, emptyFormData, isInitialized]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = onSave(formData);
      if (result instanceof Promise) {
        await result;
      }
    } catch {
      // Parent shows toast; keep dialog open
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleUseGeneratedPassword = (pwd: string) => {
    setFormData((prev) => ({ ...prev, password: pwd }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[720px] max-h-[95vh] w-[680px] max-w-[95vw] flex-col gap-0 overflow-hidden p-0 min-h-0">
        <DialogHeader className="flex-shrink-0 border-b border-brand-blue/15 bg-gradient-to-r from-brand-blue-soft to-muted px-6 pb-4 pt-6 pr-14 dark:from-brand-blue/10">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue/15">
              <Eye className="h-5 w-5 text-brand-blue" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate text-xl font-semibold">
                {editPassword ? "Edit Password" : "Add New Password"}
              </DialogTitle>
              <DialogDescription className="mt-1 truncate text-sm text-muted-foreground">
                {editPassword
                  ? "Update your password information below."
                  : "Fill in the details to save a new password."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="seamless-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-6 pb-6 pt-1">
          <Tabs defaultValue="details" className="flex min-h-0 w-full flex-col">
            <TabsList className="grid w-full shrink-0 grid-cols-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="generator">Password Generator</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-3 min-h-0 space-y-4 pb-1">
              <form
                id="password-form"
                onSubmit={handleSubmit}
                className="space-y-4"
                autoComplete="off"
              >
                <div className="space-y-2">
                  <Label htmlFor="title">
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    placeholder="e.g., Gmail, Facebook, Work Email"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category || defaultCategoryId}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">
                    Username/Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="username or email@example.com"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">
                    Password <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      className="pr-10"
                      autoComplete="new-password"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {formData.password && <PasswordStrengthMeter password={formData.password} />}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="url">Website URL</Label>
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://example.com"
                    value={formData.url ?? ""}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any additional notes..."
                    value={formData.notes ?? ""}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="max-h-40 min-h-[4.5rem] resize-y overflow-auto"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="favorite"
                    checked={formData.isFavorite}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isFavorite: checked === true })
                    }
                  />
                  <Label htmlFor="favorite" className="cursor-pointer">
                    Add to favorites
                  </Label>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="generator" className="mt-3 min-h-0 pb-1">
              <PasswordGenerator onUsePassword={handleUseGeneratedPassword} />
              <p className="mt-4 text-sm text-muted-foreground">
                Switch to the Details tab to see the generated password in the form.
              </p>
            </TabsContent>
          </Tabs>
        </div>
        <DialogFooter className="flex-shrink-0 border-t bg-muted/30 px-6 pb-6 pt-4 mt-0">
          <Button type="button" variant="outline" onClick={handleCancel} className="w-full md:w-auto">
            Cancel
          </Button>
          <Button
            form="password-form"
            type="submit"
            className="w-full bg-brand-blue hover:bg-brand-blue-deep md:w-auto"
          >
            {editPassword ? "Update Password" : "Save Password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
