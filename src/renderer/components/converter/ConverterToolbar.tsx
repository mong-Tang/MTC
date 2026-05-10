import React from 'react';
import type { ConverterMode } from '../layout/ConverterPanel';

interface ConverterToolbarProps {
  mode: ConverterMode;
  onChangeMode: (mode: ConverterMode) => void;
}

export const ConverterToolbar: React.FC<ConverterToolbarProps> = ({ mode, onChangeMode }) => {
  return (
    <header className="converter-panel-header">
      <h2>컨버터</h2>
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
