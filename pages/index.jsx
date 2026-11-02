import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', phone, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      const requested = typeof router.query.next === 'string' ? router.query.next : '';
      const safeNext = requested.startsWith('/') && !requested.startsWith('//') ? requested : '';
      router.replace(data.user?.is_admin ? (safeNext || '/admin') : (safeNext || '/dashboard'));
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout-container">
      {/* BACKGROUND IMAGE LAYER */}
      <div className="auth-bg-image-layer">
         {/* Replace src with your actual image path */}
         <img src="/assets/file_0000000020a881f58a4ebe5b727b73bd.png" alt="Lebara Voice" />
      </div>

      {/* FLOATING FORM CARD */}
      <div className="auth-floating-card">
        <h1>Welcome Back!</h1>
        <p className="sub">Sign in to continue your journey</p>

        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="input-group-wrapper">
            <label>Phone Number</label>
            <div className="input-box-row">
              <span className="prefix-flag">🇳🇬 +234</span>
              <input 
                type="tel" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                placeholder="Enter phone number" 
                required 
                autoComplete="tel"
              />
            </div>
          </div>

          <div className="input-group-wrapper">
            <label>Password</label>
            <div className="input-box-row">
               <svg className="icon-left" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
              <input 
                type={showPass ? "text" : "password"} 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Enter your password" 
                required 
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="toggle-pass">
                {showPass ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-signin-full" disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="footer-links">
          Don't have an account? <Link href="/register">Create Account</Link><br/>
          <Link href="/forgot-password" className="muted-link">Forgot Password?</Link>
        </div>
      </div>
    </div>
  );
          }
