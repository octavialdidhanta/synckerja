import { useState, useEffect, useRef } from "react";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useToast } from "@/shared/components/ui/use-toast";
import type { Password, PasswordFormData, Category } from "../types";

/** General first, then alphabetical — predictable defaults and Add Password dropdown */
function sortPasswordCategories(list: Category[]): Category[] {
  const general = list.find((c) => c.name.trim().toLowerCase() === "general");
  const rest = list
    .filter((c) => c.name.trim().toLowerCase() !== "general")
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return general
    ? [general, ...rest]
    : [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export const usePasswords = () => {
  const [passwords, setPasswords] = useState<Password[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [passwordsLoading, setPasswordsLoading] = useState(true);
  const [effectSettled, setEffectSettled] = useState(false);
  const { user, loading: userLoading } = useCurrentUser();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { toast } = useToast();
  const isActiveRef = useRef(true);
  const lastFetchedKeyRef = useRef<string | null>(null);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("password_categories")
        .select("*")
        .order("name");

      if (error) throw error;

      const categoriesWithCount = sortPasswordCategories(
        (data || []).map((cat) => ({
          id: cat.id,
          name: cat.name,
          icon: cat.icon || "lock",
          count: 0,
        })),
      );

      if (!isActiveRef.current) return;
      setCategories(categoriesWithCount);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load categories",
        variant: "destructive",
      });
    }
  };

  const fetchPasswords = async () => {
    if (!user || !organizationId) return;

    try {
      const { data, error } = await supabase
        .from("passwords")
        .select(
          `
          *,
          password_categories!inner(id, name, icon)
        `,
        )
        .eq("user_id", user.id)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedPasswords: Password[] = (data || []).map((item: Record<string, unknown>) => {
        const pc = item.password_categories as { id?: string; name?: string; icon?: string } | null;
        return {
          id: item.id as string,
          title: item.title as string,
          username: item.username as string,
          password: item.password as string,
          url: (item.url as string) || undefined,
          category: pc?.id || "general",
          notes: (item.notes as string) || undefined,
          isFavorite: Boolean(item.is_favorite),
          createdAt: new Date(item.created_at as string),
          updatedAt: new Date(item.updated_at as string),
        };
      });
      if (!isActiveRef.current) return;
      setPasswords(formattedPasswords);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load passwords",
        variant: "destructive",
      });
    }
  };

  const addPassword = async (data: PasswordFormData) => {
    if (!user || !organizationId) return;

    try {
      const { error } = await supabase.from("passwords").insert([
        {
          user_id: user.id,
          organization_id: organizationId,
          title: data.title,
          username: data.username,
          password: data.password,
          url: data.url || null,
          category_id: data.category,
          notes: data.notes || null,
          is_favorite: data.isFavorite,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Password saved successfully",
      });

      await fetchPasswords();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save password",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updatePassword = async (id: string, data: PasswordFormData) => {
    if (!user || !organizationId) return;

    try {
      const { error } = await supabase
        .from("passwords")
        .update({
          title: data.title,
          username: data.username,
          password: data.password,
          url: data.url || null,
          category_id: data.category,
          notes: data.notes || null,
          is_favorite: data.isFavorite,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("organization_id", organizationId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Password updated successfully",
      });

      await fetchPasswords();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update password",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deletePassword = async (id: string) => {
    if (!user || !organizationId) return;

    try {
      const { error } = await supabase
        .from("passwords")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("organization_id", organizationId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Password deleted successfully",
      });

      await fetchPasswords();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete password",
        variant: "destructive",
      });
      throw error;
    }
  };

  const toggleFavorite = async (id: string) => {
    if (!user || !organizationId) return;

    try {
      const password = passwords.find((p) => p.id === id);
      if (!password) return;

      const { error } = await supabase
        .from("passwords")
        .update({
          is_favorite: !password.isFavorite,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("organization_id", organizationId);

      if (error) throw error;

      await fetchPasswords();
    } catch {
      toast({
        title: "Error",
        description: "Failed to update favorite",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    isActiveRef.current = true;
    const key = user && organizationId ? `${user.id}-${organizationId}` : null;

    if (key) {
      if (lastFetchedKeyRef.current === key) {
        return () => {
          isActiveRef.current = false;
        };
      }
      lastFetchedKeyRef.current = key;
      setPasswordsLoading(true);
      Promise.all([fetchCategories(), fetchPasswords()]).finally(() => {
        if (isActiveRef.current) {
          setPasswordsLoading(false);
          setEffectSettled(true);
        }
      });
    } else {
      lastFetchedKeyRef.current = null;
      setPasswordsLoading(false);
      setEffectSettled(true);
    }

    return () => {
      isActiveRef.current = false;
      lastFetchedKeyRef.current = null;
    };
  }, [user, organizationId]);

  useEffect(() => {
    if (passwords.length > 0 && categories.length > 0) {
      const updatedCategories = categories.map((cat) => ({
        ...cat,
        count: passwords.filter((p) => p.category === cat.id).length,
      }));
      const hasChange = updatedCategories.some(
        (uc, i) => (categories[i]?.count ?? -1) !== uc.count,
      );
      if (!hasChange) return;
      if (!isActiveRef.current) return;
      setCategories(sortPasswordCategories(updatedCategories));
    }
  }, [passwords, categories]);

  const dataPending = Boolean(user) && Boolean(organizationId);
  const loading =
    !effectSettled ||
    userLoading ||
    orgLoading ||
    (dataPending && passwordsLoading);

  return {
    passwords,
    categories,
    loading,
    addPassword,
    updatePassword,
    deletePassword,
    toggleFavorite,
    refetch: fetchPasswords,
  };
};
