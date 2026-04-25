import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Panel — MonadCert',
  description: 'Panel administrasi Provider Admin untuk mengelola institusi yang terdaftar di protokol MonadCert.',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
