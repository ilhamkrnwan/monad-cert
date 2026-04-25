import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Server-side only — uses service_role key to bypass RLS for trusted writes
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const ALLOWED_TYPES = ['UNIVERSITY', 'COMPANY', 'COMMUNITY'] as const;
type InstitutionType = typeof ALLOWED_TYPES[number];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { wallet_address, name, type, contact_email, website, description } = body;

    // --- Validation ---
    if (!wallet_address || !name || !type || !contact_email) {
      return NextResponse.json({ error: 'Field wajib tidak lengkap.' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(type as InstitutionType)) {
      return NextResponse.json({ error: 'Tipe institusi tidak valid.' }, { status: 400 });
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      return NextResponse.json({ error: 'Format wallet address tidak valid.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email)) {
      return NextResponse.json({ error: 'Format email tidak valid.' }, { status: 400 });
    }

    // --- Duplicate check ---
    const { data: existing } = await supabaseAdmin
      .from('institutions')
      .select('id, status')
      .eq('wallet_address', wallet_address.toLowerCase())
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Wallet ini sudah terdaftar dengan status: ' + existing.status },
        { status: 409 }
      );
    }

    // --- Insert ---
    const { error } = await supabaseAdmin.from('institutions').insert({
      wallet_address: wallet_address.toLowerCase(),
      name: name.trim(),
      type,
      contact_email: contact_email.trim(),
      website: website || null,
      description: description || null,
      status: 'PENDING',
    });

    if (error) {
      console.error('[register] Supabase error:', error);
      return NextResponse.json({ error: 'Gagal menyimpan data. Coba lagi.' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('[register] Unexpected error:', err);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
