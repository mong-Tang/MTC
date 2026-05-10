import React, { useState } from 'react';
import { ConverterFileList } from '../converter/ConverterFileList';
import { ConverterFooter } from '../converter/ConverterFooter';
import { ConverterOptions } from '../converter/ConverterOptions';
import { ConverterPanelShell } from '../converter/ConverterPanelShell';
import { ConverterToolbar } from '../converter/ConverterToolbar';

export type ConverterMode = 'merge' | 'split';
export interface ConverterSourceItem {
  name: string;
  path: string;
  type: string;
}

interface ConverterPanelProps {
  sourceItems: ConverterSourceItem[];
  onAddSource: () => void;
  onAddAllSource: () => void;
  onClearSource: () => void;
  onRemoveSourceItem: (path: string) => void;
}

export const ConverterPanel: React.FC<ConverterPanelProps> = ({ sourceItems, onAddSource, onAddAllSource, onClearSource, onRemoveSourceItem }) => {
  const [mode, setMode] = useState<ConverterMode>('merge');

  return (
    <ConverterPanelShell>
      <ConverterToolbar
        mode={mode}
        onChangeMode={setMode}
      />
      <div className="converter-panel-body">
        <div className="converter-workbench-grid">
          <section className="converter-pane">
            <ConverterFileList
              mode={mode}
              items={sourceItems}
              onAdd={onAddSource}
              onAddAll={onAddAllSource}
              onClear={onClearSource}
              onRemoveItem={onRemoveSourceItem}
            />
          </section>
          <section className="converter-pane">
            <ConverterOptions mode={mode} />
          </section>
        </div>
      </div>
      <ConverterFooter mode={mode} />
    </ConverterPanelShell>
  );
};
