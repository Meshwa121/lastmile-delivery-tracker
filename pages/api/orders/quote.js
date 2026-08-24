import { requireRole } from '../../../lib/apiAuth';
import { calculateCharge } from '../../../lib/rateEngine';

// Preview-only: computes the charge breakdown WITHOUT persisting anything,
// so the customer can see the price and confirm before the order is actually created.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = await requireRole(req, res, ['CUSTOMER', 'ADMIN']);
  if (!session) return;

  try {
    const { pickupPincode, dropPincode, lengthCm, breadthCm, heightCm, actualWeightKg, orderType, paymentType } = req.body || {};
    const quote = await calculateCharge({
      pickupPincode: String(pickupPincode),
      dropPincode: String(dropPincode),
      lengthCm: Number(lengthCm),
      breadthCm: Number(breadthCm),
      heightCm: Number(heightCm),
      actualWeightKg: Number(actualWeightKg),
      orderType,
      paymentType,
    });
    return res.status(200).json(quote);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
};
