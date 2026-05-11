import React, { useMemo, useRef, useEffect } from 'react';
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
  // 🛸 [신규 계승] 최종 집행 권한 통합!
  canExecute: boolean;
  disabledReason: string | null;
  onExecute: () => void;
  progressPercent: number;
  executionLogs: string[];
  isProcessing: boolean;
  mergeComment: string;
  onChangeMergeComment: (val: string) => void;
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
  canExecute,
  disabledReason,
  onExecute,
  progressPercent,
  executionLogs,
  isProcessing,
  mergeComment,
  onChangeMergeComment
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
      <div className="converter-file-list-header">
        <h3 className="converter-section-title">변환 옵션</h3>
      </div>
      <div className="converter-option-stack">
        <label className="converter-option-row">
          <span>출력 포맷</span>
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
          <span>{mode === 'merge' ? '출력 파일명' : '출력 접두어'}</span>
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
          <div className="converter-option-block">
            <p className="converter-option-block-label">압축 정책</p>
            <select
              value={compressionPolicy}
              onChange={(event) => onChangeCompressionPolicy(event.target.value as CompressionPolicy)}
              style={{ width: '100%' }}
            >
              <option value="auto">자동 (추천)</option>
              <option value="store">항상 무압축 (빠름)</option>
              <option value="compress">항상 압축 (최소 용량)</option>
            </select>
            <p className="converter-help-line" style={{ marginTop: '4px' }}>
              {compressionPolicy === 'auto' && '💡 병합 시 기존 압축 파일은 무압축 승계, 일반 이미지는 새로 압축하여 최적의 밸런스를 유지합니다.'}
              {compressionPolicy === 'store' && '⚡ 압축 연산 과정을 생략하여 병합/분할 속도가 가장 빠르며 원본 그대로 저장됩니다.'}
              {compressionPolicy === 'compress' && '📦 모든 데이터를 최고 수준으로 압축하여 저장 장치의 공간을 최대한 절약합니다.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="converter-option-stack">
          <div className="converter-option-block">
            <p className="converter-option-block-label">분할 기준</p>
            <select
              value={splitCriterion}
              onChange={(event) => onChangeSplitCriterion(event.target.value as SplitCriterion)}
              style={{ width: '100%' }}
            >
              <option value="pages">페이지 수 기준 (동일 비율)</option>
              <option value="sizeMb">파일 용량 기준 (MB단위 제한)</option>
              <option value="custom">사용자 설정 (직접 수동 분할)</option>
            </select>
            <p className="converter-help-line" style={{ marginTop: '4px' }}>
              {splitCriterion === 'pages' && '📏 설정한 페이지 수 단위로 아카이브를 균등하게 나눕니다.'}
              {splitCriterion === 'sizeMb' && '💾 각 결과 파일의 용량이 지정된 MB를 넘지 않도록 분할합니다.'}
              {splitCriterion === 'custom' && '✂️ 사용자가 입력한 특정 페이지 경계를 기준으로 책을 나눕니다.'}
            </p>
          </div>
          <label className="converter-option-row">
            <span>{splitCriterion === 'custom' ? '시작 페이지' : '기준 값'}</span>
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

      {/* 🚀 [마스터 클라이맥스] 모든 옵션 설정의 종착역, 강력한 실행 엔진 통합! */}
      <div className="converter-action-footer">
        <button
          className={`primary-btn converter-execute-btn ${isProcessing ? 'processing' : ''}`}
          type="button"
          disabled={!canExecute}
          title={!canExecute && disabledReason ? disabledReason : ''}
          onClick={onExecute}
        >
          {/* ⚡ [버튼 내장 레이저 프로그레스] 버튼 내부에 탑재된 초박형 네온 게이지 */}
          {isProcessing && (
            <div className="btn-inner-progress-track">
              <div 
                className="btn-inner-progress-fill" 
                style={{ width: `${progressPercent}%` }} 
              />
            </div>
          )}
          
          <span className="btn-label-text">
            {isProcessing ? `처리 중 (${progressPercent}%)` : (mode === 'merge' ? '병합 실행' : '분할 실행')}
          </span>
        </button>
      </div>

      {/* 📟 [실시간 통신창 / 터미널 센터] 버튼 아래에 상주하며 연산 중 발생하는 시스템 메시지를 그대로 노출! */}
      <div className="converter-terminal-panel">
        <div className="terminal-logs-container" ref={terminalRef}>
          {executionLogs.length === 0 ? (
            <div className="terminal-log-line" style={{ opacity: 0.4 }}>
              [SYSTEM] 명령 대기 중... 병합을 실행하면 작업 내역이 여기에 표시됩니다.
            </div>
          ) : (
            executionLogs.map((log, idx) => (
              <div key={idx} className="terminal-log-line">
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
