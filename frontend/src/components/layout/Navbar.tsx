'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract } from 'wagmi';
import { EDUTRUST_ABI, EDUTRUST_ADDRESS } from '@/config/contracts';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { address } = useAccount();

  const { data: isApproved } = useReadContract({
    abi: EDUTRUST_ABI,
    address: EDUTRUST_ADDRESS,
    functionName: 'isApprovedInstitution',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: contractOwner } = useReadContract({
    abi: EDUTRUST_ABI,
    address: EDUTRUST_ADDRESS,
    functionName: 'owner',
  });

  const isAdmin = address && contractOwner && address.toLowerCase() === (contractOwner as string).toLowerCase();

  const navLinks = [
    { href: '/verify', label: 'Verifikasi' },
    ...(isApproved ? [{ href: '/dashboard', label: 'Dashboard' }] : []),
    ...(address ? [{ href: '/profile', label: 'Profil' }] : []),
    ...(isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2 group" onClick={() => setMobileOpen(false)}>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[#38bdf8] flex items-center justify-center shadow-lg shadow-[var(--primary)]/20 group-hover:shadow-[var(--primary)]/40 transition-shadow">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">
              Monad<span className="text-[var(--primary)]">Cert</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-[var(--secondary)] transition-all duration-200"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
            </div>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-[var(--secondary)] transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass border-t border-border overflow-hidden"
          >
            <div className="px-5 py-4 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-[var(--secondary)] transition-all"
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-2 sm:hidden">
                <ConnectButton showBalance={false} chainStatus="icon" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
