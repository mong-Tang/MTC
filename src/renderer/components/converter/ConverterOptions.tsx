import React from 'react';
import type { ConverterMode } from '../layout/ConverterPanel';

interface ConverterOptionsProps {
  mode: ConverterMode;
}

export const ConverterOptions: React.FC<ConverterOptionsProps> = ({ mode }) => {
  return (
    <section className="converter-section">
      <h3 className="converter-section-title">변환 옵션</h3>
      {mode === 'merge' ? (
        <div className="converter-option-stack">
          <label className="converter-option-row">
            <span>출력 파일명</span>
            <input type="text" value="merged_output.zip" readOnly />
          </label>
          <label className="converter-option-row">
            <span>정렬 기준</span>
            <select value="natural" disabled>
              <option value="natural">자연 정렬 (1,2,10)</option>
            </select>
          </label>
        </div>
      ) : (
        <div className="converter-option-stack">
          <label className="converter-option-row">
            <span>분할 기준</span>
            <select value="pages" disabled>
              <option value="pages">페이지 수</option>
              <option value="size">파일 용량</option>
            </select>
          </label>
          <label className="converter-option-row">
            <span>기준 값</span>
            <input type="number" value="100" readOnly />
          </label>
        </div>
      )}
    </section>
  );
};
