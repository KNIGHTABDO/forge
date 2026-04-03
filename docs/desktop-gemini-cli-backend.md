# Forge Desktop: Gemini CLI Backend Runtime

This document explains how Forge Desktop server routes run Gemini CLI using server-side environment variables from Vercel.

## Goal

- Keep `GEMINI_API_KEY` on backend only.
- Never send raw API key to desktop clients.
- Run Gemini CLI in headless mode on backend and return normalized response data.

## Required Environment Variables (Vercel)

Set these in Project Settings -> Environment Variables:

- `GEMINI_API_KEY` (required): Gemini API key used by backend runtime.
- `GEMINI_MODEL` (optional): default model for desktop agent route.
- `GEMINI_CLI_COMMAND` (optional): explicit command path if you do not want default command resolution.

Example:

- `GEMINI_CLI_COMMAND=gemini`

## How key sharing works safely

1. Desktop authenticates with Forge and calls backend agent route.
2. Backend route reads `process.env.GEMINI_API_KEY`.
3. Backend starts Gemini CLI process with an environment override:
   - `GEMINI_API_KEY=<server key>`
4. Desktop receives only model output metadata (reply/thinking/tools/requestId), never the raw key.

## Backend command behavior

`lib/gemini-cli.ts` resolves command in this order:

1. `GEMINI_CLI_COMMAND` if provided.
2. local binary under `node_modules/.bin/gemini`.
3. package bundle entry via Node (`node_modules/@google/gemini-cli/bundle/gemini.js`).

CLI is executed in headless mode with:

- `-p <prompt>`
- `--output-format stream-json`
- `-m <model>` when provided

## Verification checklist

1. Sign in from desktop and open Auth -> Diagnostics.
2. Send a message from desktop chat.
3. Confirm `Last agent request` and `Agent engine` fields update.
4. Confirm backend response includes `requestId`.
5. Confirm desktop payload does not include `geminiApiKey` for agent chat calls.

## Notes for production

- Desktop agent route is CLI-only. If Gemini CLI fails, the request fails with an explicit error.
- Keep `next.config.ts` tracing rules that include `node_modules/@google/gemini-cli/**/*` for desktop API routes so Vercel packages all CLI chunk files.
- Ensure your deployment environment allows child process execution for the selected runtime profile.
- Keep logs structured and never print full environment variables or raw key values.
