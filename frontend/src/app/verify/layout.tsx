import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verifikasi Sertifikat — MonadCert',
  description: 'Cek keaslian sertifikat digital secara instan langsung dari blockchain Monad. Masukkan Token ID untuk memverifikasi.',
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
