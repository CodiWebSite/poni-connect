import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, Search, Filter, X, SlidersHorizontal } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';

interface HRRequestFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
  departments: string[];
  totalCount: number;
  filteredCount: number;
}

export interface FilterState {
  search: string;
  status: string;
  type: string;
  department: string;
  dateFrom: string;
  dateTo: string;
}

const initialFilters: FilterState = {
  search: '',
  status: 'all',
  type: 'all',
  department: 'all',
  dateFrom: '',
  dateTo: ''
};

const HRRequestFilters = ({ onFiltersChange, departments, totalCount, filteredCount }: HRRequestFiltersProps) => {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [isOpen, setIsOpen] = useState(false);

  const updateFilter = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    onFiltersChange(initialFilters);
  };

  const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'search') return value !== '';
    return value !== 'all' && value !== '';
  }).length;

  const requestTypes = [
    { value: 'concediu', label: 'Concediu' },
    { value: 'delegatie', label: 'Delegație' },
    { value: 'adeverinta', label: 'Adeverință' },
    { value: 'demisie', label: 'Demisie' }
  ];

  const statusOptions = [
    { value: 'pending', label: 'În așteptare' },
    { value: 'approved', label: 'Aprobat' },
    { value: 'rejected', label: 'Respins' }
  ];

  return (
    <div className="space-y-3">
      {/* Quick search and filter toggle */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Caută după nume, departament..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="flex gap-2">
          <Select value={filters.status} onValueChange={(v) => updateFilter('status', v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toate</SelectItem>
              {statusOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="relative">
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                Filtre
                {activeFiltersCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 w-5 h-5 p-0 flex items-center justify-center text-xs"
                  >
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Filtre avansate</h4>
                  {activeFiltersCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="w-3 h-3 mr-1" />
                      Resetează
                    </Button>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label>Tip cerere</Label>
                  <Select value={filters.type} onValueChange={(v) => updateFilter('type', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Toate tipurile" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toate tipurile</SelectItem>
                      {requestTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Departament</Label>
                  <Select value={filters.department} onValueChange={(v) => updateFilter('department', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Toate departamentele" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toate departamentele</SelectItem>
                      {departments.map(dept => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Perioada</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">De la</Label>
                      <Input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => updateFilter('dateFrom', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Până la</Label>
                      <Input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => updateFilter('dateTo', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      {/* Active filters display */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtre active:</span>
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              Căutare: "{filters.search}"
              <X className="w-3 h-3 cursor-pointer" onClick={() => updateFilter('search', '')} />
            </Badge>
          )}
          {filters.status !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              Status: {statusOptions.find(s => s.value === filters.status)?.label}
              <X className="w-3 h-3 cursor-pointer" onClick={() => updateFilter('status', 'all')} />
            </Badge>
          )}
          {filters.type !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              Tip: {requestTypes.find(t => t.value === filters.type)?.label}
              <X className="w-3 h-3 cursor-pointer" onClick={() => updateFilter('type', 'all')} />
            </Badge>
          )}
          {filters.department !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              Dept: {filters.department}
              <X className="w-3 h-3 cursor-pointer" onClick={() => updateFilter('department', 'all')} />
            </Badge>
          )}
          {(filters.dateFrom || filters.dateTo) && (
            <Badge variant="secondary" className="gap-1">
              Perioadă: {filters.dateFrom || '...'} - {filters.dateTo || '...'}
              <X className="w-3 h-3 cursor-pointer" onClick={() => { updateFilter('dateFrom', ''); updateFilter('dateTo', ''); }} />
            </Badge>
          )}
          <span className="text-xs text-muted-foreground ml-2">
            {filteredCount} din {totalCount} cereri
          </span>
        </div>
      )}
    </div>
  );
};

export default HRRequestFilters;
