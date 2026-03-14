import type { Metadata } from 'next';
import './admin.css';
import { AdminAuthProvider } from '@/components/admin/AdminAuthProvider';

export const metadata: Metadata = {
  title: 'Forge Admin',
  description: 'Admin Dashboard for Forge',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <div className="admin-root">
        {children}
      </div>
    </AdminAuthProvider>
  );
}
