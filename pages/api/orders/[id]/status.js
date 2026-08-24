import prisma from '../../../../lib/prisma';
import { requireRole } from '../../../../lib/apiAuth';
import { transitionOrderStatus } from '../../../../lib/orderStatus';

// Delivery agent updates order status along the normal lifecycle.
// Marking FAILED here is what unlocks the customer's reschedule flow.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = await requireRole(req, res, ['AGENT', 'ADMIN']);
  if (!session) return;

  const { id } = req.query;
  const { status, note } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status is required' });

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (session.user.role === 'AGENT' && order.agentId !== session.user.id) {
    return res.status(403).json({ error: 'You are not assigned to this order' });
  }

  try {
    const data = { orderId: id, newStatus: status, actorId: session.user.id, actorRole: session.user.role, note };
    const updated = await transitionOrderStatus(data);

    if (status === 'FAILED') {
      await prisma.order.update({ where: { id }, data: { lastFailedReason: note || 'Delivery attempt failed' } });
    }

    return res.status(200).json(updated);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
};
