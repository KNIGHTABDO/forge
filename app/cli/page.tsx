'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { signInWithEmailAndPassword, signInWithPopup, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, onSnapshot, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '@/lib/firebase';
import { ThemeToggle } from '@/components/theme-toggle';
import '../home.css';
import '../legal.css';

interface Device {
  id: string;
  name: string;
  os: string;
  platform?: string;
  deviceType?: string;
  appVersion?: string;
  lastUsed: any;
  active: boolean;
}

interface Analytics {
  commandsExecuted: number;
  filesEdited: number;
  activeSwarms: number;
}

function toMillis(timestamp: any): number {
  if (!timestamp) return 0;
  if (typeof timestamp.toMillis === 'function') {
    return timestamp.toMillis();
  }
  if (typeof timestamp.seconds === 'number') {
    return timestamp.seconds * 1000;
  }
  return 0;
}

function formatTimestamp(timestamp: any): string {
  const millis = toMillis(timestamp);
  if (!millis) return 'N/A';
  return new Date(millis).toLocaleString();
}

function isAllowedCliCallbackHost(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
}

function sanitizeCliCallbackUrl(rawCallbackUrl: string): URL {
  const callback = new URL(rawCallbackUrl);
  const protocol = callback.protocol.toLowerCase();

  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error('Callback protocol is not allowed.');
  }

  if (!isAllowedCliCallbackHost(callback.hostname)) {
    throw new Error('Callback host is not allowed.');
  }

  if (!callback.pathname || callback.pathname.length > 120) {
    throw new Error('Callback path is invalid.');
  }

  return callback;
}

function normalizeCallbackDeviceType(value: string | null): 'cli' | 'desktop_app' | 'web' {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'desktop_app') return 'desktop_app';
  if (normalized === 'web') return 'web';
  return 'cli';
}

function normalizeOptionalCallbackField(value: string | null, maxLength = 40): string | null {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function formatDeviceType(value: string | undefined): string {
  if (value === 'desktop_app') return 'Forge Desktop';
  if (value === 'web') return 'Web Session';
  return 'Forge CLI';
}

type CliCallbackParams = {
  callbackUrl: string | null;
  deviceId: string | null;
  authState: string | null;
  deviceName: string;
  deviceOs: string;
  deviceType: 'cli' | 'desktop_app' | 'web';
  appVersion: string | null;
  platform: string | null;
  hasCliIntent: boolean;
};

function buildCallbackAttemptKey(params: {
  callbackUrl: string;
  deviceId: string | null;
  authState: string | null;
}): string {
  const encodedCallback =
    typeof window !== 'undefined'
      ? window.btoa(unescape(encodeURIComponent(params.callbackUrl))).slice(0, 120)
      : params.callbackUrl;

  return [
    'forge-device-callback',
    encodedCallback,
    params.deviceId || 'no-device',
    params.authState || 'no-state',
  ].join(':');
}

function hasAttemptedCallback(callbackKey: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.sessionStorage.getItem(callbackKey) === '1';
  } catch {
    return false;
  }
}

function markAttemptedCallback(callbackKey: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(callbackKey, '1');
  } catch {
    // Ignore storage write errors; callback logic still has ref-based guard.
  }
}

function readCliCallbackParams(searchParams: URLSearchParams): CliCallbackParams {
  let callbackUrl = searchParams.get('callback') || searchParams.get('cb');
  let deviceId = searchParams.get('deviceId') || searchParams.get('did');
  let authState = searchParams.get('authState') || searchParams.get('state');
  let deviceName =
    searchParams.get('deviceName') || searchParams.get('dn') || 'Forge CLI Device';
  let deviceOs = searchParams.get('os') || 'Unknown OS';
  let deviceType = normalizeCallbackDeviceType(searchParams.get('deviceType'));
  let appVersion = searchParams.get('appVersion');
  let platform = searchParams.get('platform');
  let hasCliIntent = searchParams.get('cliLogin') === '1' || Boolean(callbackUrl);

  if (typeof window !== 'undefined' && window.location.hash) {
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hash);

    callbackUrl = callbackUrl || hashParams.get('callback') || hashParams.get('cb');
    deviceId = deviceId || hashParams.get('deviceId') || hashParams.get('did');
    authState = authState || hashParams.get('authState') || hashParams.get('state');

    if (deviceName === 'Forge CLI Device') {
      deviceName = hashParams.get('deviceName') || hashParams.get('dn') || deviceName;
    }
    if (deviceOs === 'Unknown OS') {
      deviceOs = hashParams.get('os') || deviceOs;
    }

    deviceType = normalizeCallbackDeviceType(hashParams.get('deviceType') || deviceType);
    appVersion = appVersion || hashParams.get('appVersion');
    platform = platform || hashParams.get('platform');

    hasCliIntent =
      hasCliIntent ||
      hashParams.get('cliLogin') === '1' ||
      Boolean(hashParams.get('callback') || hashParams.get('cb'));
  }

  return {
    callbackUrl,
    deviceId,
    authState: normalizeOptionalCallbackField(authState, 120),
    deviceName,
    deviceOs,
    deviceType,
    appVersion: normalizeOptionalCallbackField(appVersion),
    platform: normalizeOptionalCallbackField(platform),
    hasCliIntent,
  };
}

function CliDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [devices, setDevices] = useState<Device[]>([]);
  const [analytics, setAnalytics] = useState<Analytics>({ commandsExecuted: 0, filesEdited: 0, activeSwarms: 0 });
  const [cliCallbackState, setCliCallbackState] = useState<'idle' | 'processing' | 'error'>('idle');
  const [cliCallbackMessage, setCliCallbackMessage] = useState('');
  const [manualCallbackUrl, setManualCallbackUrl] = useState<string | null>(null);
  const callbackAttemptedRef = useRef(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);

      if (u) {
        const {
          callbackUrl,
          deviceId,
          authState,
          deviceName,
          deviceOs,
          deviceType,
          appVersion,
          platform,
          hasCliIntent,
        } = readCliCallbackParams(searchParams);

        // If there's a CLI callback, we should redirect there or provide the token.
        if (callbackUrl) {
          const callbackAttemptKey = buildCallbackAttemptKey({
            callbackUrl,
            deviceId,
            authState,
          });

          if (callbackAttemptedRef.current) {
            return;
          }

          if (hasAttemptedCallback(callbackAttemptKey)) {
            return;
          }

          callbackAttemptedRef.current = true;
          markAttemptedCallback(callbackAttemptKey);

          (async () => {
            try {
              setCliCallbackState('processing');
              setCliCallbackMessage('Completing device login and returning to Forge Desktop...');

              const callback = sanitizeCliCallbackUrl(callbackUrl);

              // Do not block callback redirect on Firestore writes.
              if (deviceId) {
                void setDoc(
                  doc(db, 'users', u.uid, 'devices', deviceId),
                  {
                    name: deviceName,
                    os: deviceOs,
                    platform: platform || deviceOs,
                    deviceType,
                    ...(appVersion ? { appVersion } : {}),
                    active: true,
                    lastUsed: serverTimestamp(),
                  },
                  { merge: true },
                ).catch((deviceErr) => {
                  console.warn('CLI callback device write warning', deviceErr);
                });
              }

              const token = await u.getIdToken(true);
              callback.searchParams.set('token', token);

              if (authState) {
                callback.searchParams.set('authState', authState);
                callback.searchParams.set('state', authState);
              }

              const redirectUrl = callback.toString();
              setManualCallbackUrl(redirectUrl);
              window.location.replace(redirectUrl);

              // Fallback message when browser navigation is blocked or cancelled.
              setTimeout(() => {
                if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
                  setCliCallbackState('error');
                  setCliCallbackMessage(
                    'Automatic callback redirect was blocked. Use the manual callback link below.',
                  );
                }
              }, 2000);
            } catch (err: any) {
              console.error('CLI callback redirect failed', err);
              setCliCallbackState('error');
              setCliCallbackMessage(
                err?.message ||
                  'Failed to complete CLI callback flow. Please re-run /login in the CLI.',
              );
            }
          })();
        } else if (hasCliIntent) {
          setCliCallbackState('error');
          setCliCallbackMessage(
            'CLI callback details are missing. Please run /login again from Forge Code.',
          );
        }
      }
    });
    return () => unsub();
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;

    // Fetch analytics
    const unsubAnalytics = onSnapshot(doc(db, 'users', user.uid, 'analytics', 'current'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Analytics;
        setAnalytics({
          commandsExecuted: data.commandsExecuted || 0,
          filesEdited: data.filesEdited || 0,
          activeSwarms: data.activeSwarms || 0
        });
      }
    });

    // Fetch devices
    const devicesRef = collection(db, 'users', user.uid, 'devices');

    const unsubDevices = onSnapshot(
      devicesRef,
      (snapshot) => {
        const devs = snapshot.docs
          .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Device))
          .filter(device => device.active !== false)
          .sort((a, b) => toMillis(b.lastUsed) - toMillis(a.lastUsed));
        setDevices(devs);
      },
      (err) => {
        console.error('Failed to load devices snapshot', err);
      },
    );

    return () => {
      unsubAnalytics();
      unsubDevices();
    };
  }, [user]);

  const handleRevoke = async (deviceId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'devices', deviceId), {
        active: false
      });
    } catch (err) {
      console.error('Error revoking device', err);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error');
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setError(err.message || 'Authentication error');
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  const navBar = (
    <nav className="nav">
      <Link href="/" className="nav-logo">FORGE</Link>
      <div className="nav-links">
        <Link href="/#how" className="nav-link">How it works</Link>
        <Link href="/#gallery" className="nav-link">Gallery</Link>
        <Link href="/research/new" className="nav-link">Deep Research</Link>
        <Link href="/pricing" className="nav-link">Pricing</Link>
      </div>
      <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <ThemeToggle />
        <Link href="/build" className="nav-cta">Inquire</Link>
      </div>
    </nav>
  );

  if (loading) {
    return (
      <div className="legal-page">
        {navBar}
        <main className="legal-hero">
          <div className="legal-hero-inner">
            <h1 className="legal-title">Loading...</h1>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="legal-page">
        <Head><title>Device Authentication | Forge</title></Head>
        {navBar}
        <main className="legal-hero">
          <div className="legal-hero-inner" style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
            <h1 className="legal-title">Sign In to Forge</h1>
            <p className="legal-subtitle" style={{marginBottom: '2rem'}}>Authenticate Forge CLI and Forge Desktop to securely access workspace capabilities.</p>
            
            {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}

            <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
              <input 
                type="email" 
                placeholder="Email Address" 
                className="search-input"
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required 
                style={{ background: 'transparent' }}
              />
              <input 
                type="password" 
                className="search-input"
                placeholder="Password" 
                value={password} 
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                required 
                style={{ background: 'transparent' }}
              />
              <button className="btn-primary" type="submit" style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center' }}>
                {mode === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            </form>

            <div style={{ margin: '1.5rem 0', color: 'var(--text-muted)' }}>— or —</div>

            <button className="btn-ghost" onClick={handleGoogleAuth} style={{ width: '100%', marginBottom: '1rem', justifyContent: 'center' }}>
              Sign {mode === 'login' ? 'In' : 'Up'} with Google
            </button>

            <button 
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {mode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Dashboard View
  return (
    <div className="legal-page">
      <Head>
        <title>Device Dashboard | Forge</title>
      </Head>
      {navBar}
      <main className="legal-hero" style={{ paddingBottom: '40px' }}>
        <div className="legal-hero-inner">
          <span className="legal-date">Welcome back</span>
          <h1 className="legal-title">Device Dashboard</h1>
          <p className="legal-subtitle">
            Manage your connected Forge CLI and Forge Desktop sessions, view usage metrics, and revoke access securely.
            <br/>Logged in as: <strong>{user.email}</strong>
          </p>
          {(cliCallbackState !== 'idle' || error) && (
            <div
              style={{
                marginTop: '1rem',
                padding: '0.85rem 1rem',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: cliCallbackState === 'error' || error ? '#ff6b6b' : 'var(--text-main)',
              }}
            >
              {cliCallbackState !== 'idle' ? cliCallbackMessage : error}
              {manualCallbackUrl && cliCallbackState === 'error' && (
                <div style={{ marginTop: '0.6rem', wordBreak: 'break-all' }}>
                  <a href={manualCallbackUrl}>Complete callback manually</a>
                </div>
              )}
            </div>
          )}
          <div style={{ marginTop: '2rem' }}>
            <button className="btn-ghost" onClick={handleLogout}>Sign Out</button>
          </div>
        </div>
      </main>

      <section className="legal-body" style={{ maxWidth: '1000px', margin: '0 auto', display: 'grid', gap: '40px', padding: '0 48px 80px' }}>
        <div className="legal-section">
          <h2>Usage Analytics</h2>
          <p className="legal-desc">Your command executions and agent swarms.</p>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '1rem' }}>
            <div style={{ flex: 1, minWidth: '200px', padding: '2rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--card-bg)' }}>
              <h3 style={{ margin: 0, fontSize: '2rem' }}>{analytics.commandsExecuted}</h3>
              <p style={{ color: 'var(--text-muted)' }}>Commands Executed</p>
            </div>
            <div style={{ flex: 1, minWidth: '200px', padding: '2rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--card-bg)' }}>
              <h3 style={{ margin: 0, fontSize: '2rem' }}>{analytics.filesEdited}</h3>
              <p style={{ color: 'var(--text-muted)' }}>Files Edited</p>
            </div>
            <div style={{ flex: 1, minWidth: '200px', padding: '2rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--card-bg)' }}>
              <h3 style={{ margin: 0, fontSize: '2rem' }}>{analytics.activeSwarms}</h3>
              <p style={{ color: 'var(--text-muted)' }}>Active Swarms</p>
            </div>
          </div>
        </div>

        <div className="legal-section">
          <h2>Connected Devices</h2>
          <p className="legal-desc">Securely manage devices and desktop sessions that currently have access to environment APIs.</p>
          <div style={{ marginTop: '1rem', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem 2rem' }}>
            {devices.length === 0 ? (
              <div style={{ padding: '1rem 0', color: 'var(--text-muted)' }}>No active devices found.</div>
            ) : (
              devices.map((device, index) => (
                <div key={device.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0', borderBottom: index < devices.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div>
                    <strong>{device.name}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      Last used: {formatTimestamp(device.lastUsed)} • {device.platform || device.os} • {formatDeviceType(device.deviceType)}{device.appVersion ? ` • v${device.appVersion}` : ''}
                    </div>
                  </div>
                  <button 
                    className="btn-ghost" 
                    style={{ color: 'red', borderColor: 'var(--border)' }}
                    onClick={() => handleRevoke(device.id)}
                  >
                    Revoke
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function CliDashboardPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CliDashboard />
    </Suspense>
  );
}
