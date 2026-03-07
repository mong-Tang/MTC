const dropZone = document.getElementById('dropZone');
const statusEl = document.getElementById('status');
const eventTimeEl = document.getElementById('eventTime');
const fileCountEl = document.getElementById('fileCount');
const bridgeStatusEl = document.getElementById('bridgeStatus');
const logEl = document.getElementById('log');
const filesEl = document.getElementById('files');

const MAX_LOG = 30;

function nowText() {
  return new Date().toLocaleTimeString('ko-KR', { hour12: false });
}

function setStatus(text) {
  statusEl.textContent = text;
  eventTimeEl.textContent = nowText();
}

function addLog(message) {
  const li = document.createElement('li');
  li.textContent = `[${nowText()}] ${message}`;
  logEl.prepend(li);

  while (logEl.children.length > MAX_LOG) {
    logEl.removeChild(logEl.lastChild);
  }
}

function clearFiles() {
  filesEl.innerHTML = '';
}

function renderFiles(fileList) {
  clearFiles();
  const files = Array.from(fileList || []);
  fileCountEl.textContent = String(files.length);

  if (files.length === 0) {
    const li = document.createElement('li');
    li.textContent = '드롭된 파일 없음';
    filesEl.appendChild(li);
    return;
  }

  files.forEach((file, index) => {
    const li = document.createElement('li');
    const filePath = typeof file.path === 'string' && file.path ? ` | path: ${file.path}` : '';
    li.textContent = `${index + 1}. ${file.name} | size: ${file.size} | type: ${file.type || 'n/a'}${filePath}`;
    filesEl.appendChild(li);
  });
}

function activateZone() {
  dropZone.classList.add('active');
}

function deactivateZone() {
  dropZone.classList.remove('active');
}

['dragenter', 'dragover'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
    activateZone();
    setStatus(eventName);

    const itemCount = event.dataTransfer?.items?.length ?? 0;
    addLog(`${eventName} items=${itemCount}`);
  });
});

dropZone.addEventListener('dragleave', (event) => {
  event.preventDefault();
  event.stopPropagation();
  deactivateZone();
  setStatus('dragleave');
  addLog('dragleave');
});

dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  event.stopPropagation();
  deactivateZone();
  setStatus('drop');

  const files = event.dataTransfer?.files;
  const itemCount = event.dataTransfer?.items?.length ?? 0;
  addLog(`drop files=${files?.length ?? 0} items=${itemCount}`);
  renderFiles(files);
});

window.addEventListener('dragover', (event) => {
  event.preventDefault();
});

window.addEventListener('drop', (event) => {
  event.preventDefault();
});

if (window.dragChk?.version) {
  bridgeStatusEl.textContent = `ok (${window.dragChk.version})`;
} else {
  bridgeStatusEl.textContent = 'not exposed';
}

renderFiles([]);
addLog('ready');
