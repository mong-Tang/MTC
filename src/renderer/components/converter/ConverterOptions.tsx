import React, { useMemo } from 'react';
import type { ConverterMode } from '../layout/ConverterPanel';
import type { CompressionPolicy } from '../layout/ConverterPanel';
import type { OutputNamePattern } from '../layout/ConverterPanel';
import type { SplitCriterion } from '../layout/ConverterPanel';

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
  onPickOutputDirectory
}) => {
  const customSplitPreview = useMemo(() => {
    if (splitCriterion !== 'custom') return '';
    const cutPoints = splitCustomValues
      .split(',')
      .map((token) => Number(token.trim()))
      .filter((value) => Number.isFinite(value) && value > 1)
      .map((value) => Math.floor(value));
    if (splitTotalPages <= 0) return '미리보기: 총 페이지를 입력하세요.';
    if (cutPoints.length === 0) return `미리보기: 분할 없음 (1~${splitTotalPages}, 1권)`;

    const invalid = cutPoints.some((point) => point > splitTotalPages);
    if (invalid) return `미리보기: 시작 페이지는 총 페이지(${splitTotalPages}) 이하여야 합니다.`;

    const sortedUnique = Array.from(new Set(cutPoints)).sort((a, b) => a - b);
    const starts = [1, ...sortedUnique];
    const ranges = starts.map((start, index) => {
      const nextStart = starts[index + 1];
      const end = nextStart ? nextStart - 1 : splitTotalPages;
      return `${start}~${end}`;
    });

    const preview = ranges.slice(0, 5).join(', ');
    const suffix = ranges.length > 5 ? ', ...' : '';
    return `미리보기: ${preview}${suffix} (${ranges.length}권)`;
  }, [splitCriterion, splitCustomValues, splitTotalPages]);

  const customInputHint = useMemo(() => {
    if (splitCriterion !== 'custom') return '';
    const points = splitCustomValues
      .split(',')
      .map((token) => Number(token.trim()))
      .filter((value) => Number.isFinite(value))
      .map((value) => Math.floor(value));
    if (points.length === 0) return '입력 예시: 201,451,651,851 (다음 권 시작 페이지)';
    const nonAscending = points.some((point, index) => index > 0 && point <= points[index - 1]);
    if (nonAscending) return '주의: 시작 페이지는 오름차순으로 입력하세요.';
    return '각 숫자는 다음 권 시작 페이지입니다. 실제 컷은 입력값 - 1 경계에서 수행됩니다.';
  }, [splitCriterion, splitCustomValues]);

  const splitNamePreview = useMemo(() => {
    const sampleIndex = '01';
    if (outputNamePattern === 'name-index') return `${outputNameBase}-${sampleIndex}`;
    if (outputNamePattern === 'index-name') return `${sampleIndex}-${outputNameBase}`;
    if (outputNamePattern === 'name_underscore_index') return `${outputNameBase}_${sampleIndex}`;
    return `${sampleIndex}_${outputNameBase}`;
  }, [outputNameBase, outputNamePattern]);
  const outputLabelBase = outputNameBase.trim() || 'output';

  return (
    <section className="converter-section">
      <h3 className="converter-section-title">변환 옵션</h3>
      <div className="converter-option-stack">
        <label className="converter-option-row">
          <span>출력 포맷</span>
          <select value={outputFormat} onChange={(event) => onChangeOutputFormat(event.target.value as 'zip' | 'cbz')}>
            <option value="zip">ZIP (.zip)</option>
            <option value="cbz">CBZ (.cbz)</option>
          </select>
        </label>
        <label className="converter-option-row">
          <span>{mode === 'merge' ? '출력 파일명' : '출력 파일명 접두어'}</span>
          <div className="converter-option-path-row">
            <input
              type="text"
              value={outputNameBase}
              placeholder={mode === 'merge' ? '예: merged_output' : '예: split_output'}
              onChange={(event) => onChangeOutputNameBase(event.target.value)}
            />
            <span className="converter-option-suffix">.{outputFormat}</span>
          </div>
        </label>
        {mode === 'split' && (
          <>
            <div className="converter-option-block">
              <p className="converter-option-block-label">출력 파일명 옵션</p>
              <div className="converter-option-radio-group">
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
              </div>
            </div>
            <p className="converter-help-line">미리보기: {splitNamePreview}.{outputFormat}</p>
          </>
        )}
        <label className="converter-option-row">
          <span>출력 위치</span>
          <div className="converter-option-path-row">
            <input
              type="text"
              value={outputDirectory}
              placeholder="출력 폴더를 선택하세요"
              onChange={(event) => onChangeOutputDirectory(event.target.value)}
            />
            <button type="button" className="converter-mini-btn" onClick={onPickOutputDirectory}>
              선택
            </button>
          </div>
        </label>
      </div>
      {mode === 'merge' ? (
        <div className="converter-option-stack">
          <label className="converter-option-row">
            <span>압축 정책</span>
            <select value={compressionPolicy} onChange={(event) => onChangeCompressionPolicy(event.target.value as CompressionPolicy)}>
              <option value="auto">자동: 압축파일 병합 무압축 / 일반이미지 압축</option>
              <option value="store">항상 무압축</option>
              <option value="compress">항상 압축</option>
            </select>
          </label>
        </div>
      ) : (
        <div className="converter-option-stack">
          <label className="converter-option-row">
            <span>분할 기준</span>
            <select value={splitCriterion} onChange={(event) => onChangeSplitCriterion(event.target.value as SplitCriterion)}>
              <option value="pages">페이지 수 기준</option>
              <option value="sizeMb">파일 용량 기준(MB)</option>
              <option value="custom">사용자 설정(다음 권 시작 페이지)</option>
            </select>
          </label>
          <label className="converter-option-row">
            <span>{splitCriterion === 'custom' ? '다음 권 시작 페이지' : '기준 값'}</span>
            {splitCriterion === 'custom' ? (
              <input
                type="text"
                value={splitCustomValues}
                placeholder="예: 201,451,651,851"
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
                <span>총 페이지</span>
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
