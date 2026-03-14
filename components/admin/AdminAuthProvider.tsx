'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type AdminAuthContextType = {
  isAuthenticated: boolean;
  login: (password: string) => boolean;
  logout: () => void;
};

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const pass = localStorage.getItem('admin_token');
    if (pass === 'ABDOKNIGHT2007') {
      setIsAuthenticated(true);
    }
  }, []);

  const login = (password: string) => {
    if (password === 'ABDOKNIGHT2007') {
      localStorage.setItem('admin_token', password);
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    setIsAuthenticated(false);
  };

  if (!isClient) {
    return <div style={{ background: 'var(--bg-void)', height: '100dvh' }} />;
  }

  return (
    <AdminAuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
};
