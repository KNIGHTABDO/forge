import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { openUrl } from '@tauri-apps/plugin-opener'
import {
  beginAuthFlow,
  clearSessionToken,
  consumeAuthToken,
  fetchDesktopKeys,
  getAuthStatus,
  getBootstrapPayload,
  getForgeWebBaseUrl,
  listWorkspaceFiles,
  loadSessionToken,
  pickWorkspaceFolder,
  postDesktopTelemetry,
  readWorkspaceFile,
  runDesktopAgentChat,
  saveSessionToken,
  searchDesktopWeb,
  type BootstrapPayload,
  type CliKeys,
  type DesktopAgentMessage,
  type DesktopAgentToolResult,
  type DesktopDeviceContext,
} from './lib/tauri'

type ThemeMode = 'light' | 'dark'
type StartupStep = 'onboarding' | 'chat'
type ChatRole = 'user' | 'assistant'

type ToolEvent = {
  name: string
  status: 'running' | 'done' | 'error'
  detail: string
}

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  createdAt: number
  thinking?: string[]
  tools?: ToolEvent[]
}

type ChatSession = {
  id: string
  title: string
  workspacePath: string
  messages: ChatMessage[]
  draft: string
  indexedFiles: string[]
  searchEnabled: boolean
  createdAt: number
  updatedAt: number
}

type RemoteKeySummary = {
  geminiReady: boolean
  githubReady: boolean
  geminiModel: string
  githubModel: string
}

const DEVICE_ID_STORAGE_KEY = 'forge-desktop-device-id'
const THEME_STORAGE_KEY = 'forge-desktop-theme'
const SESSION_STORAGE_KEY = 'forge-desktop-chat-sessions-v3'
const ACTIVE_SESSION_STORAGE_KEY = 'forge-desktop-active-session-v3'
const DEFAULT_SESSION_TITLE = 'New Session'

function makeId(prefix: string): string {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`
  }

  const randomSuffix = Math.floor(Math.random() * 1_000_000)
  return `${prefix}-${Date.now()}-${randomSuffix}`
}

function nextTheme(current: ThemeMode): ThemeMode {
  return current === 'light' ? 'dark' : 'light'
}

function summarizeRemoteKeys(keys: CliKeys): RemoteKeySummary {
  return {
    geminiReady: Boolean(keys.GEMINI_API_KEY),
    githubReady: Boolean(keys.GITHUB_TOKEN),
    geminiModel: keys.GEMINI_MODEL,
    githubModel: keys.GITHUB_MODEL,
  }
}

function readStoredDesktopDeviceId(): string | null {
  const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY)
  if (!existing) return null
  const trimmed = existing.trim()
  return trimmed || null
}

function createDesktopDeviceId(): string {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return `desktop-${globalThis.crypto.randomUUID()}`
  }

  const randomSuffix = Math.floor(Math.random() * 1_000_000)
  return `desktop-${Date.now()}-${randomSuffix}`
}

function persistDesktopDeviceId(deviceId: string): void {
  localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId)
}

function getOrCreateDesktopDeviceId(): string {
  const existing = readStoredDesktopDeviceId()
  if (existing) {
    return existing
  }

  const created = createDesktopDeviceId()
  persistDesktopDeviceId(created)
  return created
}

function toSessionTitleFromPrompt(prompt: string): string {
  const compact = prompt.replace(/\s+/g, ' ').trim()
  if (!compact) return DEFAULT_SESSION_TITLE
  if (compact.length <= 46) return compact
  return `${compact.slice(0, 46)}...`
}

function createSession(workspacePath: string, title = DEFAULT_SESSION_TITLE): ChatSession {
  const now = Date.now()
  return {
    id: makeId('session'),
    title,
    workspacePath,
    messages: [],
    draft: '',
    indexedFiles: [],
    searchEnabled: true,
    createdAt: now,
    updatedAt: now,
  }
}

function isAbsolutePath(path: string): boolean {
  return /^(?:[A-Za-z]:[\\/]|\\\\|\/)/.test(path)
}

function joinPath(basePath: string, childPath: string): string {
  const base = basePath.trim()
  const child = childPath.trim()

  if (!base) return child
  if (!child) return base
  if (isAbsolutePath(child)) return child

  const separator = base.includes('\\') ? '\\' : '/'
  if (base.endsWith('\\') || base.endsWith('/')) {
    return `${base}${child}`
  }

  return `${base}${separator}${child}`
}

function resolveWorkspaceFilePath(workspacePath: string, requestedPath: string): string {
  const target = requestedPath.trim().replace(/^['"]|['"]$/g, '')
  if (!target) return ''
  if (isAbsolutePath(target)) return target
  if (!workspacePath.trim()) return ''
  return joinPath(workspacePath, target)
}

function getWorkspaceLabel(path: string): string {
  const trimmed = path.trim().replace(/[\\/]+$/, '')
  if (!trimmed) return 'No folder selected'
  const parts = trimmed.split(/[\\/]/)
  return parts[parts.length - 1] || trimmed
}

function extractReadTarget(prompt: string): string | null {
  const slashRead = prompt.match(/^\s*\/read\s+(.+)$/i)
  if (slashRead?.[1]) {
    return slashRead[1].trim().replace(/^['"]|['"]$/g, '')
  }

  const naturalRead = prompt.match(/(?:read|open|cat)\s+(?:the\s+)?(?:file\s+)?([^\n]+)/i)
  if (naturalRead?.[1]) {
    return naturalRead[1].trim().replace(/^['"]|['"]$/g, '')
  }

  return null
}

function trimToolOutput(value: string, maxChars = 5000): string {
  const normalized = value.trim()
  if (normalized.length <= maxChars) {
    return normalized
  }

  return `${normalized.slice(0, maxChars)}\n\n[...truncated...]`
}

function buildLocalFallbackReply(
  prompt: string,
  workspacePath: string,
  toolResults: DesktopAgentToolResult[],
  toolEvents: ToolEvent[],
  errorText: string,
): string {
  const lines: string[] = [
    `I could not reach the cloud model (${errorText}).`,
    '',
    'I still executed local tool logic and preserved this session.',
    '',
    '### Request',
    prompt,
    '',
    '### Workspace',
    workspacePath || 'No workspace selected',
    '',
  ]

  if (toolEvents.length > 0) {
    lines.push('### Tool Calls')
    lines.push(
      ...toolEvents.map(
        (tool, index) =>
          `${index + 1}. ${tool.name} (${tool.status}) - ${tool.detail}`,
      ),
    )
    lines.push('')
  }

  if (toolResults.length > 0) {
    lines.push('### Local Outputs')
    for (const tool of toolResults) {
      lines.push(`#### ${tool.name}`)
      lines.push('~~~text')
      lines.push(trimToolOutput(tool.output, 1800))
      lines.push('~~~')
      lines.push('')
    }
  } else {
    lines.push('No local tool output was produced for this request.')
  }

  return lines.join('\n')
}

function loadStoredSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    const normalized = parsed
      .map((candidate) => {
        if (!candidate || typeof candidate !== 'object') {
          return null
        }

        const item = candidate as Partial<ChatSession>
        if (typeof item.id !== 'string') {
          return null
        }

        const rawMessages = Array.isArray(item.messages) ? item.messages : []
        let messages: ChatMessage[] = rawMessages
          .reduce<ChatMessage[]>((acc, message) => {
            if (!message || typeof message !== 'object') {
              return acc
            }

            const record = message as Record<string, unknown>
            const role = record.role === 'user' ? 'user' : 'assistant'
            const content = typeof record.content === 'string' ? record.content : ''
            if (!content.trim()) {
              return acc
            }

            const thinking = Array.isArray(record.thinking)
              ? record.thinking
                  .filter((entry): entry is string => typeof entry === 'string')
                  .slice(0, 12)
              : []

            const tools = Array.isArray(record.tools)
              ? record.tools
                  .map((entry) => {
                    if (!entry || typeof entry !== 'object') return null
                    const toolRecord = entry as Record<string, unknown>
                    const name = typeof toolRecord.name === 'string' ? toolRecord.name : ''
                    const status =
                      toolRecord.status === 'running' ||
                      toolRecord.status === 'done' ||
                      toolRecord.status === 'error'
                        ? toolRecord.status
                        : 'running'
                    const detail =
                      typeof toolRecord.detail === 'string' ? toolRecord.detail : ''
                    if (!name || !detail) return null
                    return { name, status, detail } satisfies ToolEvent
                  })
                  .filter((entry): entry is ToolEvent => Boolean(entry))
                  .slice(0, 20)
              : []

            const normalizedMessage: ChatMessage = {
              id:
                typeof record.id === 'string' && record.id.trim()
                  ? record.id
                  : makeId('msg'),
              role,
              content,
              createdAt:
                typeof record.createdAt === 'number' ? record.createdAt : Date.now(),
            }

            if (thinking.length > 0) {
              normalizedMessage.thinking = thinking
            }

            if (tools.length > 0) {
              normalizedMessage.tools = tools
            }

            acc.push(normalizedMessage)
            return acc
          }, [])
          .slice(-140)

        if (
          messages.length === 1 &&
          messages[0]?.role === 'assistant' &&
          messages[0].content.includes('Forge Desktop session ready')
        ) {
          messages = []
        }

        return {
          id: item.id,
          title:
            typeof item.title === 'string' && item.title.trim()
              ? item.title
              : DEFAULT_SESSION_TITLE,
          workspacePath:
            typeof item.workspacePath === 'string' ? item.workspacePath : '',
          messages,
          draft: typeof item.draft === 'string' ? item.draft : '',
          indexedFiles: Array.isArray(item.indexedFiles)
            ? item.indexedFiles
                .filter((entry): entry is string => typeof entry === 'string')
                .slice(0, 1500)
            : [],
          searchEnabled: item.searchEnabled !== false,
          createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
          updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
        } satisfies ChatSession
      })
      .filter((session): session is ChatSession => Boolean(session))

    return normalized
  } catch {
    return []
  }
}

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>('light')
  const [startupStep, setStartupStep] = useState<StartupStep>('onboarding')

  const [statusText, setStatusText] = useState('Desktop bridge ready.')
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const [isPollingAuth, setIsPollingAuth] = useState(false)
  const [isSyncingSession, setIsSyncingSession] = useState(false)
  const [hasSavedSession, setHasSavedSession] = useState(false)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [remoteKeySummary, setRemoteKeySummary] = useState<RemoteKeySummary | null>(null)
  const [selectedModel, setSelectedModel] = useState('')

  const [bootstrap, setBootstrap] = useState<BootstrapPayload>({
    appName: 'Forge Desktop',
    appVersion: 'loading',
    platform: 'loading',
  })
  const [deviceId, setDeviceId] = useState('unassigned')

  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [runningSessionId, setRunningSessionId] = useState<string | null>(null)

  const [isPickingFolder, setIsPickingFolder] = useState(false)
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [copyStatus, setCopyStatus] = useState('')

  const messageScrollRef = useRef<HTMLDivElement | null>(null)
  const authPollingStartedAtRef = useRef<number | null>(null)
  const forgeWebBase = useMemo(() => getForgeWebBaseUrl(), [])

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)
  }, [sessions])

  const availableModels = useMemo(() => {
    if (!remoteKeySummary) return []
    return Array.from(
      new Set([
        remoteKeySummary.geminiModel,
        remoteKeySummary.githubModel,
      ].filter((value) => value.trim().length > 0)),
    )
  }, [remoteKeySummary])

  const activeSession = useMemo(() => {
    if (!sessions.length) return null
    return sessions.find((session) => session.id === activeSessionId) || sessions[0] || null
  }, [activeSessionId, sessions])

  const isActiveSessionRunning = Boolean(
    activeSession && runningSessionId === activeSession.id,
  )

  const openExternalUrl = useCallback(async (url: string): Promise<boolean> => {
    try {
      await openUrl(url)
      return true
    } catch {
      try {
        const opened = window.open(url, '_blank', 'noopener,noreferrer')
        return Boolean(opened)
      } catch {
        return false
      }
    }
  }, [])

  const updateSession = useCallback(
    (sessionId: string, updater: (session: ChatSession) => ChatSession) => {
      setSessions((previous) =>
        previous.map((session) =>
          session.id === sessionId ? updater(session) : session,
        ),
      )
    },
    [],
  )

  const chooseWorkspaceFolder = useCallback(async (): Promise<string | null> => {
    setIsPickingFolder(true)
    try {
      const selected = await pickWorkspaceFolder()
      return selected?.trim() || null
    } finally {
      setIsPickingFolder(false)
    }
  }, [])

  const normalizeServerWarning = useCallback((warning: string): string => {
    if (/NOT_FOUND/i.test(warning)) {
      return 'Usage registry is unavailable on server (Firestore not initialized or unreachable). Login remains valid.'
    }

    return warning
  }, [])

  const sendUsageTelemetry = useCallback(
    async (delta: {
      commandsExecuted?: number
      filesEdited?: number
      activeSwarms?: number
      messagesSent?: number
      assistantResponses?: number
      searchQueries?: number
      toolCalls?: number
      sessionsStarted?: number
      failedTurns?: number
      lastModel?: string
      lastProvider?: string
      lastWorkspacePath?: string
    }) => {
      if (!sessionToken) {
        return
      }

      const context: DesktopDeviceContext = {
        deviceId: (deviceId || getOrCreateDesktopDeviceId()).trim(),
        deviceName: 'Forge Desktop',
        os: bootstrap.platform,
        platform: bootstrap.platform,
        appVersion: bootstrap.appVersion,
        deviceType: 'desktop_app',
      }

      const result = await postDesktopTelemetry(sessionToken, forgeWebBase, context, {
        commandsExecuted: delta.commandsExecuted ?? 0,
        filesEdited: delta.filesEdited ?? 0,
        activeSwarms: delta.activeSwarms ?? 0,
        messagesSent: delta.messagesSent ?? 0,
        assistantResponses: delta.assistantResponses ?? 0,
        searchQueries: delta.searchQueries ?? 0,
        toolCalls: delta.toolCalls ?? 0,
        sessionsStarted: delta.sessionsStarted ?? 0,
        failedTurns: delta.failedTurns ?? 0,
        ...(delta.lastModel ? { lastModel: delta.lastModel } : {}),
        ...(delta.lastProvider ? { lastProvider: delta.lastProvider } : {}),
        ...(delta.lastWorkspacePath ? { lastWorkspacePath: delta.lastWorkspacePath } : {}),
      })

      if (result.warning) {
        console.warn('Desktop telemetry warning:', result.warning)
      }
    },
    [bootstrap.appVersion, bootstrap.platform, deviceId, forgeWebBase, sessionToken],
  )

  const syncSessionWithForge = useCallback(
    async (
      token: string,
      runtime: BootstrapPayload,
      preferredDeviceId?: string,
    ): Promise<void> => {
      const resolvedDeviceId = (preferredDeviceId || getOrCreateDesktopDeviceId()).trim()
      persistDesktopDeviceId(resolvedDeviceId)
      setDeviceId(resolvedDeviceId)
      setIsSyncingSession(true)

      const context: DesktopDeviceContext = {
        deviceId: resolvedDeviceId,
        deviceName: 'Forge Desktop',
        os: runtime.platform,
        platform: runtime.platform,
        appVersion: runtime.appVersion,
        deviceType: 'desktop_app',
      }

      try {
        const keyResult = await fetchDesktopKeys(token, forgeWebBase, context)

        if (!keyResult.ok) {
          if (keyResult.status === 401 || keyResult.status === 403) {
            await clearSessionToken()
            setSessionToken(null)
            setHasSavedSession(false)
            setRemoteKeySummary(null)
            setStatusText('Session expired or revoked. Please sign in again.')
            return
          }

          setStatusText(`Session saved, but key sync failed: ${keyResult.error}`)
          return
        }

        const keySummary = summarizeRemoteKeys(keyResult.keys)
        setRemoteKeySummary(keySummary)
        setSelectedModel((previous) => previous.trim() || keySummary.geminiModel)

        const keyReadinessMessage =
          keySummary.geminiReady && keySummary.githubReady
            ? 'Authenticated and synced. Gemini and GitHub model keys are available.'
            : keySummary.geminiReady
              ? 'Authenticated and synced. Gemini key is available; GitHub token is missing.'
              : keySummary.githubReady
                ? 'Authenticated and synced. GitHub token is available; Gemini key is missing.'
                : 'Authenticated, but no model keys are configured on the server yet.'

        if (keyResult.warning) {
          setStatusText(`${keyReadinessMessage} Warning: ${normalizeServerWarning(keyResult.warning)}`)
        } else {
          setStatusText(keyReadinessMessage)
        }

        const telemetryResult = await postDesktopTelemetry(token, forgeWebBase, context, {
          commandsExecuted: 0,
          filesEdited: 0,
          activeSwarms: 0,
          messagesSent: 0,
          assistantResponses: 0,
          searchQueries: 0,
          toolCalls: 0,
          sessionsStarted: 0,
          lastModel: keySummary.geminiModel,
          lastProvider: 'gemini',
        })

        if (telemetryResult.warning) {
          const normalizedWarning = normalizeServerWarning(
            telemetryResult.warning || 'Unknown telemetry warning.',
          )
          setStatusText((previous) => `${previous} Telemetry: ${normalizedWarning}`)
        }
      } catch (error) {
        setStatusText(`Session sync failed: ${String(error)}`)
      } finally {
        setIsSyncingSession(false)
      }
    },
    [forgeWebBase, normalizeServerWarning],
  )

  const startSignIn = useCallback(async () => {
    try {
      setShowAuthDialog(true)
      setCopyStatus('')
      setStatusText('Generating secure Forge sign-in link...')

      const flow = await beginAuthFlow(forgeWebBase, 'Forge Desktop')
      setAuthUrl(flow.loginUrl)
      persistDesktopDeviceId(flow.deviceId)
      setDeviceId(flow.deviceId)
      setIsPollingAuth(true)
      authPollingStartedAtRef.current = Date.now()

      const opened = await openExternalUrl(flow.loginUrl)
      if (opened) {
        setStatusText('Login page opened. Complete sign-in and return to desktop.')
      } else {
        setStatusText('Login link ready. Browser did not open automatically, copy the link below.')
      }
    } catch (error) {
      setIsPollingAuth(false)
      authPollingStartedAtRef.current = null
      setStatusText(`Unable to start sign-in flow: ${String(error)}`)
    }
  }, [forgeWebBase, openExternalUrl])

  const copyLoginLink = useCallback(async () => {
    if (!authUrl) {
      setCopyStatus('No login link available yet.')
      return
    }

    try {
      await navigator.clipboard.writeText(authUrl)
      setCopyStatus('Login link copied to clipboard.')
      setStatusText('Login link copied. Paste it in your browser if opening fails.')
    } catch {
      setCopyStatus('Copy failed. Select and copy the URL manually.')
    }
  }, [authUrl])

  const resetSessionToken = useCallback(async () => {
    await clearSessionToken()
    setSessionToken(null)
    setHasSavedSession(false)
    setRemoteKeySummary(null)
    setStatusText('Stored desktop session cleared.')
  }, [])

  const beginNewWorkspaceSession = useCallback(async () => {
    const selectedFolder = await chooseWorkspaceFolder()
    if (!selectedFolder) {
      setStatusText('Folder selection cancelled.')
      return
    }

    const session = createSession(selectedFolder)
    setSessions((previous) => [session, ...previous])
    setActiveSessionId(session.id)
    setSidebarOpen(true)
    setStartupStep('chat')
    setStatusText(`Workspace selected: ${selectedFolder}`)
    void sendUsageTelemetry({ sessionsStarted: 1, lastWorkspacePath: selectedFolder })
  }, [chooseWorkspaceFolder, sendUsageTelemetry])

  const continueWithSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId)
    setStartupStep('chat')
    setSidebarOpen(true)
    setStatusText('Session loaded.')
  }, [])

  const continueLatestSession = useCallback(() => {
    if (!sortedSessions.length) return
    continueWithSession(sortedSessions[0]!.id)
  }, [continueWithSession, sortedSessions])

  const createSiblingSession = useCallback(async () => {
    const baseWorkspace = activeSession?.workspacePath.trim() || ''

    if (!baseWorkspace) {
      const selectedFolder = await chooseWorkspaceFolder()
      if (!selectedFolder) {
        setStatusText('No workspace selected for new session.')
        return
      }

      const session = createSession(selectedFolder)
      setSessions((previous) => [session, ...previous])
      setActiveSessionId(session.id)
      setStartupStep('chat')
      setStatusText(`New empty session created for ${selectedFolder}`)
      void sendUsageTelemetry({ sessionsStarted: 1, lastWorkspacePath: selectedFolder })
      return
    }

    const session = createSession(baseWorkspace)
    setSessions((previous) => [session, ...previous])
    setActiveSessionId(session.id)
    setStartupStep('chat')
    setStatusText(`New empty session created in ${baseWorkspace}`)
    void sendUsageTelemetry({ sessionsStarted: 1, lastWorkspacePath: baseWorkspace })
  }, [activeSession, chooseWorkspaceFolder, sendUsageTelemetry])

  const closeSession = useCallback(
    (sessionId: string) => {
      setSessions((previous) => {
        const remaining = previous.filter((session) => session.id !== sessionId)

        if (remaining.length === 0) {
          setActiveSessionId('')
          setStartupStep('onboarding')
          return []
        }

        if (activeSessionId === sessionId) {
          setActiveSessionId(remaining[0]!.id)
        }

        return remaining
      })
    },
    [activeSessionId],
  )

  const changeWorkspaceFolder = useCallback(async () => {
    if (!activeSession) return

    const selectedFolder = await chooseWorkspaceFolder()
    if (!selectedFolder) {
      setStatusText('Folder selection cancelled.')
      return
    }

    updateSession(activeSession.id, (session) => ({
      ...session,
      workspacePath: selectedFolder,
      indexedFiles: [],
      updatedAt: Date.now(),
    }))

    setStatusText(`Workspace switched to ${selectedFolder}`)
  }, [activeSession, chooseWorkspaceFolder, updateSession])

  const runAgentTurn = useCallback(
    async (overridePrompt?: string) => {
      if (!activeSession || runningSessionId) {
        return
      }

      const prompt = (overridePrompt ?? activeSession.draft).trim()
      if (!prompt) {
        return
      }

      const sessionId = activeSession.id
      const workspacePath = activeSession.workspacePath.trim()

      const userMessage: ChatMessage = {
        id: makeId('msg'),
        role: 'user',
        content: prompt,
        createdAt: Date.now(),
      }

      updateSession(sessionId, (session) => ({
        ...session,
        messages: [...session.messages, userMessage],
        draft: '',
        updatedAt: Date.now(),
        title:
          session.title === DEFAULT_SESSION_TITLE
            ? toSessionTitleFromPrompt(prompt)
            : session.title,
      }))

      setRunningSessionId(sessionId)
      setStatusText('Agent is working...')

      const toolEvents: ToolEvent[] = []
      const toolResults: DesktopAgentToolResult[] = []
      const thinking: string[] = [
        'Interpreting your request.',
        'Selecting relevant local tools and context.',
      ]

      let indexedFiles: string[] | null = null

      const pushTool = (
        name: string,
        status: ToolEvent['status'],
        detail: string,
      ): void => {
        toolEvents.push({ name, status, detail })
      }

      try {
        const wantsIndex =
          /^\s*\/index\b/i.test(prompt) ||
          /(list|show).*(files|workspace|project|tree|folders|directories)/i.test(prompt)

        const wantsDirs =
          /^\s*\/dirs\b/i.test(prompt) ||
          /(list|show).*(dirs|directories|folders)/i.test(prompt)

        if (wantsIndex || wantsDirs) {
          if (!workspacePath) {
            pushTool(
              'list_workspace_files',
              'error',
              'No workspace selected. Use Select Folder first.',
            )
          } else {
            pushTool('list_workspace_files', 'running', workspacePath)

            try {
              const files = await listWorkspaceFiles(workspacePath, 4)
              indexedFiles = files
              const displayed = wantsDirs
                ? files.filter((entry) => entry.endsWith('/'))
                : files

              toolResults.push({
                name: 'list_workspace_files',
                output: trimToolOutput(displayed.join('\n') || 'No entries found.'),
              })

              pushTool(
                'list_workspace_files',
                'done',
                `Returned ${displayed.length} entries.`,
              )
              thinking.push(`Indexed ${displayed.length} entries from workspace.`)
            } catch (error) {
              pushTool('list_workspace_files', 'error', String(error))
            }
          }
        }

        const readTarget = extractReadTarget(prompt)
        const shouldAutoReadReadme =
          !readTarget &&
          /\breadme\b|project\s+overview|repo\s+overview|project\s+summary/i.test(
            prompt,
          )

        if (readTarget) {
          const resolvedPath = resolveWorkspaceFilePath(workspacePath, readTarget)

          if (!resolvedPath) {
            pushTool(
              'read_workspace_file',
              'error',
              'Unable to resolve file path. Choose a workspace first or use absolute path.',
            )
          } else {
            pushTool('read_workspace_file', 'running', resolvedPath)

            try {
              const fileContent = await readWorkspaceFile(resolvedPath, 80000)
              toolResults.push({
                name: 'read_workspace_file',
                output: trimToolOutput(`Path: ${resolvedPath}\n\n${fileContent}`, 7000),
              })

              pushTool('read_workspace_file', 'done', `Loaded ${resolvedPath}.`)
              thinking.push(`Read file context from ${resolvedPath}.`)
            } catch (error) {
              pushTool('read_workspace_file', 'error', String(error))
            }
          }
        } else if (shouldAutoReadReadme && workspacePath) {
          const candidates = ['README.md', 'readme.md', 'README.MD']
          let readmeLoaded = false

          for (const candidate of candidates) {
            const resolvedPath = resolveWorkspaceFilePath(workspacePath, candidate)
            if (!resolvedPath) {
              continue
            }

            pushTool('read_workspace_file', 'running', resolvedPath)
            try {
              const fileContent = await readWorkspaceFile(resolvedPath, 80000)
              toolResults.push({
                name: 'read_workspace_file',
                output: trimToolOutput(`Path: ${resolvedPath}\n\n${fileContent}`, 7000),
              })
              pushTool('read_workspace_file', 'done', `Loaded ${resolvedPath}.`)
              thinking.push(`Read project README from ${resolvedPath}.`)
              readmeLoaded = true
              break
            } catch {
              pushTool('read_workspace_file', 'error', `Could not open ${resolvedPath}.`)
            }
          }

          if (!readmeLoaded) {
            pushTool(
              'read_workspace_file',
              'error',
              'README was not found in the selected workspace root.',
            )
          }
        }

        const slashSearch = prompt.match(/^\s*\/search\s+(.+)$/i)
        const searchQuery = slashSearch?.[1]?.trim() || prompt
        const shouldSearch =
          activeSession.searchEnabled &&
          (Boolean(slashSearch) ||
            /(search|research|look up|lookup|latest|news|docs|documentation)/i.test(
              prompt,
            ))

        if (shouldSearch) {
          if (!sessionToken) {
            pushTool('searchDesktopWeb', 'error', 'Sign in required for web search.')
          } else {
            pushTool('searchDesktopWeb', 'running', searchQuery.slice(0, 160))
            const searchResult = await searchDesktopWeb(
              sessionToken,
              forgeWebBase,
              searchQuery,
            )

            if (!searchResult.ok) {
              if (searchResult.status === 401 || searchResult.status === 403) {
                await clearSessionToken()
                setSessionToken(null)
                setHasSavedSession(false)
                setRemoteKeySummary(null)
              }

              pushTool('searchDesktopWeb', 'error', searchResult.error)
            } else {
              toolResults.push({
                name: 'searchDesktopWeb',
                output: trimToolOutput(
                  searchResult.results
                    .map(
                      (entry, index) =>
                        `${index + 1}. ${entry.title}\nURL: ${entry.url}\nSnippet: ${entry.snippet}`,
                    )
                    .join('\n\n') || 'No web sources found.',
                ),
              })

              pushTool(
                'searchDesktopWeb',
                'done',
                `Collected ${searchResult.results.length} web sources.`,
              )
            }
          }
        }

        thinking.push('Preparing final response.')

        const history: DesktopAgentMessage[] = [...activeSession.messages, userMessage]
          .filter((message) => message.role === 'user' || message.role === 'assistant')
          .slice(-12)
          .map((message) => ({
            role: message.role,
            content: message.content,
          }))

        const chatResult = await runDesktopAgentChat(sessionToken, forgeWebBase, {
          message: prompt,
          history,
          toolResults,
          thinkingHints: thinking,
          workspacePath,
          workspaceLabel: getWorkspaceLabel(workspacePath),
          workspaceFiles: activeSession.indexedFiles.slice(0, 120),
          modelPreference: selectedModel || undefined,
          providerPreference: 'gemini',
          sessionId,
        })

        const assistantContent = chatResult.ok
          ? chatResult.reply
          : buildLocalFallbackReply(
              prompt,
              workspacePath,
              toolResults,
              toolEvents,
              chatResult.error,
            )

        const assistantMessage: ChatMessage = {
          id: makeId('msg'),
          role: 'assistant',
          content: assistantContent,
          createdAt: Date.now(),
          thinking:
            chatResult.ok && chatResult.thinking.length > 0
              ? chatResult.thinking
              : thinking,
          tools: toolEvents,
        }

        updateSession(sessionId, (session) => ({
          ...session,
          messages: [...session.messages, assistantMessage],
          indexedFiles: indexedFiles || session.indexedFiles,
          updatedAt: Date.now(),
        }))

        if (chatResult.ok) {
          setStatusText('Agent response complete.')
        } else {
          setStatusText('Cloud model unavailable. Returned local tool-backed response.')
        }
      } catch (error) {
        const failureMessage: ChatMessage = {
          id: makeId('msg'),
          role: 'assistant',
          content: `Agent execution failed: ${String(error)}`,
          createdAt: Date.now(),
          thinking,
          tools: toolEvents,
        }

        updateSession(sessionId, (session) => ({
          ...session,
          messages: [...session.messages, failureMessage],
          updatedAt: Date.now(),
        }))

        setStatusText(`Agent execution failed: ${String(error)}`)
      } finally {
        setRunningSessionId(null)
      }
    },
    [
      activeSession,
      forgeWebBase,
      runningSessionId,
      selectedModel,
      sessionToken,
      updateSession,
    ],
  )

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    const initialTheme = savedTheme === 'dark' ? 'dark' : 'light'
    setTheme(initialTheme)

    const storedSessions = loadStoredSessions()
    setSessions(storedSessions)

    if (storedSessions.length > 0) {
      const storedActiveId = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)
      const hasStoredActive =
        Boolean(storedActiveId) &&
        storedSessions.some((session) => session.id === storedActiveId)

      setActiveSessionId(hasStoredActive ? (storedActiveId as string) : storedSessions[0]!.id)
      setStartupStep('onboarding')
    } else {
      setActiveSessionId('')
      setStartupStep('onboarding')
    }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (sessions.length === 0) {
      localStorage.removeItem(SESSION_STORAGE_KEY)
      return
    }

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions))
  }, [sessions])

  useEffect(() => {
    if (!activeSessionId) {
      localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY)
      return
    }

    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, activeSessionId)
  }, [activeSessionId])

  useEffect(() => {
    if (sessions.length === 0) return
    if (sessions.some((session) => session.id === activeSessionId)) return
    setActiveSessionId(sessions[0]!.id)
  }, [activeSessionId, sessions])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const payload = await getBootstrapPayload()
      if (cancelled) return

      setBootstrap(payload)

      const resolvedDeviceId = getOrCreateDesktopDeviceId()
      setDeviceId(resolvedDeviceId)

      const token = await loadSessionToken()
      if (cancelled) return

      if (token) {
        setSessionToken(token)
        setHasSavedSession(true)
        setStatusText(`Runtime online on ${payload.platform}. Restoring authenticated session...`)
        await syncSessionWithForge(token, payload, resolvedDeviceId)
      } else {
        setSessionToken(null)
        setStatusText(`Runtime online on ${payload.platform}. Select folder and start chatting.`)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [syncSessionWithForge])

  useEffect(() => {
    if (!isPollingAuth) return

    const intervalId = window.setInterval(() => {
      void (async () => {
        const pollStartedAt = authPollingStartedAtRef.current
        if (pollStartedAt && Date.now() - pollStartedAt > 5 * 60 * 1000) {
          setIsPollingAuth(false)
          authPollingStartedAtRef.current = null
          setStatusText('Sign-in callback timed out. Start sign-in again from Account.')
          return
        }

        const status = await getAuthStatus()

        if (status.status === 'success' && status.hasToken) {
          const token = await consumeAuthToken()
          if (!token) return

          await saveSessionToken(token)
          setSessionToken(token)

          const callbackDeviceId = readStoredDesktopDeviceId() || getOrCreateDesktopDeviceId()
          setDeviceId(callbackDeviceId)

          setHasSavedSession(true)
          setIsPollingAuth(false)
          authPollingStartedAtRef.current = null
          setStatusText('Authenticated. Syncing keys and device state...')
          await syncSessionWithForge(token, bootstrap, callbackDeviceId)
          return
        }

        if (status.status === 'error') {
          setIsPollingAuth(false)
          authPollingStartedAtRef.current = null
          setStatusText(status.error || 'Desktop callback failed. Please retry sign-in.')
        }
      })().catch((error) => {
        setIsPollingAuth(false)
        authPollingStartedAtRef.current = null
        setStatusText(`Auth polling failed: ${String(error)}`)
      })
    }, 1200)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [bootstrap, isPollingAuth, syncSessionWithForge])

  useEffect(() => {
    if (!messageScrollRef.current || startupStep !== 'chat') return
    messageScrollRef.current.scrollTop = messageScrollRef.current.scrollHeight
  }, [
    activeSession?.id,
    activeSession?.messages.length,
    isActiveSessionRunning,
    startupStep,
  ])

  const shellClass = startupStep === 'chat' && sidebarOpen ? 'sidebar-open' : 'sidebar-closed'

  return (
    <div className={`chat-shell ${shellClass}`}>
      {startupStep === 'chat' && activeSession && (
        <aside className="session-sidebar">
          <div className="sidebar-head">
            <h2>Sessions</h2>
            <div className="sidebar-head-actions">
              <button type="button" className="secondary-btn" onClick={() => void createSiblingSession()}>
                New
              </button>
              <button type="button" className="secondary-btn" onClick={() => setSidebarOpen(false)}>
                Hide
              </button>
            </div>
          </div>

          <div className="session-list">
            {sortedSessions.map((session) => (
              <div key={session.id} className={`session-row ${session.id === activeSession.id ? 'active' : ''}`}>
                <button type="button" className="session-switch" onClick={() => setActiveSessionId(session.id)}>
                  <span className="session-title">{session.title}</span>
                  <span className="session-subtitle">{getWorkspaceLabel(session.workspacePath)}</span>
                  <span className="session-time">{new Date(session.updatedAt).toLocaleTimeString()}</span>
                </button>
                <button
                  type="button"
                  className="session-close"
                  onClick={() => closeSession(session.id)}
                  aria-label={`Close ${session.title}`}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </aside>
      )}

      <section className="chat-main">
        <header className="chat-topbar">
          <div className="topbar-left">
            {startupStep === 'chat' && !sidebarOpen && (
              <button type="button" className="secondary-btn" onClick={() => setSidebarOpen(true)}>
                Sessions
              </button>
            )}
            <div className="brand-block">
              <strong>Forge Desktop</strong>
              <span>{activeSession ? getWorkspaceLabel(activeSession.workspacePath) : 'No folder selected'}</span>
            </div>
          </div>

          <div className="topbar-right">
            <span className="top-pill">{bootstrap.platform}</span>
            <span className="top-pill">{bootstrap.appVersion}</span>
            <span className="top-pill">
              {isSyncingSession ? 'Syncing' : sessionToken ? 'Signed In' : 'Guest'}
            </span>
            {remoteKeySummary && <span className="top-pill">provider: gemini</span>}
            {remoteKeySummary && (
              <span className="top-pill">{selectedModel || remoteKeySummary.geminiModel}</span>
            )}

            {startupStep === 'chat' && (
              <button type="button" className="secondary-btn" onClick={() => void changeWorkspaceFolder()}>
                Select Folder
              </button>
            )}

            <button type="button" className="secondary-btn" onClick={() => setShowAuthDialog(true)}>
              {sessionToken ? 'Account' : 'Sign In'}
            </button>

            <button type="button" className="secondary-btn" onClick={() => setTheme((previous) => nextTheme(previous))}>
              {theme === 'light' ? 'Dark' : 'Light'}
            </button>
          </div>
        </header>

        <div className="chat-status">{statusText}</div>

        {startupStep === 'chat' && activeSession ? (
          <>
            <div className="message-scroller" ref={messageScrollRef}>
              {activeSession.messages.length === 0 && (
                <div className="empty-chat-state">
                  <h3>Empty chat</h3>
                  <p>
                    Start by describing the task for this workspace. You can also use
                    commands like /index, /dirs, /read path/to/file, and /search query.
                  </p>
                </div>
              )}

              {activeSession.messages.map((message) => (
                <article key={message.id} className={`chat-message ${message.role}`}>
                  <div className="message-role">{message.role === 'assistant' ? 'Forge Agent' : 'You'}</div>
                  <div className="message-body markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                  </div>

                  {message.thinking && message.thinking.length > 0 && (
                    <details className="message-meta">
                      <summary>Thinking ({message.thinking.length})</summary>
                      <ul>
                        {message.thinking.map((item, index) => (
                          <li key={`${item}-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {message.tools && message.tools.length > 0 && (
                    <details className="message-meta">
                      <summary>Tool Calls ({message.tools.length})</summary>
                      <ul className="tool-meta-list">
                        {message.tools.map((tool, index) => (
                          <li key={`${tool.name}-${index}`}>
                            <span className={`tool-badge ${tool.status}`}>{tool.status}</span>
                            <strong>{tool.name}</strong>
                            <p>{tool.detail}</p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </article>
              ))}

              {isActiveSessionRunning && (
                <article className="chat-message assistant running-message">
                  <div className="message-role">Forge Agent</div>
                  <div className="message-body markdown-body">
                    <p>Working on your request...</p>
                  </div>
                </article>
              )}
            </div>

            <form
              className="chat-composer"
              onSubmit={(event) => {
                event.preventDefault()
                void runAgentTurn()
              }}
            >
              <textarea
                value={activeSession.draft}
                placeholder="Message Forge Agent... (Shift+Enter for newline, Enter to send)"
                onChange={(event) => {
                  updateSession(activeSession.id, (session) => ({
                    ...session,
                    draft: event.target.value,
                    updatedAt: Date.now(),
                  }))
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    if (!isActiveSessionRunning) {
                      void runAgentTurn()
                    }
                  }
                }}
                rows={3}
              />

              <div className="composer-actions">
                <button type="button" className="secondary-btn" onClick={() => void runAgentTurn('/index')}>
                  /index
                </button>
                <button type="button" className="secondary-btn" onClick={() => void runAgentTurn('/dirs')}>
                  /dirs
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={isActiveSessionRunning || !activeSession.draft.trim()}
                >
                  {isActiveSessionRunning ? 'Running...' : 'Send'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="onboarding-main-placeholder" />
        )}
      </section>

      {startupStep === 'onboarding' && (
        <div className="overlay-shell">
          <div className="onboarding-card">
            <p className="eyebrow">Forge Desktop</p>
            <h1>Select a workspace to begin</h1>
            <p>
              Start clean by choosing a project folder, or continue one of your previous sessions.
            </p>

            <div className="onboarding-actions">
              <button type="button" className="primary-btn" onClick={() => void beginNewWorkspaceSession()} disabled={isPickingFolder}>
                {isPickingFolder ? 'Selecting...' : 'Select Folder'}
              </button>
              {sortedSessions.length > 0 && (
                <button type="button" className="secondary-btn" onClick={continueLatestSession}>
                  Continue Last Session
                </button>
              )}
            </div>

            {sortedSessions.length > 0 && (
              <div className="recent-list">
                <h2>Recent Sessions</h2>
                {sortedSessions.slice(0, 8).map((session) => (
                  <button key={session.id} type="button" className="recent-item" onClick={() => continueWithSession(session.id)}>
                    <span>{session.title}</span>
                    <small>{getWorkspaceLabel(session.workspacePath)}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showAuthDialog && (
        <div className="overlay-shell">
          <div className="auth-card">
            <div className="auth-head">
              <h2>Authentication</h2>
              <button type="button" className="secondary-btn" onClick={() => setShowAuthDialog(false)}>
                Close
              </button>
            </div>

            <p className="muted">
              Sign in enables protected APIs, key sync, and authenticated web search.
            </p>
            <p className="muted">API endpoint: {forgeWebBase}</p>
            {remoteKeySummary && (
              <p className="muted">
                Key sync status: Gemini {remoteKeySummary.geminiReady ? 'ready' : 'missing'}; GitHub {remoteKeySummary.githubReady ? 'ready' : 'missing'}.
              </p>
            )}
            <p className="muted">Active provider: Gemini API</p>
            {!!remoteKeySummary && availableModels.length > 0 && (
              <label className="auth-model-row">
                <span className="muted">Active model</span>
                <select
                  value={selectedModel || remoteKeySummary.geminiModel}
                  onChange={(event) => setSelectedModel(event.target.value)}
                >
                  {availableModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {sessionToken && !remoteKeySummary && (
              <p className="muted">
                Session token is stored, but key sync has not succeeded yet.
              </p>
            )}

            <div className="auth-link-row">
              <input
                readOnly
                value={authUrl || ''}
                placeholder="Generate login link to copy manually"
              />
              <button type="button" className="secondary-btn" onClick={() => void copyLoginLink()} disabled={!authUrl}>
                Copy
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  if (authUrl) {
                    void openExternalUrl(authUrl)
                  }
                }}
                disabled={!authUrl}
              >
                Open
              </button>
            </div>

            <div className="auth-actions">
              <button type="button" className="primary-btn" disabled={isPollingAuth} onClick={() => void startSignIn()}>
                {isPollingAuth ? 'Waiting Callback...' : sessionToken ? 'Re-authenticate' : 'Start Sign In'}
              </button>

              {hasSavedSession && (
                <button type="button" className="secondary-btn danger" onClick={() => void resetSessionToken()}>
                  Clear Local Token
                </button>
              )}
            </div>

            <p className="muted">
              If browser opening fails, copy the login URL above and open it manually.
            </p>
            {copyStatus && <p className="copy-status">{copyStatus}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
