# 🔥 FORGE — PREMIUM DARK UI REDESIGN AGENT PROMPT
## GitHub Copilot Agent Session · Full-Project UI Overhaul

---

> **CRITICAL INSTRUCTION — READ FIRST, CODE NEVER:**
> You are a **Senior UI/UX Engineer** at a top-tier product company (think Linear, Vercel, Stripe, Arc).
> Your job is a FULL, PRODUCTION-QUALITY dark UI redesign of this project.
> **You will NOT touch a single line of code until you have read and catalogued EVERY page, component, route, and UI element in this entire codebase.**
> Skipping the audit phase is grounds for rejection. Every pixel matters. Every word matters.

---

## PHASE 0 — MANDATORY FULL PROJECT AUDIT (DO THIS BEFORE ANYTHING ELSE)

Before writing a single line of CSS, JS, or template code, you must do the following:

1. **Read the root directory tree** — understand the project's framework (Next.js / React / Vue / plain HTML — confirm it).
2. **Open and fully read EVERY route/page file** — note layout, components used, interactive elements, forms, lists, navigation.
3. **Open and fully read EVERY component/partial** — navbar, sidebar, cards, modals, buttons, inputs, badges, tables, etc.
4. **Open and fully read the current CSS/styling files** — understand what's already there, what tokens exist, what the existing color palette is.
5. **Open `package.json`** — note current dependencies (animation libs, icon sets, component libs, etc.).
6. **Map out a full inventory list:**
   - All pages/routes
   - All reusable components
   - All interactive states (hover, active, focus, loading, empty, error)
   - All breakpoints currently in use

Only after completing this audit should you proceed to Phase 1.

**Document your findings** as a short summary comment at the top of your first code change explaining what you found.

---

## PHASE 1 — DESIGN SYSTEM FOUNDATION

### 1.1 Color Palette

Implement this exact palette as CSS custom properties (or Tailwind config, if applicable):

```css
:root {
  /* === BASE BACKGROUNDS === */
  --bg-void:        #0A0A0C;   /* True base — deepest layer */
  --bg-base:        #0D0D10;   /* Page background */
  --bg-surface:     #131318;   /* Cards, panels */
  --bg-elevated:    #1A1A22;   /* Modals, dropdowns, popovers */
  --bg-overlay:     #21212D;   /* Hover states, active items */
  --bg-highlight:   #282836;   /* Selected items */

  /* === GRAIN TEXTURE LAYER === */
  /* Applied via SVG noise filter or CSS pseudo-element — see §1.3 */

  /* === BORDERS === */
  --border-subtle:  rgba(255,255,255,0.05);
  --border-default: rgba(255,255,255,0.09);
  --border-strong:  rgba(255,255,255,0.15);
  --border-glow:    rgba(108,92,231,0.35);

  /* === ACCENT COLORS (the "dark jewel" palette) === */
  --accent-primary:    #6C5CE7;  /* Cosmic purple */
  --accent-primary-hv: #7D6FF0;  /* Hover */
  --accent-primary-glow: rgba(108,92,231,0.25);
  --accent-secondary:  #00B4D8;  /* Ice teal */
  --accent-tertiary:   #E94560;  /* Ember red */
  --accent-amber:      #E8A838;  /* Molten amber */
  --accent-emerald:    #00CDA8;  /* Deep mint */

  /* === TEXT === */
  --text-primary:   #F0EFFF;   /* Near-white with warmth */
  --text-secondary: #9896B8;   /* Muted mid */
  --text-tertiary:  #5C5A7A;   /* Hints, placeholders */
  --text-inverse:   #0D0D10;

  /* === SEMANTIC === */
  --success:    #00CDA8;
  --success-bg: rgba(0,205,168,0.08);
  --warning:    #E8A838;
  --warning-bg: rgba(232,168,56,0.08);
  --error:      #E94560;
  --error-bg:   rgba(233,69,96,0.08);
  --info:       #00B4D8;
  --info-bg:    rgba(0,180,216,0.08);

  /* === GRADIENTS === */
  --gradient-primary: linear-gradient(135deg, #6C5CE7 0%, #00B4D8 100%);
  --gradient-surface: linear-gradient(145deg, #131318 0%, #0D0D10 100%);
  --gradient-shine:   linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 60%);
  --gradient-ember:   linear-gradient(135deg, #E94560 0%, #E8A838 100%);

  /* === GLOW SHADOWS === */
  --shadow-sm:      0 1px 2px rgba(0,0,0,0.6);
  --shadow-md:      0 4px 16px rgba(0,0,0,0.5);
  --shadow-lg:      0 12px 40px rgba(0,0,0,0.6);
  --shadow-glow:    0 0 20px rgba(108,92,231,0.2), 0 4px 16px rgba(0,0,0,0.5);
  --shadow-glow-teal: 0 0 20px rgba(0,180,216,0.2), 0 4px 16px rgba(0,0,0,0.5);

  /* === SPACING & RADIUS === */
  --radius-xs:  4px;
  --radius-sm:  6px;
  --radius-md:  10px;
  --radius-lg:  14px;
  --radius-xl:  20px;
  --radius-2xl: 28px;
  --radius-full: 9999px;

  /* === TYPOGRAPHY === */
  --font-sans: 'Inter', 'SF Pro Display', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* === TRANSITIONS === */
  --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-out:    cubic-bezier(0.0, 0.0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0.0, 0.6, 1);
  --duration-fast:   120ms;
  --duration-base:   220ms;
  --duration-slow:   380ms;
  --duration-xslow:  600ms;
}
```

