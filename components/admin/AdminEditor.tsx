'use client';

import React, { useState, useEffect, useRef } from 'react';

interface AdminEditorProps {
  slug: string;
  onClose: () => void;
  onSave: () => void;
}

export default function AdminEditor({ slug, onClose, onSave }: AdminEditorProps) {
  const [html, setHtml] = useState('');
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [remakePrompt, setRemakePrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'meta'>('code');

  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchData();
  }, [slug]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tool-details/${slug}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setHtml(data.html);
      setMeta(data.meta);
    } catch (err) {
      alert('Failed to fetch tool: ' + err);
      onClose();
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/tool-details/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, meta }),
      });
      if (!res.ok) throw new Error('Save failed');
      alert('Saved successfully!');
      onSave();
    } catch (err) {
      alert('Error saving: ' + err);
    }
    setSaving(false);
  };

  const handleAiRemake = async () => {
    if (!remakePrompt || isGenerating) return;
    setIsGenerating(true);
    
    // We'll stream into current HTML or a temporary variable
    let accum = '';
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: remakePrompt,
          currentHTML: html,
          mode: 'edit',
          generationMode: 'fast'
        }),
      });

      if (!response.ok) throw new Error('Generation failed');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        accum += chunk;
        setHtml(accum);
      }
      
      // Update prompt history in meta
      const newHistory = [...(meta.promptHistory || [])];
      newHistory.push({ role: 'user', content: `[Admin Remake] ${remakePrompt}`, at: new Date().toISOString() });
      setMeta({ ...meta, promptHistory: newHistory });
      setRemakePrompt('');

    } catch (err) {
      alert('AI error: ' + err);
    }
    setIsGenerating(false);
  };

  if (loading) return <div className="admin-editor-overlay">Loading Tool...</div>;

  return (
    <div className="admin-editor-overlay">
      <div className="admin-editor-container">
        <div className="admin-editor-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h2>Editing: {slug}</h2>
            <div className="admin-editor-tabs">
              <button 
                className={activeTab === 'code' ? 'active' : ''} 
                onClick={() => setActiveTab('code')}
              >Code</button>
              <button 
                className={activeTab === 'meta' ? 'active' : ''} 
                onClick={() => setActiveTab('meta')}
              >Metadata / Organization</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="action-btn" onClick={onClose}>Cancel</button>
            <button className="admin-btn" style={{ padding: '8px 24px' }} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Commit Changes'}
            </button>
          </div>
        </div>

        <div className="admin-editor-body">
          {activeTab === 'code' ? (
            <div style={{ display: 'flex', gap: '20px', height: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <textarea
                  ref={editorRef}
                  className="admin-input"
                  style={{ 
                    flex: 1, 
                    fontFamily: 'var(--font-mono)', 
                    fontSize: '13px', 
                    whiteSpace: 'pre',
                    resize: 'none',
                    lineHeight: '1.5',
                    background: '#000',
                    border: '1px solid var(--border-subtle)'
                  }}
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                />
              </div>

              {/* AI Remake Sidebar */}
              <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="admin-glass-panel" style={{ padding: '16px' }}>
                  <h4 style={{ marginBottom: '12px' }}>AI Remake / Morph</h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>
                    Describe how the tool should change. The AI will rewrite the HTML in real-time.
                  </p>
                  <textarea
                    className="admin-input"
                    placeholder="e.g. Add a dark mode toggle and make it more responsive..."
                    style={{ minHeight: '100px', fontSize: '13px', marginBottom: '12px' }}
                    value={remakePrompt}
                    onChange={(e) => setRemakePrompt(e.target.value)}
                  />
                  <button 
                    className="admin-btn" 
                    style={{ width: '100%', fontSize: '13px' }} 
                    onClick={handleAiRemake}
                    disabled={isGenerating || !remakePrompt}
                  >
                    {isGenerating ? 'Morphing...' : 'Start AI Remake'}
                  </button>
                </div>

                <div className="admin-glass-panel" style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
                  <h4 style={{ marginBottom: '12px', fontSize: '13px' }}>History</h4>
                  {(meta?.promptHistory || []).slice().reverse().map((p: any, i: number) => (
                    <div key={i} style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      <strong>{p.role.toUpperCase()}</strong>: {p.content}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Title</label>
                <input className="admin-input" value={meta?.title || ''} onChange={(e) => setMeta({...meta, title: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Description</label>
                <textarea className="admin-input" rows={3} value={meta?.description || ''} onChange={(e) => setMeta({...meta, description: e.target.value})} />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Project</label>
                  <input className="admin-input" placeholder="e.g. Client X" value={meta?.project || ''} onChange={(e) => setMeta({...meta, project: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Folder / Category</label>
                  <input className="admin-input" placeholder="e.g. Dashboard Widgets" value={meta?.folder || ''} onChange={(e) => setMeta({...meta, folder: e.target.value})} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Tags (comma separated)</label>
                <input className="admin-input" value={meta?.tags?.join(', ') || ''} onChange={(e) => setMeta({...meta, tags: e.target.value.split(',').map((s: string) => s.trim())})} />
              </div>
            </div>
          )}
        </div>
      </div>
      
      <style jsx>{`
        .admin-editor-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(10px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
        }
        .admin-editor-container {
          background: var(--bg-surface);
          border: 1px solid var(--border-strong);
          border-radius: var(--r-xl);
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 0 100px rgba(0,0,0,0.5);
        }
        .admin-editor-header {
          padding: 20px 32px;
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(0,0,0,0.2);
        }
        .admin-editor-tabs {
          display: flex;
          background: var(--bg-elevated);
          padding: 4px;
          border-radius: var(--r-md);
          gap: 4px;
        }
        .admin-editor-tabs button {
          background: none;
          border: none;
          color: var(--text-tertiary);
          padding: 6px 16px;
          border-radius: var(--r-sm);
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s ease;
        }
        .admin-editor-tabs button.active {
          background: var(--bg-highlight);
          color: var(--text-primary);
        }
        .admin-editor-body {
          flex: 1;
          padding: 32px;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
