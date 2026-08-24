import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Nav from '../../components/Nav';

export default function AdminDashboard() {
  const { status } = useSession({ required: true });
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (status === 'authenticated') fetch('/api/orders').then((r) => r.json()).then(setOrders);
  }, [status]);

  if (status !== 'authenticated') return null;

  const counts = orders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {});

  return (
    <>
      <Nav role="ADMIN" />
      <div className="container">
        <h1>Overview</h1>
        <div className="card">
          <table>
            <thead><tr><th>Status</th><th>Count</th></tr></thead>
            <tbody>
              {Object.entries(counts).map(([k, v]) => (
                <tr key={k}><td><span className={`badge ${k}`}>{k}</span></td><td>{v}</td></tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={2}>No orders yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <p>Total orders: {orders.length}</p>
      </div>
    </>
  );
}
