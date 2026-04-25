# ⚠️ STRICT FRONTEND CONTEXT: MonadCert (EduTrust)

**ROLE:** Frontend Engineer (REYHAN)
**STACK:** Nuxt 4 / Next.js, TypeScript, Tailwind CSS, shadcn/ui, Aceternity UI, Wagmi/viem.
**RULE 1:** Write highly concise, production-ready code. ZERO unnecessary comments. ZERO fluff.
**RULE 2:** Follow instructions exactly. DO NOT hallucinate features.

---

## 1. UI/UX & DESIGN (STRICT REQUIREMENTS)
*   **MANDATORY SKILLS:** `frontend-design`, `ui-ux-pro-max`, `shadcn`, `aceternity-ui`.
*   **VIBE:** Premium, modern, glassmorphism, dark mode, micro-animations. NO generic AI MVP looks.
*   **COMPONENTS:** Use `shadcn` for base UI (forms, tables). Use `aceternity-ui` for complex/hero animations.

## 2. BLOCKCHAIN INTEGRATION (MONAD TESTNET)
*   **Network:** Monad Testnet | Chain ID: `10143` | RPC: `https://testnet-rpc.monad.xyz` | Currency: `MON`
*   **Contract:** Address in `.env` (`NEXT_PUBLIC_EDUTRUST_ADDRESS`). ABI in `artifacts/contracts/EduTrust.sol/EduTrust.json`.
*   **Core Functions:**
    *   `isApprovedInstitution(address)` (Read)
    *   `issueCertificate(recipient, uri)` (Write)
    *   `batchIssueCertificate(recipients[], uris[])` (Write - USE THIS FOR BATCHING)
    *   `getCredential(tokenId)` (Read)
*   **Tech:** Use `@wagmi/core` or `viem`. Ensure robust error handling for tx states.

## 3. SUPABASE INTEGRATION
*   **Credentials:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env`.
*   **Tables:**
    *   `institutions` (Read-only for public if `APPROVED`)
    *   `certificates` (Read-only for public if `MINTED`)
    *   `mint_events`
*   **Storage:** Upload JSON metadata here to get `tokenURI`.
*   **SECURITY:** Frontend uses Anon Key (Read-Only via RLS). ALL WRITES MUST BE DONE SECURELY VIA BACKEND OR AUTHORIZED INSTITUTION WALLET. NEVER EXPOSE `service_role`.

## 4. REQUIRED PAGES & FLOW
1.  **Auth:** "Connect Wallet". If address in `institutions` & `APPROVED` -> Dashboard. Else -> User Page.
2.  **Institutional Dashboard:** Form to input recipient data -> generate JSON -> upload to Supabase Storage -> call `issueCertificate` / `batchIssueCertificate`.
3.  **Public Verification (`/verify`):** Search by `tokenId`, address, or QR. Show ✅ Valid ONLY IF `getCredential(tokenId)` returns `isValid == true`.
4.  **Landing Page:** High-conversion hero section using `aceternity-ui`. Highlight Monad's parallel execution speed.

## 5. BEST PRACTICES (NON-NEGOTIABLE)
*   **SEO:** Implement proper meta tags and OG images.
*   **Mobile-First:** Must be fully responsive (Capacitor prep).
*   **UX:** Add loading animations for all async/blockchain txs. NEVER leave the screen hanging.
