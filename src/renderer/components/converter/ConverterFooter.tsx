import React from 'react';
import type { ConverterMode } from '../layout/ConverterPanel';
import type { SplitCriterion } from '../layout/ConverterPanel';

interface ConverterFooterProps {
  mode: ConverterMode;
  outputFormat: 'zip' | 'cbz';
  splitCriterion: SplitCriterion;
  splitValue: number;
  splitCustomValues: string;
  canExecute: boolean;
  disabledReason: string | null;
}

export const ConverterFooter: React.FC<ConverterFooterProps> = ({
  mode,
  outputFormat,
  splitCriterion,
  splitValue,
  splitCustomValues,
  canExecute,
  disabledReason
}) => {
  return (
    <footer className="converter-footer">
      {/* 💡 힌트 텍스트가 하단 상태바로 완벽 통합 이전되어 제거되었습니다. */}
      <button
        className="primary-btn"
        type="button"
        disabled={!canExecute}
        title={!canExecute && disabledReason ? disabledReason : ''}
      >
        {mode === 'merge' ? '병합 실행' : '분할 실행'}
      </button>
    </footer>
  );
};
