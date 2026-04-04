
import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Search, Filter, X, Download } from 'lucide-react';
import { CRMFilters as CRMFiltersType } from '@/shared/types/operationsConsultant';
import { useAvailableEmployees } from '@/shared/hooks/useAvailableEmployees';

interface CRMFiltersProps {
  filters: CRMFiltersType;
  onFiltersChange: (filters: CRMFiltersType) => void;
  totalLeads: number;
}

export const CRMFilters: React.FC<CRMFiltersProps> = ({ 
  filters, 
  onFiltersChange, 
  totalLeads 
}) => {
  const [showFilters, setShowFilters] = React.useState(false);
  const { data: employees = [] } = useAvailableEmployees();
  const konsultanOptions = employees.map((e) => e.full_name || e.email).filter(Boolean);

  const sumberLeadOptions = ['Google Ads', 'Sosmed.Ads', 'TICKETCODE', 'Referral', 'Website', 'WhatsApp'];
  const diagnosaOptions = ['Kulit', 'Gigi', 'PMS', 'Mata', 'THT', 'Umum'];
  const statusFollowUpOptions = ['F1', 'F2', 'F3', 'Selesai', 'Tidak Respon', 'Datang'];
  const kategoriPasienOptions = ['Efektif', 'Tidak Efektif', 'Diluar Layanan'];

  const handleFilterChange = (filterType: keyof CRMFiltersType, value: any) => {
    onFiltersChange({
      ...filters,
      [filterType]: value
    });
  };

  const handleMultiSelectChange = (filterType: keyof CRMFiltersType, option: string, checked: boolean) => {
    const currentValues = filters[filterType] as string[];
    const newValues = checked 
      ? [...currentValues, option]
      : currentValues.filter(v => v !== option);
    
    handleFilterChange(filterType, newValues);
  };

  const clearAllFilters = () => {
    onFiltersChange({
      sumberLead: [],
      diagnosa: [],
      statusFollowUp: [],
      konsultan: [],
      kategoriPasien: [],
      dateRange: { from: null, to: null },
      searchQuery: ''
    });
  };

  const activeFiltersCount = 
    filters.sumberLead.length + 
    filters.diagnosa.length + 
    filters.statusFollowUp.length + 
    filters.konsultan.length + 
    filters.kategoriPasien.length +
    (filters.searchQuery ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-1 gap-2 items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Cari nama pasien..."
                  value={filters.searchQuery}
                  onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filter
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {totalLeads} leads ditemukan
              </span>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filter Lanjutan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Sumber Lead Filter */}
              <div>
                <h4 className="font-medium mb-3">Sumber Lead</h4>
                <div className="space-y-2">
                  {sumberLeadOptions.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox
                        id={`sumber-${option}`}
                        checked={filters.sumberLead.includes(option)}
                        onCheckedChange={(checked) => 
                          handleMultiSelectChange('sumberLead', option, checked as boolean)
                        }
                      />
                      <label htmlFor={`sumber-${option}`} className="text-sm font-medium">
                        {option}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Diagnosa Filter */}
              <div>
                <h4 className="font-medium mb-3">Diagnosa</h4>
                <div className="space-y-2">
                  {diagnosaOptions.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox
                        id={`diagnosa-${option}`}
                        checked={filters.diagnosa.includes(option)}
                        onCheckedChange={(checked) => 
                          handleMultiSelectChange('diagnosa', option, checked as boolean)
                        }
                      />
                      <label htmlFor={`diagnosa-${option}`} className="text-sm font-medium">
                        {option}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Follow Up Filter */}
              <div>
                <h4 className="font-medium mb-3">Status Follow Up</h4>
                <div className="space-y-2">
                  {statusFollowUpOptions.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${option}`}
                        checked={filters.statusFollowUp.includes(option)}
                        onCheckedChange={(checked) => 
                          handleMultiSelectChange('statusFollowUp', option, checked as boolean)
                        }
                      />
                      <label htmlFor={`status-${option}`} className="text-sm font-medium">
                        {option}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Konsultan Filter */}
              <div>
                <h4 className="font-medium mb-3">Konsultan</h4>
                <div className="space-y-2">
                  {konsultanOptions.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox
                        id={`konsultan-${option}`}
                        checked={filters.konsultan.includes(option)}
                        onCheckedChange={(checked) => 
                          handleMultiSelectChange('konsultan', option, checked as boolean)
                        }
                      />
                      <label htmlFor={`konsultan-${option}`} className="text-sm font-medium">
                        {option}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Kategori Pasien Filter */}
              <div>
                <h4 className="font-medium mb-3">Kategori Pasien</h4>
                <div className="space-y-2">
                  {kategoriPasienOptions.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox
                        id={`kategori-${option}`}
                        checked={filters.kategoriPasien.includes(option)}
                        onCheckedChange={(checked) => 
                          handleMultiSelectChange('kategoriPasien', option, checked as boolean)
                        }
                      />
                      <label htmlFor={`kategori-${option}`} className="text-sm font-medium">
                        {option}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.searchQuery && (
            <Badge variant="outline" className="flex items-center gap-1">
              Search: {filters.searchQuery}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => handleFilterChange('searchQuery', '')}
              />
            </Badge>
          )}
          {filters.sumberLead.map(item => (
            <Badge key={item} variant="outline" className="flex items-center gap-1">
              Sumber: {item}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => handleMultiSelectChange('sumberLead', item, false)}
              />
            </Badge>
          ))}
          {filters.diagnosa.map(item => (
            <Badge key={item} variant="outline" className="flex items-center gap-1">
              Diagnosa: {item}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => handleMultiSelectChange('diagnosa', item, false)}
              />
            </Badge>
          ))}
          {filters.statusFollowUp.map(item => (
            <Badge key={item} variant="outline" className="flex items-center gap-1">
              Status: {item}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => handleMultiSelectChange('statusFollowUp', item, false)}
              />
            </Badge>
          ))}
          {filters.konsultan.map(item => (
            <Badge key={item} variant="outline" className="flex items-center gap-1">
              Konsultan: {item}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => handleMultiSelectChange('konsultan', item, false)}
              />
            </Badge>
          ))}
          {filters.kategoriPasien.map(item => (
            <Badge key={item} variant="outline" className="flex items-center gap-1">
              Kategori: {item}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => handleMultiSelectChange('kategoriPasien', item, false)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};
