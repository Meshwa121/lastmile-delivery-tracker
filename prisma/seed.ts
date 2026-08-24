import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding...");

  const passwordHash = await bcrypt.hash("password123", 10);

  // --- Zones ---
  const central = await prisma.zone.upsert({
    where: { name: "Ahmedabad-Central" },
    update: {},
    create: { name: "Ahmedabad-Central" },
  });
  const west = await prisma.zone.upsert({
    where: { name: "Ahmedabad-West" },
    update: {},
    create: { name: "Ahmedabad-West" },
  });
  const surat = await prisma.zone.upsert({
    where: { name: "Surat" },
    update: {},
    create: { name: "Surat" },
  });

  // --- Pincode -> Zone mapping ---
  await prisma.zoneArea.upsert({
    where: { pincode: "380001" },
    update: {},
    create: { pincode: "380001", areaName: "Lal Darwaja", zoneId: central.id },
  });
  await prisma.zoneArea.upsert({
    where: { pincode: "380015" },
    update: {},
    create: { pincode: "380015", areaName: "Vastrapur", zoneId: west.id },
  });
  await prisma.zoneArea.upsert({
    where: { pincode: "395003" },
    update: {},
    create: { pincode: "395003", areaName: "Surat City", zoneId: surat.id },
  });

  // --- Rate cards: intra-zone (origin===dest) and inter-zone, per order type ---
  const rateCardRows: Array<{
    originZoneId: string;
    destinationZoneId: string;
    orderType: "B2B" | "B2C";
    baseRate: number;
    perKgRate: number;
  }> = [
    { originZoneId: central.id, destinationZoneId: central.id, orderType: "B2C", baseRate: 30, perKgRate: 10 },
    { originZoneId: central.id, destinationZoneId: central.id, orderType: "B2B", baseRate: 50, perKgRate: 8 },
    { originZoneId: central.id, destinationZoneId: west.id, orderType: "B2C", baseRate: 45, perKgRate: 12 },
    { originZoneId: west.id, destinationZoneId: central.id, orderType: "B2C", baseRate: 45, perKgRate: 12 },
    { originZoneId: central.id, destinationZoneId: west.id, orderType: "B2B", baseRate: 70, perKgRate: 9 },
    { originZoneId: west.id, destinationZoneId: central.id, orderType: "B2B", baseRate: 70, perKgRate: 9 },
    { originZoneId: west.id, destinationZoneId: west.id, orderType: "B2C", baseRate: 30, perKgRate: 10 },
    { originZoneId: west.id, destinationZoneId: west.id, orderType: "B2B", baseRate: 50, perKgRate: 8 },
    { originZoneId: central.id, destinationZoneId: surat.id, orderType: "B2C", baseRate: 90, perKgRate: 16 },
    { originZoneId: surat.id, destinationZoneId: central.id, orderType: "B2C", baseRate: 90, perKgRate: 16 },
    { originZoneId: central.id, destinationZoneId: surat.id, orderType: "B2B", baseRate: 120, perKgRate: 13 },
    { originZoneId: surat.id, destinationZoneId: central.id, orderType: "B2B", baseRate: 120, perKgRate: 13 },
    { originZoneId: surat.id, destinationZoneId: surat.id, orderType: "B2C", baseRate: 30, perKgRate: 10 },
    { originZoneId: surat.id, destinationZoneId: surat.id, orderType: "B2B", baseRate: 50, perKgRate: 8 },
  ];

  for (const row of rateCardRows) {
    await prisma.rateCard.upsert({
      where: {
        originZoneId_destinationZoneId_orderType: {
          originZoneId: row.originZoneId,
          destinationZoneId: row.destinationZoneId,
          orderType: row.orderType,
        },
      },
      update: row,
      create: row,
    });
  }

  // --- COD surcharge rules ---
  await prisma.codSurchargeRule.upsert({
    where: { orderType: "B2C" },
    update: {},
    create: { orderType: "B2C", flatFee: 15, percentage: 1.5 },
  });
  await prisma.codSurchargeRule.upsert({
    where: { orderType: "B2B" },
    update: {},
    create: { orderType: "B2B", flatFee: 25, percentage: 1 },
  });

  // --- Users ---
  const admin = await prisma.user.upsert({
    where: { email: "admin@lastmile.test" },
    update: {},
    create: { name: "Admin", email: "admin@lastmile.test", passwordHash, role: "ADMIN" },
  });

  const customer = await prisma.user.upsert({
    where: { email: "customer@lastmile.test" },
    update: {},
    create: { name: "Test Customer", email: "customer@lastmile.test", passwordHash, role: "CUSTOMER" },
  });

  const agentUser = await prisma.user.upsert({
    where: { email: "agent@lastmile.test" },
    update: {},
    create: { name: "Test Agent", email: "agent@lastmile.test", passwordHash, role: "AGENT" },
  });

  await prisma.agentProfile.upsert({
    where: { userId: agentUser.id },
    update: {},
    create: { userId: agentUser.id, currentZoneId: central.id, availability: "AVAILABLE" },
  });

  console.log("Seeded. Login with:");
  console.log("  admin@lastmile.test / password123");
  console.log("  customer@lastmile.test / password123");
  console.log("  agent@lastmile.test / password123");
  console.log(`Admin id: ${admin.id}, Customer id: ${customer.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
