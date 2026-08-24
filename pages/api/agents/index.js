import prisma from '../../../lib/prisma';
import { requireRole } from '../../../lib/apiAuth';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const session = await requireRole(req, res, ['ADMIN']);
    if (!session) return;
    const agents = await prisma.user.findMany({
      where: { role: 'AGENT' },
      select: { id: true, name: true, email: true, zoneId: true, isAvailable: true, zone: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
    return res.status(200).json(agents);
  }

  if (req.method === 'PATCH') {
    // Agent toggles their own availability
    const session = await requireRole(req, res, ['AGENT']);
    if (!session) return;
    const { isAvailable } = req.body || {};
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { isAvailable: Boolean(isAvailable) },
    });
    return res.status(200).json({ id: updated.id, isAvailable: updated.isAvailable });
  }

  res.setHeader('Allow', ['GET', 'PATCH']);
  return res.status(405).json({ error: 'Method not allowed' });
};
