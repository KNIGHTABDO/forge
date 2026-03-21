'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import ForgeBar from '@/components/ForgeBar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import StitchPanel, { StitchDesign } from '@/components/StitchPanel';

const PreviewFrame = dynamic(() => import('@/components/PreviewFrame'), { ssr: false });

interface PendingImage {
  data: string; // base64
  mimeType: string;
  previewUrl: string;
}

// Ensure SpeechRecognition is typed on window
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  at: string;
  isGenerating?: boolean;
  charCount?: number;
  error?: boolean;
  checkpointId?: string;
  mode?: 'fast' | 'plan' | 'build' | 'enhance' | 'chat';
}

// Generation steps shown in the thinking card
const GEN_STEPS_FAST = [
  { id: 'analyze', label: 'Analyzing prompt' },
  { id: 'architect', label: 'Designing structure' },
  { id: 'generate', label: 'Writing code' },
  { id: 'polish', label: 'Polishing result' },
];
const GEN_STEPS_PLAN = [
  { id: 'analyze', label: 'Analyzing requirements' },
  { id: 'architect', label: 'Designing architecture' },
  { id: 'features', label: 'Mapping features & data' },
  { id: 'steps', label: 'Writing implementation steps' },
];
const GEN_STEPS_BUILD = [
  { id: 'read', label: 'Reading approved plan' },
  { id: 'scaffold', label: 'Scaffolding structure' },
  { id: 'implement', label: 'Implementing features' },
  { id: 'polish', label: 'Polishing & testing' },
];
const GEN_STEPS_ENHANCE = [
  { id: 'analyze', label: 'Analyzing project state' },
  { id: 'context', label: 'Gathering file context' },
  { id: 'enhance', label: 'Expanding architecture' },
  { id: 'multi', label: 'Generating multi-page code' },
];

