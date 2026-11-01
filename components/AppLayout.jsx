import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

function PremiumLoader() {
  return (
    <div className="premium-loader" role="status" aria-label="Loading Lebara">
      <div className="loader-orbit"><span>LEBARA</span></div>
      <div className="loader-copy"><b>Preparing your experience</b><small>Securely loading your account</small></div>
    </div>
  );
}

const navItems = [
  { href: '/dashboard', label: 'Home', icon: '⌂' },
  { href: '/packages', label: 'Plans', icon: '▣' },
  { href: '/orders', label: 'Orders', icon: '▤' },
  { href: '/team', label: 'Team', icon: '♧' },
  { href: '/profile', label: 'My', icon: '◉' },
];

export default function AppLayout({ children, title = '' }) {
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function getAccount() {
      try {
        const res = await fetch('/api/auth');
        if (!res.ok) {
          router.replace('/');
          return;
        }
        const data = await res.json();
        if (mounted) setBalance(Number(data.wallet?.balance) || 0);
      } catch (error) {
        console.error(error);
        if (mounted) router.replace('/');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    getAccount();
    return () => { mounted = false; };
  }, [router]);

  if (loading) return <PremiumLoader />;

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
            <span className="nav-glyph">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
