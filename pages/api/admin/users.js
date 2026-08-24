import bcrypt from 'bcryptjs';
import prisma from '../../../lib/prisma';
import { requireRole } from '../../../lib/apiAuth';

// Admin-only: create AGENT or ADMIN accounts, or list all users.
export default async function handler(req, res) {
  const session = await requireRole(req, res, ['ADMIN']);
  if (!session) return;

  if (req.method === 'GET') {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, zoneId: true, isAvailable: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json(users);
  }

  if (req.method === 'POST') {
    const { name, email, password, role, phone, zoneId } = req.body || {};
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'name, email, password, role are required' });
    }
    if (!['AGENT', 'ADMIN', 'CUSTOMER'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role, phone, zoneId: role === 'AGENT' ? zoneId : null },
    });
    return res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method not allowed' });
};
