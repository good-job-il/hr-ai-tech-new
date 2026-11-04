HeadHunter — isolated staging implementation

Continue the existing project in this folder. Do not create another copy or connect production.
Runtime: Next.js / TypeScript / Supabase (PostgreSQL + Auth + private Storage).

Run:
  pnpm install --frozen-lockfile
  pnpm test
  pnpm typecheck
  pnpm build
  pnpm dev

Staging setup:
1. Use the new Supabase organization HeadHunter Preview (free), organization ID erditxxumjnppvsluhqm.
2. Complete creation of the headhunter-preview project. The user sets and retains its database password.
3. Apply migrations 001_initial.sql then 002_workspace.sql ONLY to that empty staging project.
4. Configure the two public variables from .env.example in .env.local and Vercel Preview only.
5. Keep email confirmation enabled. Configure exact redirect URLs for local and Preview origins.
6. Deploy to a NEW Vercel project using a Preview deployment, with protection enabled. Do not configure custom domains or production variables.
7. Run real Supabase/Auth/Storage/browser acceptance tests before calling the platform active.

Implemented:
- Hebrew RTL / English LTR, persisted language, white / blue-purple design with an original SVG AI head and candidate-card illustration based on the user's textual description.
- Public open jobs, search, application and recruiter pipeline.
- Separate employer / agency organizations; owner/admin/recruiter/viewer/finance memberships.
- Candidate profile and private PDF CVs up to 5MB; expiring signed links.
- Agency personal / shared pools. Shared-only pool for employers. Email uniqueness within organization, normalized by trim/lowercase.
- Access requests approved/denied by owner/admin; authorized canonical merge retaining source and audit. Source grants never broaden target access.
- Interviews with local-time entry and UTC storage; candidate-visible details; no calendar or email invitation is sent.
- Reward policy text restricted to owner/admin/finance; only owner/admin can write. No invented rates or payments.
- Basic counts limited to rows accessible under RLS. Team additions use an existing user's ID; no invitation email is sent.

Verification:
- Node domain tests and PostgreSQL RLS integration test use `pnpm test`.
- RLS tests run actual SQL in PGlite's embedded PostgreSQL engine, with synthetic auth/storage schema shims and six synthetic identities. This is NOT a full Supabase cloud test.
- TypeScript and optimized Next build were executed successfully during this continuation.
- Local browser verified language switching/persistence, disabled data submission without connection, desktop and 390px mobile layout without horizontal overflow.

Open acceptance work:
- Cloud signup/email confirmation, real JWT/PostgREST, real Storage uploads/signed links, multi-user browser flows and Vercel Preview protection/URL.
- Authenticated workspace UI and file-upload behavior have code and database tests but await connected browser end-to-end verification.
- Email-only deduplication; phone/ID matching is not implemented.
- Merge retains source in archive and its audit; no automatic contact-field reconciliation.
- A user belongs to one organization in the initial creation flow. Switching organizations and account recovery UI are not included.
- Marketplace, hiring-manager role, AI matching, SMTP/calendar integrations and payments are deferred.
- The referenced ChatGPT source exposed only five recent user turns and reference placeholders, not the full design or reward-policy specification. Nothing beyond the current user's explicit requirements is claimed as recovered.

No production data, DNS, or hr-ai.tech configuration was accessed or changed.
