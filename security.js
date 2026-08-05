const HTTPS_PROTOCOL = "https:";
const HTTP_PROTOCOL = "http:";
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isLoopbackHostname(hostname) {
  return LOOPBACK_HOSTNAMES.has(hostname.toLowerCase());
}

function isTrustedServerUrl(parsed) {
  return (
    parsed !== null &&
    (parsed.protocol === HTTPS_PROTOCOL ||
      (parsed.protocol === HTTP_PROTOCOL && isLoopbackHostname(parsed.hostname)))
  );
}

export function createSecureWebPreferences({ devTools = false, preload } = {}) {
  const preferences = {
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
    devTools,
  };

  if (preload) {
    preferences.preload = preload;
  }

  return preferences;
}

export function normalizeServerUrl(input) {
  if (typeof input !== "string" || input.trim() === "") {
    throw new Error("Enter a LibreChat server URL.");
  }

  const trimmed = input.trim();
  const hasProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed);
  let parsed = parseUrl(hasProtocol ? trimmed : `https://${trimmed}`);

  if (!hasProtocol && parsed && isLoopbackHostname(parsed.hostname)) {
    parsed = parseUrl(`http://${trimmed}`);
  }

  if (!parsed || !parsed.hostname) {
    throw new Error("Enter a valid LibreChat server URL.");
  }

  if (!isTrustedServerUrl(parsed)) {
    throw new Error(
      "Use HTTPS, or HTTP only with localhost, 127.0.0.1, or [::1].",
    );
  }

  if (parsed.username || parsed.password) {
    throw new Error("Credentials must not be embedded in the server URL.");
  }

  parsed.hash = "";
  return parsed.toString();
}

export function isAllowedNavigation(targetUrl, allowedOrigin) {
  const parsed = parseUrl(targetUrl);
  return isTrustedServerUrl(parsed) && parsed.origin === allowedOrigin;
}

export function isSafeExternalUrl(targetUrl) {
  const parsed = parseUrl(targetUrl);
  return parsed !== null && parsed.protocol === HTTPS_PROTOCOL;
}

export function isAllowedMediaPermission({
  permission,
  requestingUrl,
  allowedOrigin,
  mediaTypes,
}) {
  if (permission !== "media") {
    return false;
  }

  if (!isAllowedNavigation(requestingUrl, allowedOrigin)) {
    return false;
  }

  return (
    Array.isArray(mediaTypes) &&
    mediaTypes.length > 0 &&
    mediaTypes.every((mediaType) => mediaType === "audio")
  );
}
