const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("libreChatDesktop", {
  submitServerHost(serverHost) {
    return ipcRenderer.invoke("submit-server-host", serverHost);
  },
});
