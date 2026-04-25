import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-border bg-[var(--muted)]/50">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[#38bdf8] flex items-center justify-center">
                <span className="text-white font-bold text-xs">M</span>
              </div>
              <span className="text-base font-bold tracking-tight">
                Monad<span className="text-[var(--primary)]">Cert</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Protokol verifikasi kredensial terdesentralisasi berbasis Soulbound Token di Monad.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-4 text-foreground">Navigasi</h4>
            <div className="space-y-2">
              <Link href="/verify" className="block text-sm text-muted-foreground hover:text-[var(--primary)] transition-colors">
                Verifikasi Sertifikat
              </Link>
              <Link href="/dashboard" className="block text-sm text-muted-foreground hover:text-[var(--primary)] transition-colors">
                Portal Institusi
              </Link>
              <Link href="/admin" className="block text-sm text-muted-foreground hover:text-[var(--primary)] transition-colors">
                Admin Panel
              </Link>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-4 text-foreground">Teknologi</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Monad Blockchain</p>
              <p>Soulbound Token (ERC-721)</p>
              <p>Supabase + IPFS</p>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} MonadCert. Built on Monad.
          </p>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-muted-foreground">Monad Testnet</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