### 1.2 Typography Scale

```css
/* Font imports — add to <head> */
/* Inter: https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap */

.text-2xs  { font-size: 0.625rem;  line-height: 1rem; }     /* 10px */
.text-xs   { font-size: 0.75rem;   line-height: 1rem; }     /* 12px */
.text-sm   { font-size: 0.875rem;  line-height: 1.25rem; }  /* 14px */
.text-base { font-size: 1rem;      line-height: 1.5rem; }   /* 16px */
.text-lg   { font-size: 1.125rem;  line-height: 1.75rem; }  /* 18px */
.text-xl   { font-size: 1.25rem;   line-height: 1.75rem; }  /* 20px */
.text-2xl  { font-size: 1.5rem;    line-height: 2rem; }     /* 24px */
.text-3xl  { font-size: 1.875rem;  line-height: 2.25rem; }  /* 30px */
.text-4xl  { font-size: 2.25rem;   line-height: 2.5rem; }   /* 36px */
.text-5xl  { font-size: 3rem;      line-height: 1; }        /* 48px */
.text-6xl  { font-size: 3.75rem;   line-height: 1; }        /* 60px */

/* Letter spacing */
.tracking-tight  { letter-spacing: -0.025em; }
.tracking-normal { letter-spacing: 0; }
.tracking-wide   { letter-spacing: 0.05em; }
.tracking-widest { letter-spacing: 0.15em; }
```

### 1.3 Grain / Noise Texture Layer

**This is the signature effect.** Apply a subtle film grain to every surface to make dark colors feel warm, material, and alive — not flat digital black.

```css
/* Add this SVG filter to your root layout */
/* Place this SVG inline in the body, invisible, just for the filter definition */

/* Global grain overlay — goes on body::before or a fixed overlay div */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 9999;
  opacity: 0.035;  /* Subtle — adjust between 0.025–0.05 to taste */
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 128px 128px;
}
```

**Additionally, add a per-card grain variation** to create depth between surfaces:
```css
.card, .panel, .modal {
  position: relative;
  overflow: hidden;
}
.card::after, .panel::after, .modal::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.025;
  background-image: url("data:image/svg+xml,..."); /* same noise SVG */
  border-radius: inherit;
}
```

### 1.4 Glass / Frosted Surfaces (Used Sparingly)

```css
.glass {
  background: rgba(19, 19, 24, 0.7);
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  border: 1px solid var(--border-default);
}

.glass-elevated {
  background: rgba(26, 26, 34, 0.8);
  backdrop-filter: blur(24px) saturate(160%);
  border: 1px solid var(--border-strong);
}
```

---

## PHASE 2 — COMPONENT SYSTEM (Redesign ALL Components)

For **every single component** you find in the codebase, apply the following. Do not skip any component no matter how small.

### 2.1 Buttons

