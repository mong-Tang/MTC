import React from 'react';

interface EmptyStateProps {
  height?: string | number;
  children: React.ReactNode;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  height = '100px', 
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
    boxSizing: 'border-box'
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
