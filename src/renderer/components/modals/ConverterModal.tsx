import React from 'react';

interface ConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConverterModal: React.FC<ConverterModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      {/* Stop click propagation to prevent accidental close when clicking content */}
      <div className="converter-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2 style={{ fontSize: '1.2rem', fontWeight: 400, letterSpacing: '1px' }}>
            콘텐츠 변환 엔진
          </h2>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.2rem' }}
          >
            ✕
          </button>
        </header>
        
        <div className="modal-body">
          <p style={{ color: 'var(--text-dim)', fontSize: '0.95rem', marginBottom: '16px' }}>
            병합(Merge) 및 분할(Split) 시스템이 안착할 공간입니다.
          </p>
          <div style={{ 
            height: '120px', 
            border: '1px dashed var(--border-subtle)', 
            borderRadius: '12px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            color: 'var(--text-dim)' 
          }}>
            Drag & Drop Files Here
          </div>
        </div>
        
        <footer className="modal-footer">
          <button className="primary-btn" onClick={onClose}>확인</button>
        </footer>
      </div>
    </div>
  );
};
