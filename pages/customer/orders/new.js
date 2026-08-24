import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Nav from '../../../components/Nav';

const initial = {
  pickupAddress: '', pickupPincode: '', dropAddress: '', dropPincode: '',
  lengthCm: '', breadthCm: '', heightCm: '', actualWeightKg: '',
  orderType: 'B2C', paymentType: 'PREPAID',
};

export default function NewOrder() {
  useSession({ required: true });
  const [form, setForm] = useState(initial);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function update(field, value) {
    setForm({ ...form, [field]: value });
    setQuote(null); // any change invalidates the previous quote
  }

  async function getQuote(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    const res = await fetch('/api/orders/quote', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setQuote(data); else setError(data.error);
  }

  async function confirmOrder() {
    setError(''); setLoading(true);
    const res = await fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) router.push(`/customer/orders/${data.id}`);
    else setError(data.error);
  }

  return (
    <>
      <Nav role="CUSTOMER" />
      <div className="container">
        <h1>New Order</h1>
        <div className="card">
          <form onSubmit={getQuote}>
            <label>Pickup Address</label>
            <input value={form.pickupAddress} onChange={(e) => update('pickupAddress', e.target.value)} required />
            <label>Pickup Pincode</label>
            <input value={form.pickupPincode} onChange={(e) => update('pickupPincode', e.target.value)} required />
            <label>Drop Address</label>
            <input value={form.dropAddress} onChange={(e) => update('dropAddress', e.target.value)} required />
            <label>Drop Pincode</label>
            <input value={form.dropPincode} onChange={(e) => update('dropPincode', e.target.value)} required />
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}><label>Length (cm)</label><input type="number" value={form.lengthCm} onChange={(e) => update('lengthCm', e.target.value)} required /></div>
              <div style={{ flex: 1 }}><label>Breadth (cm)</label><input type="number" value={form.breadthCm} onChange={(e) => update('breadthCm', e.target.value)} required /></div>
              <div style={{ flex: 1 }}><label>Height (cm)</label><input type="number" value={form.heightCm} onChange={(e) => update('heightCm', e.target.value)} required /></div>
            </div>
            <label>Actual Weight (kg)</label>
            <input type="number" step="0.01" value={form.actualWeightKg} onChange={(e) => update('actualWeightKg', e.target.value)} required />
            <label>Order Type</label>
            <select value={form.orderType} onChange={(e) => update('orderType', e.target.value)}>
              <option value="B2C">B2C</option>
              <option value="B2B">B2B</option>
            </select>
            <label>Payment Type</label>
            <select value={form.paymentType} onChange={(e) => update('paymentType', e.target.value)}>
              <option value="PREPAID">Prepaid</option>
              <option value="COD">COD</option>
            </select>
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={loading}>Get Quote</button>
          </form>
        </div>

        {quote && (
          <div className="card">
            <h3>Charge Breakdown</h3>
            <p>Zone: {quote.pickupZone.name} → {quote.dropZone.name} ({quote.zoneType.replace('_', ' ')})</p>
            <p>Volumetric weight: {quote.volumetricWeightKg} kg | Chargeable weight: {quote.chargeableWeightKg} kg</p>
            <table>
              <tbody>
                <tr><td>Base charge</td><td>₹{quote.baseCharge}</td></tr>
                <tr><td>Weight charge</td><td>₹{quote.weightCharge}</td></tr>
                <tr><td>COD surcharge</td><td>₹{quote.codSurcharge}</td></tr>
                <tr><td><b>Total</b></td><td><b>₹{quote.totalCharge}</b></td></tr>
              </tbody>
            </table>
            <button onClick={confirmOrder} disabled={loading}>Confirm & Place Order</button>
          </div>
        )}
      </div>
    </>
  );
}
