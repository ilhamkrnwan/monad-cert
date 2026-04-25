import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Portal Institusi — MonadCert',
  description: 'Dashboard untuk institusi terverifikasi. Terbitkan sertifikat Soulbound Token kepada penerima di blockchain Monad.',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
