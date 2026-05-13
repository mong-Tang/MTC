import React, { useMemo, useRef, useEffect } from 'react';
import type { ConverterMode } from '../layout/ConverterPanel';
import type { CompressionPolicy } from '../layout/ConverterPanel';
import type { OutputNamePattern } from '../layout/ConverterPanel';
import type { SplitCriterion } from '../layout/ConverterPanel';
import type { MergeStrategy } from '../layout/ConverterPanel'; // 🛡️ [임포트] 병합 전략 타입 추가

interface ConverterOptionsProps {
  mode: ConverterMode;
  outputFormat: 'zip' | 'cbz';
  onChangeOutputFormat: (format: 'zip' | 'cbz') => void;
  outputNameBase: string;
  onChangeOutputNameBase: (name: string) => void;
  outputNamePattern: OutputNamePattern;
  onChangeOutputNamePattern: (pattern: OutputNamePattern) => void;
  compressionPolicy: CompressionPolicy;
  onChangeCompressionPolicy: (policy: CompressionPolicy) => void;
  splitCriterion: SplitCriterion;
  onChangeSplitCriterion: (criterion: SplitCriterion) => void;
  splitValue: number;
  onChangeSplitValue: (value: number) => void;
  splitCustomValues: string;
  onChangeSplitCustomValues: (value: string) => void;
  splitTotalPages: number;
  onChangeSplitTotalPages: (value: number) => void;
  outputDirectory: string;
  onChangeOutputDirectory: (path: string) => void;
  onPickOutputDirectory: () => void;
  mergeStrategy: MergeStrategy; // 🛰️ [수혈] 병합 전략
  onChangeMergeStrategy: (strategy: MergeStrategy) => void; // 🛰️ [수혈] 전략 변경 핸들러
  // 🛸 [신규 계승] 최종 집행 권한 통합!
  canExecute: boolean;
  disabledReason: string | null;
  onExecute: () => void;
  progressPercent: number;
  executionLogs: string[];
  isProcessing: boolean;
}


