'use client';

import { useState } from 'react';
import { ThemeToggle } from './theme-toggle';

interface Props {
  toolName: string;
  onToolNameChange: (name: string) => void;
  currentHTML: string;
  slug?: string;
  deployedUrl?: string;
  isDeploying: boolean;
  inspectMode: boolean;
  onInspectToggle: () => void;
  onDeploy: () => void;
  onHistoryToggle: () => void;
}

export default function ForgeBar({
  toolName, onToolNameChange, currentHTML, slug, deployedUrl,
  isDeploying, inspectMode, onInspectToggle, onDeploy, onHistoryToggle
}: Props) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(toolName);
  const [copied, setCopied] = useState(false);

  const handleNameBlur = () => {
    setEditingName(false);
    if (nameInput.trim()) onToolNameChange(nameInput.trim());
    else setNameInput(toolName);
  };
  const handleCopyUrl = () => {
    if (!deployedUrl) return;
    navigator.clipboard.writeText(deployedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const handleDownload = () => {
    if (!currentHTML) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([currentHTML], { type: 'text/html' }));
    a.download = `${slug || 'my-tool'}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="forge-bar">
      {/* Left: Logo + Tool name */}
      <div className="forge-bar-left">
        <a href="/" className="forge-logo" title="Back to home" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/logo.png" alt="Forge Logo" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }} />
          <span className="forge-logo-text">FORGE</span>
        </a>
        <span className="forge-bar-sep">/</span>
        {editingName ? (
          <input
            className="forge-name-input"
            value={nameInput}
            autoFocus
            onChange={e => setNameInput(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={e => {
              if (e.key === 'Enter') handleNameBlur();
              if (e.key === 'Escape') { setEditingName(false); setNameInput(toolName); }
            }}
            maxLength={48}
          />
        ) : (
          <button
            className="forge-name-btn"
            onClick={() => { setEditingName(true); setNameInput(toolName); }}
            title="Click to rename"
          >
            {toolName || 'Untitled Tool'}
            <span className="forge-name-edit-icon">✎</span>
          </button>
        )}
        {slug && <span className="forge-slug">/t/{slug}</span>}
      </div>

      {/* Right: Action buttons */}
      <div className="forge-bar-right">
        <button
          className="forge-bar-btn"
          onClick={onHistoryToggle}
          title="Prompt history"
        >
          <span>🕐</span>
          <span className="forge-bar-btn-label">History</span>
        </button>
        <button
          className={`forge-bar-btn${inspectMode ? ' active' : ''}`}
          onClick={onInspectToggle}
          disabled={!currentHTML}
          title="Click any element to edit it"
        >
          <span>👁</span>
          <span className="forge-bar-btn-label">{inspectMode ? 'Inspecting' : 'Inspect'}</span>
        </button>
        <button
          className="forge-bar-btn"
          onClick={handleDownload}
          disabled={!currentHTML}
          title="Download as .html"
        >
          <span>↓</span>
          <span className="forge-bar-btn-label">Download</span>
        </button>
        {deployedUrl && (
          <button
            className="forge-bar-btn"
            onClick={handleCopyUrl}
            title="Copy share URL"
          >
            <span>{copied ? '✓' : '🔗'}</span>
            <span className="forge-bar-btn-label">{copied ? 'Copied!' : 'Share'}</span>
          </button>
        )}
        <ThemeToggle />
        <button
          className={`forge-bar-deploy${isDeploying ? ' loading' : ''}`}
          onClick={onDeploy}
          disabled={!currentHTML || isDeploying}
        >
          {isDeploying ? '⟳ Deploying…' : deployedUrl ? '↑ Update' : '⚡ Deploy'}
        </button>
      </div>
    </div>
  );
}
