# FORGE — Build Apps With One Sentence

FORGE is an AI-powered web application builder. Describe your idea in plain English and get a fully working interactive web app instantly — no code required.

---

## What Is FORGE?

FORGE turns a single sentence into a deployed, shareable web application in seconds. Built on top of state-of-the-art AI, FORGE handles everything from code generation to deployment so you can focus entirely on your idea.

**Live:** [forge.app](https://forge.app) · **Twitter:** [@jip7e](https://twitter.com/jip7e)

---

## Features

- **One-sentence generation** — Describe what you want in plain English. FORGE generates a complete, interactive web app.
- **Instant preview** — See your app running live as soon as it's generated.
- **Iterative building** — Refine your app with follow-up prompts. Inspect and edit individual elements.
- **One-click deploy** — Ship your app with a unique public URL instantly.
- **Public gallery** — Browse apps built by the FORGE community.
- **No account required** — Start building immediately with no sign-up.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| UI | React 19 + TypeScript |
| Styling | Hand-written CSS (no Tailwind) |
| Fonts | Space Grotesk · Manrope · JetBrains Mono (via `next/font`) |
| AI | OpenAI / Anthropic API (server-side) |
| Storage | GitHub (app gallery via GitHub API) |
| Hosting | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A package manager (`npm`, `yarn`, or `pnpm`)

### Installation

```bash
# Clone the repository
git clone https://github.com/KNIGHTABDO/forge.git
cd forge

# Install dependencies
npm install
```

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in the required values:

```bash
cp .env.local.example .env.local
```

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Your OpenAI API key for app generation |
| `GITHUB_TOKEN` | GitHub personal access token for gallery storage |
| `GITHUB_REPO` | GitHub repo used for storing deployed apps (e.g. `username/forge-apps`) |
| `ADMIN_SECRET` | Secret key for accessing the admin dashboard |

### Development

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the app.

### Build

```bash
npm run build
npm start
```

---

## Project Structure

```
forge/
├── app/
│   ├── page.tsx          # Landing page
│   ├── layout.tsx        # Root layout (fonts, metadata)
│   ├── globals.css       # Global styles (build/tool pages)
│   ├── home.css          # Landing page styles (warm cream editorial)
│   ├── legal.css         # Shared styles for privacy/terms/contact pages
│   ├── privacy/          # Privacy Policy page
│   │   └── page.tsx
│   ├── terms/            # Terms of Service page
│   │   └── page.tsx
│   ├── contact/          # Contact page
│   │   └── page.tsx
│   ├── build/            # App builder interface
│   │   └── page.tsx
│   ├── tool/[slug]/      # Deployed app viewer
│   │   ├── page.tsx
│   │   └── tool.css
│   ├── admin/            # Admin dashboard
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   └── admin.css
│   ├── api/
│   │   ├── generate/     # POST — generate app from prompt
│   │   ├── deploy/       # POST — deploy app to GitHub
│   │   ├── gallery/      # GET  — fetch gallery apps
│   │   ├── preview/[slug]/ # GET — serve app HTML for iframe
│   │   ├── session/      # GET/POST — session management
│   │   ├── tool/[slug]/  # GET — fetch tool details
│   │   └── admin/        # Admin API routes
│   └── t/[slug]/         # Short URL redirect for deployed apps
├── components/
│   ├── ForgeBar.tsx       # Top toolbar in the builder
│   └── PreviewFrame.tsx   # Iframe wrapper for app preview
├── lib/
│   └── github.ts         # GitHub API helpers for gallery storage
└── public/
    └── logo.png
```

---

## How It Works

```
User types a prompt
       ↓
POST /api/generate
  → Sends prompt to AI model
  → Returns complete HTML/CSS/JS app as a single file
       ↓
User previews the app in an iframe
  → Can iterate with follow-up prompts
  → Can inspect and click-to-edit elements
       ↓
User clicks Deploy
POST /api/deploy
  → Commits the HTML file to a GitHub repository
  → Returns a unique shareable URL: /t/{slug}
       ↓
App is live at forge.app/t/{slug}
  → Appears in the public gallery
```

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with hero, how-it-works, gallery |
| `/build` | The app builder interface |
| `/tool/[slug]` | View a deployed app with its details |
| `/t/[slug]` | Short URL — serves the raw HTML app |
| `/privacy` | Privacy Policy |
| `/terms` | Terms of Service |
| `/contact` | Contact page |
| `/admin` | Admin dashboard (protected) |

---

## Design System

FORGE uses a custom hand-written CSS design system with two visual modes:

**Landing page** (`home.css`): Warm cream editorial aesthetic
- Background: `#fffcf7`
- Text: `#1a1a1a`
- Accents: Subtle borders `#e5e0d5`
- Fonts: Space Grotesk (headlines) + Manrope (body)

**Builder & tools** (`globals.css`): Dark minimal aesthetic
- Background: `#000000`
- Text: `#ffffff`
- Accents: Monochrome grays

---

## Contributing

FORGE is currently in early development. Contributions, bug reports, and feature suggestions are welcome via [Twitter @jip7e](https://twitter.com/jip7e).

---

## Legal

- [Privacy Policy](https://forge.app/privacy)
- [Terms of Service](https://forge.app/terms)
- [Contact](https://forge.app/contact)

---

## License

© 2026 FORGE DIGITAL. All rights reserved.
