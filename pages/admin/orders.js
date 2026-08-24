import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Nav from '../../components/Nav';

const STATUSES = ['CREATED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RESCHEDULED'];

export default function AdminOrders() {
  const { status } = useSession({ required: true });
  const [orders, setOrders] = useState([]);
  const [zones, setZones] = useState([]);
  const [agents, setAgents] = useState([]);
  const [filters, setFilters] = useState({ status: '', zoneId: '', agentId: '' });
  const [assignChoice, setAssignChoice] = useState({});
  const [overrideChoice, setOverrideChoice] = useState({});

  async function load() {
    const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    const [oRes, zRes, aRes] = await Promise.all([
      fetch(`/api/orders?${params}`),
      fetch('/api/zones'),
      fetch('/api/agents'),
    ]);
    if (oRes.ok) setOrders(await oRes.json());
    if (zRes.ok) setZones(await zRes.json());
    if (aRes.ok) setAgents(await aRes.json());
  }
  useEffect(() => { if (status === 'authenticated') load(); }, [status, filters]);

  async function autoAssign(orderId) {
    const res = await fetch(`/api/orders/${orderId}/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auto: true }) });
    if (res.ok) load(); else alert((await res.json()).error);
  }
  async function manualAssign(orderId) {
    const agentId = assignChoice[orderId];
    if (!agentId) return;
    const res = await fetch(`/api/orders/${orderId}/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId }) });
    if (res.ok) load(); else alert((await res.json()).error);
  }
  async function overrideStatus(orderId) {
    const s = overrideChoice[orderId];
    if (!s) return;
    const res = await fetch(`/api/orders/${orderId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: s }) });
    if (res.ok) load(); else alert((await res.json()).error);
  }

  if (status !== 'authenticated') return null;

  return (
    <>
      <Nav role="ADMIN" />
      <div className="container">
        <h1>All Orders</h1>
        <div className="card">
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.zoneId} onChange={(e) => setFilters({ ...filters, zoneId: e.target.value })}>
              <option value="">All zones</option>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
            <select value={filters.agentId} onChange={(e) => setFilters({ ...filters, agentId: e.target.value })}>
              <option value="">All agents</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>

        {orders.map((o) => (
          <div className="card" key={o.id}>
            <p><Link href={`/customer/orders/${o.id}`}><b>{o.orderNumber}</b></Link> — <span className={`badge ${o.status}`}>{o.status}</span></p>
            <p style={{ fontSize: 13 }}>{o.customer?.name} | {o.pickupZone?.name} → {o.dropZone?.name} | ₹{o.totalCharge}</p>
            <p style={{ fontSize: 13, color: '#666' }}>Agent: {o.agent?.name || 'unassigned'}</p>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <button onClick={() => autoAssign(o.id)}>Auto-assign</button>
              <select onChange={(e) => setAssignChoice({ ...assignChoice, [o.id]: e.target.value })} defaultValue="">
                <option value="" disabled>Pick agent</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.zone?.name || 'no zone'})</option>)}
              </select>
              <button className="secondary" onClick={() => manualAssign(o.id)}>Manually assign</button>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <select onChange={(e) => setOverrideChoice({ ...overrideChoice, [o.id]: e.target.value })} defaultValue="">
                <option value="" disabled>Override status</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="danger" onClick={() => overrideStatus(o.id)}>Force status</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
