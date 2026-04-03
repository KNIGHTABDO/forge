# Contributing to Forge

We'd love your help in making **Forge (Web + Desktop)** even more powerful.

## 🛠️ Local Environment Setup

### ⚙️ Forge Web App
The primary engine orchestrating Sandbox environments and Deep Research.

1. Navigate to the root directory.
2. Install standard Node dependencies: `npm install` (or `bun install`)
3. Initialize the config: Create `.env.local` with your standard API keys, such as `GEMINI_API_KEY`.
4. Spin up the server: `npm run dev`

### 🖥️ Forge Desktop App
The native Tauri desktop companion with authenticated key sync and local workspace tooling.

1. Navigate to `forge-desktop/`.
2. Install dependencies: `npm install`
3. Run the desktop renderer only: `npm run dev`
4. Run full desktop runtime: `npm run tauri:dev`
5. Build desktop artifacts locally: `npm run tauri:build:release`

## 🤝 Pull Request Process
1. Fork the repo and create your topic branch from `main`.
2. Ensure web app changes pass: `npm run build` at repo root.
3. Ensure desktop changes pass when relevant: `npm --prefix forge-desktop run build` and `npm --prefix forge-desktop run tauri:build`.
4. Submit your PR!

*(Note: Major architecture changes around the Web Orchestrator, desktop runtime bridge, or Deep Research agent should be discussed in a GitHub issue before implementing large refactors.)*

Thanks for contributing to the absolute edge of scalable SaaS Engineering!
