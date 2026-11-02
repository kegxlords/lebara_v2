import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppIcon } from './Icons';

function PremiumLoader({ error, onRetry }) {
  return (
    <div className="premium-loader" role="status" aria-label="Loading Lebara">
      <div className="loader-orbit"><span>LEBARA</span></div>
      <div className="loader-copy">
        <b>{error ? 'Connection took too long' : 'Preparing your experience'}</b>
        <small>{error || 'Securely loading your account'}</small>
        {error && <button type="button" className="loader-retry" onClick={onRetry}>Try again</button>}
      </div>
    </div>
  );
}

const navItems = [
  { href: '/dashboard', label: 'Home', icon: 'home' },
  { href: '/packages', label: 'Packages', icon: 'packages' },
  { href: '/orders', label: 'Orders', icon: 'orders' },
  { href: '/team', label: 'Team', icon: 'team' },
  { href: '/profile', label: 'My', icon: 'profile' },
];

export default function AppLayout({ children, title = '' }) {
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    async function getAccount() {
      try {
        const res = await fetch('/api/auth', { signal: controller.signal, cache: 'no-store' });
        if (res.status === 401 || res.status === 403) {
          router.replace('/');
          return;
        }
        if (!res.ok) throw new Error('Account service is temporarily unavailable.');
        const data = await res.json();
        if (mounted) { setBalance(Number(data.wallet?.balance) || 0); setLoadError(''); }
      } catch (error) {
        if (mounted) setLoadError(error.name === 'AbortError' ? 'The server did not respond. Check your connection and try again.' : 'Unable to reach your account. Check your connection and try again.');
      } finally {
        clearTimeout(timeout);
        if (mounted) setLoading(false);
      }
    }
    getAccount();
    return () => { mounted = false; clearTimeout(timeout); controller.abort(); };
  }, [router, retryToken]);

  if (loading) return <PremiumLoader />;
  if (loadError) return <PremiumLoader error={loadError} onRetry={() => { setLoadError(''); setLoading(true); setRetryToken((value) => value + 1); }} />;

  return (
    <div className="app-shell premium-shell">
      <header className="top-bar premium-topbar">
        <Link href="/dashboard" className="brand premium-brand"><span className="brand-mark">L</span> LEBARA</Link>
        <Link href="/recharge" className="wallet-pill premium-wallet">₦{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<small>Balance</small></Link>
      </header>

      <main className="content-area premium-content">
        {title && <h1 className="page-title premium-page-title">{title}</h1>}
        {children}
      </main>

      <nav className="bottom-nav premium-nav" aria-label="Primary navigation">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className={`nav-item premium-nav-item ${router.pathname === item.href ? 'active' : ''}`}>
            <span className="nav-glyph"><AppIcon name={item.icon} size={23} /></span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
