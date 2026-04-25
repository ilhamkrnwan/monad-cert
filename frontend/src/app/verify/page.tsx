'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ShieldCheck, ShieldX, Loader2, ExternalLink, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useReadContract } from 'wagmi';
import { EDUTRUST_ABI, EDUTRUST_ADDRESS } from '@/config/contracts';
import { supabase } from '@/lib/supabase';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function VerifyPage() {
  const [tokenId, setTokenId] = useState('');
  const [searchId, setSearchId] = useState<bigint | null>(null);
  const [copied, setCopied] = useState('');
  const [institutionName, setInstitutionName] = useState<string | null>(null);

  const { data: credential, isLoading, isError, error } = useReadContract({
    abi: EDUTRUST_ABI,
    address: EDUTRUST_ADDRESS,
    functionName: 'getCredential',
    args: searchId !== null ? [searchId] : undefined,
    query: { enabled: searchId !== null },
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = tokenId.trim();
    if (!id || isNaN(Number(id))) return;
    setInstitutionName(null);
    setSearchId(BigInt(id));
  };

  // Fetch institution name from Supabase when credential loads
  const fetchInstitutionName = async (walletAddress: string) => {
    const { data } = await supabase
      .from('institutions')
      .select('name')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();
    if (data) setInstitutionName(data.name);
  };

  if (credential && credential[4] && institutionName === null) {
    fetchInstitutionName(credential[1]);
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const isValid = credential?.[4];
  const hasSearched = searchId !== null;

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-gradient-to-br from-[#c4b5fd]/30 to-[#a78bfa]/10 blur-[100px] pointer-events-none animate-float" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[350px] h-[350px] rounded-full bg-gradient-to-br from-[#67e8f9]/20 to-[#22d3ee]/10 blur-[100px] pointer-events-none animate-float-delayed" />

      <div className="max-w-3xl mx-auto px-5 sm:px-8 pt-28 pb-20">
        {/* Header */}
        <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }}>
          <motion.p variants={fadeUp} className="text-sm font-semibold text-[var(--primary)] uppercase tracking-widest mb-3 text-center">
            Verifikasi Publik
          </motion.p>
          <motion.h1 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-foreground text-center mb-4">
            Cek Keaslian Sertifikat
          </motion.h1>
          <motion.p variants={fadeUp} className="text-muted-foreground text-center max-w-lg mx-auto mb-10">
            Masukkan Token ID sertifikat untuk memverifikasi keasliannya langsung dari smart contract di blockchain Monad.
          </motion.p>
        </motion.div>

        {/* Search Form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onSubmit={handleSearch}
          className="relative mb-12"
        >
          <div className="relative flex items-center glass rounded-2xl overflow-hidden shadow-lg shadow-[var(--primary)]/5">
            <Search className="absolute left-5 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              value={tokenId}
              onChange={(e) => setTokenId(e.target.value)}
              placeholder="Masukkan Token ID (contoh: 1, 2, 3...)"
              className="w-full h-14 pl-[52px] pr-32 bg-transparent text-foreground placeholder:text-muted-foreground/60 focus:outline-none text-base font-mono"
              id="verify-token-input"
            />
            <Button
              type="submit"
              disabled={isLoading}
              className="absolute right-2 h-10 px-6 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white font-semibold"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verifikasi'}
            </Button>
          </div>
        </motion.form>

        {/* Results */}
        <AnimatePresence mode="wait">
          {isLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center py-16"
            >
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-[var(--primary)]/20 border-t-[var(--primary)] animate-spin" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">Membaca data dari blockchain Monad...</p>
            </motion.div>
          )}

          {hasSearched && !isLoading && isValid && credential && (
            <motion.div
              key="valid"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
              className="rounded-3xl border-2 border-emerald-200 dark:border-emerald-800/50 bg-gradient-to-br from-emerald-50/80 to-teal-50/80 dark:from-emerald-950/20 dark:to-teal-950/20 p-8 backdrop-blur-sm"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-200">Sertifikat Valid ✅</h3>
                  <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80">Terverifikasi langsung dari smart contract</p>
                </div>
              </div>

              <div className="space-y-4">
                <InfoRow
                  label="Token ID"
                  value={`#${searchId!.toString()}`}
                  onCopy={() => handleCopy(searchId!.toString(), 'tokenId')}
                  isCopied={copied === 'tokenId'}
                />
                <InfoRow
                  label="Penerima"
                  value={truncateAddress(credential[0])}
                  fullValue={credential[0]}
                  onCopy={() => handleCopy(credential[0], 'recipient')}
                  isCopied={copied === 'recipient'}
                />
                <InfoRow
                  label="Diterbitkan Oleh"
                  value={institutionName || truncateAddress(credential[1])}
                  fullValue={credential[1]}
                  onCopy={() => handleCopy(credential[1], 'institution')}
                  isCopied={copied === 'institution'}
                />
                <InfoRow
                  label="Tanggal Terbit"
                  value={new Date(Number(credential[3]) * 1000).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
                />
                {credential[2] && (
                  <div className="pt-3 border-t border-emerald-200/50 dark:border-emerald-800/30">
                    <a
                      href={credential[2]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)] hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Lihat Metadata Sertifikat
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {hasSearched && !isLoading && !isValid && !isError && (
            <motion.div
              key="invalid"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-3xl border-2 border-red-200 dark:border-red-800/50 bg-gradient-to-br from-red-50/80 to-rose-50/80 dark:from-red-950/20 dark:to-rose-950/20 p-8 backdrop-blur-sm text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center mx-auto mb-4">
                <ShieldX className="h-7 w-7 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-red-700 dark:text-red-300 mb-2">Sertifikat Tidak Ditemukan</h3>
              <p className="text-sm text-red-600/70 dark:text-red-400/70">
                Token ID #{searchId?.toString()} tidak ada atau telah dicabut dari blockchain.
              </p>
            </motion.div>
          )}

          {isError && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-3xl border border-border bg-white/60 dark:bg-[#1a1932]/40 p-8 text-center backdrop-blur-sm"
            >
              <p className="text-sm text-destructive font-medium">Terjadi kesalahan: {error?.message || 'Gagal membaca kontrak'}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function InfoRow({ label, value, fullValue, onCopy, isCopied }: {
  label: string;
  value: string;
  fullValue?: string;
  onCopy?: () => void;
  isCopied?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-emerald-700/60 dark:text-emerald-400/60 font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground font-mono" title={fullValue}>
          {value}
        </span>
        {onCopy && (
          <button onClick={onCopy} className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors" title="Salin">
            {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
        )}
      </div>
    </div>
  );
}
