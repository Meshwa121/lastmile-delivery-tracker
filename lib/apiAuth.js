import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth';

/**
 * Loads the session for an API route and enforces an allowed-roles list.
 * Returns the session on success, or writes a 401/403 response and returns null.
 */
export async function requireRole(req, res, allowedRoles) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    res.status(403).json({ error: 'Forbidden: insufficient role' });
    return null;
  }
  return session;
}
