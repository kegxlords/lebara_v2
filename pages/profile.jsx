import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Link from 'next/link';
import { useRouter } from 'next/router';

const money = (value) => `₦${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [vip, setVip] = useState({ level: 0, text: 'Build your team to unlock the next level', progress: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth').then((res) => res.ok ? res.json() : null).then((result) => {
      if (!result) throw new Error('Auth failed');
      setData(result);
      const active = Number(result.stats?.activeReferrals) || 0;
      const ladder = [3, 5, 10];
      let level = 0; let next = ladder[0];
      ladder.forEach((threshold, index) => { if (active >= threshold) { level = index + 1; next = ladder[index + 1] || null; } });
      setVip({ level, text: next ? `Invite ${next - active} more activated member${next - active === 1 ? '' : 's'} to reach VIP ${level + 1}` : 'Highest VIP level reached', progress: next ? Math.min(100, active / next * 100) : 100 });
    }).catch(() => router.replace('/')).finally(() => setLoading(false));
  }, [router]);

  async function logout() { await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }); router.replace('/'); }
  if (loading) return <AppLayout><div className="premium-inline-loader">Loading your account…</div></AppLayout>;
  if (!data) return null;
  const user = data.user || {}; const wallet = data.wallet || {}; const stats = data.stats || {};
  const first = (user.full_name || 'Member').charAt(0).toUpperCase();

  return <AppLayout title="My account">
    <section className="profile-premium-header"><div className="profile-premium-avatar">{first}</div><div><span className="eyebrow">LEBARA MEMBER</span><h1>{user.full_name || 'Member'}</h1><p>{user.phone || 'Verified account'} · ID {String(user.id || '').slice(0, 8)}</p></div><span className="profile-level">VIP {vip.level}</span></section>
    <section className="profile-wallet-card"><div><span>Total balance</span><strong>{money(wallet.balance)}</strong></div><div><span>Income balance</span><b>{money(wallet.income_balance)}</b></div><div><span>Active referrals</span><b>{stats.activeReferrals || 0}</b></div></section>
    <section className="profile-vip-card"><div className="profile-vip-top"><div><span className="eyebrow">MEMBER STATUS</span><h2>VIP Level {vip.level}</h2></div><Link href="/team">Grow your team ›</Link></div><p>{vip.text}</p><div className="profile-vip-progress"><span style={{ width: `${vip.progress}%` }} /></div></section>
    <div className="profile-section-heading"><span className="eyebrow">ACCOUNT & SECURITY</span><h2>Manage your account</h2></div>
    <section className="profile-settings-list"><Link href="/bank-cards" className="profile-setting"><span className="setting-icon bank">▣</span><div><b>Bank cards</b><small>Add or manage your payout accounts</small></div><strong>›</strong></Link><Link href="/withdrawal-password" className="profile-setting"><span className="setting-icon lock">⌁</span><div><b>Withdrawal security</b><small>Set or change your withdrawal PIN</small></div><strong>›</strong></Link><Link href="/sign" className="profile-setting"><span className="setting-icon reward">✦</span><div><b>Daily rewards</b><small>Keep your 30-day streak alive</small></div><strong>›</strong></Link><Link href="/history" className="profile-setting"><span className="setting-icon history">↺</span><div><b>Transaction history</b><small>Review deposits, earnings and payouts</small></div><strong>›</strong></Link><Link href="/support" className="profile-setting"><span className="setting-icon help">?</span><div><b>Customer service</b><small>Get help from the Lebara team</small></div><strong>›</strong></Link></section>
    <section className="profile-quick-links"><Link href="/recharge">Add funds <span>＋</span></Link><Link href="/withdraw">Withdraw <span>↗</span></Link><Link href="/download">Get app <span>↓</span></Link></section>
    <button className="profile-logout" onClick={logout}>Sign out securely <span>↗</span></button>
  </AppLayout>;
}
