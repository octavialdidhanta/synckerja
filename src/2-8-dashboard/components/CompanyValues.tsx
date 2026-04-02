
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { Plus, X } from 'lucide-react';
import { useCompanyValues } from '../hooks';

export const CompanyValues = () => {
  const { companyValues, isLoading, addValue, removeValue, isAddingValue } = useCompanyValues();
  const [newValue, setNewValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddValue = () => {
    if (newValue.trim()) {
      addValue(newValue.trim());
      setNewValue('');
      setIsAdding(false);
    }
  };

  const handleRemoveValue = (valueId: string) => {
    removeValue(valueId);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddValue();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewValue('');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Company Values</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-muted-foreground">Loading company values...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg sm:text-xl font-semibold truncate">Company Values</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4">
        {companyValues.length === 0 && !isAdding ? (
          <div className="text-center py-4 sm:py-6">
            <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">No company values added yet</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAdding(true)}
              className="flex items-center space-x-2 mx-auto"
            >
              <Plus className="h-4 w-4" />
              <span>Add Value</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            <div className="flex flex-wrap gap-2">
              {companyValues.map((value) => (
                <Badge
                  key={value.id}
                  variant="secondary"
                  className="text-xs sm:text-sm px-2 sm:px-3 py-1 flex items-center space-x-1 sm:space-x-2 max-w-full"
                >
                  <span className="truncate">{value.value_text}</span>
                  <button
                    onClick={() => handleRemoveValue(value.id)}
                    className="ml-1 hover:text-destructive flex-shrink-0"
                    aria-label="Remove value"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            
            {isAdding ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-2">
                <Input
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Enter company value"
                  className="flex-1 text-xs sm:text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={handleAddValue}
                    disabled={isAddingValue}
                    className="flex-1 sm:flex-none"
                  >
                    {isAddingValue ? 'Adding...' : 'Add'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsAdding(false);
                      setNewValue('');
                    }}
                    className="flex-1 sm:flex-none"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAdding(true)}
                className="flex items-center space-x-2 w-full sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                <span>Add Value</span>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
