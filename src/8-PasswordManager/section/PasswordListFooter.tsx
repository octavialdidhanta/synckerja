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
    <div className="flex-shrink-0 border-t border-brand-blue/15 bg-brand-blue/5 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing {filteredPasswords} of {totalPasswords} passwords{categoryText}
        </span>
        <span className="text-xs text-muted-foreground/80">Total: {totalPasswords} passwords</span>
      </div>
    </div>
  );
};
