'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { EDUTRUST_ABI, EDUTRUST_ADDRESS } from '@/config/contracts';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Loader2, CheckCircle2, XCircle, Building2, Ban } from 'lucide-react';

interface Institution {
  id: string;
  wallet_address: string;
  name: string;
  type: string;
  contact_email: string;
  status: string;
  created_at: string;
  description?: string;
  website?: string;
}

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionTarget, setActionTarget] = useState<string | null>(null);

  const { data: contractOwner, isLoading: checkingOwner } = useReadContract({
    abi: EDUTRUST_ABI,
    address: EDUTRUST_ADDRESS,
    functionName: 'owner',
  });

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const isAdmin = address && contractOwner && address.toLowerCase() === (contractOwner as string).toLowerCase();

  useEffect(() => {
    if (isAdmin) fetchInstitutions();
  }, [isAdmin]);

  useEffect(() => {
    if (isConfirmed) {
      fetchInstitutions();
      setActionTarget(null);
    }
  }, [isConfirmed]);

  const fetchInstitutions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('institutions')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setInstitutions(data);
    setLoading(false);
  };

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
          <p className="text-muted-foreground">Wallet Anda bukan Provider Admin dari smart contract EduTrust.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-5 sm:px-8">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-foreground mb-2">Admin Panel</h1>
          <p className="text-muted-foreground mb-8">Kelola institusi yang terdaftar di protokol MonadCert.</p>
        </motion.div>

        {isConfirmed && txHash && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Transaksi Berhasil!</p>
              <p className="text-xs text-emerald-600/80 font-mono">{txHash}</p>
            </div>
          </motion.div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
          </div>
        ) : institutions.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-border bg-white/60 dark:bg-[#1a1932]/40 backdrop-blur-sm">
            <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Belum ada institusi yang mendaftar.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {institutions.map((inst) => (
              <motion.div
                key={inst.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-2xl border border-border bg-white/60 dark:bg-[#1a1932]/40 backdrop-blur-sm hover:shadow-lg transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-foreground">{inst.name}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        inst.status === 'APPROVED'
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                          : inst.status === 'REJECTED'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                      }`}>
                        {inst.status}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--secondary)] text-[var(--primary)] font-medium">
                        {inst.type}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground mb-1">{inst.wallet_address}</p>
                    <p className="text-sm text-muted-foreground">{inst.contact_email}</p>
                    {inst.description && <p className="text-sm text-muted-foreground mt-1">{inst.description}</p>}
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleGrant(inst.wallet_address)}
                      disabled={isPending || isConfirming}
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
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
                      disabled={isPending || isConfirming}
                      className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 text-xs"
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
          </div>
        )}
      </div>
    </div>
  );
}
