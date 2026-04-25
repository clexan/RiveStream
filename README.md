# RiveStream Desktop

RiveStream Desktop is a lightweight wrapper for the RiveStream web app, built with Tauri.

The app loads the RiveStream site inside a native desktop window and adds a small native shell around it. The goal is not to rebuild the website, but to provide a cleaner app like experience with desktop window behavior, navigation control, optional injected cleanup scripts, and native handling for external links or unwanted new-window popups

## Why Tauri?

Tauri was used instead of electron since it is lighter. Electron ships a full chromium browser and node runtime with every app, which makes even simple wrappers relatively fat.

Tauri uses OS native WebView instead. On Windows it uses WebView2, on macOS it uses WKWebView, and on Linux it uses WebKitGTK. This keeps the app smaller.

Electron would provide more control, including easy access to browser specific behavior and extension-like tooling. That can be useful for more "complex" apps.

For this project, that tradeoff is not worth it. RiveStream Desktop is primarily a focused web wrapper, so shipping an entire chromium runtime would add unnecessary size and overhead.

## Current goals

- Provide a simple desktop launcher for RiveStream.
- Keep the app lightweight.
- Block or externalize unwanted new windows (adware) where possible.
- Keep navigation constrained to the intended web app.
- Preserve a normal app-like fullscreen and desktop experience.

## Limitations

Any injected cleanup scripts are best-effort only and cannot fully replace network level browser ad blocking

## Development

Run in development mode:

```bash
cd src-tauri
cargo tauri dev
