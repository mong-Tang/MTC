import React from 'react';

interface ConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConverterModal: React.FC<ConverterModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  // 🌌 [CSS-in-JS] 컴포넌트 자급자족을 위한 하이엔드 스타일 객체 선언
  const styles: { [key: string]: React.CSSProperties } = {
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'var(--modal-backdrop)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      animation: 'fadeIn 0.3s ease'
    },
    modal: {
      width: '520px',
      background: 'var(--bg-panel)',
      border: '1px solid rgba(var(--rgb-contrast), 0.1)',
      borderRadius: '20px',
      boxShadow: 'var(--shadow-popup)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      animation: 'slideUp 0.4s var(--transition-smooth)'
    },
    header: {
      padding: '24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px solid var(--border-subtle)'
    },
    body: {
      padding: '24px'
    },
    footer: {
      padding: '20px 24px',
      background: 'rgba(0, 0, 0, 0.2)',
      display: 'flex',
      justifyContent: 'flex-end'
    },
    primaryBtn: {
      padding: '10px 24px',
      background: 'var(--accent)',
      color: '#ffffff',
      border: 'none',
      borderRadius: '8px',
      fontWeight: 600,
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)',
      fontSize: '0.9rem',
      transition: 'all 0.2s'
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      {/* 🎭 [독립성 마침표] 애니메이션 키프레임마저 내부에 동적 주입하여 100% 고립 달성! */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
      
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header style={styles.header}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 400, letterSpacing: '1px', color: 'var(--text-main)' }}>
            콘텐츠 변환 엔진
          </h2>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.2rem' }}
          >
            ✕
          </button>
        </header>
        
        <div style={styles.body}>
          <p style={{ margin: '0 0 16px 0', color: 'var(--text-dim)', fontSize: '0.95rem' }}>
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
            개발 중인 영역
          </div>
        </div>

        <footer style={styles.footer}>
          <button style={styles.primaryBtn} onClick={onClose}>
            확인
          </button>
        </footer>
      </div>
    </div>
  );
};
