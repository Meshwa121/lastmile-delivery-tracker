import prisma from '../../../lib/prisma';
import { requireRole } from '../../../lib/apiAuth';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Any authenticated user can read zones (needed for order-creation forms)
    const session = await requireRole(req, res, ['CUSTOMER', 'AGENT', 'ADMIN']);
    if (!session) return;
    const zones = await prisma.zone.findMany({
      include: { pincodes: true },
      orderBy: { name: 'asc' },
    });
    return res.status(200).json(zones);
  }

  if (req.method === 'POST') {
    const session = await requireRole(req, res, ['ADMIN']);
    if (!session) return;
    const { name, pincodes } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });

    const zone = await prisma.zone.create({
      data: {
        name,
        pincodes: pincodes && pincodes.length
          ? { create: pincodes.map((p) => ({ pincode: String(p) })) }
          : undefined,
      },
      include: { pincodes: true },
    });
    return res.status(201).json(zone);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method not allowed' });
};
