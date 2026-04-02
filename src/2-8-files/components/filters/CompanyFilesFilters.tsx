import { Search, RefreshCw, Upload } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';

interface CompanyFilesFiltersProps {
  onUploadFile?: () => void;
}

export const CompanyFilesFilters = ({ onUploadFile }: CompanyFilesFiltersProps) => {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Search Input */}
        <div className="relative min-w-[150px] flex-1">
          <Search className="absolute right-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search files..."
            className="h-9 w-full border-border pl-4 pr-10 text-sm text-foreground ring-ring focus-visible:ring-2"
          />
        </div>

        {/* File Type Filter */}
        <Select>
          <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-36 lg:w-40">
            <SelectValue placeholder="File Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="image">Images</SelectItem>
            <SelectItem value="document">Documents</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
          </SelectContent>
        </Select>

        {/* File Size Filter */}
        <Select>
          <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-36 lg:w-40">
            <SelectValue placeholder="File Size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sizes</SelectItem>
            <SelectItem value="small">Small (&lt; 1MB)</SelectItem>
            <SelectItem value="medium">Medium (1-10MB)</SelectItem>
            <SelectItem value="large">Large (10-100MB)</SelectItem>
            <SelectItem value="xlarge">Extra Large (&gt; 100MB)</SelectItem>
          </SelectContent>
        </Select>

        {/* Date Filter */}
        <Select>
          <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-36 lg:w-40">
            <SelectValue placeholder="Date Uploaded" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="this_week">This Week</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
            <SelectItem value="last_3_months">Last 3 Months</SelectItem>
            <SelectItem value="this_year">This Year</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear Filters Button */}
        <button
          type="button"
          className="flex h-9 items-center justify-center rounded-md border border-border px-3 transition-colors hover:bg-muted"
          title="Clear all filters"
        >
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Upload File Button */}
        {onUploadFile && (
          <Button onClick={onUploadFile} className="flex h-9 items-center gap-1.5 whitespace-nowrap px-3 text-sm">
            <Upload className="h-4 w-4" />
            Upload File
          </Button>
        )}
      </div>
    </div>
  );
};
