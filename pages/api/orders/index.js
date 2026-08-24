import prisma from '../../../lib/prisma';
import { requireRole } from '../../../lib/apiAuth';
import { calculateCharge } from '../../../lib/rateEngine';
import { generateOrderNumber } from '../../../lib/orderNumber';
import { transitionOrderStatus } from '../../../lib/orderStatus';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return handleList(req, res);
  }
  if (req.method === 'POST') {
    return handleCreate(req, res);
  }
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method not allowed' });
};

async function handleList(req, res) {
  const session = await requireRole(req, res, ['CUSTOMER', 'AGENT', 'ADMIN']);
  if (!session) return;

  const { status, zoneId, agentId } = req.query;
  const where = {};

  if (session.user.role === 'CUSTOMER') {
    where.customerId = session.user.id;
  } else if (session.user.role === 'AGENT') {
    where.agentId = session.user.id;
  } else if (session.user.role === 'ADMIN') {
    if (status) where.status = status;
    if (zoneId) where.OR = [{ pickupZoneId: zoneId }, { dropZoneId: zoneId }];
    if (agentId) where.agentId = agentId;
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      pickupZone: true,
      dropZone: true,
      agent: { select: { id: true, name: true, email: true } },
      customer: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return res.status(200).json(orders);
}

async function handleCreate(req, res) {
  const session = await requireRole(req, res, ['CUSTOMER', 'ADMIN']);
  if (!session) return;

  const {
    customerId, // required if admin is creating on behalf of a customer
    pickupAddress, pickupPincode,
    dropAddress, dropPincode,
    lengthCm, breadthCm, heightCm, actualWeightKg,
    orderType, paymentType,
  } = req.body || {};

  if (!pickupAddress || !pickupPincode || !dropAddress || !dropPincode || !lengthCm || !breadthCm || !heightCm || !actualWeightKg || !orderType || !paymentType) {
    return res.status(400).json({ error: 'Missing required order fields' });
  }

  let resolvedCustomerId = session.user.id;
  if (session.user.role === 'ADMIN') {
    if (!customerId) return res.status(400).json({ error: 'customerId is required when admin creates an order' });
    const customer = await prisma.user.findUnique({ where: { id: customerId } });
    if (!customer || customer.role !== 'CUSTOMER') return res.status(400).json({ error: 'customerId must reference a CUSTOMER user' });
    resolvedCustomerId = customerId;
  }

  try {
    // Recalculate server-side (never trust a client-supplied price) using the same engine as /quote
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

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        customerId: resolvedCustomerId,
        createdById: session.user.role === 'ADMIN' ? session.user.id : null,
        pickupAddress, pickupPincode,
        pickupZoneId: quote.pickupZone.id,
        dropAddress, dropPincode,
        dropZoneId: quote.dropZone.id,
        lengthCm: Number(lengthCm), breadthCm: Number(breadthCm), heightCm: Number(heightCm),
        actualWeightKg: Number(actualWeightKg),
        volumetricWeightKg: quote.volumetricWeightKg,
        chargeableWeightKg: quote.chargeableWeightKg,
        orderType, paymentType,
        baseCharge: quote.baseCharge,
        weightCharge: quote.weightCharge,
        codSurcharge: quote.codSurcharge,
        totalCharge: quote.totalCharge,
        status: 'CREATED',
      },
    });

    // Seed the immutable tracking history with the initial CREATED event
    await transitionOrderStatus({
      orderId: order.id,
      newStatus: 'CREATED',
      actorId: session.user.id,
      actorRole: session.user.role,
      note: 'Order created',
      force: true, // CREATED has no "from" state to validate against
    });

    const full = await prisma.order.findUnique({
      where: { id: order.id },
      include: { pickupZone: true, dropZone: true },
    });
    return res.status(201).json(full);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
}
