import prisma from '../../../lib/prisma';
import { requireRole } from '../../../lib/apiAuth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = await requireRole(req, res, ['ADMIN']);
  if (!session) return;

  const { orderType, amount } = req.body || {};
  if (!orderType || amount == null) {
    return res.status(400).json({ error: 'orderType and amount are required' });
  }
  const surcharge = await prisma.codSurcharge.upsert({
    where: { orderType },
    update: { amount },
    create: { orderType, amount },
  });
  return res.status(200).json(surcharge);
};
