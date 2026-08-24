import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Nav from '../../../components/Nav';

export default function OrderDetail() {
  useSession({ required: true });
  const router = useRouter();
  const { id } = router.query;
  const [order, setOrder] = useState(null);
  const [date, setDate] = useState('');
  const [error, setError] = useState('');

  async function load() {
    if (!id) return;
    const res = await fetch(`/api/orders/${id}`);
    if (res.ok) setOrder(await res.json());
  }
  useEffect(() => { load(); }, [id]);

  async function reschedule(e) {
    e.preventDefault();
    setError('');
    const res = await fetch(`/api/orders/${id}/reschedule`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scheduledDate: date }),
    });
    if (res.ok) load(); else setError((await res.json()).error);
  }

  if (!order) return <div className="container">Loading...</div>;

  return (
    <>
      <Nav role="CUSTOMER" />
      <div className="container">
        <h1>Order {order.orderNumber}</h1>
        <div className="card">
          <p><b>Status:</b> <span className={`badge ${order.status}`}>{order.status}</span></p>
          <p><b>Route:</b> {order.pickupZone.name} → {order.dropZone.name}</p>
          <p><b>From:</b> {order.pickupAddress} ({order.pickupPincode})</p>
          <p><b>To:</b> {order.dropAddress} ({order.dropPincode})</p>
          <p><b>Chargeable weight:</b> {order.chargeableWeightKg} kg &nbsp; <b>Total:</b> ₹{order.totalCharge}</p>
          {order.agent && <p><b>Agent:</b> {order.agent.name} ({order.agent.phone || order.agent.email})</p>}
        </div>

        {order.status === 'FAILED' && (
          <div className="card">
            <h3>Reschedule Delivery</h3>
            <p>Reason: {order.lastFailedReason}</p>
            <form onSubmit={reschedule}>
              <label>New delivery date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              {error && <p className="error">{error}</p>}
              <button type="submit">Reschedule</button>
            </form>
          </div>
        )}

        <div className="card">
          <h3>Tracking Timeline</h3>
          <ul className="timeline">
            {order.statusEvents.map((ev) => (
              <li key={ev.id}>
                <b>{ev.status}</b> — {new Date(ev.timestamp).toLocaleString()}
                {ev.actor && <> by {ev.actor.name} ({ev.actor.role})</>}
                {ev.note && <div style={{ color: '#666', fontSize: 13 }}>{ev.note}</div>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
