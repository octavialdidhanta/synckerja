interface PasswordSidebarFooterProps {
  totalCategories: number;
  totalPasswords: number;
}

export const PasswordSidebarFooter = ({
  totalCategories,
  totalPasswords,
}: PasswordSidebarFooterProps) => {
  return (
    <div className="flex-shrink-0 border-t border-brand-blue/15 bg-brand-blue/5 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Categories: {totalCategories}</span>
        <span className="text-xs text-muted-foreground/80">Total: {totalPasswords}</span>
      </div>
    </div>
  );
};