```css
/* Base button */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  border-radius: var(--radius-md);
  padding: 8px 16px;
  border: 1px solid transparent;
  cursor: pointer;
  transition:
    background var(--duration-base) var(--ease-smooth),
    border-color var(--duration-base) var(--ease-smooth),
    box-shadow var(--duration-base) var(--ease-smooth),
    transform var(--duration-fast) var(--ease-spring);
  position: relative;
  overflow: hidden;
  user-select: none;
}

/* Shimmer shine effect on all buttons */
.btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--gradient-shine);
  opacity: 0;
  transition: opacity var(--duration-base) var(--ease-smooth);
  border-radius: inherit;
}
.btn:hover::before { opacity: 1; }
.btn:active { transform: scale(0.97); }

/* Primary */
.btn-primary {
  background: var(--accent-primary);
  color: #fff;
  box-shadow: var(--shadow-glow);
}
.btn-primary:hover {
  background: var(--accent-primary-hv);
  box-shadow: 0 0 28px rgba(108,92,231,0.35), var(--shadow-md);
}

/* Secondary */
.btn-secondary {
  background: var(--bg-elevated);
  color: var(--text-primary);
  border-color: var(--border-default);
}
.btn-secondary:hover {
  background: var(--bg-overlay);
  border-color: var(--border-strong);
}

/* Ghost */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border-color: transparent;
}
.btn-ghost:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

/* Danger */
.btn-danger {
  background: var(--error-bg);
  color: var(--error);
  border-color: rgba(233,69,96,0.2);
}
.btn-danger:hover {
  background: var(--error);
  color: #fff;
  box-shadow: 0 0 20px rgba(233,69,96,0.3);
}

/* Sizes */
.btn-sm { padding: 5px 10px; font-size: 0.75rem; border-radius: var(--radius-sm); }
.btn-lg { padding: 12px 24px; font-size: 1rem; border-radius: var(--radius-lg); }
.btn-xl { padding: 14px 32px; font-size: 1.0625rem; border-radius: var(--radius-xl); }

/* Icon-only button */
.btn-icon {
  padding: 8px;
  aspect-ratio: 1;
  justify-content: center;
}

/* Loading state */
.btn[data-loading] {
  pointer-events: none;
  opacity: 0.7;
}
.btn[data-loading]::after {
  content: '';
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
```

### 2.2 Cards

```css
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: 20px;
  position: relative;
  overflow: hidden;
  transition:
    border-color var(--duration-base) var(--ease-smooth),
    box-shadow var(--duration-base) var(--ease-smooth),
    transform var(--duration-slow) var(--ease-smooth);
}

/* Top edge glow line */
.card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(108,92,231,0.4), transparent);
  opacity: 0;
  transition: opacity var(--duration-slow) var(--ease-smooth);
}

.card:hover {
  border-color: var(--border-glow);
  box-shadow: var(--shadow-glow);
  transform: translateY(-2px);
}
.card:hover::before { opacity: 1; }

/* Card variants */
.card-elevated {
  background: var(--bg-elevated);
  border-color: var(--border-default);
}
.card-ghost {
  background: transparent;
  border-color: var(--border-subtle);
}

/* Interactive card (clickable) */
.card-interactive {
  cursor: pointer;
}
.card-interactive:active {
  transform: translateY(0) scale(0.99);
}
```

### 2.3 Inputs & Form Elements

```css
.input {
  width: 100%;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  font-size: 0.875rem;
  color: var(--text-primary);
  transition:
    border-color var(--duration-base) var(--ease-smooth),
    box-shadow var(--duration-base) var(--ease-smooth),
    background var(--duration-base) var(--ease-smooth);
  outline: none;
}
.input::placeholder { color: var(--text-tertiary); }
.input:hover { border-color: var(--border-strong); }
.input:focus {
  border-color: var(--accent-primary);
  background: var(--bg-overlay);
  box-shadow: 0 0 0 3px var(--accent-primary-glow);
}
.input:focus::placeholder { color: var(--text-tertiary); opacity: 0.5; }

/* Input with icon */
.input-group {
  position: relative;
}
.input-group .input-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
  pointer-events: none;
}
.input-group .input { padding-left: 36px; }

/* Select */
select.input {
  appearance: none;
  background-image: url("data:image/svg+xml,..."); /* custom chevron */
  background-repeat: no-repeat;
  background-position: right 12px center;
}

/* Textarea */
textarea.input {
  resize: vertical;
  min-height: 100px;
  line-height: 1.6;
}

/* Checkbox / Radio — custom styled */
input[type="checkbox"], input[type="radio"] {
  appearance: none;
  width: 16px; height: 16px;
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  background: var(--bg-elevated);
  cursor: pointer;
  position: relative;
  transition: all var(--duration-base) var(--ease-smooth);
}
input[type="radio"] { border-radius: 50%; }
input[type="checkbox"]:checked, input[type="radio"]:checked {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  box-shadow: 0 0 8px var(--accent-primary-glow);
}
input[type="checkbox"]:checked::after {
  content: '';
  position: absolute;
  top: 2px; left: 5px;
  width: 4px; height: 8px;
  border: 1.5px solid white;
  border-top: none; border-left: none;
  transform: rotate(45deg);
}
```

