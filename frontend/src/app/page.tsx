'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, ShieldCheck, Zap, GraduationCap, Search, Building2, Users, FileCheck } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useReadContract } from 'wagmi';
import { EDUTRUST_ABI, EDUTRUST_ADDRESS } from '@/config/contracts';

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const orbY = useTransform(scrollYProgress, [0, 1], [0, 120]);

  const { data: totalMinted } = useReadContract({
    abi: EDUTRUST_ABI,
    address: EDUTRUST_ADDRESS,
    functionName: 'totalMinted',
  });

  return (
    <div className="relative overflow-hidden">
      {/* ─── Decorative Orbs ─── */}
      <motion.div style={{ y: orbY }} className="absolute top-[-8%] left-[-6%] w-[480px] h-[480px] rounded-full bg-gradient-to-br from-[#c4b5fd]/40 to-[#a78bfa]/20 blur-[100px] pointer-events-none animate-float" />
      <motion.div style={{ y: orbY }} className="absolute top-[15%] right-[-8%] w-[420px] h-[420px] rounded-full bg-gradient-to-br from-[#67e8f9]/30 to-[#22d3ee]/10 blur-[100px] pointer-events-none animate-float-delayed" />
      <motion.div style={{ y: orbY }} className="absolute bottom-[-5%] left-[30%] w-[360px] h-[360px] rounded-full bg-gradient-to-br from-[#fbcfe8]/30 to-[#f9a8d4]/10 blur-[100px] pointer-events-none animate-float-slow" />

      {/* ─── HERO SECTION ─── */}
      <section ref={heroRef} className="relative pt-28 pb-24 px-5 sm:px-8 grain">
        <div className="max-w-5xl mx-auto flex flex-col items-center text-center">
          <motion.div initial="hidden" animate="show" variants={stagger}>
            {/* Status Badge */}
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-[#1a1932]/80 border border-border shadow-sm mb-8 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">Live di Monad Testnet</span>
              {totalMinted !== undefined && (
                <span className="text-xs font-mono font-semibold text-[var(--primary)] bg-[var(--secondary)] px-2 py-0.5 rounded-full">
                  {totalMinted.toString()} sertifikat
                </span>
              )}
            </motion.div>

            {/* Headline */}
            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] mb-6">
              <span className="block text-foreground">Verifikasi Kredensial</span>
              <span className="block bg-gradient-to-r from-[var(--primary)] via-[#38bdf8] to-[#a78bfa] bg-clip-text text-transparent">
                Instan & Permanen
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p variants={fadeUp} className="max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground leading-relaxed mb-10">
              Terbitkan ijazah dan sertifikat sebagai Soulbound Token di blockchain Monad.
              Tidak dapat dipalsukan, tidak dapat dipindahtangankan, diverifikasi dalam hitungan detik.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center gap-4">
              <Link href="/verify">
                <Button size="lg" className="h-13 px-8 rounded-2xl text-base font-semibold shadow-xl shadow-[var(--primary)]/20 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white">
                  <Search className="mr-2 h-5 w-5" />
                  Verifikasi Sekarang
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button size="lg" variant="outline" className="h-13 px-8 rounded-2xl text-base font-semibold border-border bg-white/60 dark:bg-white/5 backdrop-blur-sm hover:bg-[var(--secondary)]">
                  Portal Institusi
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          {/* Stats Bar */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mt-16 w-full max-w-3xl grid grid-cols-3 gap-4"
          >
            {[
              { value: '400ms', label: 'Waktu Blok', sub: 'Monad Speed' },
              { value: '10K+', label: 'TPS', sub: 'Eksekusi Paralel' },
              { value: totalMinted?.toString() || '—', label: 'Sertifikat', sub: 'Telah Diterbitkan' },
            ].map((stat, i) => (
              <div key={i} className="glass rounded-2xl p-5 text-center group hover:shadow-lg hover:shadow-[var(--primary)]/5 transition-all duration-300">
                <p className="text-2xl sm:text-3xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm font-medium text-muted-foreground mt-1">{stat.label}</p>
                <p className="text-xs text-[var(--primary)] font-medium mt-0.5">{stat.sub}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="py-24 px-5 sm:px-8 relative">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger} className="text-center mb-16">
            <motion.p variants={fadeUp} className="text-sm font-semibold text-[var(--primary)] uppercase tracking-widest mb-3">
              Alur Kerja
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-foreground">
              Bagaimana MonadCert Bekerja?
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger} className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: '01', icon: <Building2 className="h-6 w-6" />, title: 'Registrasi Institusi', desc: 'Universitas atau organisasi mendaftar dan divalidasi oleh admin protokol.' },
              { step: '02', icon: <FileCheck className="h-6 w-6" />, title: 'Input Data Penerima', desc: 'Institusi menginput nama, wallet, dan detail sertifikat penerima.' },
              { step: '03', icon: <Zap className="h-6 w-6" />, title: 'Minting SBT', desc: 'Smart contract menerbitkan Soulbound Token ke wallet penerima di Monad.' },
              { step: '04', icon: <Search className="h-6 w-6" />, title: 'Verifikasi Instan', desc: 'Siapapun dapat memverifikasi keaslian sertifikat langsung dari blockchain.' },
            ].map((item, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="relative p-6 rounded-2xl bg-white/80 dark:bg-[#1a1932]/50 border border-border backdrop-blur-sm group hover:border-[var(--primary)]/30 hover:shadow-lg hover:shadow-[var(--primary)]/5 transition-all duration-300"
              >
                <div className="text-xs font-mono font-bold text-[var(--primary)]/40 mb-4">{item.step}</div>
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--primary)]/10 to-[#38bdf8]/10 flex items-center justify-center text-[var(--primary)] mb-4 group-hover:scale-105 transition-transform">
                  {item.icon}
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── FEATURES BENTO ─── */}
      <section className="py-24 px-5 sm:px-8 bg-[var(--muted)]/30 relative grain">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger} className="text-center mb-16">
            <motion.p variants={fadeUp} className="text-sm font-semibold text-[var(--primary)] uppercase tracking-widest mb-3">
              Fitur Unggulan
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-foreground">
              Mengapa Memilih MonadCert?
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger} className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Feature 1 - Large */}
            <motion.div variants={fadeUp} className="md:col-span-2 p-8 rounded-3xl bg-gradient-to-br from-[var(--primary)]/5 to-[#38bdf8]/5 border border-[var(--primary)]/10 group hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center mb-5">
                <Zap className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Eksekusi Paralel Monad</h3>
              <p className="text-muted-foreground leading-relaxed max-w-lg">
                Menerbitkan ribuan sertifikat secara bersamaan dalam satu transaksi batch.
                Ideal untuk musim wisuda universitas besar tanpa network congestion.
              </p>
              <div className="mt-6 flex items-center gap-3">
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">10,000 TPS</span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">400ms Block</span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">Low Gas</span>
              </div>
            </motion.div>

            {/* Feature 2 */}
            <motion.div variants={fadeUp} className="p-8 rounded-3xl bg-white/60 dark:bg-[#1a1932]/40 border border-border backdrop-blur-sm group hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center mb-5">
                <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Soulbound Token</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Sertifikat diterbitkan sebagai SBT — terikat permanen di wallet penerima. Tidak bisa ditransfer atau diperjualbelikan.
              </p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div variants={fadeUp} className="p-8 rounded-3xl bg-white/60 dark:bg-[#1a1932]/40 border border-border backdrop-blur-sm group hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 flex items-center justify-center mb-5">
                <GraduationCap className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Universal Protocol</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Untuk Universitas (Ijazah), Perusahaan (Sertifikat Magang), dan Komunitas (Workshop & Bootcamp).
              </p>
            </motion.div>

            {/* Feature 4 - Large */}
            <motion.div variants={fadeUp} className="md:col-span-2 p-8 rounded-3xl bg-gradient-to-br from-[#38bdf8]/5 to-[#22d3ee]/5 border border-[#38bdf8]/10 group hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-100 to-cyan-100 dark:from-sky-900/30 dark:to-cyan-900/30 flex items-center justify-center mb-5">
                <Users className="h-6 w-6 text-sky-600 dark:text-sky-400" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Verifikasi Publik</h3>
              <p className="text-muted-foreground leading-relaxed max-w-lg">
                HRD dan pihak ketiga dapat memverifikasi keaslian sertifikat siapapun
                tanpa perlu login. Cukup masukkan Token ID atau scan QR code.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── CTA SECTION ─── */}
      <section className="py-24 px-5 sm:px-8 relative">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-foreground mb-5">
              Siap Membawa Institusi Anda<br />ke Era Web3?
            </motion.h2>
            <motion.p variants={fadeUp} className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
              Daftarkan institusi Anda sekarang dan mulai menerbitkan sertifikat digital yang aman dan permanen.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/dashboard">
                <Button size="lg" className="h-13 px-10 rounded-2xl text-base font-semibold shadow-xl shadow-[var(--primary)]/20 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white">
                  Daftar Institusi
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/verify">
                <Button size="lg" variant="outline" className="h-13 px-10 rounded-2xl text-base font-semibold border-border">
                  Coba Verifikasi
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
