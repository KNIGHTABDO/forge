'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import ForgeBar from '@/components/ForgeBar';

const PreviewFrame = dynamic(() => import('@/components/PreviewFrame'), { ssr: false });

interface Message {
  role: 'user' | 'assistant';
  content: string;
  at: string;
  isGenerating?: boolean;
  charCount?: number;
  error?: boolean;
}

function BuildPage() {
  const searchParams = useSearchParams();
  const loadSlug = searchParams.get('tool');

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [currentHTML, setCurrentHTML] = useState('');
  const [toolName, setToolName] = useState('');
  const [slug, setSlug] = useState<string | undefined>(loadSlug || undefined);
  const [deployedUrl, setDeployedUrl] = useState<string | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [inspectMode, setInspectMode] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [elementRef, setElementRef] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const streamBufferRef = useRef('');

  useEffect(() => {
    if (!loadSlug) return;
    fetch(`/api/tool/${loadSlug}`).then(r => r.json()).then(data => {
      if (data.html) {
        setCurrentHTML(data.html);
        setToolName(data.meta?.title || loadSlug);
        setSlug(loadSlug);
        setDeployedUrl(`${window.location.origin}/t/${loadSlug}`);
        if (data.meta?.promptHistory) setMessages(data.meta.promptHistory);
      }
    }).catch(console.error);
  }, [loadSlug]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleElementClick = useCallback((ref: string) => {
    setElementRef(ref);
    setInput(ref + ' \u2192 ');
    setInspectMode(false);
    inputRef.current?.focus();
  }, []);

  const updateLastAssistantMsg = useCallback((patch: Partial<Message>) => {
    setMessages(prev => prev.map((m, i) =>
      i === prev.length - 1 && m.isGenerating ? { ...m, ...patch } : m
    ));
  }, []);

  const generate = useCallback(async (userMsg: string) => {
    if (!userMsg.trim() || isGenerating) return;

    // EDIT mode: any message when a tool already exists (with or without a specific element ref)
    const isEdit = Boolean(currentHTML);
    const now = new Date().toISOString();

    setMessages(prev => [...prev, { role: 'user', content: userMsg, at: now }]);
    setInput('');
    setElementRef(null);
    setIsGenerating(true);
    if (!toolName && !isEdit) setToolName(userMsg.charAt(0).toUpperCase() + userMsg.slice(1, 40));

    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '',
      at: new Date().toISOString(),
      isGenerating: true,
      charCount: 0,
    }]);

    streamBufferRef.current = '';

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: isEdit ? 'edit' : 'create',
          prompt: userMsg,
          // Always pass currentHTML when editing; pass elementRef only if user clicked one
          currentHTML: isEdit ? currentHTML : undefined,
          elementRef: isEdit ? (elementRef || null) : undefined,
        }),
      });

      // Surface API errors immediately
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API error ${res.status}: ${errText}`);
      }

      if (!res.body) throw new Error('No stream body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let charCount = 0;
      let lastUpdate = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        streamBufferRef.current += chunk;
        charCount += chunk.length;
        if (charCount - lastUpdate > 150) {
          lastUpdate = charCount;
          setMessages(prev => prev.map((m, i) =>
            i === prev.length - 1 && m.isGenerating ? { ...m, charCount } : m
          ));
        }
      }

      const finalHTML = streamBufferRef.current.trim();

      if (!finalHTML) {
        throw new Error('Empty response from AI — the model returned nothing. Check GEMINI_API_KEY.');
      }

      setCurrentHTML(finalHTML);
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 && m.isGenerating
          ? { ...m, isGenerating: false, content: isEdit ? 'Updated \u2713' : 'Tool built \u2713', charCount: undefined }
          : m
      ));

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[generate]', msg);
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 && m.isGenerating
          ? { ...m, isGenerating: false, content: `\u274C ${msg}`, error: true, charCount: undefined }
          : m
      ));
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, elementRef, currentHTML, toolName, updateLastAssistantMsg]);

  const deploy = useCallback(async () => {
    if (!currentHTML || isDeploying) return;
    setIsDeploying(true);
    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: toolName || 'My Tool',
          description: '',
          html: currentHTML,
          tags: [],
          promptHistory: messages.filter(m => !m.isGenerating),
          existingSlug: slug,
        }),
      });
      const data = await res.json();
      if (data.slug) {
        setSlug(data.slug);
        setDeployedUrl(data.url);
      } else if (data.error) {
        alert('Deploy failed: ' + data.error);
      }
    } catch (err) {
      console.error('[deploy]', err);
    } finally {
      setIsDeploying(false);
    }
  }, [currentHTML, isDeploying, toolName, messages, slug]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      generate(input);
    }
  };

  const SUGGESTIONS = [
    'A habit tracker for 5 daily goals',
    'A Pomodoro timer with custom intervals',
    'A tip calculator that splits between friends',
    'A password generator with strength meter',
  ];

  return (
    <div className="build-root">
      <ForgeBar
        toolName={toolName}
        onToolNameChange={setToolName}
        currentHTML={currentHTML}
        slug={slug}
        deployedUrl={deployedUrl}
        isDeploying={isDeploying}
        inspectMode={inspectMode}
        onInspectToggle={() => setInspectMode(m => !m)}
        onDeploy={deploy}
        onHistoryToggle={() => setShowHistory(h => !h)}
      />
      <div className="build-body">
        <aside className="chat-panel">
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-welcome">
                <span className="chat-welcome-icon">⚒</span>
                <p>Describe the tool you want to build</p>
                <ul className="chat-suggestions">
                  {SUGGESTIONS.map(s => (
                    <li key={s}>
                      <button onClick={() => generate(s)}>{s}</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg chat-msg-${m.role}`}>
                {m.role === 'user' ? (
                  <div className="chat-bubble user">{m.content}</div>
                ) : (
                  <div className={`chat-bubble assistant${m.isGenerating ? ' generating' : ''}${m.error ? ' error' : ''}`}>
                    {m.isGenerating ? (
                      <div className="generation-progress">
                        <div className="generation-progress-label">
                          <span className="generating-dots"><span/><span/><span/></span>
                          {' '}Building...
                        </div>
                        {(m.charCount ?? 0) > 0 && (
                          <div className="generation-progress-chars">{m.charCount?.toLocaleString()} chars written</div>
                        )}
                      </div>
                    ) : m.content}
                  </div>
                )}
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>

          {elementRef && (
            <div className="element-ref-indicator">
              <span>&#x25CE; Editing: {elementRef}</span>
              <button onClick={() => { setElementRef(null); setInput(''); }}>&#x2715;</button>
            </div>
          )}

          <div className="chat-input-area">
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder={
                elementRef ? 'Describe the change...'
                  : currentHTML ? 'Describe a change...'
                  : 'Describe the tool you want...'
              }
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              disabled={isGenerating}
            />
            <button
              className="chat-send"
              onClick={() => generate(input)}
              disabled={!input.trim() || isGenerating}
            >
              {isGenerating ? '\u2026' : '\u2191'}
            </button>
          </div>
        </aside>

        <main className={`preview-panel ${inspectMode ? 'inspect-active' : ''}`}>
          {inspectMode && (
            <div className="inspect-hud">
              <span className="inspect-hud-icon">&#x1F3AF;</span>
              <span className="inspect-hud-text"><strong>Inspect</strong> &mdash; click any element to edit it</span>
              <button className="inspect-hud-exit" onClick={() => setInspectMode(false)}>Exit</button>
            </div>
          )}
          <PreviewFrame
            html={currentHTML}
            isStreaming={isGenerating}
            inspectMode={inspectMode}
            onElementClick={handleElementClick}
          />
        </main>
      </div>

      {showHistory && (
        <div className="history-drawer">
          <div className="history-header">
            <h3>Prompt History</h3>
            <button onClick={() => setShowHistory(false)}>&#x2715;</button>
          </div>
          <div className="history-list">
            {messages.filter(m => m.role === 'user').map((m, i) => (
              <div key={i} className="history-item">
                <span className="history-index">#{i + 1}</span>
                <span className="history-text">{m.content}</span>
                <span className="history-time">{new Date(m.at).toLocaleTimeString()}</span>
              </div>
            ))}
            {messages.filter(m => m.role === 'user').length === 0 && (
              <p className="history-empty">No prompts yet</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BuildPageWrapper() {
  return (
    <Suspense fallback={<div style={{ background: '#0a0a0a', height: '100dvh' }} />}>
      <BuildPage />
    </Suspense>
  );
}
