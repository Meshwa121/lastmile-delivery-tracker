import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      const role = session.user.role;
      if (role === 'ADMIN') router.replace('/admin/dashboard');
      else if (role === 'AGENT') router.replace('/agent/dashboard');
      else router.replace('/customer/dashboard');
    }
  }, [status, session, router]);

  if (status === 'loading') return <div className="container">Loading...</div>;

  return (
    <div className="container">
      <div className="card" style={{ textAlign: 'center', marginTop: 60 }}>
        <h1>Last-Mile Delivery Tracker</h1>
        <p>Auto-calculated shipping charges, smart agent assignment, real-time tracking.</p>
        <Link href="/login"><button>Log in</button></Link>{' '}
        <Link href="/register"><button className="secondary">Register as customer</button></Link>
      </div>
    </div>
  );
}
