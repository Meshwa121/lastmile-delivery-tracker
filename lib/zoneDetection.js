const prisma = require('./prisma');

/**
 * Resolve a pincode to its configured Zone.
 * Throws a descriptive error if the admin hasn't mapped that pincode to any zone yet,
 * so the failure surfaces at order-creation time rather than silently mis-billing.
 */
async function detectZoneForPincode(pincode) {
  const mapping = await prisma.zonePincode.findUnique({
    where: { pincode },
    include: { zone: true },
  });

  if (!mapping) {
    const err = new Error(
      `No zone is configured for pincode "${pincode}". Ask an admin to map this pincode to a zone.`
    );
    err.statusCode = 422;
    throw err;
  }

  return mapping.zone;
}

module.exports = { detectZoneForPincode };
