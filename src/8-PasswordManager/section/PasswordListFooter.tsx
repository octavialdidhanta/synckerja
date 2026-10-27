interface PasswordListFooterProps {
  totalPasswords: number;
  filteredPasswords: number;
  selectedCategoryName?: string | null;
}

export const PasswordListFooter = ({
  totalPasswords,
  filteredPasswords,
  selectedCategoryName,
}: PasswordListFooterProps) => {
  const categoryText = selectedCategoryName ? ` in ${selectedCategoryName}` : "";

  return (
    <div className="flex h-9 flex-shrink-0 items-center border-t border-brand-blue/15 bg-brand-blue/5 px-4">
      <p className="text-xs text-muted-foreground">
        Showing {filteredPasswords} of {totalPasswords} passwords{categoryText}
      </p>
    </div>
  );
};
