# Contributing to Forge

We'd love your help in making **Forge (Web & CLI)** even more powerful! 

## 🛠️ Local Environment Setup

### ⚙️ Forge Web App
The primary engine orchestrating Sandbox environments and Deep Research.

1. Navigate to the root directory.
2. Install standard Node dependencies: `npm install` (or `bun install`)
3. Initialize the config: Create `.env.local` with your standard API keys, such as `GEMINI_API_KEY`.
4. Spin up the server: `npm run dev`

### 💻 Forge Code CLI
The advanced React-Ink terminal agent natively bridged into your shell.

1. Navigate to `forge-code/`.
2. Install ultra-fast Bun dependencies: `bun install`
3. Build the CLI via our TypeScript AST stripper toolchain: `bun run build`
4. Run locally to test file modifications: `bun run dev:gemini` (or `dev:github`)

## 🤝 Pull Request Process
1. Fork the repo and create your topic branch from `main`.
2. Ensure you've run the local tests and checked `/scripts/system-check.ts` for the CLI functionality.
3. Validate that the UI (React Ink) correctly complies and renders without terminal artifacting.
4. Submit your PR!

*(Note: Major architecture changes around the Web Orchestrator or Deep Research agent should be discussed in a GitHub tracking issue prior to implementing large AST changes.)*

Thanks for contributing to the absolute edge of scalable SaaS Engineering!
