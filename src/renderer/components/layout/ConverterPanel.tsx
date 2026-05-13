import React, { useEffect, useState } from 'react';
import { ConverterFileList } from '../converter/ConverterFileList';
import { ConverterFooter } from '../converter/ConverterFooter';
import { ConverterOptions } from '../converter/ConverterOptions';
import { ConverterPanelShell } from '../converter/ConverterPanelShell';
import { TRANSLATIONS } from '../../i18n';
import type { AppLanguage } from '../../i18n';
// 💡 Toolbar has been elevated to system Titlebar.

export type ConverterMode = 'merge' | 'split';
export type CompressionPolicy = 'auto' | 'store' | 'compress';
export type SplitCriterion = 'pages' | 'sizeMb' | 'custom';
export type OutputNamePattern = 'name-index' | 'index-name' | 'name_underscore_index' | 'index_underscore_name';
export type MergeStrategy = 'unpack' | 'bundle'; // 🛡️ [신규] 병합 전략 (풀어서 병합 vs 원본 묶기)
export interface ConverterSourceItem {
  name: string;
  path: string;
  type: string;
  sizeBytes?: number;
  totalPages?: number; // 📖 [데이터 모델 확장] 각 아카이브의 총 쪽수 필드 추가!
  uncompressedSizeBytes?: number; // 🗜️ [데이터 모델 확장] 압축 내부 원본 크기 총합!
}

interface ConverterPanelProps {
  sourceItems: ConverterSourceItem[];
  hasSidebarItems: boolean;
  selectedPaths: Set<string>;
  onToggleSelection: React.Dispatch<React.SetStateAction<Set<string>>>;
  mode: ConverterMode; // 🛰️ [격상 완료]
  onChangeMode: (mode: ConverterMode) => void; // ⚡ [신규] 통합 리모컨 수신처!
  onAddSource: () => void;
  onAddAllSource: () => void;
  onClearSource: () => void;
  onRemoveSourceItems: (paths: string[]) => void;
  onUpdateStatusText?: (text: string) => void; // 🛰️ 상태바 업링크 신호선!
  language: AppLanguage; // 🌍 [글로벌] 현재 언어 정보
}

