import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { setAppLanguage, type SupportedLanguage } from "@/shared/i18n/index.ts";

export default function SettingsPage() {
  const { t, i18n } = useTranslation();

  const onLang = (value: string) => {
    setAppLanguage(value as SupportedLanguage);
  };

  return (
    <div className="min-h-[100dvh] p-6 max-w-lg mx-auto space-y-8 seamless-scroll max-h-[calc(100vh-120px)] overflow-y-auto">
      <div>
        <Button variant="ghost" asChild className="mb-4 -ml-2">
          <Link to="/">{t("settings.back")}</Link>
        </Button>
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
      </div>
      <div className="space-y-2">
        <Label>{t("settings.language")}</Label>
        <Select value={i18n.language?.startsWith("en") ? "en" : "id"} onValueChange={onLang}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="id">{t("settings.langId")}</SelectItem>
            <SelectItem value="en">{t("settings.langEn")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