function ThinkingCard({ charCount, mode }: { charCount: number; mode: 'fast' | 'plan' | 'build' | 'enhance' }) {
  const steps = mode === 'plan' ? GEN_STEPS_PLAN : mode === 'build' ? GEN_STEPS_BUILD : mode === 'enhance' ? GEN_STEPS_ENHANCE : GEN_STEPS_FAST;
  const progress = Math.min(charCount / 8000, 1);
  const stepIndex = Math.min(Math.floor(progress * steps.length), steps.length - 1);

  return (
    <div className="generation-card">
      <div className="gen-card-progress-bar">
        <div className="gen-card-progress-fill" style={{ width: `${Math.max(progress * 100, 8)}%` }} />
      </div>
      <div className="generation-card-header">
        <div className="gen-card-spinner" />
        <span className="gen-card-current-label">{steps[stepIndex].label}</span>
        {charCount > 0 && (
          <span className="gen-card-charcount">{charCount.toLocaleString()} chars</span>
        )}
      </div>
      <div className="gen-card-steps">
        {steps.map((step, i) => {
          const isDone = i < stepIndex;
          const isActive = i === stepIndex;
          return (
            <div key={step.id} className={`gen-step${isDone ? ' done' : ''}${isActive ? ' active' : ''}`}>
              <div className="gen-step-icon">
                {isDone ? '✓' : null}
              </div>
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
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
  
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [generationMode, setGenerationMode] = useState<'fast' | 'plan' | 'build' | 'chat' | 'enhance'>('fast');
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [planContent, setPlanContent] = useState('');
  const [planApproved, setPlanApproved] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [mobileTab, setMobileTab] = useState<'chat' | 'preview'>('chat');

  // Stitch Design AI
  const [showStitchPanel, setShowStitchPanel] = useState(false);
  const [selectedStitchDesign, setSelectedStitchDesign] = useState<StitchDesign | null>(null);
  const [projectFiles, setProjectFiles] = useState<{ path: string, content: string }[]>([]);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const streamBufferRef = useRef('');

  useEffect(() => {
    if (loadSlug) return;
    const initSession = async () => {
      let sId = localStorage.getItem('forge-session-id');
      if (!sId) {
        sId = 'sess_' + Math.random().toString(36).substring(2, 10);
        localStorage.setItem('forge-session-id', sId);
      }
      setSessionId(sId);
      try {
        const res = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'load', sessionId: sId })
        });
        const data = await res.json();
        if (data.state) {
          if (data.state.messages) setMessages(data.state.messages);
          if (data.state.planContent) setPlanContent(data.state.planContent);
          if (data.state.currentHTML) setCurrentHTML(data.state.currentHTML);
          if (data.state.mode) setGenerationMode(data.state.mode);
          if (data.state.toolName) setToolName(data.state.toolName);
          if (data.state.planApproved) setPlanApproved(data.state.planApproved);
          if (data.state.projectFiles) setProjectFiles(data.state.projectFiles);
        }
      } catch (e) { console.error('Failed to load session', e); }
    };
    initSession();
  }, [loadSlug]);

  useEffect(() => {
    if (!sessionId || isGenerating || !messages.length) return;
    const t = setTimeout(async () => {
      // Avoid auto-saving if the generation just finished and should have triggered its own save/checkpoint
      try {
        await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save',
            sessionId,
            state: { messages, planContent, currentHTML, mode: generationMode, toolName, planApproved, projectFiles }
          })
        });
      } catch (e) {
        console.error('Save session failed', e);
      }
    }, 2500); // Increased debounce to stay clear of checkpoint saves
    return () => clearTimeout(t);
  }, [messages, planContent, currentHTML, generationMode, toolName, sessionId, isGenerating, projectFiles]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.__forge_nav) {
        const targetPath = e.data.__forge_nav.replace(/^\//, '');
        // Search in projectFiles (case-insensitive, handling potential relative paths)
        const file = projectFiles.find(f => {
            const path = f.path.toLowerCase();
            const target = targetPath.toLowerCase();
            return path === target || path.endsWith('/' + target) || path === `tools/${slug}/${target}`.toLowerCase();
        });
        if (file) {
          setCurrentHTML(file.content);
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [projectFiles, slug]);

  useEffect(() => {
    // Setup Speech Recognition on mount
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e: any) => {
        let finalTrans = '';
        let interimTrans = '';
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          if (e.results[i].isFinal) finalTrans += e.results[i][0].transcript;
          else interimTrans += e.results[i][0].transcript;
        }
        if (finalTrans) setInput(prev => prev + ' ' + finalTrans.trim());
      };
      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
    }
  }, []);

  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setInput('');
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) {
        alert('Please attach an image.');
        return;
    }
    const reader = new FileReader();
    reader.onload = (re) => {
      const rawRes = re.target?.result as string;
      if (rawRes) {
        setPendingImages(prev => [...prev, {
            data: rawRes.split(',')[1],
            mimeType: file.type,
            previewUrl: rawRes
        }]);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // reset
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.indexOf('image/') === 0) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (re) => {
            const rawRes = re.target?.result as string;
            setPendingImages(prev => [...prev, {
                data: rawRes.split(',')[1],
                mimeType: file.type,
                previewUrl: rawRes
            }]);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

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
    setInput(ref + ' → ');
    setInspectMode(false);
    inputRef.current?.focus();
  }, []);

  const generate = useCallback(async (userMsg: string, overrideMode?: 'fast' | 'plan' | 'build' | 'chat' | 'enhance') => {
    if ((!userMsg.trim() && pendingImages.length === 0) || isGenerating) return;

    const activeMode = overrideMode || generationMode;

    // Build mode guard: must have an approved plan, BUT skip if tool is already built
    if (activeMode === 'build' && !currentHTML && (!planContent || (!planApproved && overrideMode !== 'build'))) {
      setMessages(prev => [...prev, 
        { role: 'user', content: userMsg, at: new Date().toISOString() },
        { role: 'assistant', content: planContent ? '❌ Plan not approved yet. Please approve your plan first, then switch to Build mode.' : '❌ No plan exists. Please switch to Plan mode first and create a blueprint.', at: new Date().toISOString(), error: true }
      ]);
      setInput('');
      return;
    }

    // Edit flow: if we already have HTML (in any mode), treat as edit
    const isEdit = Boolean(currentHTML) && activeMode !== 'plan' && activeMode !== 'chat' && activeMode !== 'enhance';
    // Only send plan context for the FIRST build (no HTML yet)
    const shouldSendPlan = activeMode === 'build' && !currentHTML && planContent;
    const now = new Date().toISOString();

    const snapshotImages = [...pendingImages];
    if (typeof window !== 'undefined' && window.innerWidth <= 1024 && activeMode !== 'chat' && activeMode !== 'plan') {
      setMobileTab('preview');
    }
    const attachLabel = snapshotImages.length > 0 ? ` [Attached ${snapshotImages.length} image(s)]` : '';
    
    // Use a local array to keep track of messages synchronously within this turn
    // This avoids stale closure issues with the 'messages' state variable
    let turnMessages = [...messages];
    const userMsgObj: Message = { role: 'user', content: userMsg + attachLabel, at: now };
    turnMessages.push(userMsgObj);
    
    setMessages(turnMessages);
    setInput('');
    setPendingImages([]);
    setElementRef(null);
    setIsGenerating(true);
    if (!toolName && !isEdit) setToolName(userMsg.charAt(0).toUpperCase() + userMsg.slice(1, 40));

    const assistantTimestamp = new Date().toISOString();
    const assistantPlaceholder: Message = {
      role: 'assistant',
      content: '',
      at: assistantTimestamp,
      isGenerating: true,
      charCount: 0,
      mode: activeMode,
    };
    turnMessages = [...turnMessages, assistantPlaceholder];
    setMessages(turnMessages);

    streamBufferRef.current = '';
    let streamError = false;
    let lastUpdate = 0;
    try {
      const isEnhance = activeMode === 'enhance';
      const apiUrl = isEnhance ? '/api/enhance' : '/api/generate';
      const fetchBody = isEnhance ? {
        prompt: userMsg,
        currentHTML,
        stitchDesign: selectedStitchDesign || undefined,
        slug: slug || undefined,
      } : {
        mode: isEdit ? 'edit' : 'create',
        prompt: userMsg,
        currentHTML: (isEdit || activeMode === 'chat') ? currentHTML : undefined,
        elementRef: isEdit ? (elementRef || null) : undefined,
        images: snapshotImages.map(img => ({ data: img.data, mimeType: img.mimeType })),
        generationMode: shouldSendPlan ? 'build' : (activeMode === 'fast' && !isEdit ? 'plan' : activeMode),
        planContext: (shouldSendPlan || activeMode === 'plan' || activeMode === 'chat') ? planContent : undefined,
        chatHistory: messages.map(m => ({ role: m.role, content: m.content })),
        stitchDesign: selectedStitchDesign || undefined,
      };

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fetchBody),
      });

      if (!res.ok) throw new Error('API Error: ' + res.statusText);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No reader found');

      let charCount = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          streamBufferRef.current += chunk;
          charCount += chunk.length;
          const threshold = (activeMode === 'chat' || activeMode === 'plan') ? 20 : 120;
          if (charCount - lastUpdate > threshold) {
            lastUpdate = charCount;
            setMessages(prev => prev.map((m, i) =>
              i === prev.length - 1 && m.isGenerating ? { ...m, charCount, content: (activeMode === 'chat' || activeMode === 'plan') ? streamBufferRef.current : m.content } : m
            ));
          }
        }
      } catch (streamErr) {
        console.error('[stream read error]', streamErr);
        streamError = true;
        // Continue — we'll use whatever content we received so far
      }

      const finalContent = streamBufferRef.current.trim();
      if (!finalContent) throw new Error('Empty response from AI — check GEMINI_API_KEY.');

      // PARSE MULTI-FILE OUTPUT if in Enhance mode
      if (activeMode === 'enhance') {
        const files: { path: string, content: string }[] = [];
        const fileRegex = /<file\s+path=["']([^"']+)["']>\s*([\s\S]*?)<\/file>/gi;
        let match;
        while ((match = fileRegex.exec(finalContent)) !== null) {
          files.push({ path: match[1], content: match[2].trim() });
        }
        if (files.length > 0) {
          setProjectFiles(files);
          const indexFile = files.find(f => f.path.toLowerCase().endsWith('index.html')) || files[0];
          setCurrentHTML(indexFile.content);
        } else {
          // Fallback: if no tags found, treat as single HTML
          setCurrentHTML(finalContent);
        }
      }

      const isRefusal = finalContent.includes('[STRICT_REFUSAL]');
      let nextPhase = false;

      if (!isRefusal) {
        if (activeMode === 'plan') {
          setPlanContent(finalContent);
          setPlanApproved(false);
        } else if (activeMode === 'fast' && !isEdit) {
           // This was an automatic plan phase for Fast mode
           setPlanContent(finalContent);
           setPlanApproved(true);
           nextPhase = true;
        } else if (activeMode === 'enhance') {
          // Handled above in multi-file parsing
          // We don't want to overwrite currentHTML with the raw tagged string
        } else if (activeMode !== 'chat') {
          setCurrentHTML(finalContent);
        }
      }

      const suffix = streamError ? ' (partial — network interrupted)' : '';
      setMessages(prev => prev.map((m, i) => {
        if (i !== prev.length - 1 || !m.isGenerating) return m;
        let finalMessage = '';
        if (activeMode === 'chat' || isRefusal) {
          finalMessage = (finalContent.replace('[STRICT_REFUSAL]', '').trim()) + suffix;
        } else if (activeMode === 'plan') {
          finalMessage = `✓ Plan created! Review it on the right and approve to continue.${suffix}`;
        } else if (activeMode === 'fast' && !isEdit) {
          finalMessage = `✓ Tech Blueprint ready. Now building your app...${suffix}`;
        } else {
          finalMessage = isEdit ? `✓ Updated${suffix}` : `✓ Tool built${suffix}`;
        }
        return { ...m, isGenerating: false, content: finalMessage, charCount: undefined };
      }));

      // AUTO-CONTINUE to build phase if we just finished automatic planning
      if (nextPhase && !isRefusal) {
        setTimeout(() => {
           generate(userMsg, 'build');
        }, 800);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 && m.isGenerating
          ? { ...m, isGenerating: false, content: `❌ ${msg}`, error: true, charCount: undefined }
          : m
      ));
    } finally {
      setIsGenerating(false);
      // Create a checkpoint after generation using the synchronously reconstructed state
      if (sessionId && !streamError) {
        const finalContent = streamBufferRef.current.trim();
        const isRefusal = finalContent.includes('[STRICT_REFUSAL]');
        const suffix = streamError ? ' (partial — network interrupted)' : '';
        let finalAssistantContent = '';
        
        if (activeMode === 'chat' || isRefusal) {
          finalAssistantContent = (finalContent.replace('[STRICT_REFUSAL]', '').trim()) + suffix;
        } else if (activeMode === 'plan') {
          finalAssistantContent = `✓ Plan created! Review it on the right and approve to continue.${suffix}`;
        } else {
          finalAssistantContent = isEdit ? `✓ Updated${suffix}` : `✓ Tool built${suffix}`;
        }

        // Construct the definite final messages list for the checkpoint
        const finalTurnMessages = turnMessages.map(m => 
          m.at === assistantTimestamp ? { ...m, isGenerating: false, content: finalAssistantContent, charCount: undefined } : m
        );

        const finalState = {
          messages: finalTurnMessages,
          planContent: (activeMode === 'plan' && !isRefusal) ? finalContent : planContent,
          currentHTML: (activeMode !== 'chat' && activeMode !== 'plan' && !isRefusal) ? finalContent : currentHTML,
          mode: generationMode,
          toolName: toolName || (userMsg.charAt(0).toUpperCase() + userMsg.slice(1, 40)),
          planApproved,
          projectFiles,
          sessionId
        };

        console.log(`[checkpoint] Saving state with ${finalTurnMessages.length} messages`);
        fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'checkpoint', sessionId, state: finalState })
        }).then(r => r.json()).then(data => {
          if (data.checkpointId) {
            setMessages(prev => prev.map(m => m.at === assistantTimestamp ? { ...m, checkpointId: data.checkpointId } : m));
          }
        }).catch(e => console.error('Failed to save checkpoint', e));
      }
    }
  }, [isGenerating, elementRef, currentHTML, toolName, pendingImages, generationMode, planContent, planApproved, sessionId, messages, selectedStitchDesign]);

  const restoreToCheckpoint = useCallback(async (cpId: string) => {
    if (!sessionId) return;
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load', sessionId, checkpointId: cpId })
      });
      const data = await res.json();
      if (data.state) {
        setMessages(data.state.messages);
        setPlanContent(data.state.planContent);
        setCurrentHTML(data.state.currentHTML);
        setGenerationMode(data.state.mode);
        setToolName(data.state.toolName);
        setPlanApproved(data.state.planApproved);
        setProjectFiles(data.state.projectFiles || []);
        setInput('');
        
        // Explicitly save the session after restoration to ensure persistence on refresh
        fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save', sessionId, state: data.state })
        }).catch(e => console.error('Immediate save after restore failed', e));
      }
    } catch (e) {
      console.error('Failed to restore checkpoint', e);
      alert('Failed to restore checkpoint');
    }
  }, [sessionId]);

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
          files: projectFiles.length > 0 ? projectFiles : undefined,
          tags: [],
          promptHistory: messages.filter(m => !m.isGenerating),
          existingSlug: slug,
        }),
      });
      const data = await res.json();
      if (data.slug) { setSlug(data.slug); setDeployedUrl(data.url); }
      else if (data.error) alert('Deploy failed: ' + data.error);
    } catch (err) {
      console.error('[deploy]', err);
    } finally {
      setIsDeploying(false);
    }
  }, [currentHTML, isDeploying, toolName, messages, slug]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generate(input); }
  };

  const removeImage = (index: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index));
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

      {/* ─── Mobile Tab Toggle (visible only on mobile) ─── */}
      <div className="mobile-tab-toggle">
        <button 
          className={`mobile-tab-btn ${mobileTab === 'chat' ? 'active' : ''}`}
          onClick={() => setMobileTab('chat')}
        >
          {generationMode === 'plan' ? 'Plan' : 'Chat'}
        </button>
        <button 
          className={`mobile-tab-btn ${mobileTab === 'preview' ? 'active' : ''}`}
          onClick={() => setMobileTab('preview')}
        >
          Preview
        </button>
      </div>

      <div className={`build-body mobile-show-${mobileTab}`}>
         <aside className="chat-panel">
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-welcome">
                <h3>What are we building?</h3>
                <p>Describe your tool below and Forge will generate it instantly.</p>
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
              <div key={i} className={`chat-msg chat-msg-${m.role} group`} style={{ position: 'relative' }}>
                {m.role === 'user' ? (
                  <div className="chat-bubble user">{m.content}</div>
                ) : (
                  <div className={`chat-bubble assistant${m.error ? ' error' : ''}`}>
                    {m.isGenerating && m.mode !== 'chat' ? (
                      <ThinkingCard charCount={m.charCount ?? 0} mode={(m.mode as any) || generationMode} />
                    ) : (
                      <div className="chat-bubble-content-wrap">
                        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{m.content}</div>
                        
                        {!m.isGenerating && !m.error && generationMode === 'chat' && i === messages.length - 1 && (
                          <div className="chat-quick-actions">
                            <button 
                              onClick={() => {
                                setGenerationMode('plan');
                                setPlanApproved(false);
                                generate("Let's create a detailed plan based on our discussion.", 'plan');
                              }}
                              className="chat-quick-btn"
                            >
                              <span>📝</span> Start Planning
                            </button>
                            <button 
                              onClick={() => {
                                setGenerationMode('fast');
                                generate("Build a tool based on our brainstorming.", 'fast');
                              }}
                              className="chat-quick-btn chat-quick-btn-primary"
                            >
                              <span>⚡</span> Build Instantly
                            </button>
                          </div>
                        )}

                        {m.checkpointId && !m.isGenerating && (
                          <div className="chat-msg-actions">
                            <button 
                              onClick={() => restoreToCheckpoint(m.checkpointId!)}
                              className="restore-btn"
                              title="Restore state to this point"
                            >
                              ↺ Restore
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>

          {elementRef && (
            <div className="element-ref-indicator">
              <span>◎ Editing: {elementRef}</span>
              <button onClick={() => { setElementRef(null); setInput(''); }}>&#x2715;</button>
            </div>
          )}

          <div className="chat-input-area">
            <div className="chat-input-box-wrap">
              <div className="chat-input-box">
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                {pendingImages.length > 0 && (
                  <div className="chat-image-previews">
                    {pendingImages.map((img, i) => (
                      <div key={i} className="chat-image-preview">
                        <img src={img.previewUrl} alt="attachment" />
                        <button className="chat-image-preview-rm" onClick={() => removeImage(i)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <textarea
                  ref={inputRef}
                  className="chat-input"
                  placeholder={
                    generationMode === 'plan' ? 'Describe the architecture and features...'
                      : generationMode === 'build' && planContent ? 'Build it using the plan!'
                      : generationMode === 'chat' ? 'Ask a question or brainstorm...'
                      : elementRef ? 'Describe the change...'
                      : currentHTML ? 'Describe a change...'
                      : 'Describe the tool you want...'
                  }
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  rows={2}
                  disabled={isGenerating}
                />
                <div className="chat-input-actions">
                  <div className="chat-input-left">
                    <div className="mode-dropdown-container">
                      {isModeMenuOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setIsModeMenuOpen(false)} />}
                      <button 
                        className="mode-dropdown-btn" 
                        onClick={() => setIsModeMenuOpen(!isModeMenuOpen)} 
                        type="button"
                      >
                        <span>{generationMode === 'fast' ? 'Fast' : generationMode === 'plan' ? 'Planning' : generationMode === 'chat' ? 'Chat' : generationMode === 'enhance' ? 'Enhance' : 'Build'}</span>
                      </button>
                      
                      {isModeMenuOpen && (
                        <div className="mode-dropdown-menu">
                          {currentHTML ? (
                            <button type="button" className={`mode-dropdown-item ${generationMode === 'fast' ? 'active' : ''}`} onClick={() => { setGenerationMode('fast'); setIsModeMenuOpen(false); }}>
                              <div className="mode-dropdown-item-title">⚡ Edit</div>
                              <div className="mode-dropdown-item-desc">Apply quick targeted updates.</div>
                            </button>
                          ) : (
                            <>
                              <button type="button" className={`mode-dropdown-item ${generationMode === 'fast' ? 'active' : ''}`} onClick={() => { setGenerationMode('fast'); setIsModeMenuOpen(false); }}>
                                <div className="mode-dropdown-item-title">⚡ Fast</div>
                                <div className="mode-dropdown-item-desc">Generate instantly from your prompt.</div>
                              </button>
                              
                              <button type="button" className={`mode-dropdown-item ${generationMode === 'plan' ? 'active' : ''}`} onClick={() => { setGenerationMode('plan'); setIsModeMenuOpen(false); }}>
                                <div className="mode-dropdown-item-title">📋 Planning</div>
                                <div className="mode-dropdown-item-desc">Create a blueprint before building.</div>
                              </button>
                            </>
                          )}

                          {planContent && !currentHTML && (
                            <button type="button" className={`mode-dropdown-item ${generationMode === 'build' ? 'active' : ''}`} onClick={() => { setGenerationMode('build'); setIsModeMenuOpen(false); }}>
                              <div className="mode-dropdown-item-title">🏗️ Build</div>
                              <div className="mode-dropdown-item-desc">Execute the approved blueprint.</div>
                            </button>
                          )}
                          
                          {currentHTML && (
                            <button type="button" className={`mode-dropdown-item ${generationMode === 'enhance' ? 'active' : ''}`} onClick={() => { setGenerationMode('enhance'); setIsModeMenuOpen(false); }}>
                              <div className="mode-dropdown-item-title">✨ Enhance <span className="beta-badge">BETA</span></div>
                              <div className="mode-dropdown-item-desc">Expand into multi-page (GitHub Models).</div>
                            </button>
                          )}

                          <button type="button" className={`mode-dropdown-item ${generationMode === 'chat' ? 'active' : ''}`} onClick={() => { setGenerationMode('chat'); setIsModeMenuOpen(false); }}>
                            <div className="mode-dropdown-item-title">💬 Chat</div>
                            <div className="mode-dropdown-item-desc">Brainstorm and technical Q&A.</div>
                          </button>
                        </div>
                      )}
                    </div>
                    <button className="chat-input-icon-btn" title="Attach image" onClick={() => fileInputRef.current?.click()} type="button">＋</button>
                    <button className={`chat-input-icon-btn ${isListening ? 'listening' : ''}`} title="Voice input" onClick={toggleVoice} type="button" style={{ color: isListening ? '#f43f5e' : undefined }}>{isListening ? '🎙️' : '🎙'}</button>
                    <button
                      className={`chat-input-icon-btn stitch-toggle-btn ${showStitchPanel ? 'active' : ''} ${selectedStitchDesign ? 'has-design' : ''}`}
                      title={selectedStitchDesign ? 'Stitch Design Active — click to manage' : 'Generate UI designs with Stitch AI'}
                      onClick={() => setShowStitchPanel(v => !v)}
                      type="button"
                    >
                      🎨
                      {selectedStitchDesign && <span className="stitch-dot-indicator" />}
                    </button>
                  </div>
                  <button
                    className="chat-send"
                    onClick={() => generate(input)}
                    disabled={(!input.trim() && pendingImages.length === 0) || isGenerating}
                    title="Send (Enter)"
                  >
                    {isGenerating ? '…' : '↑'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ─── Preview Panel ─── */}
        <main className={`preview-panel ${inspectMode ? 'inspect-active' : ''}`}>
          {((generationMode === 'plan' || generationMode === 'build' || generationMode === 'fast') && planContent && !currentHTML) ? (
            <div className="plan-frame-wrapper">
              {!planApproved && !currentHTML && (
                <div className="plan-approval-bar">
                  <span>📋 Review the blueprint below</span>
                  <div className="plan-approval-actions">
                    <button className="plan-approve-btn" onClick={() => {
                      setPlanApproved(true);
                      setGenerationMode('build');
                      generate("The plan is excellent. Please start the build now.", 'build');
                    }}>✓ Approve &amp; Build</button>
                    <button className="plan-edit-btn" onClick={() => {
                      setPlanApproved(false);
                      setMessages(prev => [...prev, { role: 'assistant', content: '📝 Describe what you want changed in the plan. The AI will revise it with your feedback.', at: new Date().toISOString() }]);
                    }}>✎ Request Changes</button>
                  </div>
                </div>
              )}
              {(planApproved || isGenerating) && !currentHTML && (
                <div className="plan-approval-bar approved">
                  <span>{isGenerating ? '🏗️ Architect is executing the plan...' : '✅ Plan approved — ready to build'}</span>
                </div>
              )}
              <div className="plan-frame-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {planContent}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <>
              {inspectMode && (
                <div className="inspect-hud">
                  <span className="inspect-hud-icon">🎯</span>
                  <span className="inspect-hud-text"><strong>Inspect</strong> &mdash; click any element to edit it</span>
                  <button className="inspect-hud-exit" onClick={() => setInspectMode(false)}>Exit</button>
                </div>
              )}
              <PreviewFrame
                html={currentHTML}
                isStreaming={isGenerating}
                inspectMode={inspectMode}
                onElementClick={handleElementClick}
                mode={messages[messages.length - 1]?.mode || generationMode}
              />
            </>
          )}
        </main>
      </div>

      {showHistory && (
        <div className="history-drawer">
          <div className="history-header">
            <h3>Sessions &amp; History</h3>
            <button onClick={() => setShowHistory(false)}>&#x2715;</button>
          </div>
          <div className="history-list">
            {/* Session management */}
            <div className="history-session-info">
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                Session: {sessionId || 'none'}
              </span>
            </div>
            <button
              className="history-new-session-btn"
              onClick={() => {
                localStorage.removeItem('forge-session-id');
                const newSId = 'sess_' + Math.random().toString(36).substring(2, 10);
                localStorage.setItem('forge-session-id', newSId);
                setSessionId(newSId);
                setMessages([]);
                setCurrentHTML('');
                setPlanContent('');
                setPlanApproved(false);
                setToolName('');
                setSlug(undefined);
                setDeployedUrl(undefined);
                setGenerationMode('fast');
                setShowHistory(false);
                setShowStitchPanel(false);
                setSelectedStitchDesign(null);
                // Clear Stitch from backend as well
                fetch('/api/stitch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'clear' }) }).catch(console.error);
              }}
            >
              + New Session
            </button>

            {/* Prompt history */}
            {messages.filter(m => m.role === 'user').length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8, fontWeight: 600 }}>PROMPTS</div>
                {messages.filter(m => m.role === 'user').map((m, i) => (
                  <div key={i} className="history-item">
                    <span className="history-index">#{i + 1}</span>
                    <span className="history-text">{m.content}</span>
                    <span className="history-time">{new Date(m.at).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            )}
            {messages.filter(m => m.role === 'user').length === 0 && (
              <p className="history-empty">No prompts yet</p>
            )}
          </div>
        </div>
      )}

      {/* Stitch Design Panel */}
      <StitchPanel
        key={sessionId || 'empty'}
        isOpen={showStitchPanel}
        onClose={() => setShowStitchPanel(false)}
        onSelectDesign={(design) => {
          setSelectedStitchDesign(design);
          if (design && generationMode === 'fast') {
            setGenerationMode('plan');
          }
        }}
        selectedDesign={selectedStitchDesign}
        lastPrompt={messages.filter(m => m.role === 'user').slice(-1)[0]?.content}
      />
    </div>
  );
}

export default function BuildPageWrapper() {
  return (
    <Suspense fallback={<div style={{ background: 'var(--bg-void)', height: '100dvh' }} />}>
      <BuildPage />
    </Suspense>
  );
}
