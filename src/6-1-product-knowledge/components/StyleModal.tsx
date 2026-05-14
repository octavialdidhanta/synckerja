import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { Palette, ChevronDown, Search } from 'lucide-react';
import { ProductKnowledgeStyle } from '../hooks/useProductKnowledgeStyle';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import './StyleModal.css';

interface StyleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { name: string; description: string; structure?: string; content_pillar_ids?: string[] }) => Promise<void>;
  isLoading?: boolean;
  initialData?: ProductKnowledgeStyle | null;
}

export const StyleModal: React.FC<StyleModalProps> = ({
  open,
  onOpenChange,
  onSave,
  isLoading = false,
  initialData = null,
}) => {
  const { t } = useAppTranslation();
  const { organizationId } = useCurrentOrg();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [structure, setStructure] = useState('');
  const [selectedPillarIds, setSelectedPillarIds] = useState<string[]>([]);
  const [contentPillars, setContentPillars] = useState<any[]>([]);
  const [isPillarPopoverOpen, setIsPillarPopoverOpen] = useState(false);
  const [pillarSearchQuery, setPillarSearchQuery] = useState('');

  // Load content pillars from table "content_pillars" column "name"
  // Fetch ALL accessible active pillars (default + organization-specific)
  useEffect(() => {
    const loadContentPillars = async () => {
      try {
        // Query: Get ALL active pillars that user has access to
        // Special handling to ensure Story Telling (id: 6a1093f8-2547-483b-9371-439a74e741dc) is included
        const storyTellingId = '6a1093f8-2547-483b-9371-439a74e741dc';
        
        // Get all accessible active pillars
        let query = supabase
          .from('content_pillars')
          .select('id, name, is_active, organization_id, is_default')
          .eq('is_active', true);
        
        // Build OR condition to get all accessible pillars
        // Include: default pillars, organization-specific pillars, and pillars with null org_id
        if (organizationId) {
          // Get default pillars OR organization-specific pillars OR pillars with null org_id
          query = query.or(`is_default.eq.true,organization_id.eq.${organizationId},organization_id.is.null`);
        } else {
          // Get default pillars OR pillars with null org_id
          query = query.or('is_default.eq.true,organization_id.is.null');
        }
        
        const { data, error } = await query
          .order('is_default', { ascending: false })
          .order('name', { ascending: true });
        
        if (error) {
          console.error('Error loading content pillars from content_pillars table:', error);
          setContentPillars([]);
          return;
        }
        
        if (!data || data.length === 0) {
          console.warn('No content pillars found in content_pillars table');
          setContentPillars([]);
          return;
        }
        
        // Check if Story Telling is in the results
        const hasStoryTellingInResults = data.some((p: any) => p.id === storyTellingId);
        if (!hasStoryTellingInResults) {
          console.warn('Story Telling (id: ' + storyTellingId + ') not found in query results. Trying to fetch it separately...');
          // Try to fetch Story Telling separately
          const { data: storyTellingData, error: storyTellingError } = await supabase
            .from('content_pillars')
            .select('id, name, is_active, organization_id, is_default')
            .eq('id', storyTellingId)
            .eq('is_active', true)
            .maybeSingle();
          
          if (storyTellingData && !storyTellingError) {
            console.log('Story Telling found separately:', storyTellingData);
            // Add Story Telling to the results
            data.push(storyTellingData);
          } else {
            console.error('Story Telling fetch error:', storyTellingError);
            console.warn('Story Telling pillar details:', {
              id: storyTellingId,
              organizationId: organizationId,
              queryResult: data.map((p: any) => ({ id: p.id, name: p.name, org_id: p.organization_id, is_default: p.is_default }))
            });
          }
        } else {
          console.log('Story Telling found in query results');
        }
        
        console.log(`Raw data from content_pillars: ${data.length} pillars`, data.map((p: any) => p.name));
        
        // Filter out pillars with invalid names
        // Remove duplicates by name (prefer organization-specific over default)
        const seenNames = new Map<string, any>();
        data.forEach((pillar: any) => {
          // Validate that pillar.name exists and is not empty
          if (!pillar.name || typeof pillar.name !== 'string' || pillar.name.trim() === '') {
            console.warn('Skipping pillar with invalid name:', pillar);
            return;
          }
          // Keep organization-specific over default if duplicate name exists
          const existing = seenNames.get(pillar.name);
          if (!existing || (pillar.organization_id && !existing.organization_id)) {
            seenNames.set(pillar.name, pillar);
          }
        });
        
        const filtered = Array.from(seenNames.values());
        
        console.log(`Loaded ${filtered.length} content pillars from content_pillars table:`, filtered.map((p: any) => p.name));
        // Check if Story Telling is in the list
        const hasStoryTelling = filtered.some((p: any) => 
          p.name.toLowerCase().includes('story') && p.name.toLowerCase().includes('telling')
        );
        if (!hasStoryTelling) {
          console.warn('Story Telling pillar not found in loaded pillars. Available pillars:', filtered.map((p: any) => p.name));
        }
        console.log(`Setting ${filtered.length} pillars to state. Total height estimate: ${filtered.length * 40}px`);
        setContentPillars(filtered);
      } catch (error) {
        console.error('Error loading content pillars from content_pillars table:', error);
        setContentPillars([]);
      }
    };
    
    if (open) {
      loadContentPillars();
    }
  }, [open, organizationId]);


  // Reset form when modal opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      if (initialData) {
        // Edit mode - populate with existing data
        setName(initialData.name || '');
        setDescription(initialData.description || '');
        setStructure(initialData.structure || '');
        setSelectedPillarIds(initialData.content_pillar_ids || []);
      } else {
        // Create mode - reset form
        setName('');
        setDescription('');
        setStructure('');
        setSelectedPillarIds([]);
      }
      // Reset search query when modal opens
      setPillarSearchQuery('');
    } else {
      // Close modal - reset form
      setName('');
      setDescription('');
      setStructure('');
      setSelectedPillarIds([]);
      setPillarSearchQuery('');
    }
  }, [open, initialData]);

  const handlePillarToggle = (pillarId: string) => {
    setSelectedPillarIds(prev => {
      if (prev.includes(pillarId)) {
        return prev.filter(id => id !== pillarId);
      } else {
        return [...prev, pillarId];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      return;
    }

    try {
      const saveData: { name: string; description: string; structure?: string; content_pillar_ids?: string[] } = {
        name: trimmedName,
        description: (description || '').trim(),
      };
      
      if (structure) {
        saveData.structure = structure.trim();
      }
      
      // Include content_pillar_ids (empty array means universal)
      saveData.content_pillar_ids = selectedPillarIds.length > 0 ? selectedPillarIds : [];
      
      console.log('Saving style data:', saveData);
      await onSave(saveData);
      // Reset form after successful save
      setName('');
      setDescription('');
      setStructure('');
      setSelectedPillarIds([]);
    } catch (error) {
      // Error handling is done in parent component
      console.error('Error saving style:', error);
    }
  };

  const handleCancel = () => {
    setName('');
    setDescription('');
    setStructure('');
    setSelectedPillarIds([]);
    onOpenChange(false);
  };

  const getSelectedPillarsText = () => {
    if (selectedPillarIds.length === 0) {
      return 'Semua Pillar (Universal)';
    }
    if (selectedPillarIds.length === 1) {
      const pillar = contentPillars.find(p => p.id === selectedPillarIds[0]);
      return pillar?.name || '1 Pillar dipilih';
    }
    return `${selectedPillarIds.length} Pillar dipilih`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-gray-700" />
              {initialData
                ? t('productKnowledge.style.modal.editTitle', 'Edit Style')
                : t('productKnowledge.style.modal.title', 'Add New Style')}
            </DialogTitle>
            <DialogDescription>
              {initialData
                ? t(
                    'productKnowledge.style.modal.editDescription',
                    'Update the style information'
                  )
                : t(
                    'productKnowledge.style.modal.description',
                    'Create a new style for creative content'
                  )}
            </DialogDescription>
          </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Style Name */}
            <div className="space-y-2">
              <Label htmlFor="style-name">
                {t('productKnowledge.style.modal.nameLabel', 'Style Name')} *
              </Label>
              <Input
                id="style-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('productKnowledge.style.modal.namePlaceholder', 'Enter style name')}
                disabled={isLoading}
                required
              />
            </div>

            {/* Style Description */}
            <div className="space-y-2">
              <Label htmlFor="style-description">
                {t('productKnowledge.style.modal.descriptionLabel', 'Description')}
              </Label>
              <Textarea
                id="style-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t(
                  'productKnowledge.style.modal.descriptionPlaceholder',
                  'Enter style description (optional)'
                )}
                disabled={isLoading}
                rows={4}
              />
            </div>

            {/* Style Structure */}
            <div className="space-y-2">
              <Label htmlFor="style-structure">
                {t('productKnowledge.style.modal.structureLabel', 'Structure')}
              </Label>
              <Textarea
                id="style-structure"
                value={structure}
                onChange={(e) => setStructure(e.target.value)}
                placeholder={t(
                  'productKnowledge.style.modal.structurePlaceholder',
                  'Enter style structure (optional)'
                )}
                disabled={isLoading}
                rows={4}
              />
            </div>

            {/* Content Pillars Multi-Select */}
            <div className="space-y-2">
              <Label htmlFor="content-pillars">
                Content Pillars (Opsional)
              </Label>
              <Popover 
                open={isPillarPopoverOpen} 
                onOpenChange={(open) => {
                  setIsPillarPopoverOpen(open);
                  if (!open) {
                    // Reset search when popover closes
                    setPillarSearchQuery('');
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between"
                    disabled={isLoading}
                  >
                    <span className={selectedPillarIds.length === 0 ? 'text-gray-500' : ''}>
                      {getSelectedPillarsText()}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-[var(--radix-popover-trigger-width)] p-0 bg-white border shadow-lg flex flex-col" 
                  align="start"
                  style={{ 
                    maxHeight: '400px',
                    height: '400px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                  }}
                >
                  {/* Search Bar */}
                  <div className="p-2 border-b flex-shrink-0 bg-white">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Cari content pillar..."
                        value={pillarSearchQuery}
                        onChange={(e) => setPillarSearchQuery(e.target.value)}
                        className="pl-8 h-8 text-sm"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  
                  {/* Scrollable Pillar List */}
                  <div 
                    className="seamless-scroll p-2 flex-1 min-h-0"
                    style={{
                      maxHeight: '320px',
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      WebkitOverflowScrolling: 'touch',
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none'
                    }}
                  >
                    {(() => {
                      const filteredPillars = contentPillars.filter((pillar) =>
                        pillar.name.toLowerCase().includes(pillarSearchQuery.toLowerCase())
                      );
                      
                      if (filteredPillars.length === 0) {
                        return (
                          <div className="p-2 text-sm text-gray-500 text-center">
                            {pillarSearchQuery 
                              ? `Tidak ada pillar yang cocok dengan "${pillarSearchQuery}"`
                              : 'Tidak ada content pillar tersedia'}
                          </div>
                        );
                      }
                      
                      return (
                        <div className="space-y-1">
                          {filteredPillars.map((pillar) => {
                            const isSelected = selectedPillarIds.includes(pillar.id);
                            return (
                              <div
                                key={pillar.id}
                                className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors"
                                onClick={() => handlePillarToggle(pillar.id)}
                              >
                                <Checkbox
                                  id={`pillar-${pillar.id}`}
                                  checked={isSelected}
                                  onCheckedChange={() => handlePillarToggle(pillar.id)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <label
                                  htmlFor={`pillar-${pillar.id}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1 select-none"
                                >
                                  {pillar.name}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                  
                  {/* Footer */}
                  <div className="border-t p-2 bg-gray-50">
                    <p className="text-xs text-gray-500">
                      Kosongkan semua untuk membuat style universal (semua pillar)
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              {t('productKnowledge.style.modal.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading
                ? t('productKnowledge.style.modal.saving', 'Saving...')
                : t('productKnowledge.style.modal.save', 'Save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

