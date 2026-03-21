import { NextRequest } from 'next/server';

/**
 * lib/copilot-token.ts
 * Logic for exchanging a GitHub OAuth token for a short-lived Copilot inference token.
 */

interface CopilotToken {
  token: string;
  expires_at: number;
}

let CACHE: CopilotToken | null = null;

export async function getCopilotToken(): Promise<string> {
  // 1. Check in-memory cache
  if (CACHE && CACHE.expires_at > (Date.now() / 1000) + 60) {
    return CACHE.token;
  }

  // 2. Get the base OAuth token from environment
  let oauthToken = process.env.GITHUB_COPILOT_OAUTH_TOKEN || process.env.GITHUB_TOKEN;
  
  // Debugging: log the token source/prefix
  const source = process.env.GITHUB_COPILOT_OAUTH_TOKEN ? 'ENV_COPILOT' : (process.env.GITHUB_TOKEN ? 'ENV_GITHUB' : 'NONE');
  console.log(`[copilot-token] Attempting exchange using: ${source} (prefix: ${oauthToken?.substring(0, 7)}...)`);

  if (!oauthToken) {
    throw new Error('No GitHub token found for Copilot inference.');
  }

  // 3. Exchange for an inference token
  try {
    // Note: Copilot internal token exchange endpoint
    const res = await fetch('https://api.github.com/copilot_internal/v2/token', {
      headers: {
        'Authorization': `Bearer ${oauthToken}`,
        'editor-version': 'vscode/1.98.0',
        'editor-plugin-version': 'GitHub.copilot/1.276.0',
        'copilot-integration-id': 'vscode-chat',
        'user-agent': 'GithubCopilot/1.276.0',
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[copilot-token] Exchange failed:', res.status, errText);
      throw new Error(`Failed to exchange Copilot token: ${res.status}`);
    }

    const data = await res.json();
    if (!data.token) {
      throw new Error('Copilot exchange response missing token');
    }

    CACHE = {
      token: data.token,
      expires_at: data.expires_at,
    };

    return data.token;
  } catch (err) {
    console.error('[copilot-token] Error:', err);
    throw err;
  }
}

export function getCopilotBaseURL(token: string): string {
  // According to the guide, Copilot API uses root path and no /v1
  // However, AI SDK might append /chat/completions or similar.
  // Standard Copilot inference base is often just empty or specific proxy.
  // We'll use the one from the guide's context if available, otherwise default to a standard one.
  return 'https://api.githubcopilot.com';
}
