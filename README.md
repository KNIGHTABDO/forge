# ⚒️ FORGE — The AI Micro-SaaS Engine

FORGE is a high-performance AI deployment engine that turns single-sentence ideas into fully functional, responsive, and persistent web applications. No code, no setup, no limits.

![Landing Page Header](public/screenshots/landing_page_hero_1774007612405.png)

---

## 🚀 The Forge V2 Revolution

Forge V2 represents a massive leap in autonomous app creation. We've moved beyond simple code snippets to a sophisticated **Multi-Agent Workflow** that plans, builds, and persists.

### 🧠 Architect & Builder Workflow
Every request starts in the **Architect Phase**. Our AI Planner creates a detailed Technical Blueprint covering architecture, state models, and UI strategy before a single line of code is written. Once approved, the **Builder Engine** executes the plan with surgical precision.

![Architect Planning](public/screenshots/build_page_planning_1774007691839.png)

### 💎 Premium Tailwind Generation
Forge tools aren't just functional — they are beautiful. The engine is mandated to use a **Mobile-First Tailwind CSS** strategy, ensuring glassmorphism effects, smooth animations, and perfect responsiveness on every device.

### ☁️ Forge BaaS (Backend-as-a-Service)
Stop building static demos. Forge tools come with built-in **Data Persistence**. Using `window.forge.db`, your generated apps can save and load data across sessions, effectively turning every "tool" into a real "app".

![Final Tool Result](public/screenshots/build_page_completed_tool_1774007722903.png)

---

## ✨ Core Features

- **Multi-Agent Intelligence** — Architect plans, Builder constructs.
- **High-Fidelity Inspector** — Point and click to edit any element in real-time.
- **Mobile-First Design** — Finger-friendly layouts and responsive ECharts included by default.
- **Zero-Config Deployment** — Ship your app to a public URL in one click.
- **Real Persistence** — Cloud-synced database storage (Forge BaaS).
- **Dark Mode / Light Mode** — Native support for premium aesthetics.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Core** | [Next.js 16](https://nextjs.org/) (App Router) |
| **Logic** | TypeScript + React 19 |
| **AI Engine** | Google Gemini (Multi-Agent Prompting) |
| **Styling** | Vanilla CSS (Internal) + Tailwind (Generated) |
| **Persistence** | GitHub JSON Database (Forge BaaS) |
| **UI Assets** | Lucide Icons · ECharts · Google Fonts |

---

## 🚦 Getting Started

### 1. Prerequisites
- Node.js 18+
- GitHub Personal Access Token (for storage)
- Google Gemini API Key

### 2. Quick Start
```bash
git clone https://github.com/KNIGHTABDO/forge.git
cd forge
npm install
cp .env.local.example .env.local  # Fill in your keys
npm run dev
```

Visit `http://localhost:3000` to start forging.

---

## 📂 Project Structure

- `app/build/` — The high-performance builder interface.
- `app/api/db/` — The Forge BaaS endpoint.
- `lib/system-prompt.ts` — The "Brain" containing the Architect and Builder mandates.
- `app/globals.css` — The premium design system tokens.

---

## 🤝 Contributing & Legal

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

- **License**: [MIT](LICENSE)
- **Legal**: [Terms of Service](app/terms/page.tsx) | [Privacy Policy](app/privacy/page.tsx)

---

© 2026 FORGE DIGITAL. Created by [KNIGHTABDO](https://github.com/KNIGHTABDO).