export const ConverterOptions: React.FC<ConverterOptionsProps> = ({
  mode,
  outputFormat,
  onChangeOutputFormat,
  outputNameBase,
  onChangeOutputNameBase,
  outputNamePattern,
  onChangeOutputNamePattern,
  compressionPolicy,
  onChangeCompressionPolicy,
  splitCriterion,
  onChangeSplitCriterion,
  splitValue,
  onChangeSplitValue,
  splitCustomValues,
  onChangeSplitCustomValues,
  splitTotalPages,
  onChangeSplitTotalPages,
  outputDirectory,
  onChangeOutputDirectory,
  onPickOutputDirectory,
  mergeStrategy,
  onChangeMergeStrategy,
  canExecute,
  disabledReason,
  onExecute,
  progressPercent,
  executionLogs,
  isProcessing
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);

  // 📜 [자동 스크롤 매직] 로그가 들어올 때마다 자동으로 최하단으로 스르륵 스크롤
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [executionLogs]);

  const customSplitPreview = useMemo(() => {
    if (splitCriterion !== 'custom') return '';
    const cutPoints = splitCustomValues
      .split(',')
      .map((token) => Number(token.trim()))
      .filter((value) => Number.isFinite(value) && value > 1)
      .map((value) => Math.floor(value));
    if (splitTotalPages <= 0) return 'Preview: Please enter total pages.';
    if (cutPoints.length === 0) return `Preview: No split (1~${splitTotalPages}, 1 vol.)`;

    const invalid = cutPoints.some((point) => point > splitTotalPages);
    if (invalid) return `Preview: Start page must be less than or equal to total pages (${splitTotalPages}).`;

    const sortedUnique = Array.from(new Set(cutPoints)).sort((a, b) => a - b);
    const starts = [1, ...sortedUnique];
    const ranges = starts.map((start, index) => {
      const nextStart = starts[index + 1];
      const end = nextStart ? nextStart - 1 : splitTotalPages;
      return `${start}~${end}`;
    });

    const preview = ranges.slice(0, 5).join(', ');
    const suffix = ranges.length > 5 ? ', ...' : '';
    return `Preview: ${preview}${suffix} (${ranges.length} vol.)`;
  }, [splitCriterion, splitCustomValues, splitTotalPages]);

  const customInputHint = useMemo(() => {
    if (splitCriterion !== 'custom') return '';
    const points = splitCustomValues
      .split(',')
      .map((token) => Number(token.trim()))
      .filter((value) => Number.isFinite(value))
      .map((value) => Math.floor(value));
    if (points.length === 0) return 'e.g., 201,451,651,851 (Start page of next volume)';
    const nonAscending = points.some((point, index) => index > 0 && point <= points[index - 1]);
    if (nonAscending) return 'Warning: Start pages must be entered in ascending order.';
    return 'Each number represents the start page of the next volume. Split will occur before that page.';
  }, [splitCriterion, splitCustomValues]);

  const splitNamePreview = useMemo(() => {
    const sampleIndex = '01';
    if (outputNamePattern === 'name-index') return `${outputNameBase}-${sampleIndex}`;
    if (outputNamePattern === 'index-name') return `${sampleIndex}-${outputNameBase}`;
    if (outputNamePattern === 'name_underscore_index') return `${outputNameBase}_${sampleIndex}`;
    return `${sampleIndex}_${outputNameBase}`;
  }, [outputNameBase, outputNamePattern]);
  const outputLabelBase = outputNameBase.trim() || 'example_filename';

  return (
    <section className="converter-section converter-options-section">
      <div className="converter-file-list-header">
        <h3 className="converter-section-title">Conversion Options</h3>
      </div>
      <div className="converter-option-stack">
        <label className="converter-option-row">
          <span>Output Format</span>
          <select
            value={outputFormat}
            onChange={(event) => onChangeOutputFormat(event.target.value as 'zip' | 'cbz')}
            style={{ width: '100%' }}
          >
            <option value="zip">ZIP (.zip)</option>
            <option value="cbz">CBZ (.cbz)</option>
          </select>
        </label>
        <label className="converter-option-row">
          <span>Output Filename</span>
          <div className="converter-option-path-row">
            <input
              type="text"
              value={outputNameBase}
              placeholder={mode === 'merge' ? 'e.g., merged_output' : 'e.g., split_output'}
              onChange={(event) => onChangeOutputNameBase(event.target.value)}
            />
            <span className="converter-option-suffix">.{outputFormat}</span>
          </div>
        </label>

        {/* 🎯 [긴급 투입] 병합 모드 전용: 압축 해제 여부를 결정하는 하이레벨 선택 시스템! */}
        {mode === 'merge' && (
          <div className="converter-option-block">
            <p className="converter-option-block-label">Merge Strategy</p>
            <div className="converter-option-radio-group" style={{ marginBottom: '4px' }}>
              <label className="converter-option-radio-item">
                <input
                  type="radio"
                  name="merge-strategy-radio"
                  checked={mergeStrategy === 'unpack'}
                  onChange={() => onChangeMergeStrategy('unpack')}
                />
                <span>Combine Images (Manga Omnibus)</span>
              </label>
              <label className="converter-option-radio-item">
                <input
                  type="radio"
                  name="merge-strategy-radio"
                  checked={mergeStrategy === 'bundle'}
                  onChange={() => onChangeMergeStrategy('bundle')}
                />
                <span>Keep Original Files (Simple Archive)</span>
              </label>
            </div>
            <p className="converter-help-line" style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
              {mergeStrategy === 'unpack'
                ? '※ Automatically extracts archives and merges only the internal images into a single volume.'
                : '※ Combines the selected archive files directly without extracting their contents.'}
            </p>
          </div>
        )}
        {mode === 'split' && (
          <div className="converter-option-block">
            <p className="converter-option-block-label">Output Filename Pattern</p>
            <div className="converter-option-radio-group grid-2-col" style={{ marginBottom: '2px' }}>
              <label className="converter-option-radio-item">
                <input
                  type="radio"
                  name="output-name-pattern"
                  checked={outputNamePattern === 'name-index'}
                  onChange={() => onChangeOutputNamePattern('name-index')}
                />
                <span>{`${outputLabelBase}-01`}</span>
              </label>
              <label className="converter-option-radio-item">
                <input
                  type="radio"
                  name="output-name-pattern"
                  checked={outputNamePattern === 'name_underscore_index'}
                  onChange={() => onChangeOutputNamePattern('name_underscore_index')}
                />
                <span>{`${outputLabelBase}_01`}</span>
              </label>
              <label className="converter-option-radio-item">
                <input
                  type="radio"
                  name="output-name-pattern"
                  checked={outputNamePattern === 'index-name'}
                  onChange={() => onChangeOutputNamePattern('index-name')}
                />
                <span>{`01-${outputLabelBase}`}</span>
              </label>
              <label className="converter-option-radio-item">
                <input
                  type="radio"
                  name="output-name-pattern"
                  checked={outputNamePattern === 'index_underscore_name'}
                  onChange={() => onChangeOutputNamePattern('index_underscore_name')}
                />
                <span>{`01_${outputLabelBase}`}</span>
              </label>

              {/* 🛸 [긴급 정정] 회색 옵션 박스 '내부'로 전격 침투! 그리드 전체 폭을 장악하여 아름답게 통합! */}
              <div className="converter-help-line" style={{ 
                gridColumn: 'span 2', /* 🔗 [통합] 2열을 시원하게 가로지르는 전대미문의 병합 선언! */
                marginTop: '-2px', /* 🚀 [긴급 견인] 그리드 row-gap을 음수 마진으로 뚫고 위로 초밀착! */
                paddingTop: '3px', /* ⚡ [극슬림화] 패딩을 최소 단위로 압축 */
                paddingBottom: '0px',
                borderTop: '1px dashed rgba(var(--rgb-contrast), 0.08)', /* ✂️ 내부 구획 정리선 */
                fontSize: '0.74rem', 
                color: 'var(--text-dim)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                paddingLeft: '4px'
              }}>
                <span>🔍 Preview:</span>
                <strong style={{ color: 'var(--text-main)', fontWeight: '700' }}>{splitNamePreview}.{outputFormat}</strong>
              </div>
            </div>
          </div>
        )}
        <label className="converter-option-row">
          <span>Output Location</span>
          <div className="converter-option-path-row">
            <input
              type="text"
              value={outputDirectory}
              placeholder="Select output folder"
              onChange={(event) => onChangeOutputDirectory(event.target.value)}
            />
            <button type="button" className="converter-mini-btn" onClick={onPickOutputDirectory}>
              Select
            </button>
          </div>
        </label>
      </div>
      {mode === 'merge' ? (
        <div className="converter-option-stack">
          <div className="converter-option-block">
            <p className="converter-option-block-label">Compression Policy</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px', paddingLeft: '4px' }}>
              <div className="converter-radio-item-group">
                <label className="converter-option-radio-item">
                  <input
                    type="radio"
                    name="compression-policy-radio"
                    checked={compressionPolicy === 'auto'}
                    onChange={() => onChangeCompressionPolicy('auto')}
                  />
                  <span style={{ fontWeight: '600' }}>Auto (Recommended)</span>
                </label>
                <p className="converter-radio-sub-desc" style={{ margin: '4px 0 0 22px', fontSize: '0.74rem', color: 'var(--text-dim)', opacity: 0.85 }}>
                  💡 Inherits store method for existing archives and compresses raw images to balance speed and size.
                </p>
              </div>

              <div className="converter-radio-item-group">
                <label className="converter-option-radio-item">
                  <input
                    type="radio"
                    name="compression-policy-radio"
                    checked={compressionPolicy === 'store'}
                    onChange={() => onChangeCompressionPolicy('store')}
                  />
                  <span style={{ fontWeight: '600' }}>Always Store (Fast)</span>
                </label>
                <p className="converter-radio-sub-desc" style={{ margin: '4px 0 0 22px', fontSize: '0.74rem', color: 'var(--text-dim)', opacity: 0.85 }}>
                  ⚡ Skips compression calculations for maximum speed. Files are saved in store mode.
                </p>
              </div>

              <div className="converter-radio-item-group">
                <label className="converter-option-radio-item">
                  <input
                    type="radio"
                    name="compression-policy-radio"
                    checked={compressionPolicy === 'compress'}
                    onChange={() => onChangeCompressionPolicy('compress')}
                  />
                  <span style={{ fontWeight: '600' }}>Always Compress (Small Size)</span>
                </label>
                <p className="converter-radio-sub-desc" style={{ margin: '4px 0 0 22px', fontSize: '0.74rem', color: 'var(--text-dim)', opacity: 0.85 }}>
                  📦 Maximally compresses all data to minimize storage footprint.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="converter-option-stack">
          <div className="converter-option-block">
            <p className="converter-option-block-label">Split Criteria</p>
            <div className="converter-option-select-group">
              <select
                value={splitCriterion}
                onChange={(event) => onChangeSplitCriterion(event.target.value as SplitCriterion)}
                style={{ width: '100%', marginBottom: '8px' }}
              >
                <option value="pages">By Page Count (Even Split)</option>
                <option value="sizeMb">By File Size (MB Limit)</option>
                <option value="custom">Custom (Manual Split)</option>
              </select>

              <p className="converter-help-line" style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic', minHeight: '1.2rem' }}>
                {splitCriterion === 'pages' && '📏 Evenly divides the archive based on the specified number of pages.'}
                {splitCriterion === 'sizeMb' && '💾 Ensures that each output file does not exceed the specified MB threshold.'}
                {splitCriterion === 'custom' && '✂️ Splits the archive precisely at the page boundaries you define.'}
              </p>
            </div>
          </div>
          <label className="converter-option-row">
            <span>{splitCriterion === 'custom' ? 'Start Pages' : 'Target Value'}</span>
            {splitCriterion === 'custom' ? (
              <input
                type="text"
                value={splitCustomValues}
                placeholder="e.g., 201,451,651,851"
                onChange={(event) => onChangeSplitCustomValues(event.target.value)}
              />
            ) : (
              <input
                type="number"
                min={1}
                step={1}
                value={splitValue}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  onChangeSplitValue(Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1);
                }}
              />
            )}
          </label>
          {splitCriterion === 'custom' && (
            <>
              <label className="converter-option-row">
                <span>Total Pages</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={splitTotalPages}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    onChangeSplitTotalPages(Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1);
                  }}
                />
              </label>
              <p className="converter-help-line">{customInputHint}</p>
              <p className="converter-help-line">{customSplitPreview}</p>
            </>
          )}
        </div>
      )}


    </section>
  );
};
