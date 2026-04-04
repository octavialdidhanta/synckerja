import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Pencil } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import type { SectionType } from '../utils/parseScriptSections';

interface RevisionSectionWrapperProps {
  sectionId: string;
  sectionType: SectionType;
  content: string;
  children: React.ReactNode;
  onRevisi: (sectionId: string, content: string, sectionType: SectionType) => void;
  disabled?: boolean;
}

const SECTION_LABELS: Record<SectionType, string> = {
  concept: 'Concept',
  judul: 'Judul Script',
  formatStyle: 'Format & Style',
  table: 'Tabel',
  caption: 'Caption',
  hashtag: 'Hashtag',
};

export const RevisionSectionWrapper: React.FC<RevisionSectionWrapperProps> = ({
  sectionId,
  sectionType,
  content,
  children,
  onRevisi,
  disabled = false,
}) => {
  const { t } = useAppTranslation();
  const label = SECTION_LABELS[sectionType];

  return (
    <div className="group relative">
      <div className="relative">
        {children}
        {content && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 h-8 w-8"
            onClick={() => onRevisi(sectionId, content, sectionType)}
            disabled={disabled}
            title={t('scriptGenerator.revisi.button', 'Revisi')}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
