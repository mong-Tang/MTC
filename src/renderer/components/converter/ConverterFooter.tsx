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
  const splitHint =
    splitCriterion === 'pages' ? `${splitValue}페이지 단위` :
    splitCriterion === 'sizeMb' ? `${splitValue}MB 단위` :
    `사용자 설정 [${splitCustomValues || '-'}]`;
  return (
    <footer className="converter-footer">
      <span className="converter-footer-hint">
        {!canExecute && disabledReason
          ? disabledReason
          : mode === 'merge'
          ? `여러 권을 하나로 묶어 .${outputFormat} 파일로 저장합니다.`
          : `대용량 파일을 ${splitHint}로 분할해 .${outputFormat} 파일로 저장합니다.`}
      </span>
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
