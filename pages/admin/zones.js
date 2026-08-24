import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Nav from '../../components/Nav';

export default function Zones() {
  const { status } = useSession({ required: true });
  const [zones, setZones] = useState([]);
  const [name, setName] = useState('');
  const [pincodeInputs, setPincodeInputs] = useState({});
  const [error, setError] = useState('');

  async function load() {
    const res = await fetch('/api/zones');
    if (res.ok) setZones(await res.json());
  }
  useEffect(() => { if (status === 'authenticated') load(); }, [status]);

  async function createZone(e) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/zones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    if (res.ok) { setName(''); load(); } else setError((await res.json()).error);
  }

  async function addPincode(zoneId) {
    const pincode = pincodeInputs[zoneId];
    if (!pincode) return;
    const res = await fetch(`/api/zones/${zoneId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pincode }) });
    if (res.ok) { setPincodeInputs({ ...pincodeInputs, [zoneId]: '' }); load(); } else alert((await res.json()).error);
  }

  if (status !== 'authenticated') return null;

  return (
    <>
      <Nav role="ADMIN" />
      <div className="container">
        <h1>Zones</h1>
        <div className="card">
          <h3>Create Zone</h3>
          <form onSubmit={createZone}>
            <label>Zone name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
            {error && <p className="error">{error}</p>}
            <button type="submit">Create</button>
          </form>
        </div>

        {zones.map((z) => (
          <div className="card" key={z.id}>
            <h3>{z.name}</h3>
            <p>Pincodes: {z.pincodes.map((p) => p.pincode).join(', ') || 'none mapped yet'}</p>
            <input
              placeholder="Add pincode"
              style={{ width: 160, display: 'inline-block' }}
              value={pincodeInputs[z.id] || ''}
              onChange={(e) => setPincodeInputs({ ...pincodeInputs, [z.id]: e.target.value })}
            />
            <button onClick={() => addPincode(z.id)}>Add</button>
          </div>
        ))}
      </div>
    </>
  );
}
