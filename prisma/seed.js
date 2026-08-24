const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@lastmile.dev' },
    update: {},
    create: { name: 'Admin', email: 'admin@lastmile.dev', passwordHash, role: 'ADMIN' },
  });

  const zoneA = await prisma.zone.upsert({
    where: { name: 'Zone A - Ahmedabad Central' },
    update: {},
    create: {
      name: 'Zone A - Ahmedabad Central',
      pincodes: { create: [{ pincode: '380001' }, { pincode: '380006' }] },
    },
  });

  const zoneB = await prisma.zone.upsert({
    where: { name: 'Zone B - Ahmedabad East' },
    update: {},
    create: {
      name: 'Zone B - Ahmedabad East',
      pincodes: { create: [{ pincode: '382345' }, { pincode: '382443' }] },
    },
  });

  await prisma.rateCard.upsert({
    where: { orderType_zoneType: { orderType: 'B2C', zoneType: 'INTRA_ZONE' } },
    update: {}, create: { orderType: 'B2C', zoneType: 'INTRA_ZONE', baseCharge: 30, perKgRate: 15 },
  });
  await prisma.rateCard.upsert({
    where: { orderType_zoneType: { orderType: 'B2C', zoneType: 'INTER_ZONE' } },
    update: {}, create: { orderType: 'B2C', zoneType: 'INTER_ZONE', baseCharge: 50, perKgRate: 22 },
  });
  await prisma.rateCard.upsert({
    where: { orderType_zoneType: { orderType: 'B2B', zoneType: 'INTRA_ZONE' } },
    update: {}, create: { orderType: 'B2B', zoneType: 'INTRA_ZONE', baseCharge: 40, perKgRate: 12 },
  });
  await prisma.rateCard.upsert({
    where: { orderType_zoneType: { orderType: 'B2B', zoneType: 'INTER_ZONE' } },
    update: {}, create: { orderType: 'B2B', zoneType: 'INTER_ZONE', baseCharge: 65, perKgRate: 18 },
  });

  await prisma.codSurcharge.upsert({ where: { orderType: 'B2C' }, update: {}, create: { orderType: 'B2C', amount: 25 } });
  await prisma.codSurcharge.upsert({ where: { orderType: 'B2B' }, update: {}, create: { orderType: 'B2B', amount: 40 } });

  const agent = await prisma.user.upsert({
    where: { email: 'agent1@lastmile.dev' },
    update: {},
    create: { name: 'Agent One', email: 'agent1@lastmile.dev', passwordHash, role: 'AGENT', zoneId: zoneA.id, isAvailable: true },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer1@lastmile.dev' },
    update: {},
    create: { name: 'Customer One', email: 'customer1@lastmile.dev', passwordHash, role: 'CUSTOMER' },
  });

  console.log('Seed complete:', { admin: admin.email, agent: agent.email, customer: customer.email, password: 'password123' });
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
