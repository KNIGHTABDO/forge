'use client';

import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import AdminEditor from '@/components/admin/AdminEditor';

export default function AdminPage() {
  const { isAuthenticated, login, logout } = useAdminAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [tools, setTools] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'tools') fetchTools();
      if (activeTab === 'sessions') fetchSessions();
    }
  }, [isAuthenticated, activeTab]);

  const fetchTools = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/tools');
      const data = await res.json();
      // Handle the case where tool details might not be in index.json but in tools/slug/forge.json
      // For now we trust getGalleryIndex which we updated to include more meta if we want
      setTools(data.tools || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/sessions');
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const deleteTool = async (slug: string) => {
    if (!confirm(`Are you sure you want to delete tool: ${slug}?`)) return;
    try {
      await fetch(`/api/admin/tools?slug=${slug}`, { method: 'DELETE' });
      fetchTools();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm(`Are you sure you want to delete session: ${sessionId}?`)) return;
    try {
      await fetch(`/api/admin/sessions?sessionId=${sessionId}`, { method: 'DELETE' });
      fetchSessions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!login(password)) {
      setError('Invalid passkey. Access denied.');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="admin-login-container">
        <form className="admin-login-card" onSubmit={handleLogin}>
          <div>
            <h1>Admin Protocol</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Authenticate to access the Forge Core
            </p>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
            <input
              type="password"
              className="admin-input"
              placeholder="Enter Access Key..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {error && <span style={{ color: '#ef4444', fontSize: '12px' }}>{error}</span>}
          </div>

          <button type="submit" className="admin-btn">
            Unlock Core
          </button>
        </form>
      </div>
    );
  }

  // Group tools by project/folder for better organization
  const groupedTools = tools.reduce((acc: any, tool: any) => {
    const proj = tool.project || 'Uncategorized';
    if (!acc[proj]) acc[proj] = [];
    acc[proj].push(tool);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      {editingSlug && (
        <AdminEditor 
          slug={editingSlug} 
          onClose={() => setEditingSlug(null)} 
          onSave={() => {
            setEditingSlug(null);
            fetchTools();
          }} 
        />
      )}

      {/* Sidebar */}
      <div className="admin-sidebar">
        <div className="admin-sidebar-header">
          <span>FORGE CORE</span>
        </div>
        
        <div 
          className={`sidebar-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </div>
        <div 
          className={`sidebar-nav-item ${activeTab === 'tools' ? 'active' : ''}`}
          onClick={() => setActiveTab('tools')}
        >
          Manage Tools
        </div>
        <div 
          className={`sidebar-nav-item ${activeTab === 'sessions' ? 'active' : ''}`}
          onClick={() => setActiveTab('sessions')}
        >
          Manage Sessions
        </div>
        <div 
          className={`sidebar-nav-item ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveTab('projects')}
        >
          Projects & Folders
        </div>

        <div style={{ marginTop: 'auto', padding: '0 24px' }}>
          <button 
            onClick={logout}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--text-tertiary)', 
              cursor: 'pointer',
              fontSize: '13px',
              fontFamily: 'inherit',
              width: '100%',
              textAlign: 'left',
              padding: '12px 0'
            }}
          >
            ← Disconnect
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="admin-main">
        <div className="admin-header">
          <h2>
            {activeTab === 'dashboard' && 'System Overview'}
            {activeTab === 'tools' && 'Tool Registry'}
            {activeTab === 'sessions' && 'Active Sessions'}
            {activeTab === 'projects' && 'Projects & Folders'}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="generating-dots">
              <span></span><span></span><span></span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              SYSTEM_ONLINE
            </span>
          </div>
        </div>

        <div className="admin-content">
          <div className="admin-glass-panel">
            {activeTab === 'dashboard' && (
              <div>
                <h3 style={{ marginBottom: '16px' }}>Welcome to Forge Core Admin</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                  Select a category from the sidebar to manage standard registry items, active coding sessions, and organizational structures.
                </p>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ background: 'var(--bg-elevated)', padding: '20px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-subtle)', flex: 1 }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{tools.length > 0 ? tools.length : '--'}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Registered Tools</div>
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', padding: '20px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-subtle)', flex: 1 }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{sessions.length > 0 ? sessions.length : '--'}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Active Sessions</div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tools' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <h3>Registered Tools</h3>
                  <button onClick={fetchTools} className="action-btn">Refresh</button>
                </div>
                {loading ? (
                  <p style={{ color: 'var(--text-secondary)' }}>Loading tools...</p>
                ) : tools.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)' }}>No tools found.</p>
                ) : (
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Slug</th>
                          <th>Project / Folder</th>
                          <th>Title</th>
                          <th>Last Updated</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tools.map((tool: any) => (
                          <tr key={tool.slug}>
                            <td><strong>{tool.slug}</strong></td>
                            <td className="muted">
                              {tool.project || 'Global'} / {tool.folder || 'Default'}
                            </td>
                            <td>{tool.title}</td>
                            <td className="muted">{new Date(tool.updated).toLocaleDateString()}</td>
                            <td>
                              <button className="action-btn" onClick={() => setEditingSlug(tool.slug)}>Edit Code & Meta</button>
                              <a href={`/t/${tool.slug}`} target="_blank" className="action-btn" style={{ textDecoration: 'none' }}>View</a>
                              <button className="action-btn delete" onClick={() => deleteTool(tool.slug)}>Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'sessions' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <h3>Active Sessions</h3>
                  <button onClick={fetchSessions} className="action-btn">Refresh</button>
                </div>
                {loading ? (
                  <p style={{ color: 'var(--text-secondary)' }}>Loading sessions...</p>
                ) : sessions.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)' }}>No active sessions found.</p>
                ) : (
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Session ID</th>
                          <th>Type</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((session: any) => (
                          <tr key={session.name}>
                            <td><strong>{session.name}</strong></td>
                            <td className="muted">Dashboard Session</td>
                            <td>
                              <button className="action-btn delete" onClick={() => deleteSession(session.name)}>Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'projects' && (
              <div>
                <h3 style={{ marginBottom: '16px' }}>Projects Registry</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Overview of tools organized by project.
                </p>
                
                {Object.keys(groupedTools).map(project => (
                  <div key={project} className="admin-glass-panel" style={{ marginBottom: '16px', borderLeft: '4px solid #6366f1' }}>
                    <h4 style={{ marginBottom: '8px' }}>{project}</h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {groupedTools[project].length} items in this project.
                    </p>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      {groupedTools[project].slice(0, 5).map((t: any) => (
                        <span key={t.slug} style={{ fontSize: '11px', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                          {t.slug}
                        </span>
                      ))}
                      {groupedTools[project].length > 5 && <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>+{groupedTools[project].length - 5} more</span>}
                    </div>
                  </div>
                ))}

                {Object.keys(groupedTools).length === 0 && (
                  <p style={{ color: 'var(--text-tertiary)' }}>No projects found. Assign tools to projects in the editor.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
