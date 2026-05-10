import React from 'react';
import type { ConverterMode } from '../layout/ConverterPanel';

interface ConverterFooterProps {
  mode: ConverterMode;
}

export const ConverterFooter: React.FC<ConverterFooterProps> = ({ mode }) => {
  return (
    <footer className="converter-footer">
      <span className="converter-footer-hint">
        {mode === 'merge' ? '여러 권을 하나로 묶습니다.' : '대용량 파일을 기준에 따라 분할합니다.'}
      </span>
      <button className="primary-btn" type="button">
        {mode === 'merge' ? '병합 실행' : '분할 실행'}
      </button>
    </footer>
  );
};
