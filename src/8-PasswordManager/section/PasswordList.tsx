import type React from "react";
import type { Password, Category } from "../types";
import { PasswordCard } from "./PasswordCard";

interface PasswordListProps {
  passwords: Password[];
  categories: Category[];
  onEdit: (password: Password) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export const PasswordList: React.FC<PasswordListProps> = ({
  passwords,
  categories,
  onEdit,
  onDelete,
  onToggleFavorite,
}) => {
  if (passwords.length === 0) {
    return (
      <div className="rounded-md border border-brand-blue/15 bg-card p-8 text-center shadow-sm">
        <p className="mb-1 text-base text-muted-foreground">No passwords found</p>
        <p className="text-sm text-muted-foreground">
          Click &quot;Add Password&quot; to create your first password entry
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {passwords.map((password) => (
        <PasswordCard
          key={password.id}
          password={password}
          categories={categories}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
};
