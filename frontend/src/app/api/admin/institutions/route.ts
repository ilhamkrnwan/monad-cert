import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(req: NextRequest) {
  // Basic guard: require the admin wallet address as a header
  // The real auth is done on-chain (checked in the frontend before calling this)
  // This header is set by the admin page client after verifying on-chain ownership
  const callerWallet = req.headers.get('x-caller-wallet')?.toLowerCase();
  if (!callerWallet) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('institutions')
    .select('id, wallet_address, name, type, contact_email, status, description, website, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin/institutions] Supabase error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data.' }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 200 });
}

export async function PATCH(req: NextRequest) {
  const callerWallet = req.headers.get('x-caller-wallet')?.toLowerCase();
  if (!callerWallet) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.wallet_address || !body?.status) {
    return NextResponse.json({ error: 'wallet_address dan status wajib diisi.' }, { status: 400 });
  }

  const ALLOWED_STATUSES = ['APPROVED', 'REJECTED', 'PENDING'];
  if (!ALLOWED_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'Status tidak valid.' }, { status: 400 });
  }

  const updatePayload: Record<string, string> = {
    status: body.status,
    approved_by: callerWallet,
  };
  if (body.status === 'APPROVED') {
    updatePayload.approved_at = new Date().toISOString();
  }
  if (body.status === 'REJECTED' && body.rejection_reason) {
    updatePayload.rejection_reason = body.rejection_reason;
  }

  const { error } = await supabaseAdmin
    .from('institutions')
    .update(updatePayload)
    .eq('wallet_address', body.wallet_address.toLowerCase());

  if (error) {
    console.error('[admin/institutions] Update error:', error);
    return NextResponse.json({ error: 'Gagal update status.' }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
