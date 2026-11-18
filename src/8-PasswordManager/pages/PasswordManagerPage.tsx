import type React from "react";
import { useState, useMemo } from "react";
import { useToast } from "@/shared/components/ui/use-toast";
import {
  PasswordStats,
  SearchAndFilter,
  PasswordList,
  AddPasswordDialog,
  CategoryFilter,
  PasswordSidebarFooter,
  PasswordListFooter,
} from "../section";
import type { Password, PasswordFormData } from "../types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { usePasswords } from "../hooks";
import { PasswordManagerModuleShell } from "../layout/PasswordManagerModuleShell";
import {
  PASSWORD_MANAGER_CONTENT_GRID,
  PASSWORD_MANAGER_MAIN_COLUMN,
  PASSWORD_MANAGER_PANEL_CARD,
  PASSWORD_MANAGER_PANEL_SECTION,
} from "../layout/passwordManagerLayout";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { Loader2 } from "lucide-react";

const PasswordManagerPage: React.FC = () => {
  const { toast } = useToast();
  const {
    passwords,
    categories,
    loading,
    addPassword,
    updatePassword,
    deletePassword,
    toggleFavorite,
    revealPassword,
  } = usePasswords();

  const showContent = useDebouncedReady(!loading, 200);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isShowingFavorites, setIsShowingFavorites] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPassword, setEditingPassword] = useState<Password | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const categoriesWithCounts = useMemo(() => {
    return categories.map((cat) => ({
      ...cat,
      count: passwords.filter((p) => p.category === cat.id).length,
    }));
  }, [passwords, categories]);

  const filteredPasswords = useMemo(() => {
    let filtered = passwords;

    if (searchQuery) {
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.url?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    if (isShowingFavorites) {
      filtered = filtered.filter((p) => p.isFavorite);
    }

    if (selectedCategory !== "all" && !isShowingFavorites) {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }

    return filtered;
  }, [passwords, searchQuery, selectedCategory, isShowingFavorites]);

  const stats = useMemo(() => {
    const strongCount = passwords.filter((p) => p.passwordStrength === "strong").length;
    const weakCount = passwords.filter((p) => p.passwordStrength === "weak").length;
    const favoriteCount = passwords.filter((p) => p.isFavorite).length;

    return {
      total: passwords.length,
      strong: strongCount,
      weak: weakCount,
      favorites: favoriteCount,
    };
  }, [passwords]);

  const handleAddPassword = () => {
    setEditingPassword(null);
    setDialogOpen(true);
  };

  const handleEditPassword = async (password: Password) => {
    try {
      const revealed = await revealPassword(password.id);
      setEditingPassword({ ...password, password: revealed });
      setDialogOpen(true);
    } catch {
      setEditingPassword(null);
      toast({
        title: "Error",
        description: "Failed to reveal password",
        variant: "destructive",
      });
    }
  };

  const handleSavePassword = async (data: PasswordFormData) => {
    try {
      if (editingPassword) {
        await updatePassword(editingPassword.id, data);
      } else {
        await addPassword(data);
      }
      setDialogOpen(false);
    } catch {
      // Hook already toasts; dialog stays open for retry
    }
  };

  const handleDeletePassword = (id: string) => {
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deletePassword(deleteConfirmId);
      setDeleteConfirmId(null);
    } catch {
      // Hook shows toast
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setIsShowingFavorites(false);
  };

  const handleShowFavorites = () => {
    setIsShowingFavorites(true);
    setSelectedCategory("all");
  };

  return (
    <PasswordManagerModuleShell showContent={showContent}>
      <div className={PASSWORD_MANAGER_MAIN_COLUMN}>
        <div className="shrink-0">
          <PasswordStats
            totalPasswords={stats.total}
            strongPasswords={stats.strong}
            weakPasswords={stats.weak}
            favorites={stats.favorites}
          />
        </div>

        <div className={PASSWORD_MANAGER_CONTENT_GRID}>
          <div className="col-span-3 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden">
            <div className={PASSWORD_MANAGER_PANEL_SECTION}>
              <div className={PASSWORD_MANAGER_PANEL_CARD}>
                <div className="flex h-10 flex-shrink-0 items-center border-b border-brand-blue/15 px-4">
                  <h3 className="text-sm font-semibold leading-none text-foreground">Categories</h3>
                </div>
                <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {!showContent ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-brand-blue" aria-hidden />
                      <span className="sr-only">Loading categories</span>
                    </div>
                  ) : (
                    <CategoryFilter
                      categories={categoriesWithCounts}
                      selectedCategory={selectedCategory}
                      onSelectCategory={handleCategorySelect}
                      showFavoritesCount={stats.favorites}
                      onShowFavorites={handleShowFavorites}
                      isShowingFavorites={isShowingFavorites}
                    />
                  )}
                </div>
                <PasswordSidebarFooter
                  totalCategories={categoriesWithCounts.length}
                  totalPasswords={passwords.length}
                />
              </div>
            </div>
          </div>

          <div className="col-span-9 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden">
            <div className={PASSWORD_MANAGER_PANEL_SECTION}>
              <div className={PASSWORD_MANAGER_PANEL_CARD}>
                {!showContent ? (
                  <div className="flex min-h-[200px] flex-1 flex-col items-center justify-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-blue" aria-hidden />
                    <p className="text-sm text-muted-foreground">Loading passwords…</p>
                    <span className="sr-only">Loading passwords</span>
                  </div>
                ) : (
                  <>
                    <div className="flex-shrink-0 border-b border-brand-blue/15 bg-brand-blue/5 px-3 py-2">
                      <SearchAndFilter
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        selectedCategory={selectedCategory}
                        onCategoryChange={handleCategorySelect}
                        categories={categoriesWithCounts}
                        onAddPassword={handleAddPassword}
                      />
                    </div>
                    <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <div className="p-3">
                        <PasswordList
                          passwords={filteredPasswords}
                          categories={categoriesWithCounts}
                          onEdit={handleEditPassword}
                          onDelete={handleDeletePassword}
                          onToggleFavorite={toggleFavorite}
                          onReveal={revealPassword}
                        />
                      </div>
                    </div>
                    <PasswordListFooter
                      totalPasswords={passwords.length}
                      filteredPasswords={filteredPasswords.length}
                      selectedCategoryName={
                        selectedCategory === "all"
                          ? undefined
                          : categories.find((c) => c.id === selectedCategory)?.name
                      }
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
        aria-hidden
      />

      <AddPasswordDialog
        key={`${editingPassword?.id || "new"}-${dialogOpen ? "open" : "closed"}`}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingPassword(null);
        }}
        onSave={handleSavePassword}
        editPassword={editingPassword}
        categories={categoriesWithCounts}
      />

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete password</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this password? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PasswordManagerModuleShell>
  );
};

export default PasswordManagerPage;
