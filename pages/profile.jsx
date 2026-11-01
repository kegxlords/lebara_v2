import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { useRouter } from 'next/router';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState({ balance: 0, income_balance: 0 });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/auth');
        if (!res.ok) throw new Error('Not authenticated');
        const data = await res.json();
        setUser(data.user);
        setWallet(data.wallet || { balance: 0, income_balance: 0 });
      } catch (err) {
        console.error(err);
        router.push('/');
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [router]);

  const copyReferral = async () => {
    if (!user?.referral_code) return;
    try {
      await navigator.clipboard.writeText(user.referral_code);
      setNotice('Referral code copied');
    } catch {
      setNotice('Copy is unavailable on this device');
    }
  };

  const logout = async () => {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    router.push('/');
  };

  if (loading) return <AppLayout><div className="empty-state dashboard-loading">Loading your profile...</div></AppLayout>;

  return (
    <AppLayout>
      <section className="profile-hero">
        <div className="profile-avatar">{user?.full_name?.charAt(0).toUpperCase() || 'M'}</div>
        <div><h1>{user?.full_name || 'Lebara member'}</h1><p>{user?.phone || user?.email || 'Member account'}</p></div>
      </section>

      <section className="profile-balance">
        <div><span>Available balance</span><b>₦{(Number(wallet.balance) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</b></div>
        <div><span>Income balance</span><b>₦{(Number(wallet.income_balance) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</b></div>
      </section>

      <section className="profile-code">
        <div><span>Referral code</span><strong>{user?.referral_code || '—'}</strong></div>
        <button onClick={copyReferral}>Copy</button>
      </section>
      {notice && <div className="profile-notice" role="status">{notice}</div>}

      <div className="section-title profile-section-title">Account</div>
      <section className="profile-menu">
        <div className="profile-menu-item"><span className="menu-icon blue">◉</span><div><b>Personal information</b><small>View your registered account details</small></div><span>›</span></div>
        <div className="profile-menu-item"><span className="menu-icon purple">♙</span><div><b>Withdrawal PIN</b><small>{user?.has_pin ? 'PIN is set' : 'Set a PIN before withdrawing'}</small></div><span className={user?.has_pin ? 'status-good' : 'status-warn'}>{user?.has_pin ? 'Set' : 'Pending'}</span></div>
        <div className="profile-menu-item"><span className="menu-icon orange">▣</span><div><b>Bank accounts</b><small>Manage your payout details</small></div><span>›</span></div>
        <div className="profile-menu-item"><span className="menu-icon green">?</span><div><b>Help &amp; support</b><small>Get assistance with your account</small></div><span>›</span></div>
      </section>

      <button className="profile-logout" onClick={logout}>Log out</button>
    </AppLayout>
  );
}
