import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import PublicLayout from '../components/PublicLayout';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Login failed');

      // Success: Redirect to Dashboard
      router.replace('/dashboard');
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="auth-card">
        <h1>Welcome Back!</h1>
        <p className="sub">Sign in to continue your journey</p>

        {error && <div className="msg error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Phone Number</label>
            <div className="input-group">
              <span className="prefix">🇳 +234</span>
              <input 
                type="tel" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                placeholder="Enter phone number" 
                required 
              />
            </div>
          </div>

          <div className="field">
            <label>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Enter your password" 
              required 
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="links">
          Don't have an account? <Link href="/register">Create Account</Link><br/>
          <Link href="/forgot-password" className="text-sm muted">Forgot Password?</Link>
        </div>
      </div>
    </PublicLayout>
  );
}
