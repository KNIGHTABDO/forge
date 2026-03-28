'use client';

import { useState } from 'react';
import { ThemeToggle } from './theme-toggle';

interface Props {
  toolName: string;
  onToolNameChange: (name: string) => void;
  currentHTML?: string;
  slug?: string;
  deployedUrl?: string;
  isDeploying: boolean;
  onDeploy: () => void;
}

export default function ForgeBar({
  toolName, onToolNameChange, slug, deployedUrl, isDeploying, onDeploy
}: Props) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(toolName);
  const [copied, setCopied] = useState(false);

  const handleNameBlur = () => {
    setEditingName(false);
    if (nameInput.trim()) onToolNameChange(nameInput.trim());
    else setNameInput(toolName);
  };

  const handleCopyUrl = async () => {
    if (!deployedUrl) return;
    
    try {
      // Primary: Modern Async Clipboard API
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(deployedUrl);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch (err) {
      // Fallback: execCommand('copy') via hidden textarea
      try {
        const textArea = document.createElement("textarea");
        textArea.value = deployedUrl;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (!successful) throw new Error('execCommand failed');
      } catch (fallbackErr) {
        console.error('[clipboard] Both copy methods failed:', fallbackErr);
        // Last resort: manually prompt the user to copy
        window.prompt("Copy to clipboard: Ctrl+C, Enter", deployedUrl);
      }
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="forge-bar">
      {/* Left: Logo + Tool name */}
      <div className="forge-bar-left">
        <a href="/" className="forge-logo" title="Back to home">
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
          disabled={isDeploying}
        >
          {isDeploying ? '⟳ Deploying…' : deployedUrl ? '↑ Update' : '⚡ Deploy'}
        </button>
      </div>
    </div>
  );
}
