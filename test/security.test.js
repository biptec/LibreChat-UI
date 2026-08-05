import test from "node:test";
import assert from "node:assert/strict";
import {
  createSecureWebPreferences,
  isAllowedMediaPermission,
  isAllowedNavigation,
  isSafeExternalUrl,
  normalizeServerUrl,
} from "../security.js";

test("creates hardened Electron web preferences", () => {
  assert.deepEqual(createSecureWebPreferences(), {
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    webviewTag: false,
    safeDialogs: true,
    navigateOnDragDrop: false,
    devTools: false,
  });

  assert.equal(
    createSecureWebPreferences({ preload: "/tmp/preload.cjs" }).preload,
    "/tmp/preload.cjs",
  );
});

test("normalizeServerUrl adds HTTPS and preserves ports and paths", () => {
  assert.equal(
    normalizeServerUrl("chat.example.com:8443/librechat"),
    "https://chat.example.com:8443/librechat",
  );
  assert.equal(
    normalizeServerUrl("203.0.113.10:3080"),
    "https://203.0.113.10:3080/",
  );
});

test("normalizeServerUrl allows HTTP only for exact loopback hosts", () => {
  assert.equal(
    normalizeServerUrl("localhost:3080"),
    "http://localhost:3080/",
  );
  assert.equal(
    normalizeServerUrl("http://127.0.0.1:3080/chat"),
    "http://127.0.0.1:3080/chat",
  );
  assert.equal(
    normalizeServerUrl("http://[::1]:3080"),
    "http://[::1]:3080/",
  );
});

test("normalizeServerUrl rejects insecure public or malformed values", () => {
  assert.throws(() => normalizeServerUrl(""), /Enter a LibreChat server URL/);
  assert.throws(
    () => normalizeServerUrl("http://chat.example.com"),
    /Use HTTPS, or HTTP only/,
  );
  assert.throws(
    () => normalizeServerUrl("http://203.0.113.10:3080"),
    /Use HTTPS, or HTTP only/,
  );
  assert.throws(
    () => normalizeServerUrl("http://0.0.0.0:3080"),
    /Use HTTPS, or HTTP only/,
  );
  assert.throws(
    () => normalizeServerUrl("http://127.0.0.2:3080"),
    /Use HTTPS, or HTTP only/,
  );
  assert.throws(
    () => normalizeServerUrl("ftp://chat.example.com"),
    /Use HTTPS, or HTTP only/,
  );
  assert.throws(
    () => normalizeServerUrl("https://user:pass@chat.example.com"),
    /Credentials/,
  );
  assert.throws(() => normalizeServerUrl("not a url"), /valid LibreChat/);
});

test("normalizeServerUrl removes fragments", () => {
  assert.equal(
    normalizeServerUrl("https://chat.example.com/path#token"),
    "https://chat.example.com/path",
  );
});

test("navigation is limited to the configured trusted origin", () => {
  const httpsOrigin = "https://chat.example.com";
  assert.equal(
    isAllowedNavigation("https://chat.example.com/c/new", httpsOrigin),
    true,
  );
  assert.equal(
    isAllowedNavigation("https://evil.example.com", httpsOrigin),
    false,
  );
  assert.equal(
    isAllowedNavigation("http://chat.example.com", httpsOrigin),
    false,
  );

  const loopbackOrigin = "http://127.0.0.1:3080";
  assert.equal(
    isAllowedNavigation("http://127.0.0.1:3080/c/new", loopbackOrigin),
    true,
  );
  assert.equal(
    isAllowedNavigation("http://localhost:3080/c/new", loopbackOrigin),
    false,
  );
  assert.equal(
    isAllowedNavigation(
      "http://203.0.113.10:3080/c/new",
      "http://203.0.113.10:3080",
    ),
    false,
  );
  assert.equal(isAllowedNavigation("not a url", httpsOrigin), false);
});

test("only external HTTPS URLs are considered safe", () => {
  assert.equal(isSafeExternalUrl("https://example.com/docs"), true);
  assert.equal(isSafeExternalUrl("http://example.com"), false);
  assert.equal(isSafeExternalUrl("file:///etc/passwd"), false);
  assert.equal(isSafeExternalUrl("javascript:alert(1)"), false);
});

test("only same-origin microphone requests are allowed", () => {
  const allowedOrigin = "https://chat.example.com";
  const baseRequest = {
    permission: "media",
    requestingUrl: "https://chat.example.com/c/1",
    allowedOrigin,
  };

  assert.equal(
    isAllowedMediaPermission({ ...baseRequest, mediaTypes: ["audio"] }),
    true,
  );
  assert.equal(
    isAllowedMediaPermission({
      permission: "media",
      requestingUrl: "http://127.0.0.1:3080/c/1",
      allowedOrigin: "http://127.0.0.1:3080",
      mediaTypes: ["audio"],
    }),
    true,
  );
  assert.equal(
    isAllowedMediaPermission({ ...baseRequest, mediaTypes: ["video"] }),
    false,
  );
  assert.equal(
    isAllowedMediaPermission({
      ...baseRequest,
      mediaTypes: ["audio", "video"],
    }),
    false,
  );
  assert.equal(
    isAllowedMediaPermission({
      ...baseRequest,
      requestingUrl: "https://evil.example.com",
      mediaTypes: ["audio"],
    }),
    false,
  );
  assert.equal(
    isAllowedMediaPermission({
      ...baseRequest,
      permission: "notifications",
      mediaTypes: ["audio"],
    }),
    false,
  );
});
