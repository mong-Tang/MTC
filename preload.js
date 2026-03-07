const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('dragChk', {
  version: '1.0.0'
});
