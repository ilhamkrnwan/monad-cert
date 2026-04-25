-- ============================================================
-- MonadCert (EduTrust) — Supabase Schema Migration
-- Version: 1.0.0
-- Description: Full schema for decentralized credential protocol
-- ============================================================


-- ============================================================
-- EXTENSION: Enable UUID generation
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- TABLE: institutions
-- Stores registration data for universities, companies, communities
-- Auth model: wallet-based (wallet_address is the identity key)
-- ============================================================
CREATE TABLE public.institutions (
    id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address      TEXT        NOT NULL UNIQUE,
    name                TEXT        NOT NULL,
    type                TEXT        NOT NULL CHECK (type IN ('UNIVERSITY', 'COMPANY', 'COMMUNITY')),
    description         TEXT,
    website             TEXT,
    logo_url            TEXT,
    contact_email       TEXT        NOT NULL,
    contact_person      TEXT,
    legal_document_url  TEXT,       -- URL to uploaded proof of legality (Supabase Storage)
    -- Approval workflow
    status              TEXT        NOT NULL DEFAULT 'PENDING'
                                    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    rejection_reason    TEXT,
    approved_at         TIMESTAMPTZ,
    approved_by         TEXT,       -- Admin wallet address that approved/rejected
    -- Timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.institutions IS
    'Registered institutions (universities, companies, communities) that can issue SBT credentials.';
COMMENT ON COLUMN public.institutions.wallet_address IS
    'Ethereum-compatible wallet address — the primary identity for on-chain interactions.';
COMMENT ON COLUMN public.institutions.status IS
    'PENDING: awaiting admin review | APPROVED: can mint on-chain | REJECTED: denied';
COMMENT ON COLUMN public.institutions.legal_document_url IS
    'URL to the uploaded proof of legality stored in Supabase Storage.';


-- ============================================================
-- TABLE: certificates
-- Off-chain metadata mirror for each SBT credential
-- token_id is null until the on-chain mint is confirmed
-- ============================================================
CREATE TABLE public.certificates (
    id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    -- Blockchain reference
    token_id            BIGINT      UNIQUE,         -- Populated after on-chain confirmation
    tx_hash             TEXT        UNIQUE,         -- Minting transaction hash on Monad
    -- Relationships
    institution_id      UUID        NOT NULL REFERENCES public.institutions(id) ON DELETE RESTRICT,
    institution_wallet  TEXT        NOT NULL,       -- Denormalized for fast queries
    recipient_wallet    TEXT        NOT NULL,       -- The SBT holder's wallet address
    -- Certificate data
    recipient_name      TEXT        NOT NULL,
    title               TEXT        NOT NULL,       -- e.g., "Bachelor of Computer Science"
    description         TEXT,
    issued_date         DATE        NOT NULL,
    expiry_date         DATE,                       -- NULL = no expiry (most academic certs)
    -- Metadata storage
    ipfs_hash           TEXT,                       -- IPFS CID (optional, for permanent storage)
    metadata_url        TEXT        NOT NULL,       -- Supabase Storage URL used as tokenURI
    -- State
    status              TEXT        NOT NULL DEFAULT 'PENDING_MINT'
                                    CHECK (status IN ('PENDING_MINT', 'MINTED', 'REVOKED')),
    minted_at           TIMESTAMPTZ,
    -- Timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.certificates IS
    'Off-chain metadata record for each SBT certificate. Mirrors on-chain state.';
COMMENT ON COLUMN public.certificates.token_id IS
    'ERC-721 tokenId on Monad. NULL means not yet minted on-chain.';
COMMENT ON COLUMN public.certificates.metadata_url IS
    'The URL passed as tokenURI when minting. Points to the certificate JSON metadata.';
COMMENT ON COLUMN public.certificates.ipfs_hash IS
    'Optional IPFS CID for permanent decentralized storage of the certificate document.';


-- ============================================================
-- TABLE: mint_events
-- Indexed on-chain events for fast off-chain queries
-- Populated by a backend listener/indexer watching Monad events
-- ============================================================
CREATE TABLE public.mint_events (
    id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    token_id        BIGINT      NOT NULL,
    event_type      TEXT        NOT NULL CHECK (event_type IN ('ISSUED', 'REVOKED')),
    tx_hash         TEXT        NOT NULL UNIQUE,
    block_number    BIGINT,
    institution_wallet  TEXT,
    recipient_wallet    TEXT,
    raw_log         JSONB,      -- Full event log data from the blockchain
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.mint_events IS
    'Indexed blockchain events from EduTrust smart contract. Used for fast off-chain queries.';
COMMENT ON COLUMN public.mint_events.raw_log IS
    'Raw event log data from the Monad blockchain for debugging and full traceability.';


-- ============================================================
-- INDEXES — Optimized for common query patterns
-- ============================================================

-- institutions: filter by status (admin dashboard) and wallet (auth check)
CREATE INDEX idx_institutions_wallet  ON public.institutions(wallet_address);
CREATE INDEX idx_institutions_status  ON public.institutions(status);

-- certificates: filter by recipient (user profile), institution, status
CREATE INDEX idx_certificates_recipient_wallet   ON public.certificates(recipient_wallet);
CREATE INDEX idx_certificates_institution_wallet ON public.certificates(institution_wallet);
CREATE INDEX idx_certificates_institution_id     ON public.certificates(institution_id);
CREATE INDEX idx_certificates_status             ON public.certificates(status);
CREATE INDEX idx_certificates_token_id           ON public.certificates(token_id) WHERE token_id IS NOT NULL;

-- mint_events: filter by token and type
CREATE INDEX idx_mint_events_token_id    ON public.mint_events(token_id);
CREATE INDEX idx_mint_events_event_type  ON public.mint_events(event_type);
CREATE INDEX idx_mint_events_tx_hash     ON public.mint_events(tx_hash);


-- ============================================================
-- TRIGGER FUNCTION: Auto-update updated_at timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_institutions_updated_at
    BEFORE UPDATE ON public.institutions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_certificates_updated_at
    BEFORE UPDATE ON public.certificates
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- All tables in public schema must have RLS enabled per Supabase best practices
-- Auth model: wallet-based (no Supabase Auth). Writes go through trusted backend
--             using service_role key. Frontend (anon) gets read-only access.
-- ============================================================

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mint_events   ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------
-- institutions: RLS Policies
-- ----------------------------------------------------------------

-- Public can read APPROVED institutions (verification page, public directory)
CREATE POLICY "public_read_approved_institutions"
    ON public.institutions
    FOR SELECT
    USING (status = 'APPROVED');

-- Service role (backend) has full access — handles PENDING/REJECTED and writes
-- NOTE: service_role bypasses RLS by default in Supabase. No explicit policy needed.


-- ----------------------------------------------------------------
-- certificates: RLS Policies
-- ----------------------------------------------------------------

-- Anyone can read MINTED certificates (public verification)
CREATE POLICY "public_read_minted_certificates"
    ON public.certificates
    FOR SELECT
    USING (status = 'MINTED');


-- ----------------------------------------------------------------
-- mint_events: RLS Policies
-- ----------------------------------------------------------------

-- Public read-only for transparency (blockchain event log)
CREATE POLICY "public_read_mint_events"
    ON public.mint_events
    FOR SELECT
    USING (true);


-- ============================================================
-- GRANT: Expose tables to anon role via Data API
-- Per Supabase: must explicitly grant SELECT to anon for REST API access
-- ============================================================
GRANT SELECT ON public.institutions TO anon;
GRANT SELECT ON public.certificates  TO anon;
GRANT SELECT ON public.mint_events   TO anon;

-- authenticated role (future: Supabase Auth integration)
GRANT SELECT ON public.institutions TO authenticated;
GRANT SELECT ON public.certificates  TO authenticated;
GRANT SELECT ON public.mint_events   TO authenticated;
