'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { EDUTRUST_ABI, EDUTRUST_ADDRESS } from '@/config/contracts';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  ShieldAlert, Plus, Send, Loader2, CheckCircle2, XCircle,
  History, Trash2, Upload, FileText, X, ImageIcon
} from 'lucide-react';
import { RegistrationForm } from '@/components/dashboard/RegistrationForm';
import { parseAbiItem, decodeEventLog } from 'viem';

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
  file: File | null;           // Physical certificate file (PDF/image)
  filePreview: string | null;  // Object URL for preview
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const ACCEPTED_FILE_TYPES = '.pdf,.jpg,.jpeg,.png,.webp';
const MAX_FILE_SIZE_MB = 10;

function FileDropZone({
  value,
  preview,
  onChange,
  onClear,
}: {
  value: File | null;
  preview: string | null;
  onChange: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file: File) => {
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      alert(`Ukuran file maksimal ${MAX_FILE_SIZE_MB}MB`);
      return;
    }
    onChange(file);
  };

  const isImage = value?.type.startsWith('image/');

  return (
    <div className="md:col-span-2">
      {!value ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
          onClick={() => inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-2 h-28 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
            dragging
              ? 'border-[var(--primary)] bg-[var(--primary)]/5'
              : 'border-border hover:border-[var(--primary)]/50 hover:bg-[var(--secondary)]/50'
          }`}
        >
          <Upload className="h-6 w-6 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Upload File Sertifikat</p>
            <p className="text-xs text-muted-foreground">PDF, JPG, PNG — Maks. {MAX_FILE_SIZE_MB}MB</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      ) : (
        <div className="relative flex items-center gap-3 p-3 rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/5">
          {isImage && preview ? (
            <img src={preview} alt="preview" className="h-14 w-14 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="h-14 w-14 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
              <FileText className="h-6 w-6 text-red-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{value.name}</p>
            <p className="text-xs text-muted-foreground">{(value.size / 1024).toFixed(0)} KB · {value.type.split('/')[1]?.toUpperCase()}</p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ABI item for parsing CertificateIssued event from tx receipt
const CERT_ISSUED_ABI = parseAbiItem(
  'event CertificateIssued(uint256 indexed tokenId, address indexed recipient, address indexed institution, string metadataURI, uint256 timestamp)'
);

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [tab, setTab] = useState<'issue' | 'history'>('issue');
  const [recipients, setRecipients] = useState<RecipientInput[]>([
    { name: '', wallet: '', title: '', description: '', file: null, filePreview: null },
  ]);
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [mintError, setMintError] = useState<string | null>(null);
  // Track Supabase cert UUIDs inserted before mint (used to update after confirmation)
  const pendingCertIds = useRef<{ id: string; wallet: string; metadataUrl: string }[]>([]);

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
    if (address && isApproved) fetchCertificates();
  }, [address, isApproved]);

  useEffect(() => {
    if (!isConfirmed || !txHash || !publicClient) return;

    // After mint confirmed: fetch receipt, parse tokenIds from events, update Supabase
    (async () => {
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

        // Decode all CertificateIssued events from the receipt logs
        const tokenMap = new Map<string, bigint>(); // recipient.toLowerCase() → tokenId
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({ abi: [CERT_ISSUED_ABI], ...log });
            if (decoded.eventName === 'CertificateIssued') {
              const { tokenId, recipient } = decoded.args as { tokenId: bigint; recipient: string };
              tokenMap.set(recipient.toLowerCase(), tokenId);
            }
          } catch { /* skip non-matching logs */ }
        }

        // Update each pending Supabase row with tokenId + txHash + MINTED status
        await Promise.allSettled(
          pendingCertIds.current.map(({ id, wallet }) => {
            const tokenId = tokenMap.get(wallet.toLowerCase());
            if (tokenId === undefined) return Promise.resolve();
            return fetch('/api/certificates', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id,
                token_id: Number(tokenId),
                tx_hash: txHash,
              }),
            });
          })
        );
      } catch (err) {
        console.error('[dashboard] post-mint Supabase update error:', err);
      } finally {
        pendingCertIds.current = [];
        setUploadProgress('');
        setRecipients([{ name: '', wallet: '', title: '', description: '', file: null, filePreview: null }]);
        if (address && isApproved) fetchCertificates();
      }
    })();
  }, [isConfirmed, txHash]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setRecipients([...recipients, { name: '', wallet: '', title: '', description: '', file: null, filePreview: null }]);
  };

  const removeRecipient = (i: number) => {
    const r = recipients[i];
    if (r.filePreview) URL.revokeObjectURL(r.filePreview);
    setRecipients(recipients.filter((_, idx) => idx !== i));
  };

  const updateRecipient = (i: number, field: keyof Omit<RecipientInput, 'file' | 'filePreview'>, value: string) => {
    const updated = [...recipients];
    updated[i][field] = value;
    setRecipients(updated);
  };

  const setFile = (i: number, file: File) => {
    const updated = [...recipients];
    if (updated[i].filePreview) URL.revokeObjectURL(updated[i].filePreview!);
    updated[i].file = file;
    updated[i].filePreview = URL.createObjectURL(file);
    setRecipients(updated);
  };

  const clearFile = (i: number) => {
    const updated = [...recipients];
    if (updated[i].filePreview) URL.revokeObjectURL(updated[i].filePreview!);
    updated[i].file = null;
    updated[i].filePreview = null;
    setRecipients(updated);
  };

  const handleMint = async () => {
    if (!address) return;
    const validRecipients = recipients.filter((r) => r.name && r.wallet && r.title);
    if (validRecipients.length === 0) return;

    setMintError(null);
    pendingCertIds.current = [];
    const metadataUrls: string[] = [];
    const wallets: `0x${string}`[] = [];

    for (let idx = 0; idx < validRecipients.length; idx++) {
      const r = validRecipients[idx];
      const ts = Date.now();
      const slug = Math.random().toString(36).substring(7);

      // 1. Upload physical certificate file (PDF/image) if provided
      let documentUrl: string | null = null;
      if (r.file) {
        const ext = r.file.name.split('.').pop();
        const docPath = `documents/${address.toLowerCase()}/${ts}_${slug}.${ext}`;
        setUploadProgress(`[${idx + 1}/${validRecipients.length}] Mengupload file sertifikat...`);
        const { data: docData, error: docErr } = await supabase.storage
          .from('certificates')
          .upload(docPath, r.file, { upsert: false, contentType: r.file.type });
        if (!docErr && docData) {
          const { data: pubUrl } = supabase.storage.from('certificates').getPublicUrl(docData.path);
          documentUrl = pubUrl.publicUrl;
        }
      }

      // 2. Build ERC-721 metadata JSON
      const metadata: Record<string, unknown> = {
        name: r.title,
        description: r.description || `Certificate issued to ${r.name}`,
        attributes: [
          { trait_type: 'Recipient Name', value: r.name },
          { trait_type: 'Issuer', value: address },
          { trait_type: 'Issued Date', value: new Date().toISOString().split('T')[0] },
        ],
      };
      if (documentUrl) {
        metadata.image = documentUrl;
        metadata.document_url = documentUrl;
      }

      // 3. Upload metadata JSON to Supabase Storage
      setUploadProgress(`[${idx + 1}/${validRecipients.length}] Menyimpan metadata...`);
      const metaBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
      const metaPath = `metadata/${address.toLowerCase()}/${ts}_${slug}.json`;
      const { data: metaData, error: metaErr } = await supabase.storage
        .from('certificates')
        .upload(metaPath, metaBlob, { upsert: false, contentType: 'application/json' });

      let metadataUrl: string;
      if (metaErr || !metaData) {
        metadataUrl = `data:application/json;base64,${btoa(JSON.stringify(metadata))}`;
      } else {
        const { data: pubUrl } = supabase.storage.from('certificates').getPublicUrl(metaData.path);
        metadataUrl = pubUrl.publicUrl;
      }
      metadataUrls.push(metadataUrl);
      wallets.push(r.wallet as `0x${string}`);

      // 4. INSERT certificate row to Supabase (PENDING_MINT)
      setUploadProgress(`[${idx + 1}/${validRecipients.length}] Menyimpan ke database...`);
      try {
        const dbRes = await fetch('/api/certificates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            institution_wallet: address,
            recipient_wallet:   r.wallet,
            recipient_name:     r.name,
            title:              r.title,
            description:        r.description || null,
            metadata_url:       metadataUrl,
          }),
        });
        if (dbRes.ok) {
          const { id } = await dbRes.json();
          pendingCertIds.current.push({ id, wallet: r.wallet, metadataUrl });
        }
      } catch (err) {
        console.warn('[dashboard] Supabase pre-insert failed:', err);
        // non-fatal: continue to mint even if DB insert failed
      }
    }

    setUploadProgress('Mengirim transaksi ke blockchain Monad...');

    try {
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
    } catch {
      setMintError('Gagal mengirim transaksi. Pastikan wallet terhubung dan memiliki cukup MON.');
      setUploadProgress('');
    }
  };

  // ── Guards ────────────────────────────────────────────────

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
      <div className="min-h-screen pt-24 pb-16 px-5 sm:px-8 relative overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-gradient-to-br from-[#c4b5fd]/20 to-[#a78bfa]/10 blur-[100px] pointer-events-none animate-float" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] rounded-full bg-gradient-to-br from-[#67e8f9]/15 to-[#22d3ee]/5 blur-[100px] pointer-events-none animate-float-delayed" />
        <RegistrationForm walletAddress={address!} />
      </div>
    );
  }

  // ── Main Dashboard ────────────────────────────────────────

  return (
    <div className="min-h-screen pt-24 pb-16 px-5 sm:px-8">
      <div className="max-w-5xl mx-auto">
        <motion.div initial="hidden" animate="show" variants={fadeUp} className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Portal Institusi</h1>
          <p className="text-muted-foreground">Terbitkan sertifikat Soulbound Token ke penerima.</p>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          {([
            { key: 'issue', icon: Plus, label: 'Terbitkan Sertifikat' },
            { key: 'history', icon: History, label: 'Riwayat' },
          ] as const).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === key
                  ? 'bg-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/20'
                  : 'bg-[var(--secondary)] text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="inline h-4 w-4 mr-1.5 -mt-0.5" />{label}
            </button>
          ))}
        </div>

        {/* Issue Tab */}
        {tab === 'issue' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {recipients.map((r, i) => (
              <div key={i} className="p-6 rounded-2xl border border-border bg-white/60 dark:bg-[#1a1932]/40 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[var(--primary)] bg-[var(--secondary)] px-2.5 py-1 rounded-full">
                      Penerima #{i + 1}
                    </span>
                    {r.file && (
                      <span className="text-xs flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        {r.file.type.startsWith('image/') ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                        {r.file.name.length > 20 ? r.file.name.slice(0, 20) + '...' : r.file.name}
                      </span>
                    )}
                  </div>
                  {recipients.length > 1 && (
                    <button
                      onClick={() => removeRecipient(i)}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Text inputs */}
                  <input
                    type="text"
                    placeholder="Nama Lengkap Penerima *"
                    value={r.name}
                    onChange={(e) => updateRecipient(i, 'name', e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]"
                  />
                  <input
                    type="text"
                    placeholder="Wallet Address (0x...) *"
                    value={r.wallet}
                    onChange={(e) => updateRecipient(i, 'wallet', e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]"
                  />
                  <input
                    type="text"
                    placeholder="Judul Sertifikat *"
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

                  {/* File drop zone — full width */}
                  <FileDropZone
                    value={r.file}
                    preview={r.filePreview}
                    onChange={(f) => setFile(i, f)}
                    onClear={() => clearFile(i)}
                  />
                </div>
              </div>
            ))}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button variant="outline" onClick={addRecipient} className="rounded-xl border-dashed border-2">
                <Plus className="h-4 w-4 mr-2" />Tambah Penerima (Batch)
              </Button>
              <Button
                onClick={handleMint}
                disabled={isMinting || isConfirming || !!uploadProgress}
                className="rounded-xl bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white shadow-lg shadow-[var(--primary)]/20"
              >
                {isMinting || isConfirming || uploadProgress ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{uploadProgress || (isConfirming ? 'Mengkonfirmasi...' : 'Memproses...')}</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" />Terbitkan {recipients.length > 1 ? `${recipients.length} Sertifikat (Batch)` : 'Sertifikat'}</>
                )}
              </Button>
            </div>

            {/* Status messages */}
            <AnimatePresence mode="wait">
              {mintError && (
                <motion.div key="err" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="p-4 rounded-2xl border border-destructive/30 bg-destructive/5 flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                  <p className="text-sm text-destructive">{mintError}</p>
                </motion.div>
              )}
              {isConfirmed && txHash && (
                <motion.div key="ok" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Sertifikat Berhasil Diterbitkan!</p>
                    <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 font-mono mt-0.5 break-all">TX: {txHash}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
                            {cert.status === 'MINTED' && <CheckCircle2 className="h-3 w-3" />}
                            {cert.status === 'REVOKED' && <XCircle className="h-3 w-3" />}
                            {cert.status === 'PENDING_MINT' && <Loader2 className="h-3 w-3" />}
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
