'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { EDUTRUST_ABI, EDUTRUST_ADDRESS } from '@/config/contracts';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Plus, Send, Loader2, CheckCircle2, XCircle, History, Trash2 } from 'lucide-react';

interface CertificateRow {
  id: string;
  recipient_name: string;
  recipient_wallet: string;
  title: string;
  token_id: number | null;
  status: string;
  created_at: string;
}

interface RecipientInput {
  name: string;
  wallet: string;
  title: string;
  description: string;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<'issue' | 'history'>('issue');
  const [recipients, setRecipients] = useState<RecipientInput[]>([
    { name: '', wallet: '', title: '', description: '' },
  ]);
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(false);

  const { data: isApproved, isLoading: checkingApproval } = useReadContract({
    abi: EDUTRUST_ABI,
    address: EDUTRUST_ADDRESS,
    functionName: 'isApprovedInstitution',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { writeContract, data: txHash, isPending: isMinting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (address && isApproved) {
      fetchCertificates();
    }
  }, [address, isApproved]);

  const fetchCertificates = async () => {
    if (!address) return;
    setLoadingCerts(true);
    const { data } = await supabase
      .from('certificates')
      .select('*')
      .eq('institution_wallet', address.toLowerCase())
      .order('created_at', { ascending: false });
    if (data) setCertificates(data);
    setLoadingCerts(false);
  };

  const addRecipient = () => {
    setRecipients([...recipients, { name: '', wallet: '', title: '', description: '' }]);
  };

  const removeRecipient = (i: number) => {
    setRecipients(recipients.filter((_, idx) => idx !== i));
  };

  const updateRecipient = (i: number, field: keyof RecipientInput, value: string) => {
    const updated = [...recipients];
    updated[i][field] = value;
    setRecipients(updated);
  };

  const handleMint = async () => {
    if (!address) return;
    const validRecipients = recipients.filter((r) => r.name && r.wallet && r.title);
    if (validRecipients.length === 0) return;

    const metadataUrls: string[] = [];
    const wallets: `0x${string}`[] = [];

    for (const r of validRecipients) {
      const metadata = {
        name: r.title,
        description: r.description || `Certificate issued to ${r.name}`,
        attributes: [
          { trait_type: 'Recipient Name', value: r.name },
          { trait_type: 'Issuer', value: address },
          { trait_type: 'Issued Date', value: new Date().toISOString().split('T')[0] },
        ],
      };

      const blob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
      const fileName = `cert_${Date.now()}_${Math.random().toString(36).substring(7)}.json`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('certificates')
        .upload(fileName, blob);

      if (uploadError) {
        const url = `data:application/json;base64,${btoa(JSON.stringify(metadata))}`;
        metadataUrls.push(url);
      } else {
        const { data: publicUrl } = supabase.storage.from('certificates').getPublicUrl(uploadData.path);
        metadataUrls.push(publicUrl.publicUrl);
      }

      wallets.push(r.wallet as `0x${string}`);
    }

    if (validRecipients.length === 1) {
      writeContract({
        abi: EDUTRUST_ABI,
        address: EDUTRUST_ADDRESS,
        functionName: 'issueCertificate',
        args: [wallets[0], metadataUrls[0]],
      });
    } else {
      writeContract({
        abi: EDUTRUST_ABI,
        address: EDUTRUST_ADDRESS,
        functionName: 'batchIssueCertificate',
        args: [wallets, metadataUrls],
      });
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--secondary)] flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="h-8 w-8 text-[var(--primary)]" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Koneksikan Wallet Anda</h2>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Hubungkan wallet Anda untuk mengakses portal institusi dan menerbitkan sertifikat.
          </p>
          <ConnectButton />
        </motion.div>
      </div>
    );
  }

  if (checkingApproval) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (!isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Institusi Belum Terverifikasi</h2>
          <p className="text-muted-foreground mb-4">
            Wallet <code className="text-xs font-mono bg-[var(--muted)] px-2 py-1 rounded">{address}</code> belum terdaftar sebagai institusi yang disetujui.
          </p>
          <p className="text-sm text-muted-foreground">Hubungi admin MonadCert untuk mendaftarkan institusi Anda.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-5 sm:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div initial="hidden" animate="show" variants={fadeUp} className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Portal Institusi</h1>
          <p className="text-muted-foreground">Terbitkan sertifikat Soulbound Token ke penerima.</p>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setTab('issue')}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              tab === 'issue'
                ? 'bg-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/20'
                : 'bg-[var(--secondary)] text-muted-foreground hover:text-foreground'
            }`}
          >
            <Plus className="inline h-4 w-4 mr-1.5 -mt-0.5" />
            Terbitkan Sertifikat
          </button>
          <button
            onClick={() => setTab('history')}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              tab === 'history'
                ? 'bg-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/20'
                : 'bg-[var(--secondary)] text-muted-foreground hover:text-foreground'
            }`}
          >
            <History className="inline h-4 w-4 mr-1.5 -mt-0.5" />
            Riwayat
          </button>
        </div>

        {/* Issue Tab */}
        {tab === 'issue' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {recipients.map((r, i) => (
              <div key={i} className="p-6 rounded-2xl border border-border bg-white/60 dark:bg-[#1a1932]/40 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono font-semibold text-[var(--primary)]">Penerima #{i + 1}</span>
                  {recipients.length > 1 && (
                    <button onClick={() => removeRecipient(i)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Nama Lengkap Penerima"
                    value={r.name}
                    onChange={(e) => updateRecipient(i, 'name', e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]"
                  />
                  <input
                    type="text"
                    placeholder="Wallet Address (0x...)"
                    value={r.wallet}
                    onChange={(e) => updateRecipient(i, 'wallet', e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]"
                  />
                  <input
                    type="text"
                    placeholder="Judul Sertifikat"
                    value={r.title}
                    onChange={(e) => updateRecipient(i, 'title', e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]"
                  />
                  <input
                    type="text"
                    placeholder="Deskripsi (opsional)"
                    value={r.description}
                    onChange={(e) => updateRecipient(i, 'description', e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]"
                  />
                </div>
              </div>
            ))}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="outline"
                onClick={addRecipient}
                className="rounded-xl border-dashed border-2"
              >
                <Plus className="h-4 w-4 mr-2" />
                Tambah Penerima (Batch)
              </Button>

              <Button
                onClick={handleMint}
                disabled={isMinting || isConfirming}
                className="rounded-xl bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white shadow-lg shadow-[var(--primary)]/20"
              >
                {isMinting || isConfirming ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{isConfirming ? 'Mengkonfirmasi...' : 'Mengirim Transaksi...'}</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" />Terbitkan {recipients.length > 1 ? `${recipients.length} Sertifikat (Batch)` : 'Sertifikat'}</>
                )}
              </Button>
            </div>

            {isConfirmed && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-3"
              >
                <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Sertifikat Berhasil Diterbitkan!</p>
                  <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 font-mono mt-0.5">TX: {txHash}</p>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* History Tab */}
        {tab === 'history' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {loadingCerts ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
              </div>
            ) : certificates.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground">Belum ada sertifikat yang diterbitkan.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-[var(--muted)]/50">
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Penerima</th>
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Judul</th>
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Token ID</th>
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Status</th>
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {certificates.map((cert) => (
                      <tr key={cert.id} className="border-b border-border last:border-0 hover:bg-[var(--muted)]/30 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-medium">{cert.recipient_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{cert.recipient_wallet.slice(0, 10)}...</p>
                        </td>
                        <td className="px-5 py-4">{cert.title}</td>
                        <td className="px-5 py-4 font-mono text-[var(--primary)]">
                          {cert.token_id ? `#${cert.token_id}` : '—'}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            cert.status === 'MINTED'
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                              : cert.status === 'REVOKED'
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                          }`}>
                            {cert.status === 'MINTED' ? <CheckCircle2 className="h-3 w-3" /> : cert.status === 'REVOKED' ? <XCircle className="h-3 w-3" /> : <Loader2 className="h-3 w-3" />}
                            {cert.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground text-xs">
                          {new Date(cert.created_at).toLocaleDateString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
