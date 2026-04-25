import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sertifikat Saya — MonadCert',
  description: 'Lihat semua sertifikat Soulbound Token (SBT) yang Anda miliki di blockchain Monad.',
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
