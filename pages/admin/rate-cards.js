import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Nav from '../../components/Nav';

const COMBOS = [
  { orderType: 'B2C', zoneType: 'INTRA_ZONE' },
  { orderType: 'B2C', zoneType: 'INTER_ZONE' },
  { orderType: 'B2B', zoneType: 'INTRA_ZONE' },
  { orderType: 'B2B', zoneType: 'INTER_ZONE' },
];

export default function RateCards() {
  const { status } = useSession({ required: true });
  const [rateCards, setRateCards] = useState([]);
  const [codSurcharges, setCodSurcharges] = useState([]);
  const [form, setForm] = useState({});
  const [codForm, setCodForm] = useState({ B2C: '', B2B: '' });

  async function load() {
    const res = await fetch('/api/rate-cards');
    if (res.ok) {
      const data = await res.json();
      setRateCards(data.rateCards);
      setCodSurcharges(data.codSurcharges);
    }
  }
  useEffect(() => { if (status === 'authenticated') load(); }, [status]);

  function findCard(orderType, zoneType) {
    return rateCards.find((r) => r.orderType === orderType && r.zoneType === zoneType);
  }

  async function saveCard(orderType, zoneType) {
    const key = `${orderType}_${zoneType}`;
    const vals = form[key] || {};
    const existing = findCard(orderType, zoneType);
    const baseCharge = vals.baseCharge ?? existing?.baseCharge;
    const perKgRate = vals.perKgRate ?? existing?.perKgRate;
    const res = await fetch('/api/rate-cards', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderType, zoneType, baseCharge: Number(baseCharge), perKgRate: Number(perKgRate) }),
    });
    if (res.ok) load(); else alert((await res.json()).error);
  }

  async function saveCod(orderType) {
    const res = await fetch('/api/rate-cards/cod', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderType, amount: Number(codForm[orderType]) }),
    });
    if (res.ok) load(); else alert((await res.json()).error);
  }

  if (status !== 'authenticated') return null;

  return (
    <>
      <Nav role="ADMIN" />
      <div className="container">
        <h1>Rate Cards</h1>
        {COMBOS.map(({ orderType, zoneType }) => {
          const existing = findCard(orderType, zoneType);
          const key = `${orderType}_${zoneType}`;
          return (
            <div className="card" key={key}>
              <h3>{orderType} — {zoneType.replace('_', ' ')}</h3>
              <p style={{ fontSize: 13, color: '#666' }}>
                Current: base ₹{existing?.baseCharge ?? '—'} + ₹{existing?.perKgRate ?? '—'}/kg
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label>Base charge (₹)</label>
                  <input type="number" defaultValue={existing?.baseCharge}
                    onChange={(e) => setForm({ ...form, [key]: { ...form[key], baseCharge: e.target.value } })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Per kg rate (₹)</label>
                  <input type="number" defaultValue={existing?.perKgRate}
                    onChange={(e) => setForm({ ...form, [key]: { ...form[key], perKgRate: e.target.value } })} />
                </div>
              </div>
              <button onClick={() => saveCard(orderType, zoneType)}>Save</button>
            </div>
          );
        })}

        <div className="card">
          <h3>COD Surcharge</h3>
          {['B2C', 'B2B'].map((ot) => {
            const existing = codSurcharges.find((c) => c.orderType === ot);
            return (
              <div key={ot} style={{ marginBottom: 12 }}>
                <label>{ot} COD surcharge (₹) — current: ₹{existing?.amount ?? 0}</label>
                <input type="number" style={{ width: 160, display: 'inline-block' }}
                  value={codForm[ot]} onChange={(e) => setCodForm({ ...codForm, [ot]: e.target.value })} />
                <button onClick={() => saveCod(ot)}>Save</button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
