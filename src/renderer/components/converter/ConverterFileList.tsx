import React from 'react';
import type { ConverterMode } from '../layout/ConverterPanel';
import type { ConverterSourceItem } from '../layout/ConverterPanel';

interface ConverterFileListProps {
  mode: ConverterMode;
  items: ConverterSourceItem[];
  onAdd: () => void;
  onAddAll: () => void;
  onClear: () => void;
  onRemoveItem: (path: string) => void;
}

export const ConverterFileList: React.FC<ConverterFileListProps> = ({ mode, items, onAdd, onAddAll, onClear, onRemoveItem }) => {
  return (
    <section className="converter-section converter-file-list-section">
      <div className="converter-file-list-header">
        <h3 className="converter-section-title">{mode === 'merge' ? '입력 파일 목록' : '대상 파일'}</h3>
        <div className="converter-toolbar-actions">
          <span className="converter-source-count">선택 {items.length}</span>
          <button className="converter-mini-btn" type="button" onClick={onAdd}>
            + Add
          </button>
          <button className="converter-mini-btn" type="button" onClick={onAddAll}>
            Add All
          </button>
          <button className="converter-mini-btn" type="button" onClick={onClear}>
            Clear
          </button>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="converter-empty-list">
          <div className="converter-help-block">
            <p className="converter-section-text">
              {mode === 'merge' ? '병합할 파일을 순서대로 추가하세요.' : '분할할 파일 1개를 선택하세요.'}
            </p>
            <p className="converter-help-line">- Add All: 사이드바 목록 전체 추가</p>
            <p className="converter-help-line">- 사이드바 파일 클릭: 입력 목록에 추가/제거</p>
            <p className="converter-help-line">- + Add: 파일 선택창에서 직접 추가</p>
            <p className="converter-help-line">- Clear: 현재 입력 목록 비우기</p>
          </div>
        </div>
      ) : (
        <div className="converter-item-list">
          {items.map((item, index) => (
            <div
              key={item.path}
              className="converter-item-row"
              title={`${item.path}\n더블클릭으로 목록에서 제거`}
              onDoubleClick={() => onRemoveItem(item.path)}
            >
              <span className="converter-item-index">{index + 1}</span>
              <span className="converter-item-name">{item.name}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
