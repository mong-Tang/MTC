import React, { useEffect, useState } from 'react';
import { ConverterFileList } from '../converter/ConverterFileList';
import { ConverterFooter } from '../converter/ConverterFooter';
import { ConverterOptions } from '../converter/ConverterOptions';
import { ConverterPanelShell } from '../converter/ConverterPanelShell';
import { ConverterToolbar } from '../converter/ConverterToolbar';

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
  onAddSource: () => void;
  onAddAllSource: () => void;
  onClearSource: () => void;
  onRemoveSourceItem: (path: string) => void;
}

export const ConverterPanel: React.FC<ConverterPanelProps> = ({ sourceItems, onAddSource, onAddAllSource, onClearSource, onRemoveSourceItem }) => {
  const [mode, setMode] = useState<ConverterMode>('merge');
  const [outputFormat, setOutputFormat] = useState<'zip' | 'cbz'>('zip');
  const [outputNameBase, setOutputNameBase] = useState<string>('output');
  const [outputNamePattern, setOutputNamePattern] = useState<OutputNamePattern>('name_underscore_index');
  const [compressionPolicy, setCompressionPolicy] = useState<CompressionPolicy>('auto');
  const [splitCriterion, setSplitCriterion] = useState<SplitCriterion>('pages');
  const [splitValue, setSplitValue] = useState<number>(100);
  const [splitCustomValues, setSplitCustomValues] = useState<string>('100,100');
  const [splitTotalPages, setSplitTotalPages] = useState<number>(1000);
  const [outputDirectory, setOutputDirectory] = useState('');

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
  const isExecuteEnabled = mode === 'merge' ? isMergeReady : isSplitReady;

  const disabledReason = !hasSourceItems
    ? '입력 파일을 먼저 추가하세요.'
    : !hasOutputDirectory
      ? '출력 위치를 지정하세요.'
      : !hasOutputName
        ? '출력 파일명을 입력하세요.'
        : mode === 'split' && splitCriterion === 'custom' && !hasValidCustomCutPoints
          ? '사용자 설정 시작 페이지를 오름차순으로 확인하세요.'
          : null;

  return (
    <ConverterPanelShell>
      <ConverterToolbar
        mode={mode}
        onChangeMode={setMode}
      />
      <div className="converter-panel-body">
        <div className="converter-workbench-grid">
          <section className="converter-pane">
            <ConverterFileList
              mode={mode}
              outputFormat={outputFormat}
              compressionPolicy={compressionPolicy}
              items={sourceItems}
              onAdd={onAddSource}
              onAddAll={onAddAllSource}
              onClear={onClearSource}
              onRemoveItem={onRemoveSourceItem}
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
            />
          </section>
        </div>
      </div>
      <ConverterFooter
        mode={mode}
        outputFormat={outputFormat}
        splitCriterion={splitCriterion}
        splitValue={splitValue}
        splitCustomValues={splitCustomValues}
        canExecute={isExecuteEnabled}
        disabledReason={disabledReason}
      />
    </ConverterPanelShell>
  );
};
