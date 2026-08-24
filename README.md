# Last-Mile Delivery Tracker

A delivery management platform: customers place orders with auto-calculated shipping charges,
admins configure zones/rate cards and assign delivery agents (manually or automatically), agents
update delivery status, and customers get emailed and can track their order live. Failed
deliveries can be rescheduled, which reassigns an agent for the new attempt.

## Tech Stack

- **Framework:** Next.js 14 (Pages Router) — single codebase for API + frontend
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** NextAuth (credentials provider, JWT sessions, role-based: CUSTOMER / AGENT / ADMIN)
- **Email:** Nodemailer (any SMTP: Gmail app password, Brevo, Mailtrap free tier, etc.)
- **Deploy target:** Vercel (or Render/Railway) + a managed Postgres (Neon/Supabase free tier)

## Setup

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL, NEXTAUTH_SECRET, SMTP_* (see below)
npx prisma db push        # creates tables from prisma/schema.prisma
npm run seed               # optional: creates demo admin/agent/customer + sample rate cards
npm run dev                # http://localhost:3000
```

### Environment variables (`.env`)

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Postgres connection string. Free options: [Neon](https://neon.tech), [Supabase](https://supabase.com), Railway. |
| `NEXTAUTH_SECRET` | Any long random string (`openssl rand -base64 32`). |
| `NEXTAUTH_URL` | `http://localhost:3000` locally, your deployed URL in production. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Any SMTP provider. **If left unset, emails are logged to the console instead of sent** — the app still works fully, notifications just won't leave the server (useful for local dev/demo). |

### Demo accounts (after `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Admin | admin@lastmile.dev | password123 |
| Agent | agent1@lastmile.dev | password123 |
| Customer | customer1@lastmile.dev | password123 |

Seed also creates 2 zones (with sample pincodes), 4 rate cards (B2B/B2C × intra/inter-zone), and COD surcharges — so you can place an order immediately without doing admin config first.

## Deploying

1. Push this repo to GitHub.
2. Create a free Postgres DB (Neon is fastest: instant connection string, no card required).
3. Import the repo into Vercel → set the environment variables above → deploy.
4. After first deploy, run `npx prisma db push` once against the production `DATABASE_URL` (locally, pointed at prod) to create tables, then optionally `npm run seed`.

Render/Railway work the same way — set the build command to `npm run build` (which runs `prisma generate` automatically) and the start command to `npm start`.

## Database Schema

- **User** — `role` (CUSTOMER/AGENT/ADMIN), `zoneId` + `isAvailable` (agents only)
- **Zone** — named zone (e.g. "Zone A")
- **ZonePincode** — maps a pincode 1:1 to a Zone (admin-configured; this is how zone detection works)
- **RateCard** — one row per `(orderType, zoneType)` i.e. B2C/B2B × INTRA_ZONE/INTER_ZONE, holding `baseCharge` + `perKgRate`. Fully admin-editable, nothing hardcoded.
- **CodSurcharge** — one row per `orderType`, flat COD surcharge amount
- **Order** — full order record: addresses, pincodes, resolved zone IDs, dimensions, actual/volumetric/chargeable weight, computed charge breakdown, `status`, `agentId`, reschedule fields
- **OrderStatusEvent** — **append-only** tracking history: every status change is inserted as a new row with `status`, `actorId`, `actorRole`, `note`, `timestamp`. Nothing is ever updated or deleted here, so `Order.status` (current state) and `OrderStatusEvent[]` (full immutable history) are always consistent.

Full field list: see `prisma/schema.prisma`.

## Rate Calculation Logic

Implemented in `lib/rateEngine.js`, called from both `/api/orders/quote` (preview, no DB write — lets the customer see the price before confirming) and `/api/orders` (create, recalculates server-side so a tampered client-side price is never trusted):

1. **Zone detection** (`lib/zoneDetection.js`): look up `pickupPincode` and `dropPincode` in `ZonePincode` → resolves each to a `Zone`. If a pincode isn't mapped to any zone, order creation fails with a clear 422 error telling the admin to map it — silently guessing a zone would corrupt billing.
2. **Zone type**: `INTRA_ZONE` if pickup zone === drop zone, else `INTER_ZONE`.
3. **Volumetric weight** = `(L × B × H) / 5000` (industry-standard divisor).
4. **Chargeable weight** = `max(actualWeight, volumetricWeight)`.
5. **Rate card lookup**: fetch the `RateCard` row for `(orderType, zoneType)` → `baseCharge` + `perKgRate`.
6. **weightCharge** = `perKgRate × chargeableWeight`.
7. **COD surcharge**: if `paymentType === 'COD'`, add the configured `CodSurcharge.amount` for that `orderType`.
8. **totalCharge** = `baseCharge + weightCharge + codSurcharge`.

