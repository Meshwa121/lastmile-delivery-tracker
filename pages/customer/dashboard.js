import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Nav from '../../components/Nav';

export default function CustomerDashboard() {
  const { data: session, status } = useSession({ required: true });
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/orders').then((r) => r.json()).then(setOrders);
    }
  }, [status]);

  if (status !== 'authenticated') return null;

  return (
    <>
      <Nav role="CUSTOMER" />
      <div className="container">
        <h1>My Orders</h1>
        <Link href="/customer/orders/new"><button>+ New Order</button></Link>
        <div className="card">
          <table>
            <thead>
              <tr><th>Order #</th><th>Route</th><th>Status</th><th>Charge</th><th></th></tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.orderNumber}</td>
                  <td>{o.pickupZone?.name} → {o.dropZone?.name}</td>
                  <td><span className={`badge ${o.status}`}>{o.status}</span></td>
                  <td>₹{o.totalCharge}</td>
                  <td><Link href={`/customer/orders/${o.id}`}>View</Link></td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={5}>No orders yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
