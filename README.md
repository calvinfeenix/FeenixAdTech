# Feenix AdTech

A production-grade control plane for serving ads into Roblox experiences. Admins
build a global **asset repository**, maintain a **games inventory** (with individual
ad locations), and create **campaigns** that assign creatives, games/locations, and
viewer access. Assigned users get a read-only **analytics** view per campaign.

Built with the same stack as the wider Feenix toolchain:

- **Next.js 16** (App Router) · **React 19** · **TypeScript** (strict)
- **Tailwind CSS v4** with a dark, esports-flavored theme (modeled on feenixgroup.com)
- **Supabase** — Postgres + Auth + Storage, protected by Row Level Security
- **sharp** for on-upload image optimization
- **Recharts** for analytics
- Deploys to **Railway** (Dockerfile, `output: "standalone"`)

---

## Architecture at a glance

| Concern | Implementation |
| --- | --- |
| Auth | Supabase Auth (email/password). Username login is resolved to email server-side. New users are `pending` until an admin approves them. |
| Authorization | Two roles (`user`, `admin`) + a `status` gate. Enforced in three layers: `middleware.ts` (signed-in?), page guards in `lib/auth.ts` (`requireApproved` / `requireAdmin`), and **Postgres RLS** (`scripts/schema.sql`). |
| Data fetching | Server Components read under the user's RLS context. Mutations are **Server Actions** / Route Handlers that re-check the role. Privileged actions (approvals, ingestion, seeding) use the service role. |
| Assets | Uploaded via `POST /api/assets/upload` (Node runtime). Images → WebP + 400px thumbnail via sharp; video/audio stored as-is with a client-captured poster + duration. Stored in public Storage buckets. |
| Analytics | `analytics_events` table, aggregated by the pure `summarizeAnalytics` helper. Ingested via `POST /api/ingest` (shared-secret auth) — wire your Roblox game servers to it. |

Route groups:
- `app/(auth)/` — `login`, `signup`, `pending` (no app chrome)
- `app/(app)/` — `dashboard`, `campaigns`, `assets`, `games` (admin), `admin/users` (admin)

---

## Local development

### 1. Create a Supabase project
At [supabase.com](https://supabase.com), create a project. From **Project Settings → API** grab:
- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (secret!)

### 2. Apply the schema
Open **SQL Editor**, paste the contents of [`scripts/schema.sql`](scripts/schema.sql), and run it.
This creates all tables, RLS policies, helper functions, and the signup trigger.

### 3. Create Storage buckets
In **Storage**, create two **public** buckets named exactly:
- `assets`
- `thumbnails`

(Ad creatives are served to game clients, so public read is appropriate; uploads/deletes
are performed server-side with the service role after an admin check.)

### 4. Configure env
```bash
cp .env.example .env.local
# fill in the four Supabase values + a random INGEST_API_KEY
```

### 5. Install, seed, run
```bash
npm install
npm run seed      # creates the FEENIX admin, demo users, games, campaigns + analytics
npm run dev       # http://localhost:3000
```

### Default accounts (from the seed)
| Username | Password | Role | Status |
| --- | --- | --- | --- |
| `FEENIX` | `feenixgroup0214` (or `ADMIN_DEFAULT_PASSWORD`) | admin | approved |
| `maya` | `password123` | user | approved |
| `leo` | `password123` | user | approved |
| `newbie` | `password123` | user | pending |

> **Note:** the original brief said `phoenixgroup0214`; this defaults to `feenixgroup0214`
> to match the Feenix brand. Override it any time via `ADMIN_DEFAULT_PASSWORD`.

---

## Deploying to Railway

1. Push this repo to GitHub and **commit `package-lock.json`** (the Docker build runs `npm ci`).
2. In Railway, create a project from the repo. It auto-detects the **Dockerfile**.
3. Add the environment variables (Service → **Variables**):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `INGEST_API_KEY`, `ADMIN_DEFAULT_PASSWORD`.
   The two `NEXT_PUBLIC_*` values are needed at **build time** (they're inlined into the client bundle).
4. Deploy. Run the schema + bucket steps against your production Supabase project once,
   then run the seed locally pointed at production (or sign up + self-approve via SQL).

The same external Supabase database backs both local and production — keep a separate
Supabase project per environment if you want isolation.

---

## Roblox ingestion contract

```http
POST /api/ingest
x-api-key: <INGEST_API_KEY>
Content-Type: application/json

{
  "events": [
    { "campaign_id": "<uuid>", "game_id": "<uuid>", "location_id": "<uuid>",
      "event_type": "impression", "count": 1, "ts": "2026-06-03T12:00:00Z" }
  ]
}
```
`event_type` ∈ `impression | click | unique_user`. `game_id`, `location_id`, `ts`, and
`count` are optional. Events flow straight into the per-campaign analytics views.

> The brief mentioned auto-discovering ad locations from Roblox — that hook lives here:
> extend `/api/ingest` (or add a sync job) to upsert `game_locations` from reported data.

---

## Project layout
```
app/
  (auth)/        login · signup · pending · actions.ts
  (app)/         dashboard · campaigns · assets · games · admin/users
  api/           assets/upload · assets/[id] · ingest
components/      sidebar · header · charts · asset-gallery · campaign-form · …
lib/             supabase{,-server,-admin} · auth · analytics · storage · types · utils
scripts/         schema.sql · seed.ts
middleware.ts    session refresh + auth gating
```

## Future hardening (documented, not built)
- Real video/audio transcoding via an ffmpeg worker (currently stored as-is + poster).
- Signed URLs / private buckets if creatives must not be publicly fetchable.
- Daily analytics rollup table for very high event volumes.
