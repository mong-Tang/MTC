type Locale = 'ko' | 'en';

type ConverterMenuAction = 'select-source' | 'select-output' | 'start-conversion' | 'toggle-log' | 'show-policy';

interface ConverterState {
  sourcePath: string;
  outputDirectory: string;
  showLog: boolean;
  locale: Locale;
}

const state: ConverterState = {
  sourcePath: '',
  outputDirectory: '',
  showLog: true,
  locale: 'ko'
};

let dictionaries: { ko: Record<string, string>; en: Record<string, string> } | null = null;
let busyCursorDepth = 0;

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element: ${id}`);
  }

  return element as T;
}

function t(key: string, vars?: Record<string, string>): string {
  const table = dictionaries?.[state.locale] ?? dictionaries?.ko ?? {};
  const raw = table[key] ?? key;
  if (!vars) {
    return raw;
  }

  return Object.entries(vars).reduce((acc, [name, value]) => acc.replaceAll(`{${name}}`, value), raw);
}

function setStatus(messageKey: string, vars?: Record<string, string>): void {
  byId<HTMLSpanElement>('status').textContent = t(messageKey, vars);
}

function setLog(lines: string[]): void {
  byId<HTMLPreElement>('log-view').textContent = lines.join('\n');
}

function setBusyCursor(active: boolean): void {
  busyCursorDepth = Math.max(0, busyCursorDepth + (active ? 1 : -1));
  document.body.style.cursor = busyCursorDepth > 0 ? 'wait' : '';
}

function renderTexts(): void {
  document.title = t('converter.page.title');
  byId<HTMLHeadingElement>('title').textContent = t('converter.page.title');
  byId<HTMLParagraphElement>('subtitle').textContent = t('converter.page.subtitle');
  byId<HTMLLabelElement>('source-label').textContent = t('converter.page.source');
  byId<HTMLButtonElement>('select-source').textContent = t('converter.page.selectSource');
  byId<HTMLLabelElement>('output-label').textContent = t('converter.page.output');
  byId<HTMLButtonElement>('select-output').textContent = t('converter.page.selectOutput');
  byId<HTMLButtonElement>('start-convert').textContent = t('converter.page.start');
  byId<HTMLLabelElement>('policy-label').textContent = t('converter.page.policyAgree');
  byId<HTMLElement>('log-title').textContent = t('converter.page.log');
  byId<HTMLElement>('policy-title').textContent = t('converter.page.policyTitle');
  byId<HTMLParagraphElement>('policy-body').textContent = t('converter.page.policyBody');
}

function applyStateToInputs(): void {
  byId<HTMLInputElement>('source-path').value = state.sourcePath;
  byId<HTMLInputElement>('output-path').value = state.outputDirectory;
  byId<HTMLElement>('log-view').classList.toggle('hidden', !state.showLog);
}

async function selectSource(): Promise<void> {
  const filePath = await window.appApi.openFileDialog({
    title: t('menu.converter.selectSource'),
    zipFilterName: '',
    imageFilterName: '',
    archiveFilterName: t('converter.page.archiveFilter')
  });

  if (!filePath) {
    return;
  }

  state.sourcePath = filePath;
  applyStateToInputs();
}

async function selectOutput(): Promise<void> {
  const folderPath = await window.appApi.openFolderDialog(t('menu.converter.selectOutput'));
  if (!folderPath) {
    return;
  }

  state.outputDirectory = folderPath;
  applyStateToInputs();
}

async function startConversion(): Promise<void> {
  if (!state.sourcePath || !state.outputDirectory) {
    setStatus('converter.page.status.failed');
    setLog([t('converter.page.missingInput')]);
    return;
  }

  if (!byId<HTMLInputElement>('policy-agree').checked) {
    setStatus('converter.page.status.failed');
    setLog([t('converter.page.policyRequired')]);
    return;
  }

  setStatus('converter.page.status.running');
  setLog([]);

  setBusyCursor(true);
  const result = await window.appApi
    .convertArchiveToZip(state.sourcePath, state.outputDirectory)
    .finally(() => setBusyCursor(false));
  if (!result.ok) {
    setStatus('converter.page.status.failed');
    setLog([result.error.message]);
    return;
  }

  setStatus('converter.page.status.success');
  setLog([...result.data.logs, t('converter.page.result', { path: result.data.outputPath })]);
}

function bindEvents(): void {
  byId<HTMLButtonElement>('select-source').addEventListener('click', () => {
    void selectSource();
  });

  byId<HTMLButtonElement>('select-output').addEventListener('click', () => {
    void selectOutput();
  });

  byId<HTMLButtonElement>('start-convert').addEventListener('click', () => {
    void startConversion();
  });

  window.appApi.onConverterMenuAction((action: ConverterMenuAction) => {
    if (action === 'select-source') {
      void selectSource();
      return;
    }
    if (action === 'select-output') {
      void selectOutput();
      return;
    }
    if (action === 'start-conversion') {
      void startConversion();
      return;
    }
    if (action === 'toggle-log') {
      state.showLog = !state.showLog;
      applyStateToInputs();
      return;
    }
    if (action === 'show-policy') {
      byId<HTMLElement>('policy-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

async function init(): Promise<void> {
  dictionaries = await window.appApi.getI18nDictionaries();
  const settings = await window.appApi.getAppSettings();
  state.locale = settings.locale;

  renderTexts();
  setStatus('converter.page.status.idle');
  setLog([]);
  applyStateToInputs();
  bindEvents();
}

document.addEventListener('DOMContentLoaded', () => {
  void init();
});

export {};
