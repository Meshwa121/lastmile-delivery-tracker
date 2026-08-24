import prisma from '../../../lib/prisma';
import { requireRole } from '../../../lib/apiAuth';

// Rate cards: {orderType: B2B|B2C, zoneType: INTRA_ZONE|INTER_ZONE, baseCharge, perKgRate}
// Plus COD surcharge per order type. All admin-configurable, no hardcoded values in the engine.
export default async function handler(req, res) {
  if (req.method === 'GET') {
    const session = await requireRole(req, res, ['ADMIN', 'CUSTOMER', 'AGENT']);
    if (!session) return;
    const [rateCards, codSurcharges] = await Promise.all([
      prisma.rateCard.findMany({ orderBy: [{ orderType: 'asc' }, { zoneType: 'asc' }] }),
      prisma.codSurcharge.findMany(),
    ]);
    return res.status(200).json({ rateCards, codSurcharges });
  }

  if (req.method === 'POST') {
    const session = await requireRole(req, res, ['ADMIN']);
    if (!session) return;
    const { orderType, zoneType, baseCharge, perKgRate } = req.body || {};
    if (!orderType || !zoneType || baseCharge == null || perKgRate == null) {
      return res.status(400).json({ error: 'orderType, zoneType, baseCharge, perKgRate are required' });
    }
    const rateCard = await prisma.rateCard.upsert({
      where: { orderType_zoneType: { orderType, zoneType } },
      update: { baseCharge, perKgRate },
      create: { orderType, zoneType, baseCharge, perKgRate },
    });
    return res.status(200).json(rateCard);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method not allowed' });
};
