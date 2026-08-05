import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  shell,
} from "electron";
import path from "path";
import { fileURLToPath } from "url";
import Store from "electron-store";
import initializeShortcuts from "./shortcuts.cjs";
import {
  createSecureWebPreferences,
  isAllowedMediaPermission,
  isAllowedNavigation,
  isSafeExternalUrl,
  normalizeServerUrl,
} from "./security.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const iconPath = path.join(__dirname, "build", "icon.png");
const store = new Store();

let mainWindow = null;
let loginWindow = null;

app.disableHardwareAcceleration();
app.setName("LibreChat UI");

// Remove the identifier created by older telemetry-enabled releases.
store.delete("computerId");

function createLoginWindow() {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.focus();
    return;
  }

  loginWindow = new BrowserWindow({
    width: 600,
    height: 800,
    webPreferences: createSecureWebPreferences({
      devTools: !app.isPackaged,
      preload: path.join(__dirname, "login-preload.cjs"),
    }),
    icon: iconPath,
    resizable: false,
  });

  loginWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  loginWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  loginWindow.on("closed", () => {
    loginWindow = null;
  });

  void loginWindow.loadFile(path.join(__dirname, "login.html")).catch((error) => {
    console.error("Failed to load the configuration window:", error);
  });
}

function openExternalUrl(url) {
  if (!isSafeExternalUrl(url)) {
    return;
  }

  void shell.openExternal(url).catch((error) => {
    console.error("Failed to open external URL:", error);
  });
}

function configureMainWindowSecurity(window, serverUrl) {
  const allowedOrigin = new URL(serverUrl).origin;
  const { webContents } = window;
  const session = webContents.session;

  const blockCrossOriginNavigation = (event, targetUrl) => {
    if (isAllowedNavigation(targetUrl, allowedOrigin)) {
      return;
    }

    event.preventDefault();
    openExternalUrl(targetUrl);
  };

  webContents.on("will-navigate", blockCrossOriginNavigation);
  webContents.on("will-redirect", (event, targetUrl) => {
    if (!isAllowedNavigation(targetUrl, allowedOrigin)) {
      event.preventDefault();
    }
  });
  webContents.on("will-attach-webview", (event) => event.preventDefault());

  webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedNavigation(url, allowedOrigin)) {
      void webContents.loadURL(url);
    } else {
      openExternalUrl(url);
    }

    return { action: "deny" };
  });

  session.setPermissionCheckHandler(
    (requestingWebContents, permission, requestingOrigin, details) =>
      isAllowedMediaPermission({
        permission,
        requestingUrl:
          details?.requestingUrl ||
          details?.securityOrigin ||
          requestingOrigin ||
          requestingWebContents?.getURL() ||
          "",
        allowedOrigin,
        mediaTypes: details?.mediaType ? [details.mediaType] : [],
      }),
  );

  session.setPermissionRequestHandler(
    (requestingWebContents, permission, callback, details) => {
      const requestingUrl =
        details?.requestingUrl || requestingWebContents?.getURL() || "";

      callback(
        isAllowedMediaPermission({
          permission,
          requestingUrl,
          allowedOrigin,
          mediaTypes: details?.mediaTypes,
        }),
      );
    },
  );
}

function createMainWindow(serverHost) {
  const serverUrl = normalizeServerUrl(serverHost);

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return;
  }

  const window = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: createSecureWebPreferences({
      devTools: !app.isPackaged,
    }),
    icon: iconPath,
  });
  const disposeShortcuts = initializeShortcuts(window);

  mainWindow = window;
  configureMainWindowSecurity(window, serverUrl);
  buildMenu(serverUrl);

  window.on("closed", () => {
    disposeShortcuts();
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.close();
  }

  void window.loadURL(serverUrl).catch((error) => {
    console.error("Failed to load the LibreChat server:", error);
  });
}

function resetServerConfiguration() {
  store.delete("serverHost");

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }

  createLoginWindow();
}

function initialize() {
  const savedHost = store.get("serverHost");

  if (!savedHost) {
    createLoginWindow();
    return;
  }

  try {
    const normalizedUrl = normalizeServerUrl(savedHost);
    store.set("serverHost", normalizedUrl);
    createMainWindow(normalizedUrl);
  } catch (error) {
    console.error("Discarding invalid saved server URL:", error);
    store.delete("serverHost");
    createLoginWindow();
  }
}

app.on("web-contents-created", (_event, webContents) => {
  webContents.on("will-attach-webview", (event) => event.preventDefault());
});

app.whenReady().then(initialize);

ipcMain.handle("submit-server-host", (event, serverHost) => {
  if (!loginWindow || event.sender !== loginWindow.webContents) {
    return { ok: false, error: "Unauthorized configuration request." };
  }

  try {
    const serverUrl = normalizeServerUrl(serverHost);
    store.set("serverHost", serverUrl);
    setImmediate(() => createMainWindow(serverUrl));
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid server URL.",
    };
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    initialize();
  }
});

process.on("uncaughtException", (error) => {
  console.error("An uncaught error occurred:", error);
});

app.on("render-process-gone", (_event, _webContents, details) => {
  console.error("Render process gone:", details);
});

app.on("child-process-gone", (_event, details) => {
  console.error("Child process gone:", details);
});

function buildMenu(serverUrl) {
  const viewSubmenu = [
    { role: "reload" },
    ...(app.isPackaged ? [] : [{ role: "toggleDevTools" }]),
    { type: "separator" },
    { role: "resetZoom" },
    { role: "zoomIn" },
    { role: "zoomOut" },
    { type: "separator" },
    { role: "togglefullscreen" },
  ];

  const template = [
    ...(process.platform === "darwin"
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        process.platform === "darwin" ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "LibreChat UI",
      submenu: [
        {
          label: "Disconnect from host",
          click: async () => {
            const result = await dialog.showMessageBox({
              type: "question",
              buttons: ["Disconnect", "Cancel"],
              defaultId: 1,
              cancelId: 1,
              title: "Disconnect Confirmation",
              message: `Disconnect from this server?\n\n${serverUrl}`,
            });

            if (result.response === 0) {
              resetServerConfiguration();
            }
          },
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        ...(process.platform === "darwin"
          ? [
              { role: "pasteAndMatchStyle" },
              { role: "delete" },
              { role: "selectAll" },
              { type: "separator" },
              {
                label: "Speech",
                submenu: [
                  { role: "startSpeaking" },
                  { role: "stopSpeaking" },
                ],
              },
            ]
          : [{ role: "delete" }, { type: "separator" }, { role: "selectAll" }]),
      ],
    },
    { label: "View", submenu: viewSubmenu },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(process.platform === "darwin"
          ? [
              { type: "separator" },
              { role: "front" },
              { type: "separator" },
              { role: "window" },
            ]
          : [{ role: "close" }]),
      ],
    },
    {
      role: "help",
      submenu: [
        {
          label: "Learn More",
          click: () => openExternalUrl("https://github.com/biptec/LibreChat-UI"),
        },
        {
          label: "Keyboard Shortcuts",
          click: () => {
            if (!mainWindow || mainWindow.isDestroyed()) {
              return;
            }

            void dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "Keyboard Shortcuts",
              message: [
                "Cmd/Ctrl+N: Start a new chat",
                "Cmd/Ctrl+Shift+S: Toggle sidebar",
                "Cmd/Ctrl+Shift+P: Toggle private chat",
                "",
                "Ctrl+K: Scroll up",
                "Ctrl+J: Scroll down",
                "Ctrl+U: Scroll to top",
                "Ctrl+D: Scroll to bottom",
              ].join("\n"),
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
