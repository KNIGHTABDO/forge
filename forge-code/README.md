<div align="center">
  <h1>⚒️ Forge Code CLI</h1>
  <p><b>The Terminal-Native AI Engineering System</b></p>
  <p><i>Bring the power of Forge directly into your codebase.</i></p>
</div>

---

**Forge Code** is an elite, terminal-native AI coding assistant designed to bring the power of LLMs directly into your local workspace. Featuring a beautiful **React Ink UI** and universal model support, it acts as an ultra-fast agentic pair programmer.

## ✨ Why Forge Code?

- ⚡️ **Zero Latency Workflow** — Modify your actual local files instantly without copy-pasting.
- 🧠 **Universal Native API** — Built specifically to leverage **Gemini 3.1 Flash Lite** and **GitHub Copilot** as top-tier models alongside Anthropic/OpenAI equivalents via a unified shim.
- 🎨 **Premium Terminal UX** — Forget blocky text lines. Forge Code is built with absolute fidelity, featuring syntax highlighting, structured layouts, and fluid loading states.
- 📂 **Workspace-Aware** — Give it an instruction, and it will autonomously read your directories, figure out where to insert a React component, or rewrite a `tsconfig.json` without breaking sweat.

---

## 📦 Installation & Setup

1. **Install Globally (Required)**
   *You must include the `-g` flag so that the `forge-code` command is added to your system PATH and can be run from any folder.*
   ```bash
   npm install -g forge-ai-coder
   ```

2. **Launch with Gemini**
   Ensure an environment variable (`GEMINI_API_KEY`) is available, then simply run:
   ```bash
   forge-code dev:gemini
   ```

3. **Launch with GitHub Copilot**
   Harness your enterprise GitHub Copilot endpoints securely:
   ```bash
   forge-code dev:github
   ```

---

## 🛠️ Local Development & Ecosystem

If you want to contribute or build atop the Forge Code CLI, we use [Bun](https://bun.sh) to orchestrate lighting-fast builds and AST strips for our TypeScript core.

1. **Clone the Forge ecosystem**
   ```bash
   cd forge-code
   bun install
   ```
2. **Compile the runtime**
   ```bash
   bun run build
   ```
3. **Execute locally**
   ```bash
   bun run dev:gemini
   ```

Check out our [System Diagnostic Tool](./scripts/system-check.ts) optionally to test environment capacities before deploying to NPM.

---

<div align="center">
  <p>© 2026 FORGE DIGITAL.</p>
</div>
