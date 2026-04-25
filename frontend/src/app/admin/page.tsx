'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { EDUTRUST_ABI, EDUTRUST_ADDRESS } from '@/config/contracts';
import { Button } from '@/components/ui/button';
import {
  ShieldAlert, Loader2, CheckCircle2, XCircle,
  Building2, Ban, Clock, RefreshCw, Globe, Mail
} from 'lucide-react';

interface Institution {
  id: string;
  wallet_address: string;
  name: string;
  type: string;
  contact_email: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  description?: string;
  website?: string;
  created_at: string;
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const STATUS_BADGE: Record<string, string> = {
  APPROVED: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  REJECTED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  PENDING:  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
};

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  const { data: contractOwner, isLoading: checkingOwner } = useReadContract({
    abi: EDUTRUST_ABI,
    address: EDUTRUST_ADDRESS,
    functionName: 'owner',
  });

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const isAdmin =
    address &&
    contractOwner &&
    address.toLowerCase() === (contractOwner as string).toLowerCase();

  // Fetch via server-side API (bypasses RLS, sees ALL institutions)
  const fetchInstitutions = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setFetchError(null);
    const res = await fetch('/api/admin/institutions', {
      headers: { 'x-caller-wallet': address },
    });
    if (res.ok) {
      const json = await res.json();
      setInstitutions(json.data ?? []);
    } else {
      setFetchError('Gagal memuat data institusi.');
    }
    setLoading(false);
  }, [address]);

  useEffect(() => {
    if (isAdmin) fetchInstitutions();
  }, [isAdmin, fetchInstitutions]);

  useEffect(() => {
    if (isConfirmed) {
      fetchInstitutions();
      setActionTarget(null);
    }
  }, [isConfirmed, fetchInstitutions]);

  const handleGrant = (walletAddress: string) => {
    setActionTarget(walletAddress);
    writeContract({
      abi: EDUTRUST_ABI,
      address: EDUTRUST_ADDRESS,
      functionName: 'grantInstitution',
      args: [walletAddress as `0x${string}`],
    });
  };

  const handleRevoke = (walletAddress: string) => {
    setActionTarget(walletAddress);
    writeContract({
      abi: EDUTRUST_ABI,
      address: EDUTRUST_ADDRESS,
      functionName: 'revokeInstitution',
      args: [walletAddress as `0x${string}`],
    });
  };

  const filtered = filter === 'ALL' ? institutions : institutions.filter((i) => i.status === filter);
  const counts = {
    ALL: institutions.length,
    PENDING: institutions.filter((i) => i.status === 'PENDING').length,
    APPROVED: institutions.filter((i) => i.status === 'APPROVED').length,
    REJECTED: institutions.filter((i) => i.status === 'REJECTED').length,
  };

  // ── Guards ──────────────────────────────────────────────────

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--secondary)] flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="h-8 w-8 text-[var(--primary)]" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Admin Panel</h2>
          <p className="text-muted-foreground mb-6">Koneksikan wallet admin untuk melanjutkan.</p>
          <ConnectButton />
        </motion.div>
      </div>
    );
  }

  if (checkingOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-6">
            <Ban className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Akses Ditolak</h2>
          <p className="text-muted-foreground">
            Wallet Anda bukan Provider Admin dari smart contract EduTrust.
          </p>
          <p className="text-xs font-mono text-muted-foreground/60 mt-3">{address}</p>
        </motion.div>
      </div>
    );
  }

  // ── Main UI ──────────────────────────────────────────────────

  return (
    <div className="min-h-screen pt-24 pb-16 px-5 sm:px-8 relative overflow-hidden">
      <div className="absolute top-[-8%] right-[-6%] w-[400px] h-[400px] rounded-full bg-gradient-to-br from-[#c4b5fd]/20 to-[#a78bfa]/10 blur-[100px] pointer-events-none animate-float" />

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div initial="hidden" animate="show" variants={fadeUp} className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">Admin Panel</h1>
            <p className="text-muted-foreground text-sm">Kelola pendaftaran institusi protokol MonadCert.</p>
          </div>
          <button
            onClick={fetchInstitutions}
            disabled={loading}
            className="p-2.5 rounded-xl border border-border bg-white/60 dark:bg-[#1a1932]/40 hover:bg-[var(--secondary)] transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </motion.div>

        {/* Stats bar */}
        <motion.div initial="hidden" animate="show" variants={fadeUp} className="grid grid-cols-4 gap-3 mb-6">
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`p-4 rounded-2xl border text-left transition-all ${
                filter === s
                  ? 'border-[var(--primary)]/40 bg-[var(--primary)]/5 shadow-sm'
                  : 'border-border bg-white/60 dark:bg-[#1a1932]/40 hover:border-[var(--primary)]/20'
              }`}
            >
              <p className="text-2xl font-bold text-foreground">{counts[s]}</p>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">{s}</p>
            </button>
          ))}
        </motion.div>

        {/* Tx success banner */}
        <AnimatePresence>
          {isConfirmed && txHash && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-5 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-3"
            >
              <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Transaksi On-chain Berhasil!</p>
                <p className="text-xs text-emerald-600/80 font-mono mt-0.5 break-all">{txHash}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error state */}
        {fetchError && (
          <div className="mb-5 p-4 rounded-2xl border border-destructive/30 bg-destructive/5 text-sm text-destructive flex items-center gap-2">
            <XCircle className="h-4 w-4 flex-shrink-0" />
            {fetchError}
            <button onClick={fetchInstitutions} className="ml-auto text-xs underline">Coba lagi</button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
          </div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-20 rounded-2xl border border-border bg-white/60 dark:bg-[#1a1932]/40 backdrop-blur-sm"
          >
            <Building2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">
              {filter === 'ALL' ? 'Belum ada institusi yang mendaftar.' : `Tidak ada institusi berstatus ${filter}.`}
            </p>
          </motion.div>
        ) : (
          <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="space-y-4">
            {filtered.map((inst) => (
              <motion.div
                key={inst.id}
                variants={fadeUp}
                className="p-6 rounded-2xl border border-border bg-white/60 dark:bg-[#1a1932]/40 backdrop-blur-sm hover:shadow-lg hover:shadow-[var(--primary)]/5 transition-all duration-200"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Name & badges */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-base font-bold text-foreground">{inst.name}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[inst.status]}`}>
                        {inst.status === 'PENDING' && <Clock className="inline h-3 w-3 mr-0.5 -mt-0.5" />}
                        {inst.status === 'APPROVED' && <CheckCircle2 className="inline h-3 w-3 mr-0.5 -mt-0.5" />}
                        {inst.status === 'REJECTED' && <XCircle className="inline h-3 w-3 mr-0.5 -mt-0.5" />}
                        {inst.status}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--secondary)] text-[var(--primary)] font-medium">
                        {inst.type}
                      </span>
                    </div>

                    {/* Wallet */}
                    <p className="text-xs font-mono text-muted-foreground/70 mb-2 truncate">{inst.wallet_address}</p>

                    {/* Contact */}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />{inst.contact_email}
                      </span>
                      {inst.website && (
                        <a href={inst.website} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-[var(--primary)] transition-colors">
                          <Globe className="h-3 w-3" />{inst.website}
                        </a>
                      )}
                    </div>

                    {inst.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{inst.description}</p>
                    )}

                    <p className="text-xs text-muted-foreground/50 mt-2">
                      Mendaftar: {new Date(inst.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleGrant(inst.wallet_address)}
                      disabled={isPending || isConfirming || inst.status === 'APPROVED'}
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs disabled:opacity-50"
                    >
                      {isPending && actionTarget === inst.wallet_address ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRevoke(inst.wallet_address)}
                      disabled={isPending || isConfirming || inst.status === 'REJECTED'}
                      className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 text-xs disabled:opacity-50"
                    >
                      {isPending && actionTarget === inst.wallet_address ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <><XCircle className="h-3.5 w-3.5 mr-1" />Revoke</>
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
