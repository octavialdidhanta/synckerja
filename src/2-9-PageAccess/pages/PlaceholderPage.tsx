import { Button } from "@/shared/components/ui/button";

interface PlaceholderPageProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}

export const PlaceholderPage = ({
  title,
  description = "Fitur ini sedang dalam pengembangan...",
  icon,
}: PlaceholderPageProps) => {
  return (
    <div className="bg-background flex min-h-0 flex-1 flex-col items-center justify-center p-6 font-sans">
      <div className="mx-auto max-w-md text-center">
        {icon && (
          <div className="bg-muted mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full">
            {icon}
          </div>
        )}

        <div className="border-border bg-card rounded-lg border p-8 shadow-sm">
          <h1 className="text-foreground mb-4 text-2xl font-bold">{title}</h1>

          <p className="text-muted-foreground mb-6">{description}</p>

          <Button onClick={() => window.history.back()}>Kembali</Button>
        </div>

        <p className="text-muted-foreground mt-4 text-sm">
          Hubungi administrator untuk informasi lebih lanjut
        </p>
      </div>
    </div>
  );
};
