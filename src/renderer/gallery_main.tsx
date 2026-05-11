import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

// 📂 Total 15 Components Import Pipeline
import { EmptyState, EmptyStateHelpLine } from './components/ui/EmptyState';
import { ContextMenu } from './components/ui/ContextMenu';
import * as Icons from './components/ui/Icons';
import { TitleBarControls } from './components/layout/TitleBarControls';
import { Sidebar } from './components/layout/Sidebar';
import { StatusBar } from './components/layout/StatusBar';
import { ViewerCanvas } from './components/layout/ViewerCanvas';
import { FloatingAnchor } from './components/layout/FloatingAnchor';
import { ConverterPanel } from './components/layout/ConverterPanel';
import { ConverterFileList } from './components/converter/ConverterFileList';
import { ConverterOptions } from './components/converter/ConverterOptions';
import { ConverterFooter } from './components/converter/ConverterFooter';
import { ConverterToolbar } from './components/converter/ConverterToolbar';
import { ConverterPanelShell } from './components/converter/ConverterPanelShell';
import { ConverterModal } from './components/modals/ConverterModal';

import type { ConverterSourceItem } from './components/layout/ConverterPanel';
import './index.css';

// 🏗️ Global Config for Demos
const mockSelected = new Set<string>();
const mockItems: ConverterSourceItem[] = [
  { name: 'Volume_001.zip', path: '/mock/p1', type: 'zip', sizeBytes: 1024*1024*5, totalPages: 200 },
];

