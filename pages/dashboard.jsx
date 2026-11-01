import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Link from 'next/link';

const actions = [
  { href: '/sign', label: 'Daily sign-in', meta: 'Earn daily', icon: '✦', tone: 'violet' },
  { href: '/team', label: 'My team', meta: 'Invite & earn', icon: '♧', tone: 'blue' },
  { href: '/recharge', label: 'Add funds', meta: 'Fast & secure', icon: '＋', tone: 'orange' },
  { href: '/withdraw', label: 'Withdraw', meta: 'Cash out', icon: '↗', tone: 'purple' },
  { href: '/packages?vip=true', label: 'VIP plans', meta: 'Grow faster', icon: '♛', tone: 'gold' },
  { href: '/download', label: 'Get the app', meta: 'On every device', icon: '↓', tone: 'cyan' },
];

export default function Dashboard() {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch('/api/auth');
        if (!res.ok) throw new Error('Unable to load your account');
        const data = await res.json();
        if (mounted) {
          setAccount(data);
          setShowWelcome(true);
        }
      } catch (err) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  if (loading) return <AppLayout><div className="premium-inline-loader">Loading your dashboard...</div></AppLayout>;
  if (error) return <AppLayout><div className="premium-error"><b>We could not load your account</b><span>{error}</span><button onClick={() => window.location.reload()}>Try again</button></div></AppLayout>;

  const user = account?.user || {};
  const wallet = account?.wallet || {};
  const stats = account?.stats || {};
  const firstName = user.full_name?.split(' ')[0] || 'Member';

  return (
    <AppLayout>
      <section className="premium-greeting"><div><span className="eyebrow">WELCOME BACK</span><h1>Hi, {firstName} <span>✦</span></h1><p>Everything you need, all in one place.</p></div><div className="profile-chip">{firstName.charAt(0).toUpperCase()}</div></section>

      <section className="premium-balance-card">
        <div className="balance-card-top"><span>Total available balance</span><Link href="/history">View history ›</Link></div>
        <strong>₦{(Number(wallet.balance) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
        <div className="balance-card-bottom"><span>Income balance</span><b>₦{(Number(wallet.income_balance) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</b><Link href="/recharge">＋ Add funds</Link></div>
      </section>

      <section className="premium-promo"><div><span className="eyebrow">MEMBER BENEFIT</span><h2>Grow your rewards</h2><p>Invite friends and unlock higher VIP earnings.</p><Link href="/team">Explore team rewards <span>→</span></Link></div><div className="promo-orb">✦</div></section>

      <div className="premium-section-heading"><div><span className="eyebrow">QUICK ACCESS</span><h2>What would you like to do?</h2></div><Link href="/support">Help ›</Link></div>
      <section className="premium-action-grid">
        {actions.map((action) => <Link href={action.href} key={action.label} className="premium-action"><span className={`action-icon ${action.tone}`}>{action.icon}</span><b>{action.label}</b><small>{action.meta}</small></Link>)}
      </section>

      <section className="premium-stats-row"><div><b>{stats.activePackages || 0}</b><span>Active plans</span></div><div><b>{user.referral_code || '—'}</b><span>Referral code</span></div><div><b>VIP {stats.vipLevel || 0}</b><span>Current level</span></div></section>

      {showWelcome && <div className="premium-modal-backdrop" role="dialog" aria-modal="true"><div className="premium-modal"><button className="modal-close" onClick={() => setShowWelcome(false)} aria-label="Close">×</button><div className="modal-sparkle">✦</div><span className="eyebrow">LEBARA MEMBER UPDATE</span><h2>Welcome to your premium space</h2><p>Stay consistent, collect daily rewards, and unlock more value from your account.</p><Link href="/sign" className="modal-primary" onClick={() => setShowWelcome(false)}>View daily rewards →</Link><button className="modal-secondary" onClick={() => setShowWelcome(false)}>Maybe later</button></div></div>}
    </AppLayout>
  );
}
