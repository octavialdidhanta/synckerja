import type React from "react";
import { useState, useMemo } from "react";
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
import { getPasswordStrength } from "../section/PasswordStrengthMeter";
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
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { Loader2 } from "lucide-react";

const PasswordManagerPage: React.FC = () => {
  const {
    passwords,
    categories,
    loading,
    addPassword,
    updatePassword,
    deletePassword,
    toggleFavorite,
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
    const strongCount = passwords.filter((p) => getPasswordStrength(p.password) === "strong").length;
    const weakCount = passwords.filter((p) => getPasswordStrength(p.password) === "weak").length;
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

  const handleEditPassword = (password: Password) => {
    setEditingPassword(password);
    setDialogOpen(true);
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
      <div className="col-span-12 flex min-h-0 flex-col">
        <div className="mb-1 flex-shrink-0">
          <PasswordStats
            totalPasswords={stats.total}
            strongPasswords={stats.strong}
            weakPasswords={stats.weak}
            favorites={stats.favorites}
          />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-12 gap-2">
          <div className="col-span-12 flex min-h-0 flex-col lg:col-span-3">
            <div className="flex max-h-[calc(100vh-180px)] min-h-0 flex-1 flex-col rounded-lg border border-brand-blue/20 bg-card shadow-sm ring-1 ring-brand-blue/10">
              <div className="flex-shrink-0 border-b border-brand-blue/15 px-4 py-1.5">
                <h3 className="text-sm font-semibold text-foreground">Categories</h3>
                <p className="mt-1 text-xs text-muted-foreground">Filter by category</p>
              </div>
              <div className="seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3">
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

          <div className="col-span-12 flex min-h-0 flex-col lg:col-span-9">
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex max-h-[calc(100vh-180px)] min-h-0 flex-1 flex-col rounded-lg border border-brand-blue/20 bg-card shadow-sm ring-1 ring-brand-blue/10">
                {!showContent ? (
                  <div className="flex min-h-[200px] flex-1 flex-col items-center justify-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-blue" aria-hidden />
                    <p className="text-sm text-muted-foreground">Loading passwords…</p>
                    <span className="sr-only">Loading passwords</span>
                  </div>
                ) : (
                  <>
                    <div className="flex-shrink-0 border-b border-brand-blue/15 bg-brand-blue/5 px-4 py-2">
                      <SearchAndFilter
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        selectedCategory={selectedCategory}
                        onCategoryChange={handleCategorySelect}
                        categories={categoriesWithCounts}
                        onAddPassword={handleAddPassword}
                      />
                    </div>
                    <div className="seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                      <div className="p-4">
                        <PasswordList
                          passwords={filteredPasswords}
                          categories={categoriesWithCounts}
                          onEdit={handleEditPassword}
                          onDelete={handleDeletePassword}
                          onToggleFavorite={toggleFavorite}
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

      <AddPasswordDialog
        key={`${editingPassword?.id || "new"}-${dialogOpen ? "open" : "closed"}`}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
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
