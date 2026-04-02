# Forge Desktop

Windows-first native Forge app scaffold built with Tauri + React.

## What is included

- Tauri v2 Rust shell
- React + Vite renderer
- Forge-aligned design tokens and animated welcome/login shell
- Typed command bridge (`bootstrap`) for native runtime data
- Native auth callback listener (`begin_auth_flow`) for desktop login handoff
- Local desktop token persistence commands (`save_session_token`, `load_session_token`)

## Local development

1. Install dependencies:

```bash
npm install
```

2. Run frontend only:

```bash
npm run dev
```

3. Run full desktop app:

```bash
npm run tauri:dev
```

Optional environment variable:

- `VITE_FORGE_WEB_BASE_URL` (preferred explicit override)
- `NEXT_PUBLIC_BASE_URL` (loaded from root env via Vite envDir)

If neither is set, desktop falls back to `https://forge-app-peach.vercel.app`.

## Build

```bash
npm run tauri:build
```

## Next implementation targets

- Move from in-memory key hydration to shared runtime/service injection for tool execution
- Add encrypted token storage and refresh handling
- Add richer desktop telemetry signals and reconnect backoff behavior
