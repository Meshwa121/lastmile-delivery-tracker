const prisma = require('./prisma');

/**
 * Auto-assignment logic.
 *
 * "Nearest available agent" is modelled at zone granularity (consistent with the
 * zone-based rate engine, and avoids needing live GPS coordinates for every agent):
 *   1. Prefer an available AGENT whose home zone == the order's pickup zone
 *   2. Fall back to any available AGENT (in case no one is registered in that zone yet)
 *   3. Among candidates, pick whoever currently has the fewest active (non-terminal) orders,
 *      so load is balanced instead of always hitting the same agent
 *
 * Returns the chosen User (agent) or null if nobody is available.
 */
async function findNearestAvailableAgent(pickupZoneId) {
  const activeStatuses = ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'];

  const candidates = await prisma.user.findMany({
    where: {
      role: 'AGENT',
      isAvailable: true,
      zoneId: pickupZoneId,
    },
    include: {
      ordersAsAgent: {
        where: { status: { in: activeStatuses } },
      },
    },
  });

  let pool = candidates;

  if (pool.length === 0) {
    // Fallback: no agent registered in that exact zone, widen to any available agent
    pool = await prisma.user.findMany({
      where: { role: 'AGENT', isAvailable: true },
      include: {
        ordersAsAgent: { where: { status: { in: activeStatuses } } },
      },
    });
  }

  if (pool.length === 0) return null;

  pool.sort((a, b) => a.ordersAsAgent.length - b.ordersAsAgent.length);
  return pool[0];
}

module.exports = { findNearestAvailableAgent };
