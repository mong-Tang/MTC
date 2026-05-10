import React from 'react';

interface ConverterPanelShellProps {
  children: React.ReactNode;
}

export const ConverterPanelShell: React.FC<ConverterPanelShellProps> = ({ children }) => {
  return (
    <main className="app-main-content converter-panel-shell">
      <div className="converter-panel">{children}</div>
    </main>
  );
};
