import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Nav from '../../components/Nav';

const NEXT_STATUS = {
  ASSIGNED: ['PICKED_UP', 'FAILED'],
  PICKED_UP: ['IN_TRANSIT', 'FAILED'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'FAILED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
};

export default function AgentDashboard() {
  const { data: session, status } = useSession({ required: true });
  const [orders, setOrders] = useState([]);
  const [available, setAvailable] = useState(true);
  const [note, setNote] = useState({});

  async function load() {
    const res = await fetch('/api/orders');
    if (res.ok) setOrders(await res.json());
  }
  useEffect(() => { if (status === 'authenticated') load(); }, [status]);

  async function updateStatus(orderId, newStatus) {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, note: note[orderId] || undefined }),
    });
    if (res.ok) load(); else alert((await res.json()).error);
  }

  async function toggleAvailability() {
    const next = !available;
    await fetch('/api/agents', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isAvailable: next }) });
    setAvailable(next);
  }

  if (status !== 'authenticated') return null;

  return (
    <>
      <Nav role="AGENT" />
      <div className="container">
        <h1>My Deliveries</h1>
        <button className="secondary" onClick={toggleAvailability}>
          {available ? 'Set myself Unavailable' : 'Set myself Available'}
        </button>

        {orders.map((o) => (
          <div className="card" key={o.id}>
            <p><b>{o.orderNumber}</b> — <span className={`badge ${o.status}`}>{o.status}</span></p>
            <p>{o.pickupZone?.name} → {o.dropZone?.name} | {o.customer?.name}</p>
            <p style={{ fontSize: 13, color: '#666' }}>{o.pickupAddress} → {o.dropAddress}</p>
            {NEXT_STATUS[o.status] && (
              <>
                <input placeholder="optional note" value={note[o.id] || ''} onChange={(e) => setNote({ ...note, [o.id]: e.target.value })} />
                {NEXT_STATUS[o.status].map((s) => (
                  <button key={s} className={s === 'FAILED' ? 'danger' : ''} onClick={() => updateStatus(o.id, s)}>
                    Mark {s.replace('_', ' ')}
                  </button>
                ))}
              </>
            )}
          </div>
        ))}
        {orders.length === 0 && <p>No deliveries assigned to you yet.</p>}
      </div>
    </>
  );
}
