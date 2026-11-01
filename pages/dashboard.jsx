import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import Link from 'next/link';
import { useRouter } from 'next/router';

const shortcuts = [
  { label: 'Sign', icon: '↗', className: 'shortcut-red', href: '/recharge' },
  { label: 'My team', icon: '♧', className: 'shortcut-blue', href: '/team' },
  { label: 'Recharge', icon: '▭', className: 'shortcut-orange', href: '/recharge' },
  { label: 'Withdraw', icon: '⇩', className: 'shortcut-purple', href: '/withdraw' },
  { label: 'VIP', icon: '♔', className: 'shortcut-pink', href: '/packages' },
  { label: 'Invite', icon: '♙', className: 'shortcut-magenta', href: '/team' },
  { label: 'Download', icon: '↓', className: 'shortcut-sky', href: '/orders' },
  { label: 'Service', icon: '◖', className: 'shortcut-navy', href: '/profile' },
];

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const res = await fetch('/api/auth', { method: 'GET' });
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/');
            return;
          }
          throw new Error(`API Error: ${res.status}`);
        }
        const json = await res.json();
        if (!json.user || !json.wallet) throw new Error('Invalid response format from server');
        setData(json);
      } catch (err) {
        console.error('Dashboard Fetch Error:', err);
        setError(err.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, [router]);

  if (loading) {
    return <AppLayout><div className="empty-state dashboard-loading"><div className="spinner" />Loading your profile...</div></AppLayout>;
  }

  if (error) {
    return <AppLayout><div className="msg error dashboard-error"><strong>Error:</strong> {error}<br /><br /><button onClick={() => window.location.reload()} className="btn-primary">Retry</button></div></AppLayout>;
  }

  const user = data?.user || {};
  const wallet = data?.wallet || { balance: 0, income_balance: 0 };
  const stats = data?.stats || { activePackages: 0 };

  return (
    <AppLayout>
      <section className="dashboard-hero" aria-label="Lebara promotion">
        <div className="hero-logo-card"><span>LEBARA</span></div>
        <div className="hero-dots"><i /><b /><i /></div>
      </section>

      <div className="deposit-ticker" aria-label="Recent deposits">
        <span>00</span> user <b>M**5 deposited <em>₦1,000</em></b><span>user M**2 deposited</span>
      </div>

      <section className="shortcut-panel" aria-label="Quick actions">
        {shortcuts.map((item) => (
          <Link href={item.href} className="shortcut" key={item.label}>
            <span className={`shortcut-icon ${item.className}`}>{item.icon}</span>
            <strong>{item.label}</strong>
          </Link>
        ))}
      </section>

      <section className="dashboard-summary" aria-label="Account summary">
        <div><span>Recharge balance</span><b>₦{(Number(wallet.balance) || 0).toLocaleString()}</b></div>
        <div><span>Income balance</span><b>₦{(Number(wallet.income_balance) || 0).toLocaleString()}</b></div>
        <div><span>Active packages</span><b>{stats.activePackages}</b></div>
      </section>
    </AppLayout>
  );
}
