'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Building2, Mail, Globe, FileText, CheckCircle2,
  Loader2, ClipboardList, Clock
} from 'lucide-react';

// Must match DB CHECK constraint: type IN ('UNIVERSITY', 'COMPANY', 'COMMUNITY')
const INSTITUTION_TYPES: { label: string; value: 'UNIVERSITY' | 'COMPANY' | 'COMMUNITY' }[] = [
  { label: 'Universitas / Perguruan Tinggi', value: 'UNIVERSITY' },
  { label: 'Sekolah / Lembaga Pendidikan', value: 'UNIVERSITY' },
  { label: 'Perusahaan (Sertifikat Magang)', value: 'COMPANY' },
  { label: 'Lembaga Pelatihan / Bootcamp', value: 'COMMUNITY' },
  { label: 'Komunitas / Organisasi', value: 'COMMUNITY' },
];

interface Props {
  walletAddress: string;
}

type FormState = 'idle' | 'submitting' | 'success' | 'already_registered' | 'error';

export function RegistrationForm({ walletAddress }: Props) {
  const [formState, setFormState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState({
    name: '',
    typeIndex: 0,
    contact_email: '',
    website: '',
    description: '',
  });
  const [errors, setErrors] = useState<{ name?: string; contact_email?: string }>({});

  const set = <K extends keyof typeof form>(field: K, value: typeof form[K]) => {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((p) => ({ ...p, [field]: '' }));
  };

  const validate = () => {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = 'Nama institusi wajib diisi';
    if (!form.contact_email.trim()) e.contact_email = 'Email wajib diisi';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email))
      e.contact_email = 'Format email tidak valid';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setFormState('submitting');
    setErrorMsg('');

    // 1. Check if already registered (anon SELECT is allowed)
    const { data: existing } = await supabase
      .from('institutions')
      .select('id, status')
      .eq('wallet_address', walletAddress.toLowerCase())
      .maybeSingle();

    if (existing) {
      setFormState('already_registered');
      return;
    }

    // 2. Insert via API route (server-side uses service_role key)
    const res = await fetch('/api/institutions/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet_address: walletAddress.toLowerCase(),
        name: form.name.trim(),
        type: INSTITUTION_TYPES[form.typeIndex].value,
        contact_email: form.contact_email.trim(),
        website: form.website.trim() || null,
        description: form.description.trim() || null,
      }),
    });

    if (res.ok) {
      setFormState('success');
    } else {
      const body = await res.json().catch(() => ({}));
      setErrorMsg(body.error || 'Gagal mendaftar, coba lagi.');
      setFormState('error');
    }
  };

  if (formState === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-12 px-6 rounded-3xl border border-emerald-200 dark:border-emerald-800/50 bg-gradient-to-br from-emerald-50/80 to-teal-50/80 dark:from-emerald-950/20 dark:to-teal-950/20"
      >
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold text-emerald-800 dark:text-emerald-200 mb-2">
          Pendaftaran Terkirim!
        </h3>
        <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80 max-w-sm mx-auto">
          Data institusi Anda sudah diterima dan sedang menunggu review oleh admin MonadCert.
          Anda akan dapat mengakses dashboard setelah disetujui.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
          <Clock className="h-3.5 w-3.5" />
          Status: Menunggu Persetujuan Admin
        </div>
      </motion.div>
    );
  }

  if (formState === 'already_registered') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-12 px-6 rounded-3xl border border-amber-200 dark:border-amber-800/50 bg-gradient-to-br from-amber-50/80 to-orange-50/80 dark:from-amber-950/20 dark:to-orange-950/20"
      >
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mx-auto mb-5">
          <ClipboardList className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h3 className="text-xl font-bold text-amber-800 dark:text-amber-200 mb-2">Sudah Terdaftar</h3>
        <p className="text-sm text-amber-600/80 dark:text-amber-400/80 max-w-sm mx-auto">
          Wallet ini sudah terdaftar dan sedang menunggu persetujuan admin.
          Mohon tunggu notifikasi dari tim MonadCert.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
      <div className="mb-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--primary)]/10 to-[#38bdf8]/10 flex items-center justify-center mx-auto mb-4">
          <Building2 className="h-7 w-7 text-[var(--primary)]" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Daftarkan Institusi Anda</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Isi formulir di bawah untuk meminta akses sebagai institusi penerbit sertifikat.
          Admin akan mereview dan menyetujui pendaftaran Anda.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="p-6 rounded-2xl border border-border bg-white/60 dark:bg-[#1a1932]/40 backdrop-blur-sm space-y-5">
          {/* Wallet (readonly) */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Wallet Address
            </label>
            <div className="h-11 px-4 rounded-xl border border-border bg-[var(--muted)]/50 flex items-center">
              <span className="text-sm font-mono text-muted-foreground truncate">{walletAddress}</span>
            </div>
          </div>

          {/* Nama Institusi */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Nama Institusi <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              placeholder="Universitas / Nama Lembaga"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className={`w-full h-11 px-4 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-colors ${
                errors.name ? 'border-destructive' : 'border-border'
              }`}
            />
            <AnimatePresence>
              {errors.name && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="text-xs text-destructive mt-1">{errors.name}</motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Tipe — maps to DB enum values */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Tipe Institusi
            </label>
            <select
              value={form.typeIndex}
              onChange={(e) => set('typeIndex', Number(e.target.value))}
              className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-colors"
            >
              {INSTITUTION_TYPES.map((t, i) => (
                <option key={i} value={i}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              <Mail className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
              Email Kontak <span className="text-destructive">*</span>
            </label>
            <input
              type="email"
              placeholder="admin@institusi.ac.id"
              value={form.contact_email}
              onChange={(e) => set('contact_email', e.target.value)}
              className={`w-full h-11 px-4 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-colors ${
                errors.contact_email ? 'border-destructive' : 'border-border'
              }`}
            />
            <AnimatePresence>
              {errors.contact_email && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="text-xs text-destructive mt-1">{errors.contact_email}</motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Website (optional) */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              <Globe className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
              Website <span className="text-muted-foreground/50">(opsional)</span>
            </label>
            <input
              type="url"
              placeholder="https://institusi.ac.id"
              value={form.website}
              onChange={(e) => set('website', e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-colors"
            />
          </div>

          {/* Deskripsi (optional) */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              <FileText className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
              Deskripsi Singkat <span className="text-muted-foreground/50">(opsional)</span>
            </label>
            <textarea
              rows={3}
              placeholder="Ceritakan singkat tentang institusi Anda..."
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-colors resize-none"
            />
          </div>
        </div>

        {/* Error message */}
        <AnimatePresence>
          {formState === 'error' && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="px-4 py-3 rounded-xl border border-destructive/30 bg-destructive/5 text-sm text-destructive">
              {errorMsg}
            </motion.div>
          )}
        </AnimatePresence>

        <Button
          type="submit"
          disabled={formState === 'submitting'}
          className="w-full h-12 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white font-semibold shadow-lg shadow-[var(--primary)]/20"
        >
          {formState === 'submitting' ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Mengirim Pendaftaran...</>
          ) : (
            <><Building2 className="h-4 w-4 mr-2" />Kirim Pendaftaran</>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Dengan mendaftar, Anda setuju bahwa data yang diberikan adalah akurat dan dapat diverifikasi.
        </p>
      </form>
    </motion.div>
  );
}
