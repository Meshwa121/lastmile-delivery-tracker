import { signOut } from 'next-auth/react';
import Link from 'next/link';

export default function Nav({ role }) {
  const links = {
    CUSTOMER: [['/customer/dashboard', 'My Orders'], ['/customer/orders/new', 'New Order']],
    ADMIN: [['/admin/dashboard', 'Overview'], ['/admin/orders', 'Orders'], ['/admin/zones', 'Zones'], ['/admin/rate-cards', 'Rate Cards']],
    AGENT: [['/agent/dashboard', 'My Deliveries']],
  }[role] || [];

  return (
    <div className="nav">
      <div>
        {links.map(([href, label]) => (
          <Link key={href} href={href}>{label}</Link>
        ))}
      </div>
      <button className="secondary" onClick={() => signOut({ callbackUrl: '/' })}>Sign out</button>
    </div>
  );
}
