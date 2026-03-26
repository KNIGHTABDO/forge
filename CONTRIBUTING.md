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

## License
By contributing to FORGE, you agree that your contributions will be licensed under the project's MIT License.
