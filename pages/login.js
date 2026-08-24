import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const res = await signIn('credentials', { redirect: false, email, password });
    if (res?.error) setError('Invalid email or password');
    else router.push('/');
  }

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 380, margin: '60px auto' }}>
        <h2>Log in</h2>
        <form onSubmit={handleSubmit}>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="error">{error}</p>}
          <button type="submit">Log in</button>
        </form>
        <p style={{ marginTop: 16, fontSize: 13 }}>
          No account? <Link href="/register">Register as customer</Link>
        </p>
      </div>
    </div>
  );
}
