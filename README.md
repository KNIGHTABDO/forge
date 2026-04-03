<div align="center">
  <h1>⚒️ FORGE</h1>
  <p><b>The React Micro-SaaS Engine & Ecosystem</b></p>
  <p><i>Zero boilerplate. No modes. Just pure, instant building.</i></p>
</div>

---

**FORGE** is a high-performance AI deployment engine that transforms single-sentence ideas into modular, persistent, and professional-grade React applications. Moving beyond simple code blocks, Forge now bridges a powerful **Web Orchestrator** with a polished **Forge Desktop App**, giving you an end-to-end local-first engineering workflow.

## 🌟 The Forge Ecosystem

1. **[Forge Web App](#-the-forge-v3-orchestration-web)**: A browser-based AI orchestrator powered by Next.js and Sandpack, featuring a unified conversation/implementation engine and dynamic Delta-Sync multi-file architecture to generate functional React apps instantly.
2. **[Forge Desktop](./forge-desktop/README.md)**: A native Tauri desktop app with authenticated sync, model controls, request diagnostics, and workspace-native agent workflows.

---

## 🚀 The Forge V3 Orchestration (Web)

Forge V3 features a sophisticated **Unified Orchestrator**. We've eliminated the friction of traditional "Modes" in favor of a smooth, conversational development experience that feels like pair-programming with an elite engineer.

### 🧠 Intelligent Context Awareness
The Orchestrator natively understands the difference between **Conversation** and **Implementation**.
- Ask for advice or brainstorm ideas → Get a concise, expert text response.
- Ask to build a feature or fix a bug → Receive precise, incremental file updates instantly.

### ⚛️ Incremental Multi-File Architecture
Forget re-generating the entire app for every small change. Forge uses an advanced **Delta-Sync** strategy:
- **Modular Components** — Apps are strictly built as collections of functional components.
- **File-Level Edits** — The AI only outputs files that actually changed, drastically reducing latency and layout-shift.
- **State-Based Multi-Page Routing** — Build complex, multi-view applications using native React state routing, ensuring lightning-fast transitions.

### 📦 Sandpack V3 Engine
All Forge-built apps live in a professional development sandbox powered by `@codesandbox/sandpack`.
- **Dynamic Tailwind Injection** — All components get instant, premium styling via an automated CDN bridge.
- **Hot Reloading** — See your UI evolve in real-time as the AI streams the AST.
- **Production-Ready CRA Environment** — Uses standard React patterns for seamless handoff to your local env.

### 🔄 Persistent Developer Sessions
Your primary work is automatically synchronized to GitHub as a **Developer Session**.
- **Auto-Restore** — Refreshing the page? Forge recovers your full chat history and file tree instantly.
- **Shareable Draft URLs** — Every session gets a unique path (`?session=sess_xyz`) for easy collaboration.

---

## 🔎 Deep Research Agent (Beta)

Deep Research is a **fully standalone capability** available at `/research/[id]`. It is intentionally separate from `/build` and the one-sentence app creation workflow.

- **Long-Form Depth** — Iterative research that scales across hundreds of sources.
- **Conversational Operation** — Full-screen chat flow with a docked composer, live thinking blocks, and smooth streaming.
- **Source Transparency** — Website-by-website analysis state, rolling "learned so far" blocks, and inline live stats.
- **Citable Outputs** — Final reports include inline citation markers, a clickable source appendix, and export options.

---

## 🖥️ Forge Desktop App

**Forge Desktop** is the local-first extension of the Forge protocol. Built with Tauri + React, it brings Forge intelligence to a native desktop workspace with account-aware sync and release-grade UX.

- **Desktop-native workflow**: Session timelines, model execution controls, and tool-call transparency.
- **Secure auth + key sync**: Browser login callback to `/desktop`, cloud key hydration, and device governance.
- **Release pipeline ready**: Push to `main` can publish packaged desktop installers through GitHub Actions.

👉 **[Read the full Forge Desktop setup and documentation here.](./forge-desktop/README.md)**

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Core Framework** | [Next.js App Router](https://nextjs.org/) |
| **Logic & Types** | TypeScript + React 19 + [Sandpack](https://sandpack.codesandbox.io/) |
| **AI Intelligence** | Gemini 3.1 Flash Lite / GitHub Copilot |
| **Styling Engine** | Vanilla CSS + Dynamic Tailwind CDN |
| **Persistence** | GitHub JSON Database & Session API |
| **Desktop Runtime** | Tauri v2 + React + Rust command bridge |

---

## 🚦 Getting Started (Web App)

1. **Clone & Install**
```bash
git clone https://github.com/KNIGHTABDO/forge.git
cd forge
npm install
```

2. **Configure Environment**
Create `.env.local` using the keys required:
```env
GEMINI_API_KEY=your_gemini_key
GITHUB_TOKEN=your_github_token
```

3. **Launch the Engine**
```bash
npm run dev
```

Visit `localhost:3000` to start building. Every project you generate is automatically saved to your unique session endpoint.

---

## 📂 Repository Structure

- `app/build/` — The unified conversational builder interface.
- `app/research/[id]/` — Standalone Deep Research Agent (Beta).
- `app/api/` — Background auto-save, state recovery APIs, and generation routes.
- `forge-desktop/` — Native Forge Desktop application source code and packaging config.
- `lib/system-prompt.ts` — The "Brain" containing the V3 Orchestration rules.
- `components/` — Web app React components handling streaming ASTs and styling.

---

<div align="center">
  <p>© 2026 FORGE DIGITAL. Created by <a href="https://github.com/KNIGHTABDO">KNIGHTABDO</a>.</p>
</div>
