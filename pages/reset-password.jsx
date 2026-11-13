import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '../lib/supabase-browser';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);

  useEffect(() => {
    let active = true;
    let client;
    try {
      client = getSupabaseBrowserClient();
      if (!client) throw new Error('Supabase Auth is unavailable in this browser.');
    } catch (err) {
      setError(err.message || 'Supabase Auth is not configured.');
      setChecking(false);
      return undefined;
    }

    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY' || session) setRecoveryReady(Boolean(session));
    });

    async function resolveRecoverySession() {
      const code = new URLSearchParams(window.location.search).get('code');
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const hashError = hashParams.get('error_description') || hashParams.get('error');
      if (hashError) throw new Error(decodeURIComponent(hashError.replace(/\+/g, ' ')));
      if (code) {
        const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
        window.history.replaceState({}, document.title, '/reset-password');
      }
      let { data, error: sessionError } = await client.auth.getSession();
      // Mobile browsers may finish consuming the access-token hash just after
      // the first getSession call. Give the auth listener a moment to hydrate.
      if (!data?.session && !sessionError && window.location.hash) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        ({ data, error: sessionError } = await client.auth.getSession());
      }
      if (!active) return;
      setRecoveryReady(Boolean(data?.session));
      if (sessionError || !data?.session) setError('This recovery link is invalid or expired. Request a new one.');
      setChecking(false);
    }

    resolveRecoverySession().catch(() => {
      if (!active) return;
      setError('This recovery link is invalid or expired. Request a new one.');
      setChecking(false);
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (!recoveryReady) { setError('Open the latest password-reset link from your Supabase email, then try again.'); return; }

    setLoading(true);
    try {
      const client = getSupabaseBrowserClient();
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage('Password updated in Supabase. You can now sign in with your new password.');
      setPassword('');
      setConfirm('');
      await client.auth.signOut().catch(() => {});
      setRecoveryReady(false);
    } catch (err) {
      setError(err.message || 'Unable to update your Supabase password. Request a new recovery link and try again.');
    } finally {
      setLoading(false);
    }
  }

  return <div className="auth-layout-container"><div className="auth-floating-card"><h1>Create new password</h1><p className="sub">Choose a password of at least 8 characters for your Lebara account.</p>{message && <div className="alert-success">{message}</div>}{error && <div className="alert-error">{error}</div>}{checking ? <p className="sub">Verifying your Supabase recovery link…</p> : <form onSubmit={submit}><div className="input-group-wrapper"><label>New password</label><div className="input-box-row"><input type="password" autoComplete="new-password" minLength="8" value={password} onChange={(e) => setPassword(e.target.value)} required /></div></div><div className="input-group-wrapper"><label>Confirm password</label><div className="input-box-row"><input type="password" autoComplete="new-password" minLength="8" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></div></div><button className="btn-signin-full" disabled={loading || !recoveryReady}>{loading ? 'Updating…' : 'Update password'}</button></form>}<div className="footer-links"><Link href="/">Return to sign in</Link></div></div></div>;
}
