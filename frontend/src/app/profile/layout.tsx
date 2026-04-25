import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Profil — MonadCert',
  description:
    'Lihat semua sertifikat Soulbound Token (SBT) yang Anda miliki, atau semua ijazah yang pernah diterbitkan oleh institusi Anda di blockchain Monad.',
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
