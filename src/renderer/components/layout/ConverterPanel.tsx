import React, { useEffect, useState } from 'react';
import { ConverterFileList } from '../converter/ConverterFileList';
import { ConverterFooter } from '../converter/ConverterFooter';
import { ConverterOptions } from '../converter/ConverterOptions';
import { ConverterPanelShell } from '../converter/ConverterPanelShell';
// 💡 Toolbar has been elevated to system Titlebar.

export type ConverterMode = 'merge' | 'split';
export type CompressionPolicy = 'auto' | 'store' | 'compress';
export type SplitCriterion = 'pages' | 'sizeMb' | 'custom';
export type OutputNamePattern = 'name-index' | 'index-name' | 'name_underscore_index' | 'index_underscore_name';
export interface ConverterSourceItem {
  name: string;
  path: string;
  type: string;
  sizeBytes?: number;
}

interface ConverterPanelProps {
  sourceItems: ConverterSourceItem[];
  hasSidebarItems: boolean;
  selectedPaths: Set<string>;
  onToggleSelection: React.Dispatch<React.SetStateAction<Set<string>>>;
  mode: ConverterMode; // 🛰️ [격상 완료]
  onAddSource: () => void;
  onAddAllSource: () => void;
  onClearSource: () => void;
  onRemoveSourceItems: (paths: string[]) => void;
  onUpdateStatusText?: (text: string) => void; // 🛰️ 상태바 업링크 신호선!
}

