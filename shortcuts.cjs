const shortcutRuntime = `
(() => {
  if (window.__libreChatUiDesktopShortcuts) {
    return;
  }

  function getScrollableContainer() {
    const firstMessage = document.querySelector(".message-render");
    if (!firstMessage) return document.scrollingElement || document.documentElement;

    let container = firstMessage.parentElement;
    while (container && container !== document.body) {
      const style = getComputedStyle(container);
      if (
        container.scrollHeight > container.clientHeight &&
        style.overflowY !== "visible" &&
        style.overflowY !== "hidden"
      ) {
        return container;
      }
      container = container.parentElement;
    }

    return document.scrollingElement || document.documentElement;
  }

  function scrollToPosition(container, top) {
    if (container) container.scrollTop = top;
  }

  function scrollOneMessage(direction) {
    const container = getScrollableContainer();
    if (!container) return;

    const messages = [...document.querySelectorAll(".message-render")];
    const current = container.scrollTop;
    const ordered = direction < 0 ? messages.reverse() : messages;
    const target = ordered.find((message) =>
      direction < 0
        ? message.offsetTop < current - 25
        : message.offsetTop > current + 25,
    );

    scrollToPosition(
      container,
      target?.offsetTop ?? (direction < 0 ? 0 : container.scrollHeight),
    );
  }

  const actions = Object.freeze({
    newChat() {
      document.querySelector('button[aria-label="New chat"]')?.click();
    },
    toggleSidebar() {
      document
        .querySelector(
          'button[aria-label="Close sidebar"], button[aria-label="Open sidebar"]',
        )
        ?.click();
    },
    togglePrivateChat() {
      document.querySelector('button[aria-label="Temporary Chat"]')?.click();
    },
    scrollUp() {
      scrollOneMessage(-1);
    },
    scrollDown() {
      scrollOneMessage(1);
    },
    scrollTop() {
      scrollToPosition(getScrollableContainer(), 0);
    },
    scrollBottom() {
      const container = getScrollableContainer();
      scrollToPosition(container, container?.scrollHeight ?? 0);
    },
  });

  Object.defineProperty(window, "__libreChatUiDesktopShortcuts", {
    value: actions,
    configurable: false,
    enumerable: false,
    writable: false,
  });
})();
`;

const SHORTCUT_WORLD_ID = 1001;

const actionScripts = {
  newChat: "window.__libreChatUiDesktopShortcuts?.newChat();",
  toggleSidebar: "window.__libreChatUiDesktopShortcuts?.toggleSidebar();",
  togglePrivateChat:
    "window.__libreChatUiDesktopShortcuts?.togglePrivateChat();",
  scrollUp: "window.__libreChatUiDesktopShortcuts?.scrollUp();",
  scrollDown: "window.__libreChatUiDesktopShortcuts?.scrollDown();",
  scrollTop: "window.__libreChatUiDesktopShortcuts?.scrollTop();",
  scrollBottom: "window.__libreChatUiDesktopShortcuts?.scrollBottom();",
};

function getAction(input, platform = process.platform) {
  if (input.type !== "keyDown" || input.isAutoRepeat) {
    return null;
  }

  const key = input.key.toLowerCase();
  const primaryModifier = platform === "darwin" ? input.meta : input.control;

  if (primaryModifier && !input.alt && key === "n") return "newChat";
  if (primaryModifier && input.shift && !input.alt && key === "s") {
    return "toggleSidebar";
  }
  if (primaryModifier && input.shift && !input.alt && key === "p") {
    return "togglePrivateChat";
  }

  if (!input.control || input.meta || input.alt || input.shift) return null;
  if (key === "k") return "scrollUp";
  if (key === "j") return "scrollDown";
  if (key === "u") return "scrollTop";
  if (key === "d") return "scrollBottom";
  return null;
}

function initializeShortcuts(mainWindow) {
  const { webContents } = mainWindow;

  const runScript = (script) => {
    if (webContents.isDestroyed()) return;
    void webContents
      .executeJavaScriptInIsolatedWorld(
        SHORTCUT_WORLD_ID,
        [{ code: script }],
        true,
      )
      .catch((error) => {
        console.error("Failed to execute LibreChat shortcut:", error);
      });
  };

  const installRuntime = () => runScript(shortcutRuntime);
  const handleInput = (event, input) => {
    const action = getAction(input);
    if (!action) return;

    event.preventDefault();
    runScript(actionScripts[action]);
  };

  webContents.on("did-finish-load", installRuntime);
  webContents.on("before-input-event", handleInput);

  return () => {
    if (webContents.isDestroyed()) return;
    webContents.off("did-finish-load", installRuntime);
    webContents.off("before-input-event", handleInput);
  };
}

module.exports = initializeShortcuts;
module.exports.getAction = getAction;
