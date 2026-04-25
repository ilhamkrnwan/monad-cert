'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, usePublicClient, useReadContract } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { EDUTRUST_ABI, EDUTRUST_ADDRESS } from '@/config/contracts';
import {
  Award, Wallet, Loader2, ExternalLink, ShieldCheck,
  ShieldX, RefreshCw, Calendar, Building2, User,
  GraduationCap, Crown, Users, Hash, FileText,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'user' | 'institution' | 'admin';

interface CertRow {
  id: string;
  token_id: number | null;
  tx_hash: string | null;
  institution_wallet: string;
  recipient_wallet: string;
  recipient_name: string;
  title: string;
  description: string | null;
  issued_date: string;
  metadata_url: string;
  status: 'PENDING_MINT' | 'MINTED' | 'REVOKED';
  minted_at: string | null;
  created_at: string;
  // Joined
  institutions: { name: string; logo_url: string | null; type: string } | null;
  // Enriched client-side
  onChainValid?: boolean; // live from getCredential()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const shortAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

const STATUS_STYLE: Record<string, string> = {
  MINTED: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  PENDING_MINT: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  REVOKED: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
};

const STATUS_LABEL: Record<string, string> = {
  MINTED: 'Terverifikasi',
  PENDING_MINT: 'Menunggu Mint',
  REVOKED: 'Dicabut',
};

const ROLE_CONFIG: Record<Role, {
  label: string;
  icon: React.ElementType;
  badgeClass: string;
  emptyText: string;
  pageTitle: string;
  pageSubtitle: string;
}> = {
  user: {
    label: 'Pemegang Sertifikat',
    icon: User,
    badgeClass: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
    emptyText: 'Belum ada sertifikat SBT yang diterbitkan ke wallet Anda.',
    pageTitle: 'Sertifikat Saya',
    pageSubtitle: 'Semua sertifikat yang telah diterbitkan ke wallet Anda',
  },
  institution: {
    label: 'Portal Institusi',
    icon: Building2,
    badgeClass: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
    emptyText: 'Belum ada sertifikat yang diterbitkan oleh institusi ini.',
    pageTitle: 'Ijazah yang Diterbitkan',
    pageSubtitle: 'Semua ijazah yang pernah diterbitkan oleh wallet institusi ini',
  },
  admin: {
    label: 'Admin MonadCert',
    icon: Crown,
    badgeClass: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    emptyText: 'Belum ada sertifikat yang tersimpan di database.',
    pageTitle: 'Semua Sertifikat',
    pageSubtitle: 'Seluruh sertifikat yang terdaftar di protokol MonadCert',
  },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const [role, setRole] = useState<Role | null>(null);
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  // ── Role detection from contract ──────────────────────────────────────────

  const { data: contractOwner, isLoading: loadingOwner } = useReadContract({
    abi: EDUTRUST_ABI,
    address: EDUTRUST_ADDRESS,
    functionName: 'owner',
    query: { enabled: !!address },
  });

  const { data: isApprovedInstitution, isLoading: loadingInstitution } = useReadContract({
    abi: EDUTRUST_ABI,
    address: EDUTRUST_ADDRESS,
    functionName: 'isApprovedInstitution',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const roleLoading = loadingOwner || loadingInstitution;

  // Resolve role once both reads are done
  useEffect(() => {
    if (!address || roleLoading) return;
    if (contractOwner && address.toLowerCase() === (contractOwner as string).toLowerCase()) {
      setRole('admin');
    } else if (isApprovedInstitution) {
      setRole('institution');
    } else {
      setRole('user');
    }
  }, [address, roleLoading, contractOwner, isApprovedInstitution]);

  // ── Fetch certificates (Supabase via API route, no blockchain scan) ───────

  const fetchCertificates = async (currentRole: Role, walletAddr: string) => {
    setLoading(true);
    setError(null);
    hasFetched.current = true;

    try {
      const params = new URLSearchParams({ role: currentRole, wallet: walletAddr });
      const res = await fetch(`/api/profile/certificates?${params}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || 'Fetch error');

      const rows: CertRow[] = json.data ?? [];
      setCerts(rows);

      // After loading from Supabase, verify live on-chain validity for MINTED certs
      if (publicClient && rows.length > 0) {
        validateOnChain(rows);
      }
    } catch (err) {
      console.error('[profile] fetchCertificates error:', err);
      setError('Gagal memuat data. Periksa koneksi dan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * For certs that are MINTED (have token_id), call getCredential() to get
   * live validity from the blockchain (detects on-chain revocation).
   */
  const validateOnChain = async (rows: CertRow[]) => {
    if (!publicClient) return;
    const mintedRows = rows.filter((r) => r.status === 'MINTED' && r.token_id !== null);
    if (mintedRows.length === 0) return;

    setValidating(true);
    const results = await Promise.allSettled(
      mintedRows.map((r) =>
        publicClient.readContract({
          address: EDUTRUST_ADDRESS,
          abi: EDUTRUST_ABI,
          functionName: 'getCredential',
          args: [BigInt(r.token_id!)],
        })
      )
    );

    setCerts((prev) => {
      const updated = [...prev];
      mintedRows.forEach((row, idx) => {
        const result = results[idx];
        const i = updated.findIndex((c) => c.id === row.id);
        if (i === -1) return;
        if (result.status === 'fulfilled') {
          const [, , , , isValid] = result.value as [string, string, string, bigint, boolean];
          updated[i] = { ...updated[i], onChainValid: isValid };
        } else {
          updated[i] = { ...updated[i], onChainValid: false };
        }
      });
      return updated;
    });

    setValidating(false);
  };

  // Trigger fetch once role is resolved (only once per session)
  useEffect(() => {
    if (!role || !address || hasFetched.current) return;
    fetchCertificates(role, address);
  }, [role, address]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => {
    if (!role || !address) return;
    hasFetched.current = false;
    fetchCertificates(role, address);
  };

  // ── Not connected ─────────────────────────────────────────────────────────

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--secondary)] flex items-center justify-center mx-auto mb-6">
            <Wallet className="h-8 w-8 text-[var(--primary)]" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Profil Saya</h2>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Koneksikan wallet Anda untuk melihat sertifikat berdasarkan role Anda.
          </p>
          <ConnectButton />
        </motion.div>
      </div>
    );
  }

  // ── Detecting role (brief spinner) ────────────────────────────────────────

  if (roleLoading || !role) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
        <p className="text-sm text-muted-foreground">Mendeteksi role wallet...</p>
      </div>
    );
  }

  const cfg = ROLE_CONFIG[role];
  const RoleIcon = cfg.icon;

  // ── Main ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pt-24 pb-16 px-5 sm:px-8 relative overflow-hidden">
      {/* Ambient blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[350px] h-[350px] rounded-full bg-gradient-to-br from-[#c4b5fd]/20 to-[#a78bfa]/10 blur-[100px] pointer-events-none animate-float" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[300px] h-[300px] rounded-full bg-gradient-to-br from-[#67e8f9]/15 to-[#22d3ee]/5 blur-[100px] pointer-events-none animate-float-delayed" />

      <div className="max-w-5xl mx-auto">
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.07 } } }}
        >
          {/* ── Header ────────────────────────────────────────────────────── */}
          <motion.div variants={fadeUp} className="flex items-start justify-between mb-8 gap-4">
            <div className="min-w-0">
              {/* Role badge */}
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3 ${cfg.badgeClass}`}>
                <RoleIcon className="h-3 w-3" />
                {cfg.label}
              </span>

              <h1 className="text-3xl font-bold text-foreground mb-1">{cfg.pageTitle}</h1>
              <p className="text-sm text-muted-foreground mb-2">{cfg.pageSubtitle}</p>
              <p className="text-xs text-muted-foreground/70 font-mono truncate max-w-[280px] sm:max-w-none">
                {address}
              </p>

              {/* Stats row */}
              {!loading && certs.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badgeClass}`}>
                    {certs.length} Sertifikat
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                    {certs.filter((c) => c.status === 'MINTED').length} MINTED
                  </span>
                  {certs.some((c) => c.status === 'PENDING_MINT') && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                      {certs.filter((c) => c.status === 'PENDING_MINT').length} Pending
                    </span>
                  )}
                  {validating && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-muted-foreground bg-[var(--secondary)]">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      Verifikasi on-chain...
                    </span>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handleRefresh}
              disabled={loading}
              className="mt-1 p-2.5 rounded-xl border border-border bg-white/60 dark:bg-[#1a1932]/40 hover:bg-[var(--secondary)] transition-colors disabled:opacity-50 flex-shrink-0"
              title="Refresh data"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </motion.div>

          {/* ── Loading ──────────────────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center py-24 gap-4"
              >
                <div className="relative">
                  <Loader2 className="h-10 w-10 animate-spin text-[var(--primary)]" />
                  <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-[var(--primary)]/10" />
                </div>
                <p className="text-sm font-medium text-foreground">Memuat sertifikat dari database...</p>
              </motion.div>
            )}

            {/* ── Error ──────────────────────────────────────────────────── */}
            {!loading && error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center py-12 rounded-2xl border border-destructive/20 bg-destructive/5"
              >
                <p className="text-sm text-destructive mb-3">{error}</p>
                <button onClick={handleRefresh} className="text-xs text-[var(--primary)] underline">
                  Coba lagi
                </button>
              </motion.div>
            )}

            {/* ── Empty ──────────────────────────────────────────────────── */}
            {!loading && !error && certs.length === 0 && (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center py-24 rounded-2xl border border-border bg-white/60 dark:bg-[#1a1932]/40 backdrop-blur-sm"
              >
                <GraduationCap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-lg font-medium text-muted-foreground mb-2">Tidak Ada Sertifikat</p>
                <p className="text-sm text-muted-foreground/60 max-w-sm mx-auto">{cfg.emptyText}</p>
              </motion.div>
            )}

            {/* ── Certificate Grid ────────────────────────────────────────── */}
            {!loading && !error && certs.length > 0 && (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
              >
                {certs.map((cert, idx) => (
                  <CertCard
                    key={cert.id}
                    cert={cert}
                    role={role}
                    delay={idx * 0.04}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Certificate Card ─────────────────────────────────────────────────────────

function CertCard({ cert, role, delay }: { cert: CertRow; role: Role; delay: number }) {
  // On-chain validity: if validated → use onChainValid, else fall back to status
  const isOnChainValid = cert.onChainValid;
  const hasBeenValidated = cert.onChainValid !== undefined;

  const statusKey = cert.status;
  const instName = cert.institutions?.name || shortAddr(cert.institution_wallet);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="group relative rounded-3xl border border-border bg-white/70 dark:bg-[#1a1932]/50 backdrop-blur-sm hover:shadow-xl hover:shadow-[var(--primary)]/5 transition-all duration-300 overflow-hidden flex flex-col"
    >
      {/* Gradient header */}
      <div className={`h-20 flex items-center justify-center flex-shrink-0 ${
        cert.status === 'MINTED'
          ? 'bg-gradient-to-br from-emerald-500/10 via-[var(--primary)]/5 to-transparent'
          : cert.status === 'REVOKED'
          ? 'bg-gradient-to-br from-red-500/10 via-rose-500/5 to-transparent'
          : 'bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent'
      }`}>
        {cert.status === 'MINTED'
          ? <Award className="h-9 w-9 text-[var(--primary)]/40" />
          : cert.status === 'REVOKED'
          ? <ShieldX className="h-9 w-9 text-red-500/40" />
          : <GraduationCap className="h-9 w-9 text-amber-500/40" />
        }
      </div>

      <div className="p-5 flex flex-col flex-1 gap-3">
        {/* Top row: token ID + status */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-[var(--primary)] bg-[var(--secondary)] px-2.5 py-1 rounded-full">
            <Hash className="h-2.5 w-2.5" />
            {cert.token_id !== null ? cert.token_id : '—'}
          </span>

          <div className="flex items-center gap-1.5">
            {/* Supabase status */}
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[statusKey]}`}>
              {statusKey === 'MINTED' && <ShieldCheck className="h-3 w-3" />}
              {statusKey === 'REVOKED' && <ShieldX className="h-3 w-3" />}
              {STATUS_LABEL[statusKey]}
            </span>

            {/* On-chain badge (only if validated) */}
            {hasBeenValidated && statusKey === 'MINTED' && (
              <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full ${
                isOnChainValid
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
              }`}>
                {isOnChainValid
                  ? <><ShieldCheck className="h-2.5 w-2.5" />On-chain</>
                  : <><ShieldX className="h-2.5 w-2.5" />Revoked</>
                }
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <div>
          <h3 className="text-sm font-bold text-foreground line-clamp-2 leading-snug">
            {cert.title}
          </h3>
          {cert.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{cert.description}</p>
          )}
        </div>

        {/* Meta rows */}
        <div className="space-y-1.5 text-xs text-muted-foreground">
          {/* Institution */}
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{instName}</span>
          </div>

          {/* Recipient — show in institution & admin mode */}
          {(role === 'institution' || role === 'admin') && (
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">
                <span className="font-medium text-foreground/80">{cert.recipient_name}</span>
                {' · '}
                <span className="font-mono">{shortAddr(cert.recipient_wallet)}</span>
              </span>
            </div>
          )}

          {/* Institution wallet — show in admin mode */}
          {role === 'admin' && (
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="font-mono truncate">{shortAddr(cert.institution_wallet)}</span>
            </div>
          )}

          {/* Date */}
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              {new Date(cert.issued_date).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
          {cert.tx_hash ? (
            <a
              href={`https://testnet.monadexplorer.com/tx/${cert.tx_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[var(--primary)] hover:underline"
            >
              <FileText className="h-3 w-3" />
              Tx Hash
            </a>
          ) : (
            <span className="text-xs text-muted-foreground/50">Belum di-mint</span>
          )}

          {cert.metadata_url && (
            <a
              href={cert.metadata_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[var(--primary)] hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Metadata
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
