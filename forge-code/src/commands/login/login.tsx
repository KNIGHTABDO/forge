import React, { useEffect, useState } from 'react'
import { Box, Text } from '../../ink.js'
import http from 'http'
import os from 'os'
import { openBrowser } from '../../utils/browser.js'
import { Dialog } from '../../components/design-system/Dialog.js'
import { saveGlobalConfig, getOrCreateUserID } from '../../utils/config.js'

const DEFAULT_FORGE_WEB_APP_URL = 'https://forge.com'
const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite-preview'
const DEFAULT_GITHUB_MODEL = 'gemini-3.1-pro-preview'

type CliKeysResponse = {
  keys?: {
    GEMINI_API_KEY?: string | null
    GITHUB_TOKEN?: string | null
    GEMINI_MODEL?: string | null
    GITHUB_MODEL?: string | null
  }
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

function getForgeWebBaseUrl(): string {
  if (process.env.FORGE_LOCAL_DEV) {
    return 'http://localhost:3000'
  }

  return normalizeBaseUrl(
    process.env.FORGE_WEB_APP_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      DEFAULT_FORGE_WEB_APP_URL,
  )
}

function applyRemoteKeys(keys?: CliKeysResponse['keys']): boolean {
  if (!keys) {
    return false
  }

  const geminiKey = keys.GEMINI_API_KEY?.trim()
  const githubToken = keys.GITHUB_TOKEN?.trim()
  let appliedAny = false

  if (geminiKey) {
    process.env.GEMINI_API_KEY = geminiKey
    process.env.GEMINI_MODEL =
      keys.GEMINI_MODEL?.trim() ||
      process.env.GEMINI_MODEL ||
      DEFAULT_GEMINI_MODEL
    process.env.FORGE_CODE_USE_GEMINI = '1'
    delete process.env.FORGE_CODE_USE_OPENAI
    appliedAny = true
  }

  if (githubToken) {
    process.env.GITHUB_TOKEN = githubToken
    process.env.GITHUB_MODEL =
      keys.GITHUB_MODEL?.trim() ||
      process.env.GITHUB_MODEL ||
      DEFAULT_GITHUB_MODEL

    // If Gemini isn't configured, fall back to GitHub Models over OpenAI-compatible transport.
    if (!geminiKey) {
      process.env.OPENAI_API_KEY = githubToken
      process.env.OPENAI_BASE_URL =
        process.env.OPENAI_BASE_URL || 'https://models.inference.ai.azure.com'
      process.env.OPENAI_MODEL =
        process.env.GITHUB_MODEL || process.env.OPENAI_MODEL || DEFAULT_GITHUB_MODEL
      process.env.FORGE_CODE_USE_OPENAI = '1'
      delete process.env.FORGE_CODE_USE_GEMINI
    }

    appliedAny = true
  }

  return appliedAny
}

export function Login({ onDone }: { onDone: (result?: string, options?: any) => void }) {
  const [status, setStatus] = useState<string>('Initializing...')
  const [server, setServer] = useState<http.Server | null>(null)

  useEffect(() => {
    const baseUrl = getForgeWebBaseUrl()

    const srv = http.createServer(async (req, res) => {
      const host = req.headers.host || '127.0.0.1'
      const url = new URL(req.url || '/', `http://${host}`)
      
      if (url.pathname === '/callback') {
        const token = url.searchParams.get('token')
        if (token) {
          try {
            saveGlobalConfig(config => ({ ...config, firebaseToken: token }))
            
            // Register device
            const deviceId = getOrCreateUserID()
            const deviceName = os.hostname()
            const osName = `${os.type()} ${os.release()}`
            const encodedDeviceName = encodeURIComponent(deviceName)
            const encodedOsName = encodeURIComponent(osName)
            const encodedDeviceId = encodeURIComponent(deviceId)

            setStatus('Authenticated. Syncing keys and device state...')

            let syncWarning: string | null = null

            // Fetch and apply server-side keys immediately so the current session works.
            try {
              const keyRes = await fetch(
                `${baseUrl}/api/cli/keys?deviceId=${encodedDeviceId}&deviceName=${encodedDeviceName}&os=${encodedOsName}`,
                {
                  method: 'GET',
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                },
              )

              if (keyRes.ok) {
                const keyBody = (await keyRes.json()) as CliKeysResponse
                const hasAnyKey = applyRemoteKeys(keyBody.keys)
                if (!hasAnyKey) {
                  syncWarning =
                    'No GEMINI_API_KEY or GITHUB_TOKEN is configured on the web app yet.'
                }
              } else if (keyRes.status === 401 || keyRes.status === 403) {
                // The callback token is stale/invalid for API usage.
                saveGlobalConfig(config => ({ ...config, firebaseToken: undefined }))
                syncWarning =
                  'Session token was rejected by the web API. Please run /login again.'
              } else {
                const responseBody = await keyRes.text().catch(() => '')
                syncWarning =
                  responseBody.trim() ||
                  `Failed to fetch remote keys (${keyRes.status})`
              }
            } catch (err) {
              syncWarning = `Failed to fetch remote keys: ${String(err)}`
            }
            
            try {
              await fetch(`${baseUrl}/api/cli/telemetry`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  deviceId,
                  deviceName,
                  os: osName
                })
              })
            } catch (err) {
              if (!syncWarning) {
                syncWarning = `Telemetry registration failed: ${String(err)}`
              }
            }

            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(`
              <html>
                <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fdfdfc; color: #111;">
                  <div style="text-align: center;">
                    <h2>Authentication successful!</h2>
                    <p>Keys are synced securely. You can close this window and return to your terminal.</p>
                  </div>
                  <script>setTimeout(() => window.close(), 1500)</script>
                </body>
              </html>
            `)
            setStatus(
              syncWarning
                ? `Authenticated with warning: ${syncWarning}`
                : 'Authenticated! Keys synced and device connected.',
            )
            setTimeout(() => {
              const doneMessage = syncWarning
                ? `Logged in, but sync needs attention: ${syncWarning}`
                : 'Successfully logged in.'
              onDone(doneMessage, {
                display: 'system',
                metaMessages: [doneMessage],
              })
            }, 1000)
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'text/plain' })
            res.end('Error saving token: ' + String(e))
          }
        } else {
          res.writeHead(400, { 'Content-Type': 'text/plain' })
          res.end('Missing token in callback.')
        }
      } else {
        res.writeHead(404)
        res.end('Not found')
      }
    })

    srv.listen(0, '127.0.0.1', () => {
      const address = srv.address()
      if (address && typeof address === 'object') {
        const port = address.port
        const deviceId = getOrCreateUserID()
        const deviceName = os.hostname()
        const osName = `${os.type()} ${os.release()}`
        const callbackTarget = `http://127.0.0.1:${port}/callback`
        const callbackUrl = encodeURIComponent(callbackTarget)
        const encodedDeviceId = encodeURIComponent(deviceId)
        const encodedDeviceName = encodeURIComponent(deviceName)
        const encodedOsName = encodeURIComponent(osName)
        const hashParams =
          `#cliLogin=1` +
          `&cb=${callbackUrl}` +
          `&did=${encodedDeviceId}` +
          `&dn=${encodedDeviceName}` +
          `&os=${encodedOsName}`
        const loginUrl =
          `${baseUrl}/cli?cliLogin=1` +
          `&callback=${callbackUrl}` +
          `&cb=${callbackUrl}` +
          `&deviceId=${encodedDeviceId}` +
          `&did=${encodedDeviceId}` +
          `&deviceName=${encodedDeviceName}` +
          `&dn=${encodedDeviceName}` +
          `&os=${encodedOsName}` +
          hashParams
        
        setStatus('Opening browser to authenticate... Keep this terminal open until callback finishes.')
        openBrowser(loginUrl).catch(() => {
          setStatus(`Could not open browser automatically.\nPlease visit:\n${loginUrl}`)
        })
      }
    })

    setServer(srv)

    return () => {
      if (srv) {
        setStatus('Closing server...')
        srv.close()
      }
    }
  }, [onDone])

  return (
    <Dialog title="Forge CLI Login" onCancel={onDone}>
      <Box padding={1}>
        <Text>{status}</Text>
      </Box>
    </Dialog>
  )
}

export const call = async (onDone: (result?: string, options?: any) => void, context?: any) => {
  return <Login onDone={(result, options) => {
    if (result && context?.onChangeAPIKey) {
      context.onChangeAPIKey()
    }
    onDone(result, options)
  }} />
}

