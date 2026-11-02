import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

const links = [
  { id: 'overview', label: 'Overview', icon: '▦' },
  { id: 'users', label: 'Users', icon: '♙' },
  { id: 'deposits', label: 'Deposits', icon: '₦' },
  { id: 'withdrawals', label: 'Withdrawals', icon: '↗' },
  { id: 'gateway', label: 'Gateway', icon: '◎' },
  { id: 'packages', label: 'Packages', icon: '▣' },
  { id: 'gift-codes', label: 'Gift code', icon: '✦' },
  { id: 'settings', label: 'Settings', icon: '⚙' }
];

export default function AdminLayout({ children, title }) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const activeTab = String(router.query.tab || 'overview');

  useEffect(() => {
    let mounted = true;
    fetch('/api/admin?section=check', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.isAdmin) throw new Error('Administrator access required.');
        if (mounted) setIsAdmin(true);
      })
      .catch(() => {
        if (mounted) router.replace('/?next=%2Fadmin');
      })
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [router]);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try { await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }); }
    finally { router.replace('/'); }
  }

  if (loading) return <div className="admin-loading-screen"><span className="admin-loader" />Checking administrator access…</div>;
  if (!isAdmin) return null;

  return <div className="admin-shell">
    <header className="admin-topbar">
      <Link href="/admin" className="admin-brand">LEBARA <span>Admin</span></Link>
      <span className="admin-role-badge">ADMIN</span>
      <button type="button" className="admin-signout" onClick={signOut} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
    </header>
    <nav className="admin-tabs" aria-label="Administrator sections">
      {links.map((link) => <Link key={link.id} href={`/admin?tab=${link.id}`} scroll={false} className={`admin-tab ${activeTab === link.id ? 'active' : ''}`}><span aria-hidden="true">{link.icon}</span>{link.label}</Link>)}
    </nav>
    <main className="admin-main">
      {title && <div className="admin-page-heading"><div><span className="admin-eyebrow">LEBARA CONTROL PANEL</span><h1>{title}</h1></div><span className="admin-secure-mark">Session protected</span></div>}
      {children}
    </main>
  </div>;
}
