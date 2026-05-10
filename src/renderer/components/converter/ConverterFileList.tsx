import React from 'react';
import type { ConverterMode } from '../layout/ConverterPanel';
import type { ConverterSourceItem } from '../layout/ConverterPanel';

interface ConverterFileListProps {
  mode: ConverterMode;
  items: ConverterSourceItem[];
}

export const ConverterFileList: React.FC<ConverterFileListProps> = ({ mode, items }) => {
  return (
    <section className="converter-section">
      <h3 className="converter-section-title">{mode === 'merge' ? '입력 파일 목록' : '대상 파일'}</h3>
      {items.length === 0 ? (
        <div className="converter-empty-list">
          <p className="converter-section-text">
            {mode === 'merge' ? '병합할 파일을 순서대로 추가하세요.' : '분할할 파일 1개를 선택하세요.'}
          </p>
        </div>
      ) : (
        <div className="converter-item-list">
          {items.map((item, index) => (
            <div key={item.path} className="converter-item-row" title={item.path}>
              <span className="converter-item-index">{index + 1}</span>
              <span className="converter-item-name">{item.name}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
