const prisma = require('./prisma');
const { sendStatusEmail } = require('./notify');

// Defines which statuses are legal "next steps" from each current status.
// ADMIN override bypasses this (admins can force any status), everyone else must respect it.
const ALLOWED_TRANSITIONS = {
  CREATED: ['ASSIGNED'],
  ASSIGNED: ['PICKED_UP', 'FAILED'],
  PICKED_UP: ['IN_TRANSIT', 'FAILED'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'FAILED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
  FAILED: ['RESCHEDULED'],
  RESCHEDULED: ['ASSIGNED'],
  DELIVERED: [],
};

function isTransitionAllowed(from, to) {
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

/**
 * Applies a status change to an order: updates the current status column AND appends
 * an immutable OrderStatusEvent row (timestamp + actor) — the tracking history is never
 * mutated or deleted, only appended to. Emails the customer on every change.
 */
async function transitionOrderStatus({ orderId, newStatus, actorId, actorRole, note, force = false }) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { customer: true } });
  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }

  if (!force && !isTransitionAllowed(order.status, newStatus)) {
    const err = new Error(`Cannot move order from ${order.status} to ${newStatus}`);
    err.statusCode = 422;
    throw err;
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: newStatus },
  });

  await prisma.orderStatusEvent.create({
    data: { orderId, status: newStatus, actorId, actorRole, note },
  });

  // Fire-and-forget: never let a flaky SMTP provider block the status transition itself.
  sendStatusEmail({ to: order.customer.email, orderNumber: order.orderNumber, status: newStatus }).catch(() => {});

  return updated;
}

module.exports = { transitionOrderStatus, isTransitionAllowed, ALLOWED_TRANSITIONS };
