'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useReadContract } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { EDUTRUST_ABI, EDUTRUST_ADDRESS } from '@/config/contracts';
import { supabase } from '@/lib/supabase';
import { Award, Wallet, Loader2, ExternalLink } from 'lucide-react';
import { useEffect } from 'react';

interface CertificateData {
  id: string;
  token_id: number;
  title: string;
  recipient_name: string;
  institution_wallet: string;
  institution_name?: string;
  status: string;
  created_at: string;
  metadata_url: string;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const [certificates, setCertificates] = useState<CertificateData[]>([]);
  const [loading, setLoading] = useState(false);

  const { data: balance } = useReadContract({
    abi: EDUTRUST_ABI,
    address: EDUTRUST_ADDRESS,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  useEffect(() => {
    if (address) {
      fetchMyCertificates();
    }
  }, [address]);

  const fetchMyCertificates = async () => {
    if (!address) return;
    setLoading(true);
    const { data } = await supabase
      .from('certificates')
      .select('*')
      .eq('recipient_wallet', address.toLowerCase())
      .eq('status', 'MINTED')
      .order('created_at', { ascending: false });

    if (data) {
      const withInstitutions = await Promise.all(
        data.map(async (cert) => {
          const { data: inst } = await supabase
            .from('institutions')
            .select('name')
            .eq('wallet_address', cert.institution_wallet.toLowerCase())
            .single();
          return { ...cert, institution_name: inst?.name };
        })
      );
      setCertificates(withInstitutions);
    }
    setLoading(false);
  };

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

  return (
    <div className="min-h-screen pt-24 pb-16 px-5 sm:px-8 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[350px] h-[350px] rounded-full bg-gradient-to-br from-[#c4b5fd]/20 to-[#a78bfa]/10 blur-[100px] pointer-events-none" />

      <div className="max-w-4xl mx-auto">
        <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }}>
          <motion.div variants={fadeUp} className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Sertifikat Saya</h1>
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground font-mono">{address}</p>
              {balance !== undefined && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[var(--secondary)] text-[var(--primary)]">
                  {balance.toString()} SBT
                </span>
              )}
            </div>
          </motion.div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
            </div>
          ) : certificates.length === 0 ? (
            <motion.div variants={fadeUp} className="text-center py-20 rounded-2xl border border-border bg-white/60 dark:bg-[#1a1932]/40 backdrop-blur-sm">
              <Award className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-lg font-medium text-muted-foreground mb-2">Belum Ada Sertifikat</p>
              <p className="text-sm text-muted-foreground/70">Sertifikat SBT yang Anda terima akan muncul di sini.</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {certificates.map((cert, i) => (
                <motion.div
                  key={cert.id}
                  variants={fadeUp}
                  className="group relative p-6 rounded-3xl border border-border bg-white/70 dark:bg-[#1a1932]/50 backdrop-blur-sm hover:shadow-xl hover:shadow-[var(--primary)]/5 transition-all duration-300 overflow-hidden"
                >
                  {/* Decorative gradient */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[var(--primary)]/5 to-transparent rounded-bl-[60px]" />

                  <div className="relative">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary)]/10 to-[#38bdf8]/10 flex items-center justify-center">
                        <Award className="h-5 w-5 text-[var(--primary)]" />
                      </div>
                      <span className="text-xs font-mono font-semibold text-[var(--primary)]">#{cert.token_id}</span>
                    </div>

                    <h3 className="text-lg font-bold text-foreground mb-1 line-clamp-2">{cert.title}</h3>
                    <p className="text-sm text-muted-foreground mb-1">{cert.recipient_name}</p>
                    <p className="text-xs text-muted-foreground/70 mb-4">
                      Diterbitkan oleh: {cert.institution_name || cert.institution_wallet.slice(0, 10) + '...'}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {new Date(cert.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                      {cert.metadata_url && (
                        <a href={cert.metadata_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--primary)] hover:underline inline-flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> Metadata
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
