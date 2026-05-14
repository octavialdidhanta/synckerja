import { Search, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import type { PiutangFilterMode, PiutangVerificationFilterMode } from '../types/piutang.types';

type PiutangFiltersProps = {
  search: string;
  status: PiutangFilterMode;
  verification: PiutangVerificationFilterMode;
  onSearchChange: (v: string) => void;
  onStatusChange: (v: PiutangFilterMode) => void;
  onVerificationChange: (v: PiutangVerificationFilterMode) => void;
  onClearFilters: () => void;
};

export function PiutangFilters({
  search,
  status,
  verification,
  onSearchChange,
  onStatusChange,
  onVerificationChange,
  onClearFilters,
}: PiutangFiltersProps) {
  const hasActiveFilters =
    Boolean(search.trim()) || status !== 'open' || verification !== 'all';

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="relative min-w-[150px] flex-1">
          <Search className="absolute right-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
          <Input
            type="text"
            placeholder="Cari klien / layanan…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 w-full rounded-md border border-gray-300 pl-4 pr-10 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <Select value={status} onValueChange={(v) => onStatusChange(v as PiutangFilterMode)}>
          <SelectTrigger className="h-9 w-full text-left text-sm text-gray-700 placeholder:text-gray-700 sm:w-36 lg:w-40">
            <SelectValue placeholder="Status piutang" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Terbuka (sisa / perlu verifikasi)</SelectItem>
            <SelectItem value="settled">Lunas</SelectItem>
            <SelectItem value="all">Semua</SelectItem>
          </SelectContent>
        </Select>

        <Select value={verification} onValueChange={(v) => onVerificationChange(v as PiutangVerificationFilterMode)}>
          <SelectTrigger className="h-9 w-full text-left text-sm text-gray-700 placeholder:text-gray-700 sm:w-36 lg:w-44">
            <SelectValue placeholder="Verifikasi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Verifikasi: semua</SelectItem>
            <SelectItem value="unchecked">Belum dicek</SelectItem>
            <SelectItem value="approved">OK</SelectItem>
            <SelectItem value="rejected">Ditolak</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters ? (
          <Button variant="outline" size="sm" onClick={onClearFilters} className="h-9 px-3 text-sm">
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
