# LibreChat UI

<div align="center">
  <img src="build/icon.png" alt="LibreChat UI icon" width="200" />
</div>

LibreChat UI is a desktop wrapper for self-hosted LibreChat instances.
It provides a dedicated application window and keyboard shortcuts while
keeping remote LibreChat content isolated from Electron and Node.js APIs.

## Security model

The application treats every LibreChat server as untrusted remote content:

- remote servers require HTTPS; HTTP is limited to exact loopback hosts for
  SSH tunnels;
- Node.js integration is disabled in every renderer;
- context isolation, Chromium sandboxing, and web security are enabled;
- navigation is restricted to the configured LibreChat origin;
- external HTTPS links open in the system browser;
- pop-up windows and embedded webviews are blocked;
- only same-origin microphone access is permitted;
- camera and all unrelated Electron permissions are denied;
- packaged builds do not expose Chromium developer tools;
- no usage telemetry or persistent device identifier is collected.

A compromised LibreChat server can still access data entered into that server.
Use an instance you trust and keep both the client and server updated.

## Features

- Dedicated LibreChat application window
- Persistent server configuration
- Microphone support for LibreChat speech-to-text
- Keyboard shortcuts:
  - `Cmd/Ctrl+N`: start a new chat
  - `Cmd/Ctrl+Shift+S`: toggle the sidebar
  - `Cmd/Ctrl+Shift+P`: toggle temporary chat
  - `Ctrl+K`: scroll to the previous message
  - `Ctrl+J`: scroll to the next message
  - `Ctrl+U`: scroll to the top
  - `Ctrl+D`: scroll to the bottom

## Requirements

- Node.js 22.12 or newer
- Yarn 1.22
- A LibreChat instance available through HTTPS, or through a local SSH tunnel

Public HTTP endpoints, embedded URL credentials, and non-HTTP(S) protocols are
rejected. HTTP is accepted only for `localhost`, `127.0.0.1`, and `[::1]`, so an
unencrypted remote endpoint cannot be saved accidentally.

## Install a release on macOS

Releases are currently unsigned. Verify that the release comes from this
repository before opening it. Prefer building locally when practical.

1. Download the DMG from the repository's Releases page.
2. Drag `LibreChat UI.app` to `/Applications`.
3. Open it normally. If macOS blocks the unsigned application, review the
   warning in **System Settings → Privacy & Security** before choosing to open it.

Do not remove the quarantine attribute with `xattr`. That bypasses an important
macOS safety check instead of letting you review the application once.

After launch, enter the complete HTTPS URL of your LibreChat server, for example:

```text
https://chat.example.com
```

### Connect through an SSH tunnel

Forward a local port to the LibreChat port on the server:

```bash
ssh -L 3080:127.0.0.1:3080 user@server.example.com
```

Keep that SSH session open and enter this URL in LibreChat UI:

```text
http://127.0.0.1:3080
```

The application permits this HTTP URL because it is loopback-only; traffic
between your computer and the server is carried inside the encrypted SSH tunnel.
Direct HTTP URLs using a remote hostname or IP address remain blocked.

## Build locally

```bash
git clone https://github.com/biptec/LibreChat-UI.git
cd LibreChat-UI
yarn install --frozen-lockfile
yarn run verify
yarn app:dist:mac
```

The macOS artifact is created under `dist/`.

## Development

Start the application:

```bash
yarn start
```

Run syntax checks and tests:

```bash
yarn run verify
```

Create unpacked Linux output for local smoke testing:

```bash
yarn app:dir:linux
```

## Privacy

LibreChat UI does not send analytics or telemetry. It stores only the configured
LibreChat server URL and standard Chromium session data on the local computer.
Older releases may have stored a random `computerId`; this version removes that
legacy value at startup.

## Limitations

External identity-provider redirects are blocked inside the application because
navigation is restricted to the configured LibreChat origin. External HTTPS
links open in the default browser. Deploy authentication on the same origin or
use LibreChat in a regular browser when a cross-origin sign-in flow is required.

## License

This project is licensed under the MIT License.

## Support

Report problems through the repository's issue tracker.
