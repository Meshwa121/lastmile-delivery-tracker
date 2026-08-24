import prisma from '../../../lib/prisma';
import { requireRole } from '../../../lib/apiAuth';

// Admin: add/remove pincodes for a zone, or delete a zone
export default async function handler(req, res) {
  const session = await requireRole(req, res, ['ADMIN']);
  if (!session) return;
  const { id } = req.query;

  if (req.method === 'POST') {
    // Add a pincode to this zone
    const { pincode } = req.body || {};
    if (!pincode) return res.status(400).json({ error: 'pincode is required' });
    const existing = await prisma.zonePincode.findUnique({ where: { pincode: String(pincode) } });
    if (existing) return res.status(409).json({ error: `Pincode already mapped to zone ${existing.zoneId}` });
    const created = await prisma.zonePincode.create({ data: { pincode: String(pincode), zoneId: id } });
    return res.status(201).json(created);
  }

  if (req.method === 'DELETE') {
    await prisma.order.findFirst({ where: { OR: [{ pickupZoneId: id }, { dropZoneId: id }] } });
    await prisma.zonePincode.deleteMany({ where: { zoneId: id } });
    await prisma.zone.delete({ where: { id } });
    return res.status(204).end();
  }

  res.setHeader('Allow', ['POST', 'DELETE']);
  return res.status(405).json({ error: 'Method not allowed' });
};