Every number above is looked up from the database (admin-configurable) except the `/5000` volumetric divisor, which is a fixed industry constant, not a business rule.

## Auto-Assignment Logic (`lib/assignment.js`)

"Nearest available agent" is modelled at **zone granularity** rather than live GPS distance (consistent with the zone-based rate engine, and doesn't require agents to constantly stream location):

1. Find all `AGENT` users where `isAvailable = true` and `zoneId` = the order's **pickup** zone.
2. If none exist in that zone, widen to any available agent (fallback, so an order never gets stuck just because no agent is registered in that exact zone yet).
3. Among candidates, pick whichever agent currently has the fewest **active** orders (`ASSIGNED`/`PICKED_UP`/`IN_TRANSIT`/`OUT_FOR_DELIVERY`) — this balances load instead of always hitting the same agent.

Admins can also skip this entirely and manually assign any agent to any order from `/admin/orders`.

## Order Status Lifecycle & Failed Delivery Flow

`lib/orderStatus.js` enforces a state machine (`CREATED → ASSIGNED → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED`, with `FAILED` reachable from any in-flight state) for normal agent-driven updates, and every transition:
- Updates `Order.status`
- Appends an `OrderStatusEvent` row (immutable history)
- Emails the customer (best-effort — a broken SMTP config never blocks the status update itself)

**Admins can override to any status regardless of the state machine** (`PATCH /api/orders/[id]`) for exception handling.

**Failed delivery → reschedule flow:**
1. Agent marks an order `FAILED` (with an optional reason/note) → customer is emailed, `lastFailedReason` stored.
2. Customer opens the order, sees the reason, submits a new `scheduledDate` (`POST /api/orders/[id]/reschedule`).
3. Order moves `FAILED → RESCHEDULED`, `agentId` is cleared, `rescheduleCount` increments.
4. The system immediately re-runs auto-assignment for the new attempt → `RESCHEDULED → ASSIGNED` with a (possibly different) agent, since the original agent's availability may have changed.

## API Docs

All routes are under `/api`. Auth: NextAuth session cookie (login via `/api/auth/callback/credentials`, or the `/login` page). Role checks happen server-side in every handler via `lib/apiAuth.js`.

| Method | Route | Role | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | public | Customer self-registration |
| POST | `/api/admin/users` | ADMIN | Create AGENT/ADMIN/CUSTOMER accounts |
| GET | `/api/admin/users` | ADMIN | List all users |
| GET/POST | `/api/zones` | any / ADMIN | List zones / create a zone |
| POST | `/api/zones/[id]` | ADMIN | Add a pincode to a zone |
| DELETE | `/api/zones/[id]` | ADMIN | Delete a zone |
| GET/POST | `/api/rate-cards` | any / ADMIN | View / upsert rate cards |
| POST | `/api/rate-cards/cod` | ADMIN | Set COD surcharge for an order type |
| POST | `/api/orders/quote` | CUSTOMER/ADMIN | Preview charge, no DB write |
| GET/POST | `/api/orders` | role-scoped | List (own orders for customer/agent, filterable for admin) / create order |
| GET/PATCH | `/api/orders/[id]` | role-scoped / ADMIN | Order detail incl. full tracking history / admin status override |
| POST | `/api/orders/[id]/assign` | ADMIN | `{ agentId }` manual, or `{ auto: true }` auto-assign |
| POST | `/api/orders/[id]/status` | AGENT/ADMIN | Advance order status |
| POST | `/api/orders/[id]/reschedule` | CUSTOMER/ADMIN | Reschedule a FAILED order, triggers reassignment |
| GET/PATCH | `/api/agents` | ADMIN / AGENT | List agents (admin) / toggle own availability (agent) |

## Project Structure

```
lib/            rate engine, zone detection, assignment, status machine, auth, email — all pure/testable logic lives here, kept out of API route files
pages/api/      thin HTTP handlers that call into lib/
pages/          customer, agent, admin dashboards (React, NextAuth session-gated)
prisma/         schema.prisma, seed.js
```

## Known Simplifications (given the timeframe)

- Zone detection is pincode-based, not polygon/geo-based — matches how most last-mile rate cards actually work and avoids needing a maps API key.
- Auto-assignment uses zone + active-order-count, not live lat/long distance — no agent GPS tracking required.
- SMS notifications are out of scope (email only); the notify layer is structured so an SMS provider could be added alongside `sendStatusEmail` without touching callers.
