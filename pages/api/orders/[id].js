import prisma from '../../../lib/prisma';
import { requireRole } from '../../../lib/apiAuth';
import { transitionOrderStatus } from '../../../lib/orderStatus';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    const session = await requireRole(req, res, ['CUSTOMER', 'AGENT', 'ADMIN']);
    if (!session) return;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        pickupZone: true,
        dropZone: true,
        agent: { select: { id: true, name: true, email: true, phone: true } },
        customer: { select: { id: true, name: true, email: true, phone: true } },
        statusEvents: { orderBy: { timestamp: 'asc' }, include: { actor: { select: { name: true, role: true } } } },
      },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Scope access: customers/agents can only view their own orders
    if (session.user.role === 'CUSTOMER' && order.customerId !== session.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (session.user.role === 'AGENT' && order.agentId !== session.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return res.status(200).json(order);
  }

  if (req.method === 'PATCH') {
    // Admin override: force any status regardless of the normal transition rules
    const session = await requireRole(req, res, ['ADMIN']);
    if (!session) return;
    const { status, note } = req.body || {};
    if (!status) return res.status(400).json({ error: 'status is required' });

    try {
      const updated = await transitionOrderStatus({
        orderId: id,
        newStatus: status,
        actorId: session.user.id,
        actorRole: 'ADMIN',
        note: note || 'Status overridden by admin',
        force: true,
      });
      return res.status(200).json(updated);
    } catch (err) {
      return res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  res.setHeader('Allow', ['GET', 'PATCH']);
  return res.status(405).json({ error: 'Method not allowed' });
};
