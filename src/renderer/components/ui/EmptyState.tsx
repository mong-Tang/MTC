import React from 'react';

interface EmptyStateProps {
  height?: string | number;
  style?: React.CSSProperties; // 🎨 [신규] 커스텀 레이아웃 스타일 주입 허용
  children: React.ReactNode;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  height, // 💡 [개혁] 기본값 폐지하여 순수 속성 존중
  style, 
  children, 
  onContextMenu 
}) => {
  const containerStyle: React.CSSProperties = {
    height: typeof height === 'number' ? `${height}px` : height,
    minHeight: '96px',
    border: '2px dashed rgba(var(--rgb-contrast), 0.06)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px',
    flex: 'none',
    background: 'rgba(var(--rgb-contrast), 0.01)',
    transition: 'all 0.3s ease',
    width: '100%',
    boxSizing: 'border-box',
    ...style // 🎯 [최종 계승] 외부에서 주입한 스타일로 모든 기본 규칙 덮어쓰기 허용!
  };

  const blockStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '560px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    alignItems: 'center'
  };

  return (
    <div 
      style={containerStyle}
      onContextMenu={onContextMenu}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(var(--rgb-contrast), 0.03)';
        e.currentTarget.style.borderColor = 'rgba(var(--rgb-contrast), 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(var(--rgb-contrast), 0.01)';
        e.currentTarget.style.borderColor = 'rgba(var(--rgb-contrast), 0.06)';
      }}
    >
      <div style={blockStyle}>
        {children}
      </div>
    </div>
  );
};

export const EmptyStateHelpLine: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <p style={{
    margin: 0,
    fontSize: '0.8rem',
    color: 'var(--text-dim)',
    lineHeight: 1.5,
    opacity: 0.85,
    ...style
  }}>
    {children}
  </p>
);
