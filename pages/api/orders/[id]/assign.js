import prisma from '../../../../lib/prisma';
import { requireRole } from '../../../../lib/apiAuth';
import { findNearestAvailableAgent } from '../../../../lib/assignment';
import { transitionOrderStatus } from '../../../../lib/orderStatus';

// Admin manually assigns an agentId, OR triggers { auto: true } for nearest-available auto-assignment.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = await requireRole(req, res, ['ADMIN']);
  if (!session) return;

  const { id } = req.query;
  const { agentId, auto } = req.body || {};

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  let chosenAgentId = agentId;

  if (auto) {
    const agent = await findNearestAvailableAgent(order.pickupZoneId);
    if (!agent) return res.status(409).json({ error: 'No available agents to auto-assign' });
    chosenAgentId = agent.id;
  } else {
    if (!agentId) return res.status(400).json({ error: 'agentId is required (or pass auto: true)' });
    const agent = await prisma.user.findUnique({ where: { id: agentId } });
    if (!agent || agent.role !== 'AGENT') return res.status(400).json({ error: 'agentId must reference an AGENT user' });
  }

  await prisma.order.update({ where: { id }, data: { agentId: chosenAgentId } });

  try {
    // FAILED orders that get reassigned go through RESCHEDULED -> ASSIGNED; everything else CREATED -> ASSIGNED
    const updated = await transitionOrderStatus({
      orderId: id,
      newStatus: 'ASSIGNED',
      actorId: session.user.id,
      actorRole: 'ADMIN',
      note: auto ? 'Auto-assigned to nearest available agent' : 'Manually assigned by admin',
    });
    return res.status(200).json(updated);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
};
