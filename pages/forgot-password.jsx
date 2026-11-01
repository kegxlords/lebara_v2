import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to start password reset');
      setMessage('If an account matches that phone number or email, reset instructions will be sent.');
      setIdentifier('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-layout-container">
      <div className="auth-floating-card">
        <h1>Reset Password</h1>
        <p className="sub">Enter your phone number or email to continue.</p>
        {message && <div className="alert-success">{message}</div>}
        {error && <div className="alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="input-group-wrapper">
            <label htmlFor="identifier">Phone number or email</label>
            <div className="input-box-row">
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="Enter phone or email"
                required
                autoComplete="email"
              />
            </div>
          </div>
          <button type="submit" className="btn-signin-full" disabled={loading}>
            {loading ? 'Please wait...' : 'Request Reset'}
          </button>
        </form>
        <div className="footer-links">
          Remembered your password? <Link href="/">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
