const nodemailer = require('nodemailer');

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null; // notifications are best-effort in dev without SMTP configured
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

const STATUS_COPY = {
  CREATED: 'Your order has been placed.',
  ASSIGNED: 'A delivery agent has been assigned to your order.',
  PICKED_UP: 'Your package has been picked up.',
  IN_TRANSIT: 'Your package is in transit.',
  OUT_FOR_DELIVERY: 'Your package is out for delivery.',
  DELIVERED: 'Your package has been delivered.',
  FAILED: 'Delivery attempt failed. You can reschedule from your order page.',
  RESCHEDULED: 'Your delivery has been rescheduled.',
};

/**
 * Sends a status-change email to the customer. Failures are logged, never thrown,
 * so a broken/unconfigured SMTP setup never blocks the underlying order-status update.
 */
async function sendStatusEmail({ to, orderNumber, status }) {
  const subject = `Order ${orderNumber}: ${status.replace(/_/g, ' ')}`;
  const body = STATUS_COPY[status] || `Order status updated to ${status}.`;
  const text = `Hi,\n\nOrder ${orderNumber} update: ${body}\n\n- Last-Mile Delivery Tracker`;

  const t = getTransporter();
  if (!t) {
    console.log(`[email:dev-mode, SMTP not configured] to=${to} subject="${subject}" body="${text}"`);
    return { sent: false, reason: 'SMTP not configured (dev mode, logged only)' };
  }

  try {
    await t.sendMail({ from: process.env.SMTP_FROM, to, subject, text });
    return { sent: true };
  } catch (err) {
    console.error('Failed to send status email:', err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendStatusEmail };
