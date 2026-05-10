import React from 'react';
import type { ConverterMode } from '../layout/ConverterPanel';

interface ConverterToolbarProps {
  mode: ConverterMode;
  onChangeMode: (mode: ConverterMode) => void;
  sourceCount: number;
  onAdd: () => void;
  onAddAll: () => void;
  onClearAll: () => void;
}

export const ConverterToolbar: React.FC<ConverterToolbarProps> = ({ mode, onChangeMode, sourceCount, onAdd, onAddAll, onClearAll }) => {
  return (
    <header className="converter-panel-header">
      <h2>컨버터</h2>
      <div className="converter-toolbar-actions">
        <span className="converter-source-count">선택 {sourceCount}</span>
        <button className="converter-mini-btn" type="button" onClick={onAdd}>
          + Add
        </button>
        <button className="converter-mini-btn" type="button" onClick={onAddAll}>
          Add All
        </button>
        <button className="converter-mini-btn" type="button" onClick={onClearAll}>
          Clear
        </button>
      </div>
      <div className="converter-mode-switch" role="tablist" aria-label="컨버터 모드">
        <button
          className={`converter-mode-btn ${mode === 'merge' ? 'active' : ''}`}
          onClick={() => onChangeMode('merge')}
          role="tab"
          aria-selected={mode === 'merge'}
          type="button"
        >
          병합
        </button>
        <button
          className={`converter-mode-btn ${mode === 'split' ? 'active' : ''}`}
          onClick={() => onChangeMode('split')}
          role="tab"
          aria-selected={mode === 'split'}
          type="button"
        >
          분할
        </button>
      </div>
    </header>
  );
};
