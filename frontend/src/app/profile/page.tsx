'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAccount, usePublicClient, useReadContract } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseAbiItem, type PublicClient } from 'viem';
import { EDUTRUST_ABI, EDUTRUST_ADDRESS } from '@/config/contracts';
import { supabase } from '@/lib/supabase';
import {
  Award, Wallet, Loader2, ExternalLink, ShieldCheck,
  ShieldX, RefreshCw, Calendar, Building2
} from 'lucide-react';

interface OnChainCert {
  tokenId: bigint;
  recipient: string;
  institution: string;
  uri: string;
  timestamp: bigint;
  isValid: boolean;
  // Enriched
  institutionName?: string;
  metadataTitle?: string;
  metadataImage?: string;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

// Monad Testnet RPC: eth_getLogs max range = 100 blocks
// We use 90 to stay safely under the limit
const CHUNK_SIZE = BigInt(90);

const CERT_ISSUED_EVENT = parseAbiItem(
  'event CertificateIssued(uint256 indexed tokenId, address indexed recipient, address indexed institution, string metadataURI, uint256 timestamp)'
);

/**
 * Fetches all matching logs by chunking the block range into ≤90-block slices.
 * Required because Monad Testnet RPC limits eth_getLogs to 100-block ranges.
 */
async function getLogsChunked(
  publicClient: PublicClient,
  address: `0x${string}`,
  recipient: `0x${string}`,
  onProgress?: (msg: string) => void
) {
  const latestBlock = await publicClient.getBlockNumber();
  const allLogs: Awaited<ReturnType<typeof publicClient.getLogs>> = [];

  for (let from = BigInt(0); from <= latestBlock; from += CHUNK_SIZE) {
    const to = from + CHUNK_SIZE - BigInt(1) > latestBlock
      ? latestBlock
      : from + CHUNK_SIZE - BigInt(1);

    const pct = Math.round(Number((from * BigInt(100)) / (latestBlock || BigInt(1))));
    onProgress?.(`Memindai blockchain... ${pct}% (blok ${from.toString()})`);

    const chunk = await publicClient.getLogs({
      address,
      event: CERT_ISSUED_EVENT,
      args: { recipient },
      fromBlock: from,
      toBlock: to,
    });

    if (chunk.length > 0) allLogs.push(...chunk);
  }

  return allLogs;
}

// Fetch and parse metadata JSON from tokenURI
async function fetchMetadata(uri: string): Promise<{ name?: string; image?: string } | null> {
  try {
    if (uri.startsWith('data:application/json;base64,')) {
      const json = JSON.parse(atob(uri.replace('data:application/json;base64,', '')));
      return json;
    }
    const res = await fetch(uri, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [certs, setCerts] = useState<OnChainCert[]>([]);
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: balance } = useReadContract({
    abi: EDUTRUST_ABI,
    address: EDUTRUST_ADDRESS,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const loadCertificates = useCallback(async () => {
    if (!address || !publicClient) return;
    setLoading(true);
    setProgressText('Memulai pemindaian blockchain...');
    setError(null);

    try {
      // 1. Fetch CertificateIssued events with chunked getLogs (Monad limit: 100 blocks/req)
      const logs = await getLogsChunked(
        publicClient,
        EDUTRUST_ADDRESS,
        address as `0x${string}`,
        setProgressText
      );

      if (logs.length === 0) {
        setCerts([]);
        setLoading(false);
        setProgressText('');
        return;
      }

      setProgressText('Memuat detail sertifikat...');

      // 2. Fetch getCredential for each tokenId to get live validity status
      const credentialResults = await Promise.allSettled(
        logs.map((log) =>
          publicClient.readContract({
            address: EDUTRUST_ADDRESS,
            abi: EDUTRUST_ABI,
            functionName: 'getCredential',
            args: [log.args.tokenId!],
          })
        )
      );

      // 3. Get unique institution wallets → single Supabase query
      const institutionWallets = [...new Set(logs.map((l) => l.args.institution!.toLowerCase()))];
      const { data: institutions } = await supabase
        .from('institutions')
        .select('wallet_address, name')
        .in('wallet_address', institutionWallets);
      const instMap = new Map(institutions?.map((i) => [i.wallet_address.toLowerCase(), i.name]) ?? []);

      // 4. Build enriched cert objects
      const enriched: OnChainCert[] = [];
      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        const result = credentialResults[i];

        if (result.status === 'rejected') continue;
        const [recipient, institution, uri, timestamp, isValid] = result.value as [string, string, string, bigint, boolean];

        const cert: OnChainCert = {
          tokenId: log.args.tokenId!,
          recipient,
          institution,
          uri,
          timestamp,
          isValid,
          institutionName: instMap.get(institution.toLowerCase()),
        };

        // 5. Fetch metadata JSON for title & image (non-blocking)
        if (uri) {
          const meta = await fetchMetadata(uri);
          if (meta) {
            cert.metadataTitle = meta.name;
            cert.metadataImage = meta.image;
          }
        }

        enriched.push(cert);
      }

      // Sort: newest first (highest tokenId)
      enriched.sort((a, b) => Number(b.tokenId - a.tokenId));
      setCerts(enriched);
    } catch (err) {
      console.error('[profile] loadCertificates error:', err);
      setError('Gagal memuat data dari blockchain. Periksa koneksi dan coba lagi.');
    }

    setLoading(false);
    setProgressText('');
  }, [address, publicClient]);

  useEffect(() => {
    if (isConnected && address) loadCertificates();
  }, [isConnected, address, loadCertificates]);

  // ── Not connected ──────────────────────────────────────────

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--secondary)] flex items-center justify-center mx-auto mb-6">
            <Wallet className="h-8 w-8 text-[var(--primary)]" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Profil Saya</h2>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Koneksikan wallet Anda untuk melihat sertifikat digital yang Anda miliki.
          </p>
          <ConnectButton />
        </motion.div>
      </div>
    );
  }

  // ── Main ───────────────────────────────────────────────────

  return (
    <div className="min-h-screen pt-24 pb-16 px-5 sm:px-8 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[350px] h-[350px] rounded-full bg-gradient-to-br from-[#c4b5fd]/20 to-[#a78bfa]/10 blur-[100px] pointer-events-none animate-float" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[300px] h-[300px] rounded-full bg-gradient-to-br from-[#67e8f9]/15 to-[#22d3ee]/5 blur-[100px] pointer-events-none animate-float-delayed" />

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }}>
          <motion.div variants={fadeUp} className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Sertifikat Saya</h1>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted-foreground font-mono truncate max-w-[260px] sm:max-w-none">{address}</p>
                {balance !== undefined && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[var(--secondary)] text-[var(--primary)]">
                    {balance.toString()} SBT
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={loadCertificates}
              disabled={loading}
              className="mt-1 p-2.5 rounded-xl border border-border bg-white/60 dark:bg-[#1a1932]/40 hover:bg-[var(--secondary)] transition-colors disabled:opacity-50 flex-shrink-0"
              title="Refresh dari blockchain"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </motion.div>

          {/* Loading */}
          {loading && (
            <motion.div variants={fadeUp} className="flex flex-col items-center py-20 gap-4">
              <div className="relative">
                <Loader2 className="h-10 w-10 animate-spin text-[var(--primary)]" />
                <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-[var(--primary)]/10" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground mb-1">Memindai Blockchain Monad</p>
                <p className="text-xs text-muted-foreground font-mono max-w-xs">
                  {progressText || 'Menginisialisasi...'}
                </p>
              </div>
              <p className="text-xs text-muted-foreground/50">
                Monad RPC membatasi 100 blok per request — scan dilakukan bertahap
              </p>
            </motion.div>
          )}


          {/* Error */}
          {!loading && error && (
            <motion.div variants={fadeUp}
              className="text-center py-12 rounded-2xl border border-destructive/20 bg-destructive/5">
              <p className="text-sm text-destructive mb-3">{error}</p>
              <button onClick={loadCertificates}
                className="text-xs text-[var(--primary)] underline">Coba lagi</button>
            </motion.div>
          )}

          {/* Empty */}
          {!loading && !error && certs.length === 0 && (
            <motion.div variants={fadeUp}
              className="text-center py-20 rounded-2xl border border-border bg-white/60 dark:bg-[#1a1932]/40 backdrop-blur-sm">
              <Award className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-lg font-medium text-muted-foreground mb-2">Belum Ada Sertifikat</p>
              <p className="text-sm text-muted-foreground/60">
                Sertifikat SBT yang diterbitkan ke wallet Anda akan muncul di sini.
              </p>
            </motion.div>
          )}

          {/* Certificate cards */}
          {!loading && !error && certs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {certs.map((cert) => (
                <motion.div
                  key={cert.tokenId.toString()}
                  variants={fadeUp}
                  className="group relative rounded-3xl border border-border bg-white/70 dark:bg-[#1a1932]/50 backdrop-blur-sm hover:shadow-xl hover:shadow-[var(--primary)]/5 transition-all duration-300 overflow-hidden"
                >
                  {/* Certificate image / gradient header */}
                  {cert.metadataImage ? (
                    <div className="h-36 overflow-hidden">
                      <img
                        src={cert.metadataImage}
                        alt={cert.metadataTitle || 'Certificate'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  ) : (
                    <div className="h-24 bg-gradient-to-br from-[var(--primary)]/10 via-[#38bdf8]/5 to-transparent flex items-center justify-center">
                      <Award className="h-10 w-10 text-[var(--primary)]/30" />
                    </div>
                  )}

                  <div className="p-6">
                    {/* Token ID + validity badge */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-mono font-bold text-[var(--primary)] bg-[var(--secondary)] px-2.5 py-1 rounded-full">
                        #{cert.tokenId.toString()}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                        cert.isValid
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                      }`}>
                        {cert.isValid
                          ? <><ShieldCheck className="h-3 w-3" /> Valid</>
                          : <><ShieldX className="h-3 w-3" /> Dicabut</>
                        }
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-base font-bold text-foreground mb-1 line-clamp-2">
                      {cert.metadataTitle || 'Sertifikat #' + cert.tokenId.toString()}
                    </h3>

                    {/* Institution */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
                      <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">
                        {cert.institutionName || `${cert.institution.slice(0, 8)}...${cert.institution.slice(-4)}`}
                      </span>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(Number(cert.timestamp) * 1000).toLocaleDateString('id-ID', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </span>
                      {cert.uri && (
                        <a
                          href={cert.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-[var(--primary)] hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />Metadata
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
