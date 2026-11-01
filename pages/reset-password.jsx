import { useRouter } from 'next/router';
import { useState } from 'react';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault(); setMessage(''); setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/password-reset', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: router.query.token, newPassword: password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to reset password');
      setMessage('Password updated successfully. You can now sign in.'); setPassword(''); setConfirm('');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  return <div className="auth-layout-container"><div className="auth-floating-card"><h1>Create new password</h1><p className="sub">Choose a secure password for your Lebara account.</p>{message && <div className="alert-success">{message}</div>}{error && <div className="alert-error">{error}</div>}<form onSubmit={submit}><div className="input-group-wrapper"><label>New password</label><div className="input-box-row"><input type="password" minLength="6" value={password} onChange={(e) => setPassword(e.target.value)} required /></div></div><div className="input-group-wrapper"><label>Confirm password</label><div className="input-box-row"><input type="password" minLength="6" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></div></div><button className="btn-signin-full" disabled={loading || !router.query.token}>{loading ? 'Updating…' : 'Update password'}</button></form><div className="footer-links"><Link href="/">Return to sign in</Link></div></div></div>;
}
