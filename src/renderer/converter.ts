/// <reference path="global.d.ts" />
(() => {
  type Locale = 'ko' | 'en';

  type ConverterMenuAction = 'select-source' | 'select-output' | 'start-conversion' | 'toggle-log' | 'show-policy' | 'fmt-zip' | 'fmt-cbz';

  interface ConverterState {
    sourcePath: string;
    outputDirectory: string;
    showLog: boolean;
    locale: Locale;
    outputFormat: 'zip' | 'cbz';
  }

  const state: ConverterState = {
    sourcePath: '',
    outputDirectory: '',
    showLog: true,
    locale: 'ko',
    outputFormat: 'zip'
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
    const logView = byId<HTMLPreElement>('log-view');
    logView.textContent = lines.join('\n');
    logView.scrollTop = logView.scrollHeight; // Force Auto-Scroll to Bottom
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

  function updateFormatUI(): void {
    const zipMark = document.getElementById('fmt-zip-mark');
    const zipLabel = document.getElementById('fmt-zip-label');
    const cbzMark = document.getElementById('fmt-cbz-mark');
    const cbzLabel = document.getElementById('fmt-cbz-label');
    const badge = document.getElementById('current-format-badge');
    
    if (badge) {
      badge.textContent = `🎯 ${state.outputFormat.toUpperCase()}`;
    }

    const subtitle = document.getElementById('subtitle');
    if (subtitle) {
      // Make it dynamic & bold the active format for ultimate premium feel!
      subtitle.innerHTML = `다양한 형태의 압축파일을 표준 <strong>${state.outputFormat.toUpperCase()}</strong> 포맷으로 치환합니다.`;
    }
    
    if (zipMark && zipLabel) {
      const isZip = state.outputFormat === 'zip';
      zipMark.textContent = isZip ? '✓' : '';
      zipMark.style.color = isZip ? 'var(--accent)' : '';
      zipMark.style.fontWeight = isZip ? '600' : 'normal';
      zipLabel.style.color = isZip ? 'var(--accent)' : '';
      zipLabel.style.fontWeight = isZip ? '600' : 'normal';
    }
    if (cbzMark && cbzLabel) {
      const isCbz = state.outputFormat === 'cbz';
      cbzMark.textContent = isCbz ? '✓' : '';
      cbzMark.style.color = isCbz ? 'var(--accent)' : '';
      cbzMark.style.fontWeight = isCbz ? '600' : 'normal';
      cbzLabel.style.color = isCbz ? 'var(--accent)' : '';
      cbzLabel.style.fontWeight = isCbz ? '600' : 'normal';
    }
    // Persist preference instantly on every change!
    localStorage.setItem('pref_cvt_format', state.outputFormat);
  }

  function applyStateToInputs(): void {
    byId<HTMLInputElement>('source-path').value = state.sourcePath;
    byId<HTMLInputElement>('output-path').value = state.outputDirectory;
    updateFormatUI();
  }

  async function selectSource(): Promise<void> {
    const filePath = await window.appApi.openFileDialog({
      title: t('menu.converter.selectSource'),
      zipFilterName: '',
      imageFilterName: '',
      archiveFilterName: t('converter.page.archiveFilter'),
      excludeZip: true
    });

    if (!filePath) {
      return;
    }

    state.sourcePath = filePath;
    
    // Automatically populate result filename field with the original basename!
    const baseName = filePath.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, "") || "";
    const fileNameInput = document.getElementById('output-filename') as HTMLInputElement;
    if (fileNameInput) {
      fileNameInput.value = baseName;
    }
    
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
    const ext = state.outputFormat === 'cbz' ? '.cbz' : '.zip';
    const customName = (document.getElementById('output-filename') as HTMLInputElement)?.value || "";
    
    // 4th argument passed! The new custom name rides the wind!
    const result = await window.appApi
      .convertArchiveToZip(state.sourcePath, state.outputDirectory, ext, customName)
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

    byId<HTMLButtonElement>('win-btn-minimize').addEventListener('click', () => {
      window.appApi.minimizeWindow();
    });

    byId<HTMLButtonElement>('win-btn-maximize').addEventListener('click', () => {
      window.appApi.maximizeWindow();
    });

    byId<HTMLButtonElement>('win-btn-close').addEventListener('click', () => {
      window.appApi.closeWindow();
    });

    // [RESTORED] Handle Trigger clicks for reliable opening
    document.querySelectorAll('.custom-menu-trigger').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // Stop from reaching document
        
        // [NEW] Check if this is a direct action button (like Help now is!)
        const directAction = btn.getAttribute('data-menu');
        if (directAction === 'show-policy') {
          document.querySelectorAll('.custom-menu-item').forEach(m => m.classList.remove('active'));
          byId<HTMLElement>('policy-card')?.scrollIntoView({ behavior: 'smooth' });
          return; // Absolute shortcut, ignore dropdown logic
        }

        const parent = btn.parentElement;
        if (!parent) return;

        const isActive = parent.classList.contains('active');
        // 1. Close all menus first
        document.querySelectorAll('.custom-menu-item').forEach(m => m.classList.remove('active'));
        // 2. If it was not active, make it active
        if (!isActive) {
          parent.classList.add('active');
        }
      });

      // [RESTORED] Professional Menubar Feature: Auto-open adjacent menus while one is already open!
      btn.addEventListener('mouseenter', () => {
        const isAnyMenuOpen = !!document.querySelector('.custom-menu-item.active');
        if (isAnyMenuOpen) {
          // Shift the 'active' baton seamlessly to this neighbor
          document.querySelectorAll('.custom-menu-item').forEach(m => m.classList.remove('active'));
          btn.parentElement?.classList.add('active');
        }
      });
    });

    // [RESTORED] Close menu when clicking anywhere else on the document
    document.addEventListener('click', () => {
      document.querySelectorAll('.custom-menu-item').forEach(m => m.classList.remove('active'));
    });

    // [RESTORED] Listen to HTML Menubar Dropdown Item clicks
    document.querySelectorAll('.dropdown-item[data-menu]').forEach((el) => {
      el.addEventListener('click', () => {
        const action = el.getAttribute('data-menu');
        if (!action) return;

        switch(action) {
          case 'select-source': void selectSource(); break;
          case 'select-output': void selectOutput(); break;
          case 'close': window.appApi.closeWindow(); break;
          case 'copy': document.execCommand('copy'); break;
          case 'paste': document.execCommand('paste'); break;
          case 'start-conversion': void startConversion(); break;
          case 'fmt-zip': 
            state.outputFormat = 'zip';
            updateFormatUI();
            break;
          case 'fmt-cbz':
            state.outputFormat = 'cbz';
            updateFormatUI();
            break;
          case 'show-policy':
            byId<HTMLElement>('policy-card')?.scrollIntoView({ behavior: 'smooth' });
            break;
        }
      });
    });

    window.addEventListener('keydown', (e) => {
      // Control + W to close
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        window.appApi.closeWindow();
        return;
      }
      // F5 or Control + Enter to start conversion
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
        e.preventDefault();
        void startConversion();
        return;
      }
      // Control + O for select source
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        void selectSource();
        return;
      }
      // Control + Shift + O for select output
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        void selectOutput();
        return;
      }
    });
    
    // Premium Modal Wire-Up Logic
    const helpModal = document.getElementById('help-modal');
    const helpTrigger = document.getElementById('btn-help-trigger');
    const helpClose1 = document.getElementById('help-modal-close');
    const helpClose2 = document.getElementById('help-modal-close-btn');

    const openHelp = (): void => helpModal?.classList.add('active');
    const closeHelp = (): void => helpModal?.classList.remove('active');

    helpTrigger?.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent event bubbling that could misfire dropdown handlers
      openHelp();
    });
    helpClose1?.addEventListener('click', closeHelp);
    helpClose2?.addEventListener('click', closeHelp);
    // Clicking outside on the backdrop closes it too! Super high-end!
    helpModal?.addEventListener('click', (e) => {
      if (e.target === helpModal) closeHelp();
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
        // Left in type spec for compatibility, toggle visually inactive as ordered
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
    document.body.setAttribute('data-theme', settings.theme || 'dark');

    // Restore past format preferences instantly!
    const savedFormat = localStorage.getItem('pref_cvt_format');
    if (savedFormat === 'zip' || savedFormat === 'cbz') {
      state.outputFormat = savedFormat;
    }

    renderTexts();
    setStatus('converter.page.status.idle');
    setLog([]);
    applyStateToInputs();
    bindEvents();
  }

  document.addEventListener('DOMContentLoaded', () => {
    void init();
  });
})();
