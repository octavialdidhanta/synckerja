import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { ScriptGeneratorPanelFooter } from './ScriptGeneratorPanelFooter';
import {
  SCRIPT_GENERATOR_GRID_FORM_HIDDEN,
  SCRIPT_GENERATOR_GRID_FORM_SHOWN,
  SCRIPT_GENERATOR_MAIN_GRID,
  SCRIPT_GENERATOR_TABLE_SECTION,
} from './scriptGeneratorLayout';

type Props = {
  formHidden: boolean;
  formPanel?: ReactNode;
  promptPanel: ReactNode;
  resultPanel: ReactNode;
  count?: number;
};

export function ScriptGeneratorWorkspace({
  formHidden,
  formPanel,
  promptPanel,
  resultPanel,
  count,
}: Props) {
  return (
    <div
      className={cn(
        SCRIPT_GENERATOR_MAIN_GRID,
        formHidden ? SCRIPT_GENERATOR_GRID_FORM_HIDDEN : SCRIPT_GENERATOR_GRID_FORM_SHOWN,
      )}
    >
      {!formHidden && formPanel ? (
        <div className={SCRIPT_GENERATOR_TABLE_SECTION}>{formPanel}</div>
      ) : null}
      <div className={SCRIPT_GENERATOR_TABLE_SECTION}>{promptPanel}</div>
      <div className={SCRIPT_GENERATOR_TABLE_SECTION}>
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{resultPanel}</div>
          <ScriptGeneratorPanelFooter count={count} />
        </div>
      </div>
    </div>
  );
}