### 2.4 Navigation / Navbar

```css
.navbar {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 100;
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 24px;
  background: rgba(10, 10, 12, 0.75);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid var(--border-subtle);
  transition: box-shadow var(--duration-base) var(--ease-smooth);
}
/* Scrolled state — add via JS when page scrolled > 20px */
.navbar.scrolled {
  box-shadow: 0 2px 30px rgba(0,0,0,0.4);
  border-bottom-color: var(--border-default);
}

/* Nav links */
.nav-link {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-tertiary);
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  transition: color var(--duration-base) var(--ease-smooth), background var(--duration-base) var(--ease-smooth);
  text-decoration: none;
  letter-spacing: 0.01em;
}
.nav-link:hover { color: var(--text-primary); background: var(--bg-elevated); }
.nav-link.active {
  color: var(--text-primary);
  background: var(--bg-overlay);
  position: relative;
}
/* Active indicator dot */
.nav-link.active::after {
  content: '';
  position: absolute;
  bottom: -1px; left: 50%;
  transform: translateX(-50%);
  width: 4px; height: 4px;
  border-radius: 50%;
  background: var(--accent-primary);
}
```

### 2.5 Sidebar (if applicable)

```css
.sidebar {
  width: 240px;
  min-height: 100vh;
  background: var(--bg-surface);
  border-right: 1px solid var(--border-subtle);
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: fixed;
  left: 0; top: 60px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--bg-overlay) transparent;
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-tertiary);
  cursor: pointer;
  transition:
    color var(--duration-base) var(--ease-smooth),
    background var(--duration-base) var(--ease-smooth),
    padding-left var(--duration-base) var(--ease-smooth);
  text-decoration: none;
  white-space: nowrap;
}
.sidebar-item:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
  padding-left: 16px;
}
.sidebar-item.active {
  color: var(--text-primary);
  background: linear-gradient(90deg, rgba(108,92,231,0.15), rgba(108,92,231,0.05));
  border-left: 2px solid var(--accent-primary);
}
```