export const ConverterPanel: React.FC<ConverterPanelProps> = ({ 
  sourceItems, 
  hasSidebarItems,
  selectedPaths,
  onToggleSelection,
  mode, // 🛰️
  onAddSource, 
  onAddAllSource, 
  onClearSource, 
  onRemoveSourceItems,
  onUpdateStatusText
}) => {
  const [outputFormat, setOutputFormat] = useState<'zip' | 'cbz'>('zip');
  const [outputNameBase, setOutputNameBase] = useState<string>('output');
  const [outputNamePattern, setOutputNamePattern] = useState<OutputNamePattern>('name_underscore_index');
  const [compressionPolicy, setCompressionPolicy] = useState<CompressionPolicy>('auto');
  const [splitCriterion, setSplitCriterion] = useState<SplitCriterion>('pages');
  const [splitValue, setSplitValue] = useState<number>(100);
  const [splitCustomValues, setSplitCustomValues] = useState<string>('100,100');
  const [splitTotalPages, setSplitTotalPages] = useState<number>(1000);
  const [outputDirectory, setOutputDirectory] = useState('');
  const [isProcessing, setIsProcessing] = useState(false); // 🛰️ [작업 잠금] 병합 중 중복 클릭 및 UI 오작동 방지
  const [progressPercent, setProgressPercent] = useState(0); // 📊 현재 진행률 게이지
  const [executionLogs, setExecutionLogs] = useState<string[]>([]); // 📝 실시간 로깅 스트림
  const [mergeComment, setMergeComment] = useState<string>(''); // 📝 사용자가 작성하는 병합 메모/메시지

  useEffect(() => {
    if (sourceItems.length === 0) {
      if (outputDirectory) {
        setOutputDirectory('');
      }
      return;
    }

    const appApi = (window as any).appApi;
    if (!appApi || typeof appApi.getDirectory !== 'function') return;

    let cancelled = false;
    void appApi.getDirectory(sourceItems[0].path)
      .then((directory: string) => {
        if (!cancelled && directory && directory !== outputDirectory) {
          setOutputDirectory(directory);
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to infer output directory from source item', error);
      });

    return () => {
      cancelled = true;
    };
  }, [outputDirectory, sourceItems]);

  const handlePickOutputDirectory = async () => {
    try {
      const appApi = (window as any).appApi;
      const selected = await appApi.openFolderDialog('출력 폴더 선택');
      if (!selected) return;
      setOutputDirectory(selected);
    } catch (error) {
      console.error('Failed to pick output directory', error);
    }
  };

  // 📡 [실시간 백엔드 청취자] 백엔드에서 쏴주는 작업 진행상황을 즉각 감지!
  useEffect(() => {
    const appApi = (window as any).appApi;
    if (!appApi || typeof appApi.onConverterProgress !== 'function') return;

    const unsubscribe = appApi.onConverterProgress((data: { percent: number; message: string }) => {
      setProgressPercent(data.percent);
      setExecutionLogs((prev) => [...prev, data.message]);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const customCutPoints = splitCustomValues
    .split(',')
    .map((token) => Number(token.trim()))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.floor(value));
  const hasValidCustomCutPoints =
    customCutPoints.length > 0 &&
    customCutPoints.every((point, index) => point > 1 && (index === 0 || point > customCutPoints[index - 1])) &&
    customCutPoints.every((point) => point <= splitTotalPages);

  const hasOutputName = outputNameBase.trim().length > 0;
  const hasOutputDirectory = outputDirectory.trim().length > 0;
  const hasSourceItems = sourceItems.length > 0;
  const isSplitReady =
    hasSourceItems &&
    hasOutputName &&
    hasOutputDirectory &&
    (splitCriterion !== 'custom' || hasValidCustomCutPoints);
  const isMergeReady = hasSourceItems && hasOutputName && hasOutputDirectory;
  const isExecuteEnabled = (mode === 'merge' ? isMergeReady : isSplitReady) && !isProcessing;

  const disabledReason = isProcessing
    ? '현재 변환 작업이 진행 중입니다...'
    : !hasSourceItems
    ? '입력 파일을 먼저 추가하세요.'
    : !hasOutputDirectory
      ? '출력 위치를 지정하세요.'
      : !hasOutputName
        ? '출력 파일명을 입력하세요.'
        : mode === 'split' && splitCriterion === 'custom' && !hasValidCustomCutPoints
          ? '사용자 설정 시작 페이지를 오름차순으로 확인하세요.'
          : null;

  // 🛰️ [동기화 엔진] 실시간 상태 텍스트 생성 및 상위 전송
  useEffect(() => {
    if (!onUpdateStatusText) return;

    const splitHint =
      splitCriterion === 'pages' ? `${splitValue}페이지 단위` :
      splitCriterion === 'sizeMb' ? `${splitValue}MB 단위` :
      `사용자 설정 [${splitCustomValues || '-'}]`;

    const msg = !isExecuteEnabled && disabledReason
      ? `[대기] ${disabledReason}`
      : mode === 'merge'
      ? `여러 권을 하나로 묶어 .${outputFormat} 파일로 저장합니다.`
      : `대용량 파일을 ${splitHint}로 분할해 .${outputFormat} 파일로 저장합니다.`;

    onUpdateStatusText(msg);
  }, [
    onUpdateStatusText, 
    mode, 
    outputFormat, 
    splitCriterion, 
    splitValue, 
    splitCustomValues, 
    isExecuteEnabled, 
    disabledReason
  ]);

  // 🚀 [최종 실행 관제] 병합/분할 작업을 백엔드 엔진으로 발사!
  const handleExecute = async () => {
    if (!isExecuteEnabled || isProcessing) return;

    setIsProcessing(true);
    setProgressPercent(0); // 게이지 초기화
    setExecutionLogs([]); // 로그 리셋
    const startTime = Date.now();
    
    if (onUpdateStatusText) {
      onUpdateStatusText(`[처리 중] ${mode === 'merge' ? '병합' : '분할'} 작업을 실행하고 있습니다...`);
    }

    try {
      if (mode === 'merge') {
        const sourcePaths = sourceItems.map(item => item.path);
        
        // 🛸 백엔드 프리로드 API 호출 (새로 뚫린 파이프라인)
        const appApi = (window as any).appApi;
        if (!appApi || !appApi.mergeFiles) {
          throw new Error('머지 엔진 연결에 실패했습니다.');
        }

        const result = await appApi.mergeFiles(
          sourcePaths, 
          outputDirectory, 
          outputNameBase, 
          outputFormat,
          mergeComment // 📝 사용자가 작성한 메시지 탑재!
        );

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        if (result.ok) {
          setProgressPercent(100); // 💯 최후의 방어선: 무조건 100% 완료 상태 강제 고정
          if (onUpdateStatusText) {
            onUpdateStatusText(`[완료] 병합 완료 (${elapsed}초 소요): ${outputNameBase}.${outputFormat}`);
          }
          // 🚨 얼럿창은 렌더링을 멈추므로, 약간의 시차를 두어 UI가 100%로 바뀌는 것을 보여준 뒤 띄움
          setTimeout(() => {
            alert(`✅ 병합 성공!\n\n파일명: ${outputNameBase}.${outputFormat}\n위치: ${outputDirectory}\n소요시간: ${elapsed}초`);
          }, 200);
        } else {
          const err = result.error?.message || '알 수 없는 오류 발생';
          if (onUpdateStatusText) {
            onUpdateStatusText('[실패] 병합 과정 중 오류가 발생했습니다.');
          }
          setTimeout(() => {
            alert(`❌ 병합 실패\n\n${err}`);
          }, 200);
        }
      } else {
        // 🚧 Split 모드는 아직 구현 중으로 안전 가이드
        alert('🚧 분할(Split) 기능은 현재 준비 중입니다. 곧 지원될 예정입니다.');
        if (onUpdateStatusText) onUpdateStatusText('[알림] 분할 기능 준비 중');
      }
    } catch (error: any) {
      const errMsg = error.message || String(error);
      if (onUpdateStatusText) {
        onUpdateStatusText(`[치명적 오류] ${errMsg}`);
      }
      alert(`🚨 치명적 오류 발생\n\n${errMsg}`);
    } finally {
      // 🔐 작업 잠금 해제하여 UI 다시 복구
      setIsProcessing(false);
    }
  };

  return (
    <ConverterPanelShell>
      <div className="converter-panel-body">
        <div className="converter-workbench-grid">
          <section className="converter-pane">
            <ConverterFileList
              mode={mode}
              outputFormat={outputFormat}
              compressionPolicy={compressionPolicy}
              items={sourceItems}
              hasSidebarItems={hasSidebarItems}
              selectedPaths={selectedPaths}
              onToggleSelection={onToggleSelection}
              onAdd={onAddSource}
              onAddAll={onAddAllSource}
              onClear={onClearSource}
              onRemoveItems={onRemoveSourceItems}
            />
          </section>
          <section className="converter-pane">
            <ConverterOptions
              mode={mode}
              outputFormat={outputFormat}
              onChangeOutputFormat={setOutputFormat}
              outputNameBase={outputNameBase}
              onChangeOutputNameBase={setOutputNameBase}
              outputNamePattern={outputNamePattern}
              onChangeOutputNamePattern={setOutputNamePattern}
              compressionPolicy={compressionPolicy}
              onChangeCompressionPolicy={setCompressionPolicy}
              splitCriterion={splitCriterion}
              onChangeSplitCriterion={setSplitCriterion}
              splitValue={splitValue}
              onChangeSplitValue={setSplitValue}
              splitCustomValues={splitCustomValues}
              onChangeSplitCustomValues={setSplitCustomValues}
              splitTotalPages={splitTotalPages}
              onChangeSplitTotalPages={setSplitTotalPages}
              outputDirectory={outputDirectory}
              onChangeOutputDirectory={setOutputDirectory}
              onPickOutputDirectory={handlePickOutputDirectory}
              canExecute={isExecuteEnabled}
              disabledReason={disabledReason}
              onExecute={handleExecute}
              progressPercent={progressPercent}
              executionLogs={executionLogs}
              isProcessing={isProcessing}
              mergeComment={mergeComment}
              onChangeMergeComment={setMergeComment}
            />
          </section>
        </div>
      </div>
    </ConverterPanelShell>
  );
};
