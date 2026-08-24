import prisma from '../../../../lib/prisma';
import { requireRole } from '../../../../lib/apiAuth';
import { transitionOrderStatus } from '../../../../lib/orderStatus';
import { findNearestAvailableAgent } from '../../../../lib/assignment';

// Customer reschedules a FAILED delivery for a new date; the agent is reassigned
// (auto-assignment by default, since the original agent's availability may have changed)
// for the new attempt.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = await requireRole(req, res, ['CUSTOMER', 'ADMIN']);
  if (!session) return;

  const { id } = req.query;
  const { scheduledDate } = req.body || {};
  if (!scheduledDate) return res.status(400).json({ error: 'scheduledDate is required' });

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (session.user.role === 'CUSTOMER' && order.customerId !== session.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (order.status !== 'FAILED') {
    return res.status(422).json({ error: 'Only a FAILED order can be rescheduled' });
  }

  try {
    await prisma.order.update({
      where: { id },
      data: {
        scheduledDate: new Date(scheduledDate),
        rescheduleCount: { increment: 1 },
        agentId: null,
      },
    });

    await transitionOrderStatus({
      orderId: id,
      newStatus: 'RESCHEDULED',
      actorId: session.user.id,
      actorRole: session.user.role,
      note: `Reschedule requested for ${scheduledDate}`,
    });

    // Reassign to the nearest available agent for the rescheduled attempt
    const agent = await findNearestAvailableAgent(order.pickupZoneId);
    if (agent) {
      await prisma.order.update({ where: { id }, data: { agentId: agent.id } });
      const updated = await transitionOrderStatus({
        orderId: id,
        newStatus: 'ASSIGNED',
        actorId: session.user.id,
        actorRole: session.user.role,
        note: `Reassigned to ${agent.name} for rescheduled attempt`,
      });
      return res.status(200).json(updated);
    }

    const stillRescheduled = await prisma.order.findUnique({ where: { id } });
    return res.status(200).json(stillRescheduled); // remains RESCHEDULED until an admin manually assigns an agent
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
};