### 2.6 Badges & Tags

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.badge-primary { background: rgba(108,92,231,0.15); color: #A89FF5; border: 1px solid rgba(108,92,231,0.25); }
.badge-success { background: var(--success-bg); color: var(--success); border: 1px solid rgba(0,205,168,0.2); }
.badge-warning { background: var(--warning-bg); color: var(--warning); border: 1px solid rgba(232,168,56,0.2); }
.badge-error   { background: var(--error-bg);   color: var(--error);   border: 1px solid rgba(233,69,96,0.2); }
.badge-info    { background: var(--info-bg);     color: var(--info);    border: 1px solid rgba(0,180,216,0.2); }

/* Pulse dot for live/active states */
.badge-live::before {
  content: '';
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--success);
  animation: pulse-dot 1.8s ease-in-out infinite;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.7); }
}
```

### 2.7 Tables

```css
.table-wrapper {
  overflow-x: auto;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
thead th {
  padding: 12px 16px;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
  white-space: nowrap;
}
tbody td {
  padding: 14px 16px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-subtle);
  transition: color var(--duration-fast) var(--ease-smooth);
}
tbody tr:last-child td { border-bottom: none; }
tbody tr {
  transition: background var(--duration-fast) var(--ease-smooth);
}
tbody tr:hover td {
  background: var(--bg-elevated);
  color: var(--text-primary);
}
```

### 2.8 Modals / Dialogs

```css
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(4px);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: fade-in var(--duration-base) var(--ease-out);
}
.modal {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-2xl);
  padding: 28px;
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg), 0 0 60px rgba(108,92,231,0.1);
  animation: modal-in var(--duration-slow) var(--ease-spring);
  position: relative;
}
/* Top glow edge */
.modal::before {
  content: '';
  position: absolute;
  top: 0; left: 10%; right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent-primary), transparent);
}
@keyframes modal-in {
  from { opacity: 0; transform: translateY(20px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

### 2.9 Tooltips

```css
[data-tooltip] {
  position: relative;
}
[data-tooltip]::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  background: var(--bg-highlight);
  color: var(--text-primary);
  font-size: 0.75rem;
  font-weight: 500;
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-strong);
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--duration-base) var(--ease-smooth), transform var(--duration-base) var(--ease-smooth);
  z-index: 50;
  box-shadow: var(--shadow-md);
}
[data-tooltip]:hover::after {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
```

### 2.10 Loading States / Skeletons

```css
@keyframes shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
.skeleton {
  background: linear-gradient(
    90deg,
    var(--bg-elevated) 25%,
    var(--bg-overlay)  50%,
    var(--bg-elevated) 75%
  );
  background-size: 800px 100%;
  animation: shimmer 1.8s ease-in-out infinite;
  border-radius: var(--radius-sm);
}
.skeleton-text  { height: 14px; margin-bottom: 8px; }
.skeleton-title { height: 20px; width: 60%; margin-bottom: 16px; }
.skeleton-card  { height: 120px; border-radius: var(--radius-xl); }
```

### 2.11 Progress / Stats Bars

```css
.progress-bar-track {
  height: 4px;
  background: var(--bg-overlay);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.progress-bar-fill {
  height: 100%;
  background: var(--gradient-primary);
  border-radius: var(--radius-full);
  transition: width var(--duration-xslow) var(--ease-out);
  position: relative;
}
/* Animated shimmer on progress fill */
.progress-bar-fill::after {
  content: '';
  position: absolute;
  top: 0; right: 0; bottom: 0;
  width: 40px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  animation: progress-shimmer 1.5s ease-in-out infinite;
}
@keyframes progress-shimmer {
  from { transform: translateX(-40px); }
  to   { transform: translateX(40px); }
}
```

---

## PHASE 3 — PAGE-BY-PAGE REDESIGN

For **every single page you catalogued in Phase 0**, apply the redesign fully. Here is what every page must receive:

### 3.1 Page Layout Rules

- **Body**: `background: var(--bg-base)`, font: Inter, color: `var(--text-primary)`, `antialiased` rendering.
- **Page padding**: `padding-top: 60px` to account for fixed navbar.
- **Content max-width**: `max-width: 1280px; margin: 0 auto; padding: 0 24px;`
- **Section spacing**: `padding: 48px 0` between major sections.
- **Sidebar layouts**: sidebar fixed + main content has `margin-left: 240px`.

### 3.2 Hero Sections / Landing Areas

Every prominent page header / hero must include:
- A large heading (text-5xl or text-4xl, `font-weight: 700`, `letter-spacing: -0.02em`, `color: var(--text-primary)`)
- A subtle **gradient text span** on the key word: `background: var(--gradient-primary); -webkit-background-clip: text; -webkit-text-fill-color: transparent;`
- A muted subheading in `var(--text-secondary)`, `text-lg`, `font-weight: 400`
- A **glowing ambient orb** behind the hero (CSS radial gradient blur blob, `position: absolute`, `z-index: -1`, `pointer-events: none`, `filter: blur(80px)`, `opacity: 0.15–0.25`, using `var(--accent-primary)`)
- Entry animations (see Phase 4)

### 3.3 Grid & Card Layouts

All card grids must:
- Use CSS Grid with `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;`
- Each card: apply `.card` styles from §2.2
- Stats/numbers: large, bold, gradient text (`text-3xl`, `font-weight: 700`)
- Support responsive collapse to single column at `< 640px`

### 3.4 Data / List Views

Every list or data display must:
- Use the table styles from §2.7 OR a card list with hover effects
- Empty state: centered illustration + heading + body + CTA button, all styled
- Loading state: skeleton rows (§2.10)
- Error state: red-tinted card with `var(--error)` accented heading

---

## PHASE 4 — PREMIUM ANIMATIONS

**These are not optional.** Every page must have smooth, purposeful motion.

### 4.1 Scroll-Triggered Reveal Animations

Add these via **Intersection Observer API** (no library needed for this):

```javascript
// Add this to your main JS file
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('animate-in');
      observer.unobserve(entry.target); // Fire once only
    }
  });
}, {
  threshold: 0.1,
  rootMargin: '0px 0px -40px 0px'
});

document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));
```

```css
/* Base state — invisible, slightly below */
[data-animate] {
  opacity: 0;
  transform: translateY(20px);
  transition:
    opacity var(--duration-slow) var(--ease-out),
    transform var(--duration-slow) var(--ease-out);
}
/* Stagger delay using data attributes */
[data-animate][data-delay="1"] { transition-delay: 100ms; }
[data-animate][data-delay="2"] { transition-delay: 200ms; }
[data-animate][data-delay="3"] { transition-delay: 300ms; }
[data-animate][data-delay="4"] { transition-delay: 400ms; }

/* Triggered state */
[data-animate].animate-in {
  opacity: 1;
  transform: translateY(0);
}
```

Apply `data-animate` and `data-delay="1/2/3"` to:
- Every card in a grid (stagger them)
- Section headings
- Page hero content (with short stagger)
- List items (stagger 50ms apart)
- Stat blocks

### 4.2 Smooth Page Transitions

If using Next.js or React Router:

```javascript
// Wrap page content in:
// Enter: opacity 0 -> 1 + translateY(10px -> 0), 300ms ease-out
// Exit: opacity 1 -> 0 + translateY(0 -> -10px), 200ms ease-in

// Tailwind example:
// Initial: 'opacity-0 translate-y-2'
// Animate: 'opacity-100 translate-y-0 transition-all duration-300 ease-out'
```

### 4.3 Micro-Interactions (APPLY TO EVERY INTERACTIVE ELEMENT)

**Buttons**: 
- Hover: `translateY(-1px)`, brighter shadow
- Active/click: `scale(0.97)` 80ms spring
- Focus: visible ring (`box-shadow: 0 0 0 3px var(--accent-primary-glow)`)

**Links**:
- Hover: color to `var(--text-primary)` + subtle underline fade in
- Use `transition: color 150ms ease`

**Nav items**:
- Hover: background fill slides in from left (clip-path or width animation)

**Cards**:
- Hover: `translateY(-2px)` + glow border + top edge light beam (see §2.2)

**Icons**:
- Hover parent: icon `scale(1.1)` or `rotate(5deg)` based on context
- Use `transition: transform 200ms var(--ease-spring)`

**Input focus**:
- Smooth glow ring expansion, label float up (if floating labels used)

**Checkboxes / Toggles**:
- Spring-animated check mark draw
- Toggle: smooth 200ms slide with spring easing

**Sidebar items**:
- Hover: padding-left increases slightly (feels like a "nudge in" effect)

**Number/stat counters**:
- On scroll-enter: count up from 0 to value using a simple JS counter
```javascript
function animateCount(el, target, duration = 1200) {
  const start = performance.now();
  const update = (time) => {
    const progress = Math.min((time - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3); // cubic ease out
    el.textContent = Math.floor(ease * target).toLocaleString();
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}
```

### 4.4 Navbar Scroll Behavior

```javascript
let lastScrollY = 0;
window.addEventListener('scroll', () => {
  const navbar = document.querySelector('.navbar');
  const scrollY = window.scrollY;
  
  // Add scrolled class for backdrop
  navbar.classList.toggle('scrolled', scrollY > 20);
  
  // Hide on scroll down, show on scroll up
  if (scrollY > lastScrollY && scrollY > 100) {
    navbar.style.transform = 'translateY(-100%)';
  } else {
    navbar.style.transform = 'translateY(0)';
  }
  lastScrollY = scrollY;
}, { passive: true });
```

Add to navbar:
```css
.navbar {
  transition: transform 300ms var(--ease-smooth), box-shadow 200ms var(--ease-smooth);
}
```

### 4.5 Cursor Glow Effect (Desktop Only)

```javascript
// Ambient cursor glow that follows the mouse
const glow = document.createElement('div');
glow.id = 'cursor-glow';
document.body.appendChild(glow);

document.addEventListener('mousemove', (e) => {
  glow.style.left = e.clientX - 200 + 'px';
  glow.style.top  = e.clientY - 200 + 'px';
});
```

```css
#cursor-glow {
  width: 400px; height: 400px;
  position: fixed;
  pointer-events: none;
  z-index: 0;
  background: radial-gradient(circle, rgba(108,92,231,0.08) 0%, transparent 70%);
  border-radius: 50%;
  transition: left 400ms ease, top 400ms ease;
  mix-blend-mode: screen;
}
@media (max-width: 768px) { #cursor-glow { display: none; } }
```

### 4.6 Ambient Background Orbs

Place this behind every major hero/section:

```html
<div class="orb-container" aria-hidden="true">
  <div class="orb orb-1"></div>
  <div class="orb orb-2"></div>
  <div class="orb orb-3"></div>
</div>
```

```css
.orb-container {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}
.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.12;
  animation: orb-float 12s ease-in-out infinite;
}
.orb-1 {
  width: 500px; height: 500px;
  top: -100px; left: -100px;
  background: var(--accent-primary);
  animation-delay: 0s;
}
.orb-2 {
  width: 400px; height: 400px;
  top: 100px; right: -80px;
  background: var(--accent-secondary);
  animation-delay: -4s;
  opacity: 0.08;
}
.orb-3 {
  width: 300px; height: 300px;
  bottom: -50px; left: 40%;
  background: var(--accent-tertiary);
  animation-delay: -8s;
  opacity: 0.06;
}
@keyframes orb-float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%       { transform: translate(30px, -20px) scale(1.05); }
  66%       { transform: translate(-20px, 15px) scale(0.97); }
}
```

---

## PHASE 5 — RESPONSIVENESS (EVERY PAGE, EVERY COMPONENT)

Apply these breakpoints everywhere:

```css
/* Breakpoint system */
/* xs:  < 480px  — mobile small */
/* sm:  480px+   — mobile large */
/* md:  768px+   — tablet */
/* lg:  1024px+  — desktop */
/* xl:  1280px+  — large desktop */
/* 2xl: 1536px+  — ultra wide */

@media (max-width: 768px) {
  /* Navbar: collapse to hamburger */
  /* Sidebar: convert to slide-out drawer */
  /* Cards: single column grid */
  /* Tables: horizontal scroll + sticky first column */
  /* Modals: full-screen on mobile */
  /* Hero font: scale down 1 step */
  /* Spacing: reduce by 30% */
  /* Orbs: reduce opacity by half */
}

@media (max-width: 480px) {
  /* Font sizes: scale down 1 more step */
  /* Buttons: full width where appropriate */
  /* All horizontal gaps: halved */
}
```

**Mobile-specific required work:**
1. **Navbar**: on `< 768px`, collapse nav links behind a hamburger icon. Hamburger animates between ☰ and ✕ with a rotate+cross animation. Menu slides down with fade+height animation.
2. **Sidebar** (if exists): convert to a slide-out drawer with backdrop overlay, triggered by a menu icon.
3. **Tables**: horizontal scroll wrapper. Consider a card-per-row layout as an alternative on very small screens.
4. **Card grids**: `grid-template-columns: 1fr` on mobile. Cards get slightly reduced padding.
5. **All touch targets**: minimum 44×44px hit area on all interactive elements.
6. **Hover effects**: wrap in `@media (hover: hover)` so they don't fire on touch devices.

---

## PHASE 6 — SCROLLBAR STYLING

```css
/* Firefox */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--bg-overlay) transparent;
}

/* Chrome, Edge, Safari */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: var(--bg-overlay);
  border-radius: 3px;
  transition: background 150ms ease;
}
::-webkit-scrollbar-thumb:hover { background: var(--bg-highlight); }
```

---

## PHASE 7 — ACCESSIBILITY

Do NOT sacrifice accessibility for aesthetics. All interactive elements must:

- **Focus rings**: every focusable element must have a visible focus ring using `box-shadow: 0 0 0 3px var(--accent-primary-glow), 0 0 0 1px var(--accent-primary)`. Remove browser outline (`outline: none`) only when you add this.
- **Color contrast**: all text must meet WCAG AA. Check `--text-secondary` on `--bg-surface` (target ≥ 4.5:1). Never rely on color alone to convey information.
- **Reduced motion**: wrap ALL keyframe animations in:
  ```css
  @media (prefers-reduced-motion: no-preference) {
    /* animation here */
  }
  ```
- **ARIA labels**: all icon-only buttons must have `aria-label`. All modals must have `role="dialog"` and `aria-modal="true"`.
- **Keyboard navigation**: sidebar and mobile nav must be fully keyboard navigable.

---

## PHASE 8 — GLOBAL BASE STYLES

Apply these as a global reset/base:

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  scroll-behavior: smooth;
  -webkit-text-size-adjust: 100%;
}

body {
  font-family: var(--font-sans);
  background: var(--bg-base);
  color: var(--text-primary);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  min-height: 100vh;
  overflow-x: hidden;
}

/* Selection color */
::selection {
  background: rgba(108,92,231,0.3);
  color: var(--text-primary);
}

/* Links */
a {
  color: var(--accent-secondary);
  text-decoration: none;
  transition: color var(--duration-base) var(--ease-smooth);
}
a:hover { color: var(--text-primary); }

/* Headings */
h1, h2, h3, h4, h5, h6 {
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  line-height: 1.2;
}

/* Code blocks */
code, pre {
  font-family: var(--font-mono);
  font-size: 0.875em;
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
}
code { padding: 2px 6px; }
pre  { padding: 16px 20px; overflow-x: auto; }

/* Dividers */
hr {
  border: none;
  border-top: 1px solid var(--border-subtle);
}

/* Images */
img, video { max-width: 100%; display: block; }
```

---

## PHASE 9 — ICON SYSTEM

Ensure the project uses a consistent icon set. Recommended:
- **Lucide Icons** (clean, modern, consistent weight): `https://lucide.dev`
- OR **Phosphor Icons**: `https://phosphoricons.com`
- All icons: `width: 16px; height: 16px` in text contexts, `20px` in buttons, `24px` standalone
- Use `currentColor` for icon stroke so they inherit text color
- Add `transition: transform 200ms var(--ease-spring)` to all icons inside interactive elements

---

## PHASE 10 — FINAL CHECKLIST (BEFORE SCREENSHOTS)

Go through this list item by item. Do not skip:

- [ ] Every page has been visited and redesigned
- [ ] Every component has the new styles applied
- [ ] No plain black `#000000` or pure white `#ffffff` exists in CSS (use design tokens)
- [ ] No hard-coded font-size in px without using the type scale
- [ ] Grain overlay is visible on all surfaces (subtle but present)
- [ ] All cards have hover animation
- [ ] All buttons have hover + active + focus states
- [ ] All inputs have focus glow ring
- [ ] Navbar backdrop blur works
- [ ] Ambient cursor glow working on desktop
- [ ] Background orbs present on main pages
- [ ] Scroll-triggered reveal animations fire on all cards and sections
- [ ] Navbar hides on scroll down, shows on scroll up
- [ ] Mobile hamburger nav works
- [ ] All tables/lists are horizontally scrollable on mobile
- [ ] Scrollbar is custom styled everywhere
- [ ] No accessibility regressions (focus rings present, aria labels, color contrast OK)
- [ ] `prefers-reduced-motion` respected
- [ ] No z-index conflicts (use a z-index scale: 1 content, 10 sticky, 50 dropdown, 100 navbar, 200 modal)

---

## PHASE 11 — SCREENSHOTS

Once EVERY item in Phase 10 is checked:

1. Take a **full-page screenshot** of every single page/route in the app at:
   - Desktop: 1440px viewport
   - Mobile: 375px viewport
2. Name screenshots clearly: `[page-name]-desktop.png` and `[page-name]-mobile.png`
3. Capture screenshots of:
   - Every unique page
   - Open state of any modal/dialog
   - Sidebar open (mobile)
   - Any hover state you can capture
   - A loading/skeleton state if applicable
4. Share all screenshots for review.

---

## CONSTRAINTS & PRINCIPLES

- **Never** use a pure `#000000` background — use `#0A0A0C` or `#0D0D10`
- **Never** use pure white text — use `#F0EFFF`
- **Never** use more than 3 accent colors in a single viewport
- **Never** animate layout properties (width, height, top, left) — only transform and opacity for performance
- **Never** add z-index without documenting why
- **Never** break an existing feature or route while changing styles
- **Always** preserve all existing functionality 100%
- **Always** test at 3 widths: 375px, 768px, 1440px
- **Always** prefer CSS transitions over JavaScript for simple states
- **Always** add `will-change: transform` to elements that will animate on scroll

---

*This is not a small tweak. This is a full design system implementation.
Take your time. Read everything first. Code second. The goal is a UI that looks like it ships at a company whose design team wins awards.*

