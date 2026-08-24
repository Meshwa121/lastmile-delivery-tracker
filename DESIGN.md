# System Design Write-Up — Last-Mile Delivery Tracker

## Rate Calculation Engine

The rate engine (`lib/rateEngine.js`) is one pure function, `calculateCharge()`, called from two
places: a preview-only `/api/orders/quote` endpoint (so the customer sees the price before
confirming) and the real `/api/orders` create endpoint, which recalculates the same way
server-side rather than trusting a client-supplied number — this prevents a price from being
modified in the browser before submitting the order.

The calculation is a fixed pipeline of admin-configurable lookups, with no business constants
hardcoded in code:

1. Resolve pickup and drop pincodes to zones (see Zone Detection).
2. Classify the shipment as INTRA_ZONE (same zone) or INTER_ZONE (different zones).
3. Compute volumetric weight as (L × B × H) / 5000 — the one fixed constant, since it's an
   industry-standard divisor rather than a business rule an admin would tune.
4. Chargeable weight = max(actual, volumetric) — standard courier practice, so a large-but-light
   package (pillows, etc.) is billed fairly for the space it occupies.
5. Look up the RateCard row keyed by (orderType, zoneType) — a 2×2 matrix (B2B/B2C × intra/inter)
   giving baseCharge + perKgRate. This is deliberately simple: rather than a full zone-pair rate
   matrix (which needs N² rows and is unnecessary for a system that prices by "in-zone" vs
   "cross-zone," one row per combination covers the requirement and keeps the pricing easy to
   manage from the admin panel.
6. weightCharge = perKgRate × chargeableWeight.
7. If paymentType is COD, add a flat CodSurcharge configured per orderType.
8. totalCharge = baseCharge + weightCharge + codSurcharge.

Every numeric input (base charges, per-kg rates, COD surcharge) lives in the database and is
editable from `/admin/rate-cards` with no deploy required to change pricing.

## Zone Detection Approach

Zones are admin-defined named groups (`Zone`), each containing a set of pincodes (`ZonePincode`,
a 1:1 pincode → zone mapping via a unique constraint). Detecting a zone is therefore a single
indexed lookup on pincode, not geocoding or polygon containment. This provides a simple and
predictable way to determine the delivery zone without requiring an external maps or geocoding
service. If a pincode has no zone mapping, order creation fails fast with a 422 telling the admin
to map it, rather than guessing — a wrong silent guess could result in incorrect billing and
assignment.

## Auto-Assignment Logic

Agent assignment (`lib/assignment.js`) also works at zone granularity rather than requiring live
GPS from every agent.
`findNearestAvailableAgent(pickupZoneId)`:

1. Filters `AGENT` users to `isAvailable = true` and `zoneId = pickupZoneId` — "nearest" is modelled
   as "based in the pickup zone," which is the resolution the rest of the system operates at.
2. Falls back to any available agent system-wide if no one is registered in that exact zone, so an
   order does not remain unassigned just because there is no available agent in its pickup zone.
3. Among remaining candidates, picks whoever has the fewest active orders (ASSIGNED / PICKED_UP /
   IN_TRANSIT / OUT_FOR_DELIVERY), helping distribute orders across available agents.

Admins can bypass this via manual assignment from `/admin/orders`; both paths funnel through the
same `transitionOrderStatus()` call, so manual and automatic assignments are recorded in the
order history in the same way.

## Order Status Lifecycle & Immutable Tracking History

`Order.status` (current state) and `OrderStatusEvent[]` (full history) are updated together,
always, through one function: `transitionOrderStatus()`. This keeps the current status and its
history synchronized. Every event row captures status, actor, actor role, an optional note, and a
server timestamp, and rows are only ever inserted, never updated or deleted, so the history acts
as a permanent audit record rather than just storing the latest status.

Agent- and system-driven transitions (`/api/orders/[id]/status`, `/assign`) are validated against
an explicit adjacency list (e.g. ASSIGNED can only move to PICKED_UP or FAILED) to catch
invalid transitions. Admin overrides (`PATCH /api/orders/[id]`) intentionally bypass this
validation for exceptional situations, but still log through the same path. The actor role in the
history indicates when an administrator performed an override.

## Failed Delivery Handling

FAILED is a dead end in the normal state machine (its only allowed next state is RESCHEDULED),
forcing the reschedule flow rather than allowing an agent to directly continue the delivery:

1. Agent marks the order FAILED with an optional reason → customer is emailed and can see the
   reason on their tracking page.
2. Customer submits a new date via `/api/orders/[id]/reschedule`, accepted only while the order is
   FAILED (enforced server-side).
3. Order moves FAILED → RESCHEDULED, `agentId` is cleared and `rescheduleCount` increments —
   clearing the agent matters because their availability may have changed by the new date.
4. Auto-assignment immediately re-runs, moving RESCHEDULED → ASSIGNED. If no agent is available,
   the order stays at RESCHEDULED, visible to admins as needing manual attention, rather than
   silently failing.

This keeps the failed-delivery and rescheduling process controlled while still allowing admins to
manually handle cases where automatic assignment cannot find an available agent.
