import type React from "react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";
import {
  Star,
  Globe,
  Mail,
  CreditCard,
  Briefcase,
  Lock,
  Wrench,
  BookOpen,
  Sparkles,
  ShoppingBag,
  Heart,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  icon: string;
  count: number;
}

interface CategoryFilterProps {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
  showFavoritesCount: number;
  onShowFavorites: () => void;
  isShowingFavorites: boolean;
}

const iconMap: Record<string, React.ReactNode> = {
  star: <Star className="h-4 w-4" />,
  globe: <Globe className="h-4 w-4" />,
  mail: <Mail className="h-4 w-4" />,
  card: <CreditCard className="h-4 w-4" />,
  briefcase: <Briefcase className="h-4 w-4" />,
  lock: <Lock className="h-4 w-4" />,
  wrench: <Wrench className="h-4 w-4" />,
  "book-open": <BookOpen className="h-4 w-4" />,
  sparkles: <Sparkles className="h-4 w-4" />,
  "shopping-bag": <ShoppingBag className="h-4 w-4" />,
  heart: <Heart className="h-4 w-4" />,
};

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  showFavoritesCount,
  onShowFavorites,
  isShowingFavorites,
}) => {
  return (
    <div className="space-y-1">
      <h3 className="mb-2 px-2 text-xs font-semibold text-muted-foreground">FILTERS</h3>

      <Button
        variant={isShowingFavorites ? "secondary" : "ghost"}
        className={cn(
          "h-9 w-full justify-start px-2",
          isShowingFavorites && "bg-amber-500/10",
        )}
        onClick={onShowFavorites}
        size="sm"
      >
        <Star
          className={cn(
            "mr-2 h-4 w-4",
            isShowingFavorites && "fill-amber-400 text-amber-500",
          )}
        />
        <span className="text-sm">Favorites</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          {showFavoritesCount}
        </Badge>
      </Button>

      <Button
        variant={selectedCategory === "all" && !isShowingFavorites ? "secondary" : "ghost"}
        className="h-9 w-full justify-start px-2"
        onClick={() => onSelectCategory("all")}
        size="sm"
      >
        <Globe className="mr-2 h-4 w-4" />
        <span className="text-sm">All Passwords</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          {categories.reduce((sum, cat) => sum + cat.count, 0)}
        </Badge>
      </Button>

      <div className="pt-3">
        <h3 className="mb-2 px-2 text-xs font-semibold text-muted-foreground">CATEGORIES</h3>
        {categories.map((category) => (
          <Button
            key={category.id}
            variant={
              selectedCategory === category.id && !isShowingFavorites ? "secondary" : "ghost"
            }
            className="mb-0.5 h-9 w-full justify-start px-2"
            onClick={() => onSelectCategory(category.id)}
            size="sm"
          >
            {iconMap[category.icon] || <Lock className="h-4 w-4" />}
            <span className="ml-2 text-sm">{category.name}</span>
            <Badge variant="secondary" className="ml-auto text-xs">
              {category.count}
            </Badge>
          </Button>
        ))}
      </div>
    </div>
  );
};
