const prisma = require('./prisma');
const { detectZoneForPincode } = require('./zoneDetection');

const VOLUMETRIC_DIVISOR = 5000; // industry-standard divisor, cm -> kg

/**
 * Core rate calculation engine.
 *
 * Steps (all admin-configurable, nothing hardcoded except the volumetric divisor,
 * which is the universal courier-industry constant):
 *  1. Detect pickup & drop zone from pincodes
 *  2. Determine INTRA_ZONE vs INTER_ZONE from whether the two zones match
 *  3. Compute volumetric weight = (L x B x H) / 5000
 *  4. Chargeable weight = max(actual, volumetric)
 *  5. Look up the RateCard row for (orderType, zoneType) -> baseCharge + perKgRate
 *  6. weightCharge = perKgRate * chargeableWeight
 *  7. If paymentType === COD, add the configured CodSurcharge for that orderType
 *  8. totalCharge = baseCharge + weightCharge + codSurcharge
 */
async function calculateCharge({
  pickupPincode,
  dropPincode,
  lengthCm,
  breadthCm,
  heightCm,
  actualWeightKg,
  orderType, // 'B2B' | 'B2C'
  paymentType, // 'PREPAID' | 'COD'
}) {
  const pickupZone = await detectZoneForPincode(pickupPincode);
  const dropZone = await detectZoneForPincode(dropPincode);

  const zoneType = pickupZone.id === dropZone.id ? 'INTRA_ZONE' : 'INTER_ZONE';

  const volumetricWeightKg = (lengthCm * breadthCm * heightCm) / VOLUMETRIC_DIVISOR;
  const chargeableWeightKg = Math.max(actualWeightKg, volumetricWeightKg);

  const rateCard = await prisma.rateCard.findUnique({
    where: { orderType_zoneType: { orderType, zoneType } },
  });

  if (!rateCard) {
    const err = new Error(
      `No rate card configured for ${orderType} / ${zoneType}. Ask an admin to configure it.`
    );
    err.statusCode = 422;
    throw err;
  }

  const baseCharge = rateCard.baseCharge;
  const weightCharge = round2(rateCard.perKgRate * chargeableWeightKg);

  let codSurcharge = 0;
  if (paymentType === 'COD') {
    const codConfig = await prisma.codSurcharge.findUnique({ where: { orderType } });
    codSurcharge = codConfig ? codConfig.amount : 0;
  }

  const totalCharge = round2(baseCharge + weightCharge + codSurcharge);

  return {
    pickupZone,
    dropZone,
    zoneType,
    volumetricWeightKg: round2(volumetricWeightKg),
    chargeableWeightKg: round2(chargeableWeightKg),
    baseCharge,
    weightCharge,
    codSurcharge,
    totalCharge,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { calculateCharge, VOLUMETRIC_DIVISOR };
