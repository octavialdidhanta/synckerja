interface PasswordSidebarFooterProps {
  totalCategories: number;
  totalPasswords: number;
}

export const PasswordSidebarFooter = ({
  totalCategories,
  totalPasswords,
}: PasswordSidebarFooterProps) => {
  return (
    <div className="flex h-9 flex-shrink-0 items-center border-t border-brand-blue/15 bg-brand-blue/5 px-4">
      <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
        <span>{totalCategories} categories</span>
        <span>{totalPasswords} passwords</span>
      </div>
    </div>
  );
};
