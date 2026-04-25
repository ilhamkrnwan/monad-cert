import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client with service_role (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/**
 * GET /api/profile/certificates
 *
 * Query params:
 *  - role: 'user' | 'institution' | 'admin'
 *  - wallet: connected wallet address
 *
 * Role logic:
 *  - user        → certificates WHERE recipient_wallet = wallet
 *  - institution → certificates WHERE institution_wallet = wallet
 *  - admin       → all certificates (requires wallet to be contract owner — verified client-side)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const role = searchParams.get('role') as 'user' | 'institution' | 'admin' | null;
  const wallet = searchParams.get('wallet')?.toLowerCase();

  if (!wallet || !role) {
    return NextResponse.json({ error: 'Missing role or wallet param.' }, { status: 400 });
  }

  if (!['user', 'institution', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
  }

  // Build the base query — join institutions for name
  let query = supabaseAdmin
    .from('certificates')
    .select(`
      id,
      token_id,
      tx_hash,
      institution_wallet,
      recipient_wallet,
      recipient_name,
      title,
      description,
      issued_date,
      metadata_url,
      status,
      minted_at,
      created_at,
      institutions ( name, logo_url, type )
    `)
    .order('created_at', { ascending: false });

  if (role === 'user') {
    query = query.eq('recipient_wallet', wallet);
  } else if (role === 'institution') {
    query = query.eq('institution_wallet', wallet);
  }
  // admin → no filter, returns all

  const { data, error } = await query;

  if (error) {
    console.error('[api/profile/certificates] Supabase error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data sertifikat.' }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 200 });
}