export const ConverterPanel: React.FC<ConverterPanelProps> = ({
  sourceItems,
  hasSidebarItems,
  selectedPaths,
  onToggleSelection,
  mode, // 🛰️
  onChangeMode, // ⚡
  onAddSource,
  onAddAllSource,
  onClearSource,
  onRemoveSourceItems,
  onUpdateStatusText,
  language
}) => {
  const t = TRANSLATIONS[language]; // ⚡ 실시간 번역기 소환

  const [outputFormat, setOutputFormat] = useState<'zip' | 'cbz'>('zip');
  const [outputNameBase, setOutputNameBase] = useState<string>(language === 'ko' ? '예제 파일명' : 'example_filename');
  const [outputNamePattern, setOutputNamePattern] = useState<OutputNamePattern>('name-index');
  const [compressionPolicy, setCompressionPolicy] = useState<CompressionPolicy>('auto');
  const [splitCriterion, setSplitCriterion] = useState<SplitCriterion>('custom');
  const [splitValue, setSplitValue] = useState<number>(100);
  const [splitCustomValues, setSplitCustomValues] = useState<string>('0,0');
  const [splitTotalPages, setSplitTotalPages] = useState<number>(0);
  const [mergeStrategy, setMergeStrategy] = useState<MergeStrategy>('unpack'); // 🎯 [긴급 수혈] 기본은 '풀기'이나 유저 선택권 부여
  const [outputDirectory, setOutputDirectory] = useState('');
  const [isProcessing, setIsProcessing] = useState(false); // 🛰️ [작업 잠금] 병합 중 중복 클릭 및 UI 오작동 방지
  const [progressPercent, setProgressPercent] = useState(0); // 📊 현재 진행률 게이지
  const [executionLogs, setExecutionLogs] = useState<string[]>([]); // 📝 실시간 로깅 스트림
  const [elapsedTime, setElapsedTime] = useState(0); // ⏱️ [정밀 타이머] 작업 경과 시간 실시간 트래킹
  const [processingMode, setProcessingMode] = useState<ConverterMode | null>(null); // 🚦 [모드 고유 인식표] 어느 화면에서 작업을 시작했는지 박제

  // ⏱️ [실시간 타이머 박동] 작업 시작 시 1초마다 째깍째깍!
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing) {
      setElapsedTime(0); // 작업 시작 시 리셋
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing]);

  // 🧹 [모드 전환 클리너] 화면을 전환할 때마다 기존 작업의 누적 로그 및 잔여 게이지 정보를 깨끗이 초기화!
  useEffect(() => {
    setExecutionLogs([]);
    setProgressPercent(0);
    setElapsedTime(0);
  }, [mode]);

  // ⏳ [글로벌 커서 컨트롤러] 작업 중일 때 전체 애플리케이션에 'is-processing' 클래스를 부여하여 모래시계 커서를 발동!
  useEffect(() => {
    if (isProcessing) {
      document.body.classList.add('is-processing');
    } else {
      document.body.classList.remove('is-processing');
    }
    return () => {
      document.body.classList.remove('is-processing'); // 언마운트 시 안전 해제
    };
  }, [isProcessing]);

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

  // 🧩 [분할 타겟 동기화 엔진] 분할 모드에서 대상 파일이 등록되면, 해당 아카이브의 실측 '총 페이지 수'를 즉각 UI 상태에 자동 연동!
  useEffect(() => {
    if (mode === 'split' && sourceItems.length > 0) {
      const targetItem = sourceItems[0];
      if (typeof targetItem.totalPages === 'number' && targetItem.totalPages > 0) {
        setSplitTotalPages(targetItem.totalPages);
      }
    } else if (sourceItems.length === 0) {
      // 대상 소멸 시 기본값 회귀
      setSplitTotalPages(0);
    }
  }, [mode, sourceItems]);

  const handlePickOutputDirectory = async () => {
    try {
      const appApi = (window as any).appApi;
      const selected = await appApi.openFolderDialog(t.selectOutputDirTitle);
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
    ? t.conversionInProgress
    : !hasSourceItems
      ? t.addInputFirst
      : !hasOutputDirectory
        ? t.selectOutputLoc
        : !hasOutputName
          ? t.enterOutputName
          : mode === 'split' && splitCriterion === 'custom' && !hasValidCustomCutPoints
            ? t.ensureAscending
            : null;

  // 🛰️ [동기화 엔진] 실시간 상태 텍스트 생성 및 상위 전송
  useEffect(() => {
    if (!onUpdateStatusText) return;

    const splitHint =
      splitCriterion === 'pages' ? `${splitValue}${t.unitPages}` :
        splitCriterion === 'sizeMb' ? `${splitValue}${t.unitMb}` :
          `${t.userCustom} [${splitCustomValues || '-'}]`;

    const msg = !isExecuteEnabled && disabledReason
      ? `[${t.awaiting}] ${disabledReason}`
      : mode === 'merge'
        ? t.combinesToSingle.replace('{{format}}', outputFormat)
        : t.splitsLargeTo.replace('{{hint}}', splitHint).replace('{{format}}', outputFormat);

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
    setProcessingMode(mode); // 📡 현재 동작 중인 모드 낙인 찍기!
    setProgressPercent(0); // 게이지 초기화
    setExecutionLogs([]); // 로그 리셋
    const startTime = Date.now();

    if (onUpdateStatusText) {
      onUpdateStatusText(t.runningTask.replace('{{mode}}', mode === 'merge' ? t.merge : t.split));
    }

    try {
      if (mode === 'merge') {
        const sourcePaths = sourceItems.map(item => item.path);

        // 🛸 백엔드 프리로드 API 호출 (새로 뚫린 파이프라인)
        const appApi = (window as any).appApi;
        if (!appApi || !appApi.mergeFiles) {
          throw new Error(t.connectEngineFailed);
        }

        const result = await appApi.mergeFiles(
          sourcePaths,
          outputDirectory,
          outputNameBase,
          outputFormat,
          mergeStrategy // 🚀 [전략 투하] 유저가 고른 전략 주입!
        );

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        if (result.ok) {
          setProgressPercent(100); // 💯 최후의 방어선: 무조건 100% 완료 상태 강제 고정
          if (onUpdateStatusText) {
            onUpdateStatusText(`[${t.done}] ${t.merge} ${t.done} (${elapsed}${t.timeSecShort}): ${outputNameBase}.${outputFormat}`);
          }
          // 🚨 얼럿창은 렌더링을 멈추므로, 약간의 시차를 두어 UI가 100%로 바뀌는 것을 보여준 뒤 띄움
          setTimeout(() => {
            alert(`${t.mergeSuccess}\n\n${t.filenameLabel}: ${outputNameBase}.${outputFormat}\n${t.locationLabel}: ${outputDirectory}\n${t.timeLabel}: ${elapsed}${t.timeSecShort}`);
          }, 200);
        } else {
          const err = result.error?.message || t.unknownError;
          if (onUpdateStatusText) {
            onUpdateStatusText(`[${t.fatalError}] ${t.errorOccurredDuringMerge}`);
          }
          setTimeout(() => {
            alert(`${t.mergeFailed}\n\n${err}`);
          }, 200);
        }
      } else {
        // 🚧 Split 모드는 아직 구현 중으로 안전 가이드
        alert(t.splitUnderDev);
        if (onUpdateStatusText) onUpdateStatusText(`[${t.notice}] ${t.splitUnderDevNotice}`);
      }
    } catch (error: any) {
      const errMsg = error.message || String(error);
      if (onUpdateStatusText) {
        onUpdateStatusText(`[${t.fatalError}] ${errMsg}`);
      }
      alert(`🚨 ${t.fatalError}\n\n${errMsg}`);
    } finally {
      // 🔐 작업 잠금 해제하여 UI 다시 복구
      setIsProcessing(false);
      setProcessingMode(null); // 🏁 신분증 폐기!
    }
  };

  const isEffectiveProcessing = isProcessing && processingMode === mode;
  const currentProgress = isEffectiveProcessing ? progressPercent : 0;
  const currentLogs = isEffectiveProcessing ? executionLogs : [];
  const currentElapsedTime = isEffectiveProcessing ? elapsedTime : 0;

  return (
    <ConverterPanelShell>
      <div className="converter-panel-body">
        {/* 🛸 [원점 회귀 완료] 사용자의 엄명에 따라 외곽 판넬 박스 내부 최상단으로 복귀한 컨트롤 타워! */}
        <div className="titlebar-converter-header">
          <h2 className="titlebar-converter-title">
            {mode === 'split' ? t.converterSplit : t.converterMerge}
          </h2>

          <div className="converter-mode-switch" role="tablist" aria-label="Converter Mode">
            <button
              className={`converter-mode-btn ${mode === 'merge' ? 'active' : ''}`}
              onClick={() => onChangeMode('merge')}
              role="tab"
              aria-selected={mode === 'merge'}
              type="button"
            >
              {t.merge}
            </button>
            <button
              className={`converter-mode-btn ${mode === 'split' ? 'active' : ''}`}
              onClick={() => onChangeMode('split')}
              role="tab"
              aria-selected={mode === 'split'}
              type="button"
            >
              {t.split}
            </button>
          </div>
        </div>

        <div className="converter-workbench-grid">
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
            // 🛰️ [동적 릴레이] 분할 모드일 때 왼쪽으로 이사 올 터미널/실행 버튼용 엔진 주입!!
            canExecute={isExecuteEnabled}
            disabledReason={disabledReason}
            onExecute={handleExecute}
            progressPercent={currentProgress}
            executionLogs={currentLogs}
            isProcessing={isEffectiveProcessing}
            elapsedTime={currentElapsedTime} // 📡 타이머 맥동 전송!
            language={language} // 🌍 [전파] 언어 주입!
          />
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
            mergeStrategy={mergeStrategy}
            onChangeMergeStrategy={setMergeStrategy}
            outputDirectory={outputDirectory}
            onChangeOutputDirectory={setOutputDirectory}
            onPickOutputDirectory={handlePickOutputDirectory}
            canExecute={isExecuteEnabled}
            disabledReason={disabledReason}
            onExecute={handleExecute}
            progressPercent={currentProgress}
            executionLogs={currentLogs}
            isProcessing={isEffectiveProcessing}
            language={language} // 🌍 [전파] 언어 주입!
          />
        </div>
      </div>
    </ConverterPanelShell>
  );
};