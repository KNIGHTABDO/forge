# Design System Strategy: Forge

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Kinetic Archive."** 

This system represents the intersection of high-end editorial authority and the fluid, atmospheric nature of generative AI. It rejects the "SaaS template" look in favor of a bespoke, cinematic environment. By combining a rigid, professional typography scale with a deep, layered "Nocturne" color palette, we create a workspace that feels like a premium developer tool while maintaining the soul of a creative playground.

The design breaks traditional grids through intentional asymmetry, using negative space (the "Void") as a functional element that directs focus toward high-contrast interactive components.

---

## 2. Colors
Our palette is rooted in the "Deepest Blacks" and "Ether Purples," creating a high-contrast environment where light is used as a signal, not just a decoration.

### Tonal Foundation
- **background**: `#131313` (The base "darkroom" environment)
- **surface-container-lowest**: `#0E0E0E` (Used for inset areas or "carved out" content)
- **surface-container-highest**: `#353534` (Used for floating elements and top-level modals)

### Brand Signal
- **primary**: `#D6BAFF` (A muted, atmospheric purple for primary actions)
- **primary-container**: `#AA73FF` (A vibrant glow-state purple)
- **on-background**: `#E5E2E1` (Crisp, off-white for maximum legibility)

### The "No-Line" Rule
To achieve a premium feel, **1px solid borders are prohibited for sectioning.** Boundaries between content blocks must be defined by background color shifts. For example, a card (using `surface-container-high`) should sit on a background (using `surface`) to create a natural edge. 

### Signature Textures & Glass
Floating UI elements (like tooltips or navigation bars) must utilize **Glassmorphism**. 
- **Effect:** Apply a backdrop-blur of `12px` to `24px`.
- **Background:** Use `surface-container` at 70% opacity. 
- **Signature Gradient:** For main CTAs, use a subtle linear gradient from `primary` to `primary-container` at a 45-degree angle to provide a sense of "physical light" within the screen.

---

## 3. Typography
The typography system is a study in high-contrast editorial hierarchy, blending the authoritative weight of a serif with the technical precision of a sans-serif.

| Level | Font Family | Token | Role |
| :--- | :--- | :--- | :--- |
| **Display** | Newsreader | `display-lg` | High-impact headlines; the "Editorial" voice. |
| **Headline** | Newsreader | `headline-md` | Section titles; provides a "Premium Tool" feel. |
| **Title** | Inter | `title-lg` | Component-level headers; clarity over character. |
| **Body** | Inter | `body-md` | General UI text; high legibility at 98% weight. |
| **Label** | Space Grotesk | `label-md` | Technical metadata, tags, and monospaced accents. |

**The Signature Mix:** Always pair a `display-lg` serif heading with a `label-sm` Space Grotesk sub-headline. This contrast suggests both "Creative Vision" and "Technical Execution."

---

## 4. Elevation & Depth
In this design system, depth is achieved through **Tonal Layering** rather than structural lines.

- **The Layering Principle:** Treat the UI as a series of stacked sheets of dark glass.
    - Base Level: `background`
    - Recessed Level: `surface-container-lowest` (use for inputs or background sections)
    - Elevated Level: `surface-container-high` (use for cards)
- **Ambient Shadows:** Shadows should be felt, not seen. Use extra-diffused shadows for floating elements: `box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);`. Never use pure black shadows; use a tinted version of the surface color to mimic ambient light.
- **The "Ghost Border" Fallback:** If accessibility requires a border, use the `outline-variant` token at **15% opacity**. This creates a "hairline" effect that defines the edge without cluttering the visual field.

---

## 5. Components

### Buttons
- **Primary**: Sharp corners (`none` or `sm` roundedness). Background: `primary` gradient. Text: `on-primary`.
- **Secondary**: "Ghost" style. Transparent background with a `Ghost Border`.
- **State**: On hover, the `primary` button should emit a subtle `primary-container` outer glow (8px blur).

### Cards
- **Construction**: Use `xl` (0.75rem) rounded corners to soften the larger layout.
- **Background**: `surface-container-low`.
- **Rule**: **No divider lines.** Use `1.4rem` (Spacing 4) to separate the card header from the body.

### Input Fields
- **Aesthetic**: Sharp corners, high-precision lines.
- **Color**: `surface-container-lowest` background with a `surface-bright` bottom-border only (2px).
- **Interaction**: On focus, the bottom border transitions to `primary` with a 2px "glow" shadow.

### Status Chips
- **Aesthetic**: Pill-shaped (`full` roundedness).
- **Typography**: `label-sm` (Space Grotesk).
- **Color**: Low-opacity `secondary-container` with high-contrast text.

---

## 6. Do's and Don'ts

### Do
- **Use Negative Space:** Ensure at least `spacing-16` (5.5rem) between major sections to let the typography breathe.
- **Layer Surface Tones:** Use `surface-container-lowest` for your main canvas and `surface-container-high` for interactive panels.
- **Apply "Purple Glow":** Use the `primary-container` color sparingly as a "light leak" or aura behind key visuals to mimic the Spline aesthetic.

### Don't
- **Don't use 1px solid white borders.** It breaks the "Nocturne" atmosphere and feels like a standard template.
- **Don't use drop shadows on text.** Rely on the high-contrast `on-surface` white against the dark background.
- **Don't round button corners heavily.** Keep buttons sharp (`none` or `sm`) to maintain the "Professional Tool" authority, while keeping cards soft (`xl`) for the "Playground" feel.

---

## 7. Agent Intelligence Layer

The Architect and Builder agents carry the official **gemini-api-dev** skill, embedded as the `GEMINI_API_DEV_SKILL` constant in `lib/system-prompt.ts`. This provides:

- Authoritative knowledge of the latest Gemini 3 model family
- Current SDK recommendations (`@google/genai` for JS/TS, `google-genai` for Python)
- Canonical quick-start patterns and API documentation links

This intelligence layer is invisible to end users — they simply receive more accurate, future-proof output whenever they build Gemini-powered applications.

### Smart Title Generation

After analyzing the user's idea, the Architect outputs a `## 🏷️ Smart Title Suggestions` section at the end of every architectural blueprint. This section proposes exactly 3 short, memorable, brandable project names (2–5 words each, specific to the app's purpose).

- **Fast mode**: The best suggestion (marked ⭐) is automatically applied as the project name before the Builder runs.
- **Plan mode**: A title picker card surfaces in the chat panel — users can pick a suggestion, dismiss it, or keep their own name.
- The chosen title propagates to the ForgeBar project name field, the deployed URL slug, gallery metadata, and page titles.
- CSS classes: `.title-suggestion-card`, `.title-suggestion-btn`, `.title-best-badge` (see `app/globals.css`).
- Parsing utility: `parseTitleSuggestions(planContent: string): string[]` in `app/build/page.tsx`.