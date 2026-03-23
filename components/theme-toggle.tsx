'use client';

import { useState, useEffect, useRef } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'kinetic'>('light');
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'kinetic' | null;
    const documentTheme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark' | 'kinetic' | null;
    const initialTheme = savedTheme || documentTheme || 'light';
    
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const changeTheme = (newTheme: 'light' | 'dark' | 'kinetic') => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    setIsOpen(false);
  };

  if (!mounted) return null;

  const currentIcon = theme === 'light' ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  ) : theme === 'dark' ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  );

  return (
    <div className="theme-selector-container" ref={menuRef}>
      <button 
        className="theme-btn" 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Selection Tool"
      >
        <span className="theme-btn-icon">{currentIcon}</span>
        <span className="theme-btn-label">{theme === 'kinetic' ? 'Archive' : theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
        <svg className={`theme-btn-arrow ${isOpen ? 'open' : ''}`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <div className="theme-menu">
          <button 
            className={`theme-menu-item ${theme === 'light' ? 'active' : ''}`}
            onClick={() => changeTheme('light')}
          >
            <span className="menu-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="1" y1="12" x2="3" y2="12"/></svg>
            </span>
            Light Theme
          </button>
          <button 
            className={`theme-menu-item ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => changeTheme('dark')}
          >
            <span className="menu-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            </span>
            Dark Theme
          </button>
          <button 
            className={`theme-menu-item ${theme === 'kinetic' ? 'active' : ''}`}
            onClick={() => changeTheme('kinetic')}
          >
            <span className="menu-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </span>
            Kinetic Archive
          </button>
        </div>
      )}

      <style jsx>{`
        .theme-selector-container {
          position: relative;
          user-select: none;
        }
        .theme-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          height: 38px;
          padding: 0 14px;
          background: var(--bg-alt);
          border: 1px solid var(--border);
          border-radius: 4px;
          color: var(--text);
          cursor: pointer;
          transition: all 0.25s ease;
          font-family: var(--font-label), sans-serif;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-weight: 600;
        }
        .theme-btn:hover {
          border-color: var(--text-muted);
          background: var(--bg);
        }
        .theme-btn-label {
          min-width: 50px;
          text-align: left;
        }
        .theme-btn-arrow {
          transition: transform 0.3s ease;
          opacity: 0.5;
        }
        .theme-btn-arrow.open {
          transform: rotate(180deg);
        }
        .theme-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 180px;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 6px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
          padding: 6px;
          z-index: 1000;
          backdrop-filter: blur(24px);
          animation: menu-show 0.2s ease-out;
        }
        @keyframes menu-show {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .theme-menu-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border: none;
          background: transparent;
          color: var(--text-muted);
          font-size: 12px;
          text-align: left;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s;
          font-family: inherit;
        }
        .theme-menu-item:hover {
          background: var(--bg-alt);
          color: var(--text);
        }
        .theme-menu-item.active {
          color: var(--accent);
          background: rgba(170, 115, 255, 0.08);
        }
        .menu-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.7;
        }
      `}</style>
    </div>
  );
}
