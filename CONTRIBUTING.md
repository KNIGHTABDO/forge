# Contributing to FORGE

First off, thank you for considering contributing to FORGE! It's people like you who make FORGE such a great tool.

## How Can I Contribute?

### Reporting Bugs
- Use a clear and descriptive title.
- Describe the exact steps which reproduce the problem.
- Explain which behavior you expected to see and what you saw instead.
- Include screenshots if possible.

### Suggesting Enhancements
- Explain why this enhancement would be useful to most FORGE users.
- Provide step-by-step descriptions of the suggested enhancement.

### Pull Requests
1. Fork the repo and create your branch from `main`.
2. Install dependencies with `npm install`.
3. Ensure the project builds with `npm run build`.
4. If you've added code that should be tested, add tests.
5. Ensure the test suite passes.
6. Make sure your code lints.
7. Issue that pull request!

## Style Guide
- Use TypeScript for all new code.
- Follow the existing project structure.
- Write clean, documented code.
- Ensure all new UI components are responsive and follow the FORGE design system.

## Agent Intelligence (gemini-api-dev Skill)

Forge's Architect and Builder agents embed the official **gemini-api-dev** skill as a shared constant (`GEMINI_API_DEV_SKILL`) in `lib/system-prompt.ts`. This constant is appended to both `PLANNER_SYSTEM_PROMPT` and `BUILD_SYSTEM_PROMPT`.

If you need to update the skill's content (e.g. to reflect new Gemini models or SDK changes), edit `GEMINI_API_DEV_SKILL` in `lib/system-prompt.ts`. The change will automatically propagate to both agents. Do not duplicate the skill content inline inside individual prompts.

## Smart Title Generation

Forge's Architect agent automatically proposes 3 short, catchy, brandable project names at the end of every architectural blueprint, inside a `## 🏷️ Smart Title Suggestions` section.

- **Prompt instructions**: see `PLANNER_SYSTEM_PROMPT` rule 6 in `lib/system-prompt.ts`.
- **Parsing**: `parseTitleSuggestions(content)` in `app/build/page.tsx` extracts the three titles from the plan markdown.
- **UI**: `.title-suggestion-card` and related classes are defined in `app/globals.css`.
- **Fast mode**: best title auto-applied (no user action needed).
- **Plan mode**: title picker card shown in the chat panel before the user approves the plan.

When updating title generation behavior, keep the parseable list format (`- ⭐ **TitleName** — rationale`) intact so the regex stays accurate.

## Deep Research Agent (Beta)

Forge includes a dedicated Deep Research capability on a standalone route (`/research/[id]`).

- Keep this workflow fully separate from `/build` and the one-sentence app creation flow.
- Use research-specific APIs under `app/api/research/` and session-backed persistence.
- Maintain Beta labeling and progressive disclosure in UI copy.

### Research UI Animation Patterns

- Prefer existing Forge timing/easing tokens and subtle motion (pulse, fade-in, progress fill, smooth state transitions).
- Keep animations informative (phase changes, status transitions, loading indicators), not decorative noise.
- Respect responsive behavior and avoid introducing visual styles outside the current premium minimal design system.

## License
By contributing to FORGE, you agree that your contributions will be licensed under the project's MIT License.
