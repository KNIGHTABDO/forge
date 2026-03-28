'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import ForgeBar from '@/components/ForgeBar';
import StitchPanel, { StitchDesign } from '@/components/StitchPanel';

const PreviewFrame = dynamic(() => import('@/components/PreviewFrame'), { ssr: false });

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isGenerating?: boolean;
  error?: boolean;
}

interface ProjectFile {
  path: string;
  content: string;
}

const SUGGESTIONS = [
  'A habit tracker for 5 daily goals',
  'A Pomodoro timer with custom intervals',
  'A tip calculator that splits between friends',
  'A password generator with strength meter',
];

function BuildPageContent() {
  const searchParams = useSearchParams();
  const loadSlug = searchParams.get('tool');

  // Unified State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [toolName, setToolName] = useState('Untitled Tool');
  const [slug, setSlug] = useState<string | undefined>(loadSlug || undefined);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [deployedUrl, setDeployedUrl] = useState<string | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Mobile tab
  const [mobileView, setMobileView] = useState<'chat' | 'preview'>('chat');

  // Stitch Design
  const [showStitchPanel, setShowStitchPanel] = useState(false);
  const [selectedStitchDesign, setSelectedStitchDesign] = useState<StitchDesign | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 1. Initialize Session or Load Existing
  useEffect(() => {
    // Priority: search param -> localStorage -> new uuid
    const queryId = searchParams.get('session');
    const storedId = localStorage.getItem('forge_last_session');
    const finalId = queryId || storedId || `sess_${Math.random().toString(36).substring(2, 9)}`;
    
    setSessionId(finalId);
    localStorage.setItem('forge_last_session', finalId);

    // Update URL silently without reload
    const url = new URL(window.location.href);
    if (!url.searchParams.has('tool')) {
      url.searchParams.set('session', finalId);
      window.history.replaceState({}, '', url.toString());
    }

    // Load session from GitHub if it's not a new session
    if (finalId && !loadSlug) {
      fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load', sessionId: finalId })
      })
      .then(r => r.json())
      .then(data => {
        if (data.state) {
          console.log('[session] Loaded state:', data.state);
          if (data.state.messages) setMessages(data.state.messages);
          if (data.state.projectFiles) setProjectFiles(data.state.projectFiles);
          if (data.state.toolName) setToolName(data.state.toolName);
        }
      })
      .catch(console.error);
    }
  }, [loadSlug, searchParams]);

  // 2. Load Tool by Slug (if opened via gallery / url slug)
  useEffect(() => {
    if (!loadSlug) return;
    fetch(`/api/tool/${loadSlug}`)
      .then(r => r.json())
      .then(data => {
        if (data.files) {
          setProjectFiles(data.files);
          setToolName(data.meta?.title || loadSlug);
          setSlug(loadSlug);
          setDeployedUrl(`${window.location.origin}/t/${loadSlug}`);
          if (data.meta?.promptHistory) setMessages(data.meta.promptHistory);
        } else if (data.html) {
          setProjectFiles([{ path: 'public/index.html', content: data.html }]);
          setToolName(data.meta?.title || loadSlug);
        }
      })
      .catch(console.error);
  }, [loadSlug]);

  // Generate / Orchestrator API
  const generate = useCallback(async (userMsg: string) => {
    if (!userMsg.trim() || isGenerating) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setInput('');
    setIsGenerating(true);

    // Switch mobile to preview
    setMobileView('preview');

    const assistantIndex = newMessages.length;
    setMessages([...newMessages, { role: 'assistant', content: '', isGenerating: true }]);

    let streamBuffer = '';
    let parsedFiles = [...projectFiles];

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMsg,
          chatHistory: newMessages,
          projectFiles,
          stitchDesign: selectedStitchDesign || undefined,
        }),
      });

      if (!res.ok) throw new Error('API Execution Failed');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No reader found');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        streamBuffer += chunk;

        const rawText = streamBuffer;

        // Parse <title>Project Name</title> tags (pick the last one if multiple)
        const allTitles = [...rawText.matchAll(/<title>([\s\S]*?)<\/title>/gi)];
        if (allTitles.length > 0) {
          const latestTitle = allTitles[allTitles.length - 1][1];
          setToolName(latestTitle.trim());
        }

        // Only extract COMPLETE file blocks — must have closing </file> tag
        const fileRegex = /<file\s+path=["']([^"']+)["']>([\s\S]*?)<\/file>/gi;
        let match;
        const newParsedFiles: Record<string, string> = {};

        while ((match = fileRegex.exec(rawText)) !== null) {
          newParsedFiles[match[1]] = match[2];
        }

        if (Object.keys(newParsedFiles).length > 0) {
          const updatedFiles = [...parsedFiles];
          for (const [path, content] of Object.entries(newParsedFiles)) {
            const existingIdx = updatedFiles.findIndex(f => f.path === path);
            if (existingIdx >= 0) {
              updatedFiles[existingIdx] = { path, content };
            } else {
              updatedFiles.push({ path, content });
            }
          }
          parsedFiles = updatedFiles;
          setProjectFiles(parsedFiles);
        }

        // Real-time chat message update (strip file and title blocks)
        const currentMsg = streamBuffer
          .replace(/<file[^>]*>[\s\S]*?(?:<\/file>|$)/gi, '')
          .replace(/<title>[\s\S]*?(?:<\/title>|$)/gi, '');
        
        setMessages(prev => prev.map((m, i) =>
          i === assistantIndex ? { ...m, content: currentMsg } : m
        ));
      }

      // Final cleanup of the chat message (strip file and title blocks)
      const finalMsg = streamBuffer
        .replace(/<file[^>]*>[\s\S]*?(?:<\/file>|$)/gi, '')
        .replace(/<title>[\s\S]*?(?:<\/title>|$)/gi, '');

      // Done streaming
      const finalAssistantMsg = { role: 'assistant' as const, content: finalMsg, isGenerating: false };
      setMessages(prev => prev.map((m, i) =>
        i === assistantIndex ? finalAssistantMsg : m
      ));

      // Auto-save session after successful generation
      if (sessionId) {
        setIsSaving(true);
        fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save',
            sessionId,
            state: {
              messages: [...newMessages, finalAssistantMsg],
              projectFiles: parsedFiles,
              toolName: toolName,
              mode: 'build'
            }
          })
        }).finally(() => setIsSaving(false));
      }

    } catch (err: any) {
      console.error('[generation]', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setMessages(prev => prev.map((m, i) =>
        i === assistantIndex ? { ...m, isGenerating: false, content: `Error: ${errorMsg}`, error: true } : m
      ));
    } finally {
      setIsGenerating(false);
    }
  }, [messages, projectFiles, toolName, sessionId, selectedStitchDesign, isGenerating]);

  // Deploy
  const deploy = useCallback(async () => {
    if (projectFiles.length === 0 || isDeploying) return;
    setIsDeploying(true);
    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: toolName || 'My Tool',
          description: '',
          files: projectFiles,
          tags: ['react', 'sandpack'],
          promptHistory: messages.filter(m => !m.isGenerating),
          existingSlug: slug,
        }),
      });
      const data = await res.json();
      if (data.slug) {
        setSlug(data.slug);
        setDeployedUrl(data.url);
      } else {
        alert('Deploy failed: ' + data.error);
      }
    } catch (err) {
      console.error('[deploy]', err);
    } finally {
      setIsDeploying(false);
    }
  }, [projectFiles, isDeploying, toolName, messages, slug]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      generate(input);
    }
  };

  return (
    <div className="build-root">
      <ForgeBar
        toolName={toolName}
        onToolNameChange={setToolName}
        slug={slug}
        deployedUrl={deployedUrl}
        isDeploying={isDeploying}
        onDeploy={deploy}
      />

      {/* Mobile Tab Toggle */}
      <div className="mobile-tab-toggle">
        <button
          className={`mobile-tab-btn ${mobileView === 'chat' ? 'active' : ''}`}
          onClick={() => setMobileView('chat')}
        >Chat</button>
        <button
          className={`mobile-tab-btn ${mobileView === 'preview' ? 'active' : ''}`}
          onClick={() => setMobileView('preview')}
        >Preview</button>
      </div>

      <div className={`build-body ${mobileView === 'preview' ? 'mobile-show-preview' : 'mobile-show-chat'}`}>
        {/* ─── Chat Panel ─── */}
        <div className="chat-panel">
          <div className="chat-messages custom-scrollbar">
            {messages.length === 0 && (
              <div className="chat-welcome">
                <h3>What are we building?</h3>
                <p>Describe your tool below and Forge will generate it instantly.</p>
                <ul className="chat-suggestions">
                  {SUGGESTIONS.map((s, i) => (
                    <button key={i} onClick={() => generate(s)}>{s}</button>
                  ))}
                </ul>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role === 'user' ? 'chat-msg-user' : 'chat-msg-assistant'}`}>
                <div className={`chat-bubble ${m.role}${m.error ? ' error' : ''}`}>
                  {m.role === 'assistant' ? (
                    m.isGenerating && !m.content ? (
                      <span className="generating-dots"><span /><span /><span /></span>
                    ) : (
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    )
                  ) : (
                    <span>{m.content}</span>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>

          {/* ─── Input Area ─── */}
          <div className="chat-input-area">
            <div className="chat-input-box-wrap">
              <div className="chat-input-box">
                <textarea
                  className="chat-input"
                  placeholder="Describe the tool you want..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isGenerating}
                  rows={1}
                />
                <div className="chat-input-actions">
                  <div className="chat-input-left">
                    <button
                      className={`chat-input-icon-btn${selectedStitchDesign ? ' active' : ''}`}
                      onClick={() => setShowStitchPanel(!showStitchPanel)}
                      title="Stitch Design AI"
                      style={selectedStitchDesign ? { color: 'var(--amber)' } : {}}
                    >
                      🧵
                    </button>
                  </div>
                  <button
                    className="chat-send"
                    onClick={() => generate(input)}
                    disabled={!input.trim() || isGenerating}
                    title="Send"
                  >
                    ↑
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Preview Panel ─── */}
        <div className="preview-panel">
          <PreviewFrame files={projectFiles} isStreaming={isGenerating} />
        </div>
      </div>

      <StitchPanel
        isOpen={showStitchPanel}
        onClose={() => setShowStitchPanel(false)}
        selectedDesign={selectedStitchDesign}
        onSelectDesign={setSelectedStitchDesign}
        lastPrompt={input}
      />
    </div>
  );
}

export default function BuildPage() {
  return (
    <Suspense fallback={
      <div className="build-root flex items-center justify-center bg-[#0a0a0a] text-white/50" style={{ height: '100vh', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ width: '2rem', height: '2rem', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'rgba(255,255,255,0.8)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: '0.875rem', fontWeight: 500, letterSpacing: '-0.02em' }}>Initializing Protocol...</span>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes spin { to { transform: rotate(360deg); } }
        `}} />
      </div>
    }>
      <BuildPageContent />
    </Suspense>
  );
}
