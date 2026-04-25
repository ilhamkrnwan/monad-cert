import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/**
 * POST /api/certificates
 * Insert a new certificate row (PENDING_MINT state, before on-chain mint).
 *
 * Body: {
 *   institution_wallet: string
 *   recipient_wallet:   string
 *   recipient_name:     string
 *   title:              string
 *   description?:       string
 *   metadata_url:       string   ← Supabase Storage public URL for metadata JSON
 * }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body?.institution_wallet || !body?.recipient_wallet || !body?.recipient_name || !body?.title || !body?.metadata_url) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
  }

  // Lookup institution id from wallet address
  const { data: inst, error: instErr } = await supabaseAdmin
    .from('institutions')
    .select('id')
    .eq('wallet_address', body.institution_wallet.toLowerCase())
    .maybeSingle();

  if (instErr || !inst) {
    return NextResponse.json({ error: 'Institution not found.' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from('certificates')
    .insert({
      institution_id:     inst.id,
      institution_wallet: body.institution_wallet.toLowerCase(),
      recipient_wallet:   body.recipient_wallet.toLowerCase(),
      recipient_name:     body.recipient_name,
      title:              body.title,
      description:        body.description ?? null,
      metadata_url:       body.metadata_url,
      issued_date:        new Date().toISOString().split('T')[0],
      status:             'PENDING_MINT',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[POST /api/certificates]', error);
    return NextResponse.json({ error: 'Gagal menyimpan sertifikat.' }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}

/**
 * PATCH /api/certificates
 * Update a certificate after on-chain mint is confirmed.
 *
 * Body: {
 *   id:       string   ← certificate UUID from POST above
 *   token_id: number   ← ERC-721 token ID from event log
 *   tx_hash:  string   ← minting transaction hash
 * }
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body?.id || body?.token_id === undefined || !body?.tx_hash) {
    return NextResponse.json({ error: 'Missing id, token_id, or tx_hash.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('certificates')
    .update({
      token_id:   body.token_id,
      tx_hash:    body.tx_hash,
      status:     'MINTED',
      minted_at:  new Date().toISOString(),
    })
    .eq('id', body.id);

  if (error) {
    console.error('[PATCH /api/certificates]', error);
    return NextResponse.json({ error: 'Gagal update sertifikat.' }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