// 🗺️ Central Registry Definition
const COMPONENTS: Record<string, { label: string, desc: string, render: () => React.ReactNode }> = {
  'ViewerCanvas': {
    label: 'ViewerCanvas',
    desc: '메인 작품 뷰어 캔버스 엔진',
    render: () => <div style={{ height: '100vh', background: '#000' }}><ViewerCanvas hasActiveFile={false} /></div>
  },
  'FloatingAnchor': {
    label: 'FloatingAnchor',
    desc: '화면 모드 및 사이드바 플로팅 앵커',
    render: () => <div style={{ height: '100vh', display:'flex', alignItems:'center', justifyContent:'center' }}><FloatingAnchor onToggleSidebar={()=>{}} onToggleMenu={()=>{}} onShowViewer={()=>{}} onShowConverter={()=>{}} canShowViewer={true} canShowConverter={true} isSidebarOpen={true} /></div>
  },
  'TitleBarControls': {
    label: 'TitleBarControls',
    desc: '타이틀바 윈도우 제어 & 리본 메뉴',
    render: () => <div style={{ height: '32px', background:'rgba(0,0,0,0.4)', position:'fixed', top:0, width:'100%' }}><TitleBarControls viewMode="1" onChangeViewMode={()=>{}} themeMode="dark" onChangeThemeMode={()=>{}} /></div>
  },
  'StatusBar': {
    label: 'StatusBar',
    desc: '하단 진행률 및 텔레메트리 바',
    render: () => <div style={{ position:'fixed', bottom:0, width:'100%' }}><StatusBar hasActiveFile={true} activeFileName="Masterpiece.zip" currentPageIndex={1} totalPages={100} totalLibraryItems={5} isSidebarOpen={true} /></div>
  },
  'Sidebar': {
    label: 'Sidebar',
    desc: '좌측 라이브러리 매니지먼트 패널',
    render: () => <div style={{ height: '100vh', display:'flex' }}><Sidebar isOpen={true} isMenuOpen={false} onOpenConverter={()=>{}} loadSameBook={true} onToggleLoadSameBook={()=>{}} /><div style={{ flex: 1, opacity: 0.1, background:'#888' }}></div></div>
  },
  'ConverterPanel': {
    label: 'ConverterPanel',
    desc: '컨버터 최종 취합 메인 컨테이너',
    render: () => <div style={{ height: '100vh' }}><ConverterPanel sourceItems={mockItems} hasSidebarItems={true} selectedPaths={mockSelected} onToggleSelection={()=>{}} mode="merge" onAddSource={()=>{}} onAddAllSource={()=>{}} onClearSource={()=>{}} onRemoveSourceItems={()=>{}} /></div>
  },
  'ConverterOptions': {
    label: 'ConverterOptions',
    desc: '변환 세부 옵션 설정 컨트롤 타워',
    render: () => <div style={{ padding: '40px', maxWidth: '900px', margin: '0 auto' }}><ConverterOptions mode="split" outputFormat="cbz" onChangeOutputFormat={()=>{}} outputNameBase="out" onChangeOutputNameBase={()=>{}} outputNamePattern="index-name" onChangeOutputNamePattern={()=>{}} compressionPolicy="auto" onChangeCompressionPolicy={()=>{}} splitCriterion="pages" onChangeSplitCriterion={()=>{}} splitValue={100} onChangeSplitValue={()=>{}} splitCustomValues="" onChangeSplitCustomValues={()=>{}} splitTotalPages={300} onChangeSplitTotalPages={()=>{}} outputDirectory="/dummy" onChangeOutputDirectory={()=>{}} onPickOutputDirectory={()=>{}} mergeStrategy="unpack" onChangeMergeStrategy={()=>{}} canExecute={true} disabledReason={null} onExecute={()=>{}} progressPercent={0} executionLogs={[]} isProcessing={false} /></div>
  },
  'ConverterFileList': {
    label: 'ConverterFileList',
    desc: '변환 대기열 파일 리스트 관리',
    render: () => <div style={{ height: '100vh', display:'flex', flexDirection:'column' }}><ConverterFileList mode="merge" outputFormat="zip" compressionPolicy="auto" items={mockItems} hasSidebarItems={true} selectedPaths={mockSelected} onToggleSelection={()=>{}} onAdd={()=>{}} onAddAll={()=>{}} onClear={()=>{}} onRemoveItems={()=>{}} /></div>
  },
  'ConverterFooter': {
    label: 'ConverterFooter',
    desc: '실행/취소 및 퍼센테이지 하단 제어',
    render: () => <div style={{ padding:'40px' }}><ConverterFooter mode="merge" outputFormat="zip" splitCriterion="pages" splitValue={100} splitCustomValues="" canExecute={true} disabledReason={null} /></div>
  },
  'ConverterToolbar': {
    label: 'ConverterToolbar',
    desc: '병합/분할 전환 서브 헤더',
    render: () => <div style={{ padding:'40px' }}><ConverterToolbar mode="merge" onChangeMode={()=>{}} /></div>
  },
  'ConverterPanelShell': {
    label: 'ConverterPanelShell',
    desc: '컨버터 외곽 프레임 래퍼',
    render: () => <div style={{ padding:'40px', height:'100vh' }}><ConverterPanelShell><div style={{ border:'1px dashed #444', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>Shell Context Content</div></ConverterPanelShell></div>
  },
  'ConverterModal': {
    label: 'ConverterModal',
    desc: '콘텐츠 변환 엔진 팝업 포털',
    render: () => {
      const [open, setOpen] = useState(true);
      return (
        <div style={{ height: '100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <button onClick={()=>setOpen(true)} style={{ background:'var(--accent)', border:'none', color:'#FFF', padding:'12px 24px', borderRadius:'6px' }}>Open Modal</button>
          <ConverterModal isOpen={open} onClose={() => setOpen(false)} />
        </div>
      );
    }
  },
  'ContextMenu': {
    label: 'ContextMenu',
    desc: '우클릭 플로팅 컨텍스트 메뉴',
    render: () => <div style={{ height: '100vh' }}><ContextMenu show={true} x={50} y={50} onClose={()=>{}} imageFitMode="auto" onChangeImageFitMode={()=>{}} viewMode="2" onChangeViewMode={()=>{}} themeMode="dark" onChangeThemeMode={()=>{}} /></div>
  },
  'EmptyState': {
    label: 'EmptyState',
    desc: '데이터 부재 시 기본 공백 안내 UI',
    render: () => <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'40px' }}><div style={{ width:'100%' }}><EmptyState height={300}><EmptyStateHelpLine>Nothing to show.</EmptyStateHelpLine></EmptyState></div></div>
  },
  'Icons': {
    label: 'Icons',
    desc: '시스템 전체 SVG 아이콘 벡터 맵',
    render: () => (
      <div style={{ padding: '40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '20px' }}>
        {Object.keys(Icons).map(k => {
           const C = (Icons as any)[k];
           return <div key={k} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'12px', padding:'20px', background:'rgba(255,255,255,0.03)', border:'1px solid #444', borderRadius:'10px' }}><C /><span style={{ fontSize:'0.75rem', opacity: 0.6 }}>{k}</span></div>
        })}
      </div>
    )
  }
};

// 🚀 Dynamic Page Shell Engine
const App = () => {
  const [targetComp, setTargetComp] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTargetComp(params.get('comp'));
  }, []);

  // 🕵️‍♀️ Case A: Dynamic Render In-Isolation
  if (targetComp && COMPONENTS[targetComp]) {
    return (
      <div style={{ background: 'var(--bg-base)', minHeight: '100vh', color: 'var(--text-main)' }}>
         {COMPONENTS[targetComp].render()}
      </div>
    );
  }

  // 🏡 Case B: Index Listing Directory
  return (
    <div style={{ background: '#1A1817', minHeight: '100vh', color: '#EAE6E2', fontFamily: 'sans-serif' }}>
      <header style={{ padding: '60px 40px', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>
        <h1 style={{ fontWeight: 300, margin: 0, fontSize: '2.2rem', letterSpacing: '2px' }}>MTC COMPONENT HUB</h1>
        <p style={{ opacity: 0.5, fontSize: '0.9rem', marginTop: '12px' }}>
          💡 항목을 클릭하면 **새 탭(Isolated Window)**에서 해당 컴포넌트 단독 실시간 뷰가 열립니다.
        </p>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '60px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
          {Object.keys(COMPONENTS).map((key, idx) => {
            const data = COMPONENTS[key];
            return (
              <a 
                key={key}
                href={`?comp=${key}`}
                target="_blank"
                rel="noreferrer"
                style={{ 
                  textDecoration: 'none', color: 'inherit', display: 'block',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  padding: '30px', borderRadius: '12px', transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#CE743E';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontFamily: 'monospace', opacity: 0.5 }}>
                    #{idx + 1}
                  </span>
                  <span style={{ color: '#CE743E' }}>↗</span>
                </div>
                <h3 style={{ fontSize: '1.25rem', margin: '16px 0 8px 0', fontWeight: 500 }}>{data.label}</h3>
                <p style={{ fontSize: '0.85rem', opacity: 0.6, margin: 0, lineHeight: '1.5' }}>{data.desc}</p>
              </a>
            );
          })}
        </div>
      </main>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
