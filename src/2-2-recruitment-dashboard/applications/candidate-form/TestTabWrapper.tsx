import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { DiscTestTab } from './DiscTestTab';
import { CognitiveTestTab } from './CognitiveTestTab';
import { SjtTestTab } from './SjtTestTab';
import { ClipboardList, Brain, Scale } from 'lucide-react';

export interface TestTabWrapperProps {
  candidateProfileId: string;
  recruitmentToken: string;
  onTestCompleted?: () => void;
  candidate?: any;
  onUpdate?: (data: any) => void;
  isReadOnly?: boolean;
  isHRView?: boolean;
  /** DISC test must be completed before candidate can take Cognitive test */
  hasDiscCompleted?: boolean;
  /** Cognitive test must be completed before candidate can take SJT */
  hasCognitiveCompleted?: boolean;
}

/** Wrapper for the main "Test" tab: shows sub-tabs (DISC Test, Test Kognitif, Tes Situasi Kerja). */
export function TestTabWrapper({
  candidateProfileId,
  recruitmentToken,
  onTestCompleted,
  isHRView,
  hasDiscCompleted = false,
  hasCognitiveCompleted = false,
}: TestTabWrapperProps) {
  const [activeSubTab, setActiveSubTab] = useState('disc');

  return (
    <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="h-full flex flex-col">
      <TabsList className="w-full justify-start gap-1 flex-shrink-0 mb-3">
        <TabsTrigger value="disc" className="gap-2">
          <ClipboardList className="h-4 w-4" />
          DISC Test
        </TabsTrigger>
        <TabsTrigger value="cognitive" className="gap-2">
          <Brain className="h-4 w-4" />
          Test Kognitif
        </TabsTrigger>
        <TabsTrigger value="sjt" className="gap-2">
          <Scale className="h-4 w-4" />
          Tes Situasi Kerja
        </TabsTrigger>
      </TabsList>
      <TabsContent value="disc" className="flex-1 overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
        <DiscTestTab
          candidateProfileId={candidateProfileId}
          recruitmentToken={recruitmentToken}
          onTestCompleted={onTestCompleted}
          isHRView={isHRView}
        />
      </TabsContent>
      <TabsContent value="cognitive" className="flex-1 overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
        <CognitiveTestTab
          candidateProfileId={candidateProfileId}
          recruitmentToken={recruitmentToken}
          onTestCompleted={onTestCompleted}
          isHRView={isHRView}
          hasDiscCompleted={hasDiscCompleted}
        />
      </TabsContent>
      <TabsContent value="sjt" className="flex-1 overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
        <SjtTestTab
          candidateProfileId={candidateProfileId}
          recruitmentToken={recruitmentToken}
          onTestCompleted={onTestCompleted}
          isHRView={isHRView}
          hasDiscCompleted={hasDiscCompleted}
          hasCognitiveCompleted={hasCognitiveCompleted}
        />
      </TabsContent>
    </Tabs>
  );
}
