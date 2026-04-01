import * as fs from 'fs';

const rootReadme = `# ⚒️ Forge — The React Micro-SaaS Engine & AI CLI

Forge is a high-performance AI deployment engine and a unified developer assistant that transforms single-sentence ideas into modular, persistent, and professional-grade applications. It seamlessly bridges a powerful Web Orchestrator with an elite Terminal CLI.

## 🌟 Two Ways to Build

1. **Forge Web App**: A browser-based AI orchestrator for rapid prototyping, featuring a unified conversation/implementation engine and dynamic Delta-Sync multi-file architecture to generate functional React apps instantly.
2. **Forge Code CLI**: A terminal-native AI pair programmer that lives in your local workspace. Completely rebranded and deeply integrated with modern models like Gemini 3.1 Flash Lite and GitHub Copilot.

## 🚀 The Forge Orchestration (Web)
Forge moves beyond simple code blocks to a sophisticated **Unified Orchestrator**. 
- Ask for advice → Get a concise, expert text response.
- Ask to build a feature → Receive precise, incremental file updates instantly.
- **Delta-Sync Strategy**: File-level edits, modular components, and state-based multi-page routing eliminate the friction of full-page reloads.

## 💻 Forge Code CLI (Terminal)
The ultimate terminal companion for AI-assisted coding. Check out the [\`forge-code\` directory](./forge-code/README.md) for detailed CLI documentation, npm installation, and usage.

## 🤝 Contributing
Please see [\`CONTRIBUTING.md\`](./CONTRIBUTING.md) for details on how to set up the local environment and contribute to the Forge ecosystem.
`;

const cliReadme = `# ⚒️ Forge Code

**Forge Code** is an elite, terminal-native AI coding assistant designed to bring the power of LLMs directly into your local workspace. Featuring a beautiful React Ink UI and universal model support, it works instantly with your existing codebase.

## 📦 Installation

Install globally via npm:
\`\`\`bash
npm install -g forge-code
\`\`\`

## 🚀 Quick Start

Run Forge Code anywhere in your terminal:
\`\`\`bash
forge-code
\`\`\`

It will evaluate your workspace context, load your configured model, and drop you into an interactive session.

## ⚙️ Model Providers

Forge Code employs a universal API shim and supports multiple top-tier models right out of the box:

- **Gemini**: Deep integration with \`gemini-3.1-flash-lite-preview\`. Just set your \`GEMINI_API_KEY\` and run \`forge-code dev:gemini\`.
- **GitHub Copilot**: Use your existing Copilot tokens for native enterprise-grade autocomplete. Run \`forge-code dev:github\`.
- **OpenAI / Anthropic / Ollama**: Fully supported via the robust internal routing system.

## 🛠️ Local Development

1. Clone the repository and navigate to \`forge-code\`.
2. Install dependencies: \`bun install\`
3. Build the CLI: \`bun run build\`
4. Run in dev mode: \`bun run dev:gemini\` (or \`dev:github\`)

## 🛡️ License
MIT License.
`;

const contributing = `# Contributing to Forge

We'd love your help in making Forge (Web & CLI) better! 

## 🛠️ Local Setup

### Web App
1. Navigate to the root directory.
2. Install dependencies: \`npm install\` (or \`bun install\`)
3. Set your environment variables (keys, DB URLs).
4. Run: \`npm run dev\`

### Forge Code CLI
1. Navigate to \`forge-code/\`.
2. Install dependencies: \`bun install\`
3. Our build system uses Bun to quickly compile the TypeScript AST: \`bun run build\`
4. Test your changes: \`bun run dev:gemini\`

## 📝 Pull Request Process
1. Fork the repo and create your branch from \`main\`.
2. Ensure you've run the local tests and \`/scripts/system-check.ts\` for the CLI.
3. Make sure all terminal UIs (React Ink) correctly compile and render.
4. Submit your PR with a clear description of the problem your code solves.

Thanks for contributing to the Forge ecosystem!
`;

fs.writeFileSync('C:/Users/hiba/Desktop/forge/README.md', rootReadme);
fs.writeFileSync('C:/Users/hiba/Desktop/forge/forge-code/README.md', cliReadme);
fs.writeFileSync('C:/Users/hiba/Desktop/forge/CONTRIBUTING.md', contributing);
console.log('✅ Remade all markdown files');
