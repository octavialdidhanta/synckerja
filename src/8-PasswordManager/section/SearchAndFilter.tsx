import type React from "react";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Search, SlidersHorizontal, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

interface SearchAndFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  categories: Array<{ id: string; name: string }>;
  onAddPassword: () => void;
}

export const SearchAndFilter: React.FC<SearchAndFilterProps> = ({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  categories,
  onAddPassword,
}) => {
  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <h2 className="flex h-10 shrink-0 items-center whitespace-nowrap text-lg font-semibold leading-none text-gray-900">
        Passwords
      </h2>
      <div className="relative min-w-[140px] flex-1">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search passwords..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-10 pr-9"
        />
      </div>

      <Select value={selectedCategory} onValueChange={onCategoryChange}>
        <SelectTrigger className="h-10 w-[180px] shrink-0">
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          <SelectValue placeholder="All Categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button type="button" onClick={onAddPassword} className="h-10 shrink-0 whitespace-nowrap">
        <Plus className="mr-2 h-4 w-4" />
        Add Password
      </Button>
    </div>
  );
};
